import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { after, test } from 'node:test';
import {
  REPOSITORY_ROOT, resolveProjectRun, makePlaywrightArguments, selectionEnvironment, RunConfigurationError,
} from '../../src/core/project-runner.mjs';
import { loadProjectRegistry, validateProjectProfile } from '../../src/core/project-registry.mjs';

const temps = [];
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const makeTemp = () => { const dir = mkdtempSync(join(tmpdir(), 'qa-isolation-')); temps.push(dir); return dir; };

const local = (projectId, suite = 'all', browser = 'all') => resolveProjectRun({
  projectId, environment: 'local', suite, browser,
});

test('Module 2: resolves two projects into disjoint test directories and target URLs', () => {
  const northline = local('northline-goods');
  const api = local('sample-api');
  assert.equal(northline.projectType, 'hybrid');
  assert.equal(api.projectType, 'api');
  assert.notEqual(northline.testDir, api.testDir);
  assert.equal(basename(northline.testDir), 'tests');
  assert.equal(relative(REPOSITORY_ROOT, api.testDir).split(sep).join('/'), 'projects/sample-api/tests');
  assert.equal(northline.webBaseUrl, 'http://127.0.0.1:4173/');
  assert.equal(api.apiBaseUrl, 'http://127.0.0.1:4174/');
});

test('Module 2: builds fixed, project-specific Playwright switches', () => {
  assert.deepEqual(makePlaywrightArguments(local('northline-goods', 'ui', 'all')), [
    'test', '--project=chromium', '--project=firefox', '--project=webkit',
  ]);
  assert.deepEqual(makePlaywrightArguments(local('northline-goods', 'smoke', 'chromium')), [
    'test', '--grep', '@smoke', '--project=chromium',
  ]);
  assert.deepEqual(makePlaywrightArguments(local('sample-api', 'negative')), [
    'test', '--grep', '@negative', '--project=api',
  ]);
  assert.deepEqual(makePlaywrightArguments(local('northline-goods', 'api')), [
    'test', '--project=api',
  ]);
});

test('Module 2: rejects disabled projects and unknown environments and suites', () => {
  for (const options of [
    { projectId: 'starter-api', environment: 'staging', suite: 'api' },
    { projectId: 'unknown-id', environment: 'local' },
    { projectId: '../sample-api', environment: 'local' },
    { projectId: 'sample-api', environment: 'production' },
    { projectId: 'sample-api', environment: 'local', suite: 'ui' },
    { projectId: 'sample-api', environment: 'local', suite: 'accessibility' },
    { projectId: 'sample-api', environment: 'local', suite: 'api', browser: 'firefox' },
    { projectId: 'northline-goods', environment: 'local', suite: 'api', browser: 'chromium' },
    { projectId: 'northline-goods', environment: 'local', browser: '--config=/tmp/evil' },
    { projectId: 'northline-goods', environment: 'local', suite: 'all', command: 'whoami' },
  ]) assert.throws(() => resolveProjectRun(options), RunConfigurationError);
});

test('Module 2: read-only remote environments are fail-closed', () => {
  const registry = loadProjectRegistry().filter((p) => p.id === 'northline-goods');
  const remote = validateProjectProfile({
    schemaVersion: 1,
    id: 'pilot-api', name: 'Pilot API', type: 'api', enabled: true,
    allowedHosts: ['api.example.test'],
    environments: { staging: { apiBaseUrl: 'https://api.example.test/', readOnly: true } },
    suites: ['api'], credentialEnv: {},
  });
  assert.throws(() => resolveProjectRun({ projectId: 'pilot-api', environment: 'staging', suite: 'api' }, { registry: [...registry, remote] }), /read-only/);
});

test('Module 2: writable remote environments are blocked pending safety controls', () => {
  const remote = validateProjectProfile({
    schemaVersion: 1, id: 'pilot-api', name: 'Pilot API', type: 'api', enabled: true,
    allowedHosts: ['api.example.test'],
    environments: { staging: { apiBaseUrl: 'https://api.example.test/', readOnly: false } },
    suites: ['api'], credentialEnv: {},
  });
  assert.throws(() => resolveProjectRun({ projectId: 'pilot-api', environment: 'staging', suite: 'api' }, { registry: [remote] }), /only explicitly configured local fixtures/);
});

test('Module 2: refuses symlinked test directories outside checkout', (context) => {
  const root = makeTemp();
  const out = makeTemp();
  mkdirSync(join(root, 'projects', 'sample-api'), { recursive: true });
  mkdirSync(join(out, 'api'), { recursive: true });
  writeFileSync(join(out, 'api', 'bad.spec.ts'), 'throw Error("outside");\n');
  try {
    symlinkSync(out, join(root, 'projects', 'sample-api', 'tests'), 'dir');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') return context.skip('Windows symlink permission unavailable');
    throw error;
  }
  assert.throws(() => resolveProjectRun({ projectId: 'sample-api', environment: 'local' }, { repositoryRoot: root }), /inside the repository/);
});

test('Module 2: environment injection cannot be confused with another project', () => {
  const env = selectionEnvironment(local('sample-api'), { CI: 'true', QA_PROJECT_ID: 'northline-goods' });
  assert.equal(env.QA_PROJECT_ID, 'sample-api');
  assert.equal(env.QA_ENVIRONMENT, 'local');
  assert.equal(env.CI, 'true');
});

test('Module 2: command-line preflight succeeds without starting a server', () => {
  const sample = spawnSync(process.execPath, [
    'scripts/run-project.mjs', '--project', 'sample-api', '--environment', 'local', '--suite', 'api', '--dry-run',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(sample.status, 0, sample.stderr);
  assert.match(sample.stdout, /Preflight successful/);
  const malicious = spawnSync(process.execPath, [
    'scripts/run-project.mjs', '--project', '../sample-api', '--dry-run',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(malicious.status, 1);
  assert.match(malicious.stderr, /Project execution rejected/);
});
