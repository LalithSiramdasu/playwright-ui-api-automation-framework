/** Local-only orchestration API for the QA dashboard. No arbitrary shell commands. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, createReadStream, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUITES, summarizeReport } from './reporting.mjs';
import { historyForScope, summarizeHistory, compareRuns, exportJson, exportCsv } from './analytics.mjs';
import { loadRunHistory, saveRunHistory } from './storage.mjs';
import { loadProjectRegistry } from '../src/core/project-registry.mjs';
import { configuredSecretValues, redactSensitiveText } from '../src/core/redaction.mjs';
import { resolveProjectRun, makePlaywrightArguments, selectionEnvironment, RunConfigurationError } from '../src/core/project-runner.mjs';

const dashboardDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dashboardDir, '..');
const dataDir = process.env.DASHBOARD_DATA_DIR ? resolve(process.env.DASHBOARD_DATA_DIR) : join(dashboardDir, 'data');
const artifactDir = join(dataDir, 'artifacts');
const historyFile = join(dataDir, 'runs.json');
const distDir = join(dashboardDir, 'dist');
const playwrightCli = join(root, 'node_modules', 'playwright', 'cli.js');
const port = Number(process.env.DASHBOARD_PORT ?? 4300);
const MAX_RUNS = 100;
const MAX_LOG_LINES = 350;
const VALID_RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
mkdirSync(artifactDir, { recursive: true });

const secretValues = configuredSecretValues();
const redact = (value) => redactSensitiveText(value, secretValues);
let runs = loadRunHistory(historyFile, MAX_RUNS);
for (const run of runs) {
  run.logs = (run.logs ?? []).map(redact);
  run.cases = (run.cases ?? []).map((item) => ({ ...item, error: redact(item.error ?? '') }));
  if (run.status === 'running') {
    run.status = 'interrupted';
    run.finishedAt = new Date().toISOString();
    run.logs = [...(run.logs ?? []), 'Dashboard restarted before this run finished.'].slice(-MAX_LOG_LINES);
  }
}
const save = () => saveRunHistory(historyFile, runs, MAX_RUNS);
function removeArtifact(id) {
  if (!VALID_RUN_ID.test(id)) return; // never derive a filesystem path from an untrusted ID
  rmSync(join(artifactDir, id), { recursive: true, force: true });
}
function removeHistory(predicate) {
  const deleted = runs.filter(predicate);
  for (const run of deleted) removeArtifact(run.id);
  runs = runs.filter((run) => !predicate(run));
  save();
  return deleted.length;
}
function validScope(projectId, environment) {
  if (typeof projectId !== 'string' || typeof environment !== 'string') return false;
  return loadProjectRegistry().some((project) => project.id === projectId &&
    Object.prototype.hasOwnProperty.call(project.environments, environment));
}
function sendDownload(res, format, payload, projectId, environment) {
  const mime = format === 'csv' ? 'text/csv' : 'application/json';
  const safeName = `${projectId}-${environment}-qa-runs.${format}`;
  res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`,
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(payload);
}
function trustedOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${req.headers.host}`;
}
save();
let activeProcess = null;
let activeId = null;

function send(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function appendLog(run, chunk) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
  const lines = String(chunk).replace(ansi, '').split(/\r?\n/).filter(Boolean);
  run.logs.push(...lines.map(redact));
  if (run.logs.length > MAX_LOG_LINES) run.logs.splice(0, run.logs.length - MAX_LOG_LINES);
}
function safePath(base, requestPath) {
  const target = resolve(base, requestPath);
  const difference = relative(base, target);
  return difference === '' || (!isAbsolute(difference) && difference !== '..' && !difference.startsWith(`..${sep}`)) ? target : null;
}
function serveFile(res, file) {
  if (!existsSync(file)) return send(res, 404, { error: 'File not found' });
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  }[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}
async function parseBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > 16_384) throw Error('Request body too large');
  }
  try { return JSON.parse(body); } catch { throw Error('Invalid JSON request'); }
}
function recordForList(run) {
  const summary = { ...run };
  delete summary.logs;
  delete summary.cases;
  return summary;
}
function startRun(selection) {
  const { suite, browser, projectId, environment } = selection;
  const run = {
    id: randomUUID(), suite, browser, projectId, environment, status: 'running', startedAt: new Date().toISOString(),
    finishedAt: null, durationMs: 0, counts: null, cases: [], logs: [], exitCode: null,
  };
  runs.unshift(run);
  const evicted = runs.slice(MAX_RUNS);
  runs = runs.slice(0, MAX_RUNS);
  for (const expired of evicted) removeArtifact(expired.id);
  activeId = run.id;
  save();
  const folder = join(artifactDir, run.id);
  const htmlDir = join(folder, 'html');
  mkdirSync(folder, { recursive: true });
  const args = [playwrightCli, ...makePlaywrightArguments(selection)];
  args.push('--reporter=line,json,html', '--output', join(folder, 'test-results'));
  appendLog(run, `Executing: ${projectId}/${environment} — Playwright ${suite} suite (${browser})`);
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: {
      ...selectionEnvironment(selection), CI: 'true', FORCE_COLOR: '0',
      PLAYWRIGHT_JSON_OUTPUT_FILE: join(folder, 'results.json'),
      PLAYWRIGHT_HTML_OUTPUT_DIR: htmlDir, PLAYWRIGHT_HTML_OPEN: 'never',
    },
    shell: false,
    windowsHide: true,
  });
  activeProcess = child;
  child.stdout.on('data', (chunk) => appendLog(run, chunk));
  child.stderr.on('data', (chunk) => appendLog(run, chunk));
  let finalized = false;
  function finish(code, error) {
    if (finalized) return;
    finalized = true;
    const wasCancelled = run.status === 'cancelling';
    run.exitCode = code;
    run.finishedAt = new Date().toISOString();
    run.durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    run.status = wasCancelled ? 'cancelled' : code === 0 ? 'passed' : 'failed';
    if (error) appendLog(run, error);
    try {
      const summary = summarizeReport(JSON.parse(readFileSync(join(folder, 'results.json'), 'utf8')));
      run.cases = summary.cases.map((item) => ({ ...item, error: redact(item.error) }));
      run.counts = summary.counts;
    } catch { appendLog(run, 'JSON result unavailable. See log above for the execution error.'); }
    run.reportAvailable = existsSync(join(htmlDir, 'index.html'));
    appendLog(run, `Run finished: ${run.status} (exit ${code ?? 'unknown'}).`);
    if (activeId === run.id) { activeId = null; activeProcess = null; }
    save();
  }
  child.on('error', (error) => finish(null, error.message));
  child.on('close', (code) => finish(code));
  return run;
}

const server = createServer(async (req, res) => {
  try {
    const host = String(req.headers.host ?? '');
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(res, 403, { error: 'Local dashboard only' });
    const url = new URL(req.url, `http://${host}`);
    const pathname = decodeURIComponent(url.pathname);
    const segments = pathname.split('/').filter(Boolean);
    if (req.method === 'GET' && pathname === '/api/health') {
      return send(res, 200, { status: 'ok', dependenciesReady: existsSync(playwrightCli), node: process.version, activeId });
    }
    if (req.method === 'GET' && pathname === '/api/suites') return send(res, 200, { suites: SUITES });
    if (req.method === 'GET' && pathname === '/api/projects') {
      const projects = loadProjectRegistry().map(({ id, name, type, enabled, environments, suites }) => ({
        id, name, type, enabled, environments: Object.keys(environments), suites,
        environmentDetails: Object.entries(environments).map(([environmentId, target]) => ({
          id: environmentId,
          readOnly: target.readOnly,
          remote: [target.webBaseUrl, target.apiBaseUrl].filter(Boolean).some((value) =>
            !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)),
        })),
      }));
      return send(res, 200, { projects, executionMode: 'project-aware' });
    }
    if (req.method === 'GET' && (pathname === '/api/analytics' || pathname === '/api/exports')) {
      const projectId = url.searchParams.get('projectId');
      const environment = url.searchParams.get('environment');
      if (!validScope(projectId, environment)) return send(res, 400, { error: 'Unknown project or environment' });
      const scoped = historyForScope(runs, projectId, environment);
      if (pathname === '/api/analytics') return send(res, 200, { projectId, environment, summary: summarizeHistory(scoped) });
      const format = url.searchParams.get('format');
      if (!['csv', 'json'].includes(format)) return send(res, 400, { error: 'Export must be csv or json' });
      return sendDownload(res, format, format === 'csv' ? exportCsv(scoped) : exportJson(scoped), projectId, environment);
    }
    if (req.method === 'GET' && segments[0] === 'api' && segments[1] === 'runs' && segments[3] === 'compare' && segments.length === 4) {
      const newer = runs.find((run) => run.id === segments[2]);
      const older = runs.find((run) => run.id === url.searchParams.get('with'));
      if (!newer || !older) return send(res, 404, { error: 'Comparison run not found' });
      try { return send(res, 200, { comparison: compareRuns(older, newer) }); }
      catch (error) { return send(res, 400, { error: error.message }); }
    }
    if (req.method === 'DELETE') {
      if (!trustedOrigin(req)) return send(res, 403, { error: 'Untrusted origin' });
      if (activeProcess) return send(res, 409, { error: 'Stop active execution before deleting history' });
      if (segments[0] === 'api' && segments[1] === 'runs' && segments.length === 3) {
        const id = segments[2];
        const run = runs.find((item) => item.id === id);
        if (!VALID_RUN_ID.test(id) || !run) return send(res, 404, { error: 'Run not found' });
        const body = await parseBody(req);
        if (body?.confirm !== id) return send(res, 400, { error: 'Confirmation must match the run ID' });
        return send(res, 200, { deleted: removeHistory((item) => item.id === id) });
      }
      if (pathname === '/api/history') {
        const body = await parseBody(req);
        if (!validScope(body?.projectId, body?.environment)) return send(res, 400, { error: 'Invalid project or environment' });
        if (body?.confirm !== 'DELETE HISTORY') return send(res, 400, { error: 'Type DELETE HISTORY to confirm' });
        const scoped = (run) => historyForScope([run], body.projectId, body.environment).length === 1;
        return send(res, 200, { deleted: removeHistory(scoped), projectId: body.projectId, environment: body.environment });
      }
      return send(res, 404, { error: 'Endpoint not found' });
    }
    if (req.method === 'GET' && pathname === '/api/runs') {
      const projectId = url.searchParams.get('projectId');
      const environment = url.searchParams.get('environment');
      if (projectId !== null || environment !== null) {
        if (!validScope(projectId, environment)) return send(res, 400, { error: 'Unknown project or environment' });
      }
      const requested = projectId === null ? runs : historyForScope(runs, projectId, environment);
      return send(res, 200, { runs: requested.map(recordForList), activeId });
    }
    if (req.method === 'GET' && segments[0] === 'api' && segments[1] === 'runs' && segments.length === 3) {
      const run = runs.find((candidate) => candidate.id === segments[2]);
      return run ? send(res, 200, { run }) : send(res, 404, { error: 'Run not found' });
    }
    if (req.method === 'POST') {
      if (!trustedOrigin(req)) {
        return send(res, 403, { error: 'Untrusted origin' });
      }
      if (pathname === '/api/runs') {
        const body = await parseBody(req);
        // Older dashboard clients omit projectId/environment; default to Northline/local.
        // Reject arbitrary input fields rather than forwarding them to Playwright.
        let selection;
        try {
          selection = resolveProjectRun(body);
        } catch (error) {
          if (error instanceof RunConfigurationError) return send(res, 400, { error: error.message });
          throw error;
        }
        if (activeProcess) return send(res, 409, { error: 'Another suite is already running' });
        if (!existsSync(playwrightCli)) return send(res, 409, { error: 'Playwright is not installed. Run npm install at repository root.' });
        const run = startRun(selection);
        return send(res, 202, { run: recordForList(run) });
      }
      if (segments[0] === 'api' && segments[1] === 'runs' && segments[3] === 'cancel' && segments.length === 4) {
        const run = runs.find((candidate) => candidate.id === segments[2]);
        if (!run || activeId !== run.id || !activeProcess) return send(res, 404, { error: 'No active run with that ID' });
        run.status = 'cancelling';
        appendLog(run, 'Cancellation requested by user.');
        activeProcess.kill();
        return send(res, 202, { run: recordForList(run) });
      }
      return send(res, 404, { error: 'Endpoint not found' });
    }
    if (req.method === 'GET' && segments[0] === 'reports' && segments.length >= 2) {
      const id = segments[1];
      if (!VALID_RUN_ID.test(id) || !runs.some((run) => run.id === id)) return send(res, 404, { error: 'Unknown run' });
      const base = join(artifactDir, id, 'html');
      const path = safePath(base, segments.slice(2).join('/') || 'index.html');
      return path ? serveFile(res, path) : send(res, 403, { error: 'Invalid path' });
    }
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      const target = safePath(distDir, pathname === '/' ? 'index.html' : pathname.slice(1));
      const file = target && existsSync(target) ? target : join(distDir, 'index.html');
      if (existsSync(file)) return serveFile(res, file);
      return send(res, 503, { error: 'Dashboard build missing. Run npm run dashboard:setup then npm run dashboard:build.' });
    }
    return send(res, 404, { error: 'Endpoint not found' });
  } catch (error) {
    const clientError = /Invalid JSON|too large|URI malformed/.test(error.message);
    return send(res, clientError ? 400 : 500, { error: clientError ? error.message : 'Internal dashboard error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`QA Control Center listening at http://127.0.0.1:${server.address().port}`);
});
