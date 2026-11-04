import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveCiSelection, recordCiSelection, WEEKLY_SELECTION } from '../../scripts/ci-project.mjs';

const manual = (overrides = {}) => ({
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  QA_CI_PROJECT: 'sample-api', QA_CI_ENVIRONMENT: 'local',
  QA_CI_SUITE: 'api', QA_CI_BROWSER: 'all', ...overrides,
});

test('Module 8: manual project-aware API run resolves to independent test directory', () => {
  const result = resolveCiSelection(manual());
  assert.equal(result.projectId, 'sample-api');
  assert.match(result.testDir, /projects[\\/]sample-api[\\/]tests$/);
  assert.equal(result.remote, false);
});

test('Module 8: web browser selection supports registered Sample Website', () => {
  const result = resolveCiSelection(manual({
    QA_CI_PROJECT: 'sample-web', QA_CI_SUITE: 'smoke', QA_CI_BROWSER: 'chromium',
  }));
  assert.equal(result.projectType, 'web');
  assert.equal(result.browser, 'chromium');
});

test('Module 8: scheduled run ignores caller selection and uses local safe staging fixture', () => {
  const result = resolveCiSelection(manual({
    GITHUB_EVENT_NAME: 'schedule', QA_CI_PROJECT: 'northline-goods',
    QA_CI_ENVIRONMENT: 'local', QA_CI_SUITE: 'all', QA_CI_BROWSER: 'webkit',
  }));
  assert.equal(result.projectId, WEEKLY_SELECTION.projectId);
  assert.equal(result.environment, 'staging');
  assert.equal(result.restricted, true);
  assert.match(result.testDir, /tests[\\/]safe$/);
});

test('Module 8: incompatible API/browser choice and unsupported suite fail preflight', () => {
  assert.throws(() => resolveCiSelection(manual({ QA_CI_BROWSER: 'firefox' })), /cannot select a browser/);
  assert.throws(() => resolveCiSelection(manual({ QA_CI_PROJECT: 'sample-web', QA_CI_SUITE: 'api' })), /not enabled/);
});

test('Module 8: unregistered project, disabled template and unknown target are refused', () => {
  assert.throws(() => resolveCiSelection(manual({ QA_CI_PROJECT: '../sample-api' })), /invalid id/);
  assert.throws(() => resolveCiSelection(manual({ QA_CI_PROJECT: 'starter-api', QA_CI_ENVIRONMENT: 'staging' })), /disabled/);
  assert.throws(() => resolveCiSelection(manual({ QA_CI_ENVIRONMENT: 'production' })), /Unknown or missing environment/);
});

test('Module 8: only scheduled or manually dispatched events are authorized', () => {
  assert.throws(() => resolveCiSelection(manual({ GITHUB_EVENT_NAME: 'push' })), /Only manual dispatch/);
  assert.throws(() => resolveCiSelection(manual({ GITHUB_EVENT_NAME: 'pull_request' })), /Only manual dispatch/);
});

test('Module 8: CI artifact metadata is scoped and excludes secret environment values', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-ci-evidence-'));
  try {
    const result = resolveCiSelection(manual());
    const meta = recordCiSelection(result, {
      root,
      env: { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: 'a'.repeat(40),
        GITHUB_RUN_ID: '123456', PROJECT_PASSWORD: 'a-super-secret' },
    });
    assert.equal(meta.projectId, 'sample-api');
    assert.equal(meta.github.sha, 'a'.repeat(40));
    const saved = readFileSync(join(root, 'reports', 'ci-selection.json'), 'utf8');
    assert.equal(saved.includes('a-super-secret'), false);
    assert.equal(saved.includes('http://'), false);
    assert.equal(JSON.parse(saved).environment, 'local');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Module 8: preflight CLI can run without npm install or Playwright', () => {
  const command = spawnSync(process.execPath, ['scripts/ci-project.mjs', '--preflight'], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, ...manual() },
  });
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /CI preflight passed/);
});

test('Module 8: CI script never accepts arbitrary shell options', () => {
  const command = spawnSync(process.execPath, ['scripts/ci-project.mjs', '--shell', 'curl https://unknown.test'], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, ...manual() },
  });
  assert.equal(command.status, 1);
  assert.match(command.stderr, /arbitrary arguments are not accepted/);
});
