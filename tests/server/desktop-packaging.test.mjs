import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

const root = process.cwd();
const desktop = JSON.parse(readFileSync(join(root, 'desktop', 'package.json'), 'utf8'));
const main = readFileSync(join(root, 'desktop', 'main.mjs'), 'utf8');
const prepare = readFileSync(join(root, 'desktop', 'scripts', 'prepare.mjs'), 'utf8');
const workflow = readFileSync(join(root, '.github', 'workflows', 'windows-installer.yml'), 'utf8');

test('Windows installer uses NSIS and does not automatically publish a GitHub Release', () => {
  assert.deepEqual(desktop.build.win.target, ['nsis']);
  assert.equal(desktop.build.publish, null);
  assert.match(workflow, /upload-artifact@v4/);
  assert.doesNotMatch(workflow, /gh release create|softprops\/action-gh-release/);
  assert.match(workflow, /windows-latest/);
});

test('desktop renderer is sandboxed, user data is writable and runner stays on loopback', () => {
  for (const marker of [
    'DASHBOARD_PORT:', 'app.getPath', 'nodeIntegration: false',
    'sandbox: true', 'contextIsolation: true',
    'QA_REMOTE_APPROVAL:', 'taskkill',
  ]) assert.ok(main.includes(marker), 'Missing runtime safety policy: ' + marker);
});

test('runtime staging ships approved fixture code but not private history or secrets', () => {
  for (const marker of ['demo-app', 'src', 'tests', 'projects', 'playwright-core', 'node.exe']) {
    assert.ok(prepare.includes(marker), 'Runtime missing ' + marker);
  }
  assert.doesNotMatch(workflow, /QA_REMOTE_APPROVAL:\s+[a-z0-9]/i);
});
