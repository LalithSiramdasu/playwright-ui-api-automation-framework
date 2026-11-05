/** Tests the packaged runtime, with fresh temporary data and a real API suite. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, delimiter } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

if (process.platform !== 'win32') throw Error('This packaged installer smoke test requires Windows.');
const runtime = resolve(process.argv[2] ?? 'desktop/dist/win-unpacked/resources/qa-runtime');
const node = join(runtime, 'bin', 'node.exe');
const data = mkdtempSync(join(tmpdir(), 'qa-desktop-packaged-'));
const browsers = join(runtime, 'browsers');
for (const file of [
  node, join(runtime, 'dashboard', 'server.mjs'),
  join(runtime, 'dashboard', 'dist', 'index.html'),
  join(runtime, 'node_modules', 'playwright', 'cli.js'),
]) assert.ok(existsSync(file), 'Missing packaged runtime file: ' + file);
assert.equal(statSync(browsers).isDirectory(), true);
const env = {
  ...process.env, DASHBOARD_PORT: '0', DASHBOARD_DATA_DIR: data,
  QA_DESKTOP_MODE: '1', QA_REMOTE_APPROVAL: '',
  PLAYWRIGHT_BROWSERS_PATH: browsers,
  PATH: join(runtime, 'bin') + delimiter + (process.env.PATH ?? ''),
};
const child = spawn(node, [join(runtime, 'dashboard', 'server.mjs')], {
  cwd: runtime, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let errors = '';
try {
  const base = await new Promise((ok, fail) => {
    const timeout = setTimeout(() => fail(Error('Local packaged server timeout: ' + errors)), 25000);
    child.once('error', fail);
    child.once('exit', code => fail(Error('Server exited ' + code + ': ' + errors)));
    let output = '';
    child.stdout.on('data', chunk => {
      output = (output + String(chunk)).slice(-2000);
      const match = output.match(/QA Control Center listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); ok(match[1]); }
    });
    child.stderr.on('data', chunk => { errors = (errors + String(chunk)).slice(-2500); });
  });
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.dependenciesReady, true);
  const projects = await (await fetch(base + '/api/projects')).json();
  assert.ok(projects.projects.some(x => x.id === 'sample-api' && x.enabled));
  assert.match(await (await fetch(base + '/')).text(), /QA Control Center/i);
  const response = await fetch(base + '/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'all' }),
  });
  assert.equal(response.status, 202, 'Run was rejected: ' + await response.text());
  const started = (await response.json()).run;
  const limit = Date.now() + 120000;
  let finished;
  while (Date.now() < limit) {
    await sleep(1600);
    const current = await fetch(base + '/api/runs/' + started.id);
    assert.equal(current.status, 200);
    finished = (await current.json()).run;
    if (!['running', 'cancelling'].includes(finished.status)) break;
  }
  assert.equal(finished?.status, 'passed', JSON.stringify(finished?.logs?.slice(-30)));
  assert.equal(finished.counts?.total, 18);
  assert.equal(finished.counts.failed, 0);
  assert.equal(finished.reportAvailable, true);
  const html = await fetch(base + '/reports/' + started.id + '/');
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Playwright/i);
  const persisted = JSON.parse(readFileSync(join(data, 'runs.json'), 'utf8'));
  assert.equal(persisted[0].counts.passed, 18);
  console.log('PASS: packaged runtime executed 18/18 Sample API tests.');
  console.log('PASS: offline-capable Node process, local HTML report and isolated user history.');
} finally {
  if (child.pid) {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true,
    });
    await new Promise(resolve => killer.once('exit', resolve));
  }
  rmSync(data, { recursive: true, force: true });
}
