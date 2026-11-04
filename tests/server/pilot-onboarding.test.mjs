import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { loadProjectRegistry } from '../../src/core/project-registry.mjs';
import { resolveProjectRun } from '../../src/core/project-runner.mjs';
import { auditPilotProjects } from '../../src/core/pilot-audit.mjs';
import { isReadOnlyOriginRequest } from '../../src/web/read-only-policy.mjs';
import { resolveCiSelection } from '../../scripts/ci-project.mjs';

const profiles = loadProjectRegistry();
const pilotSelection = (projectId, host, suite = 'smoke', browser = 'all') => resolveProjectRun({
  projectId, environment: 'staging', suite, browser,
}, { remoteOptIn: true, environmentVariables: { QA_REMOTE_APPROVAL: host } });

test('Module 9: real online practice API and website have independent, read-only profiles', () => {
  const api = profiles.find((project) => project.id === 'pilot-jsonplaceholder');
  const web = profiles.find((project) => project.id === 'pilot-the-internet');
  assert.equal(api.type, 'api');
  assert.equal(web.type, 'web');
  assert.equal(api.environments.staging.readOnly, true);
  assert.equal(web.environments.staging.readOnly, true);
  assert.deepEqual(api.allowedHosts, ['jsonplaceholder.typicode.com']);
  assert.deepEqual(web.allowedHosts, ['the-internet.herokuapp.com']);
  assert.equal(api.credentialEnv.token, undefined);
  assert.equal(web.credentialEnv.username, undefined);
});

test('Module 9: external runs require exact explicit approval and are restricted to safe tests', () => {
  for (const [id, host, suite, browser] of [
    ['pilot-jsonplaceholder','jsonplaceholder.typicode.com','api','all'],
    ['pilot-the-internet','the-internet.herokuapp.com','smoke','chromium'],
  ]) {
    assert.throws(() => resolveProjectRun({ projectId: id, environment: 'staging', suite, browser }), /requires --allow-remote/);
    assert.throws(() => resolveProjectRun({ projectId: id, environment: 'staging', suite, browser }, {
      remoteOptIn: true, environmentVariables: { QA_REMOTE_APPROVAL: 'wrong.example.org' },
    }), /exact approved host/);
    const selected = pilotSelection(id, host, suite, browser);
    assert.equal(selected.remote, true);
    assert.equal(selected.restricted, true);
    assert.match(selected.testDir.replaceAll('\\', '/'), new RegExp(`projects/${id}/tests/safe$`));
  }
});

test('Module 9: audit maps 16 pilot requirements to actual project-specific Playwright tests', () => {
  const audits = auditPilotProjects();
  assert.equal(audits.length, 2);
  assert.equal(audits.reduce((sum, item) => sum + item.cases, 0), 16);
  assert.notEqual(audits[0].host, audits[1].host);
});

test('Module 9: browser requests are constrained to GET/HEAD on exact HTTPS origin', () => {
  const host = 'https://the-internet.herokuapp.com/';
  assert.equal(isReadOnlyOriginRequest(host, 'https://the-internet.herokuapp.com/checkboxes', 'GET'), true);
  assert.equal(isReadOnlyOriginRequest(host, 'https://the-internet.herokuapp.com/assets/app.css', 'HEAD'), true);
  for (const [url, method] of [
    ['http://the-internet.herokuapp.com/','GET'],
    ['https://the-internet.herokuapp.com.evil.test/','GET'],
    ['https://example.org/','GET'],
    ['https://the-internet.herokuapp.com/form_authentication','POST'],
    ['https://the-internet.herokuapp.com/','DELETE'],
    ['file:///etc/passwd','GET'],
  ]) assert.equal(isReadOnlyOriginRequest(host, url, method), false);
});

test('Module 9: remotely approved pilots cannot be executed by unattended CI dispatcher', () => {
  for (const projectId of ['pilot-jsonplaceholder','pilot-the-internet']) {
    assert.throws(() => resolveCiSelection({
      GITHUB_EVENT_NAME: 'workflow_dispatch', QA_CI_PROJECT: projectId,
      QA_CI_ENVIRONMENT: 'staging', QA_CI_SUITE: 'smoke', QA_CI_BROWSER: 'all',
      QA_REMOTE_APPROVAL: 'jsonplaceholder.typicode.com', QA_ALLOW_REMOTE: '1',
    }), /requires --allow-remote/);
  }
});

test('Module 9: pilot validation command never sends requests', () => {
  const result = spawnSync(process.execPath, ['scripts/pilot-audit.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /16|8 mapped/);
  assert.match(result.stdout, /NOT executed/);
});
