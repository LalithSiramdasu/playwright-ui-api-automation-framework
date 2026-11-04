import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { resolveProjectRun } from '../../src/core/project-runner.mjs';
import { validateProjectProfile } from '../../src/core/project-registry.mjs';
import { assessTargetPolicy } from '../../src/core/execution-policy.cjs';

function fixture() {
  return {
    schemaVersion: 1, id: 'approved-api', name: 'Approved Staging API', type: 'api', enabled: true,
    allowedHosts: ['staging.example.test'],
    environments: { staging: { apiBaseUrl: 'https://staging.example.test/v1/', readOnly: true } },
    suites: ['smoke', 'api', 'negative'], credentialEnv: { token: 'APPROVED_API_TOKEN' },
    remoteExecution: { enabled: true },
  };
}

test('Module 5: local fixture staging runs only its dedicated safe tests', () => {
  const staging = resolveProjectRun({ projectId: 'sample-api', environment: 'staging', suite: 'api' });
  const local = resolveProjectRun({ projectId: 'sample-api', environment: 'local', suite: 'api' });
  assert.equal(staging.restricted, true);
  assert.equal(staging.remote, false);
  assert.ok(staging.testDir.split(sep).join('/').endsWith('projects/sample-api/tests/safe'));
  assert.notEqual(local.testDir, staging.testDir);
});

test('Module 5: remote target requires explicit profile enablement, CLI acknowledgement and matching host', () => {
  const profile = validateProjectProfile(fixture());
  assert.throws(() => assessTargetPolicy(profile, 'staging'), /requires --allow-remote/);
  assert.throws(() => assessTargetPolicy(profile, 'staging', { remoteOptIn: true, approval: 'wrong.example.test' }), /exact approved host/);
  assert.deepEqual(assessTargetPolicy(profile, 'staging', { remoteOptIn: true, approval: 'staging.example.test' }), {
    remote: true, restricted: true, host: 'staging.example.test',
  });
  const disabled = fixture(); disabled.remoteExecution.enabled = false;
  assert.throws(() => assessTargetPolicy(validateProjectProfile(disabled), 'staging', { remoteOptIn: true, approval: 'staging.example.test' }), /not enabled/);
});

test('Module 5: remote consent cannot enable writes, production or mixed hosts', () => {
  const approved = fixture();
  approved.environments.staging.readOnly = false;
  assert.throws(() => assessTargetPolicy(validateProjectProfile(approved), 'staging', { remoteOptIn: true, approval: 'staging.example.test' }), /read-only/);
  const prod = fixture();
  prod.environments.production = { apiBaseUrl: 'https://staging.example.test/v1/', readOnly: true };
  assert.throws(() => assessTargetPolicy(validateProjectProfile(prod), 'production', { remoteOptIn: true, approval: 'staging.example.test' }), /only supported for development/);
  const mixed = fixture();
  mixed.type = 'hybrid';
  mixed.allowedHosts = ['staging.example.test', '127.0.0.1'];
  mixed.environments.staging.webBaseUrl = 'http://127.0.0.1:4175';
  assert.throws(() => assessTargetPolicy(validateProjectProfile(mixed), 'staging', { remoteOptIn: true, approval: 'staging.example.test' }), /one dedicated approved host/);
});

test('Module 5: remote selection only loads safe tests from its own project', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-module5-'));
  try {
    const safe = join(root, 'projects', 'approved-api', 'tests', 'safe', 'api');
    mkdirSync(safe, { recursive: true });
    writeFileSync(join(safe, 'health.spec.ts'), 'test("readonly", () => {});');
    const profile = validateProjectProfile(fixture());
    const input = { projectId: profile.id, environment: 'staging', suite: 'api' };
    const options = { registry: [profile], repositoryRoot: root, remoteOptIn: true, environmentVariables: { QA_REMOTE_APPROVAL: 'staging.example.test' } };
    const selection = resolveProjectRun(input, options);
    assert.equal(selection.remote, true);
    assert.ok(selection.testDir.endsWith(join('tests', 'safe')));
    assert.throws(() => resolveProjectRun(input, { ...options, remoteOptIn: false }), /requires --allow-remote/);
    rmSync(join(root, 'projects', 'approved-api', 'tests', 'safe'), { recursive: true });
    assert.throws(() => resolveProjectRun(input, options), /no test directory/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Module 5: remote configuration rejects unexpected policy properties', () => {
  const bad = fixture(); bad.remoteExecution.command = 'curl attacker';
  assert.throws(() => validateProjectProfile(bad), /unknown property/);
});
