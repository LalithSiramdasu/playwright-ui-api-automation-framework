/** Local-only orchestration API for the QA dashboard. No arbitrary shell commands. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUITES, summarizeReport } from './reporting.mjs';

const dashboardDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dashboardDir, '..');
const dataDir = join(dashboardDir, 'data');
const artifactDir = join(dataDir, 'artifacts');
const historyFile = join(dataDir, 'runs.json');
const distDir = join(dashboardDir, 'dist');
const playwrightCli = join(root, 'node_modules', 'playwright', 'cli.js');
const port = Number(process.env.DASHBOARD_PORT ?? 4300);
const MAX_RUNS = 100;
const MAX_LOG_LINES = 350;
mkdirSync(artifactDir, { recursive: true });

let runs = [];
try {
  const parsed = JSON.parse(readFileSync(historyFile, 'utf8'));
  if (Array.isArray(parsed)) runs = parsed.slice(0, MAX_RUNS);
} catch { /* Fresh installation, no saved runs. */ }
for (const run of runs) {
  if (run.status === 'running') {
    run.status = 'interrupted';
    run.finishedAt = new Date().toISOString();
    run.logs = [...(run.logs ?? []), 'Dashboard restarted before this run finished.'].slice(-MAX_LOG_LINES);
  }
}
const save = () => writeFileSync(historyFile, JSON.stringify(runs.slice(0, MAX_RUNS), null, 2));
save();
let activeProcess = null;
let activeId = null;

function send(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function appendLog(run, chunk) {
  const lines = String(chunk).replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).filter(Boolean);
  run.logs.push(...lines);
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
function startRun(suite, browser) {
  const run = {
    id: randomUUID(), suite, browser, status: 'running', startedAt: new Date().toISOString(),
    finishedAt: null, durationMs: 0, counts: null, cases: [], logs: [], exitCode: null,
  };
  runs.unshift(run);
  runs = runs.slice(0, MAX_RUNS);
  activeId = run.id;
  save();
  const folder = join(artifactDir, run.id);
  const htmlDir = join(folder, 'html');
  mkdirSync(folder, { recursive: true });
  const args = [playwrightCli, 'test'];
  if (suite === 'api') args.push('tests/api');
  if (suite === 'ui') args.push('tests/ui');
  if (['smoke', 'regression', 'negative', 'accessibility'].includes(suite)) args.push('--grep', `@${suite}`);
  if (suite !== 'api' && browser !== 'all') args.push(`--project=${browser}`);
  args.push('--reporter=line,json,html', '--output', join(folder, 'test-results'));
  appendLog(run, `Executing: Playwright ${suite} suite (${browser})`);
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: {
      ...process.env, CI: 'true', FORCE_COLOR: '0',
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
      run.cases = summary.cases;
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
    if (req.method === 'GET' && pathname === '/api/runs') {
      return send(res, 200, { runs: runs.map(recordForList), activeId });
    }
    if (req.method === 'GET' && segments[0] === 'api' && segments[1] === 'runs' && segments.length === 3) {
      const run = runs.find((candidate) => candidate.id === segments[2]);
      return run ? send(res, 200, { run }) : send(res, 404, { error: 'Run not found' });
    }
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
        return send(res, 403, { error: 'Untrusted origin' });
      }
      if (pathname === '/api/runs') {
        const body = await parseBody(req);
        const suite = body?.suite;
        const browser = body?.browser ?? 'all';
        if (!SUITES.some((item) => item.id === suite) || !['all', 'chromium', 'firefox', 'webkit'].includes(browser)) {
          return send(res, 400, { error: 'Unsupported suite or browser' });
        }
        if (suite === 'api' && browser !== 'all') return send(res, 400, { error: 'API suite does not use a browser' });
        if (activeProcess) return send(res, 409, { error: 'Another suite is already running' });
        if (!existsSync(playwrightCli)) return send(res, 409, { error: 'Playwright is not installed. Run npm install at repository root.' });
        const run = startRun(suite, browser);
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
      if (!/^[0-9a-f-]{36}$/.test(id) || !runs.some((run) => run.id === id)) return send(res, 404, { error: 'Unknown run' });
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
