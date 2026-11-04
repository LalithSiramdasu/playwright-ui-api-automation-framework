import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { planProjectOnboarding, writeProjectOnboarding } from '../../src/core/project-onboarding.mjs';
import { validateProjectProfile } from '../../src/core/project-registry.mjs';
import { onboardingStatus, assertOnboardingReady } from '../../src/core/onboarding-gate.cjs';
import { resolveProjectRun, RunConfigurationError } from '../../src/core/project-runner.mjs';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'qa-onboarding-'));
  mkdirSync(join(root, 'projects'));
  roots.push(root);
  return root;
}
const configuration = (type = 'api', overrides = {}) => ({
  id: 'client-catalog', name: 'Client Catalog QA', type,
  url: 'https://staging.example.org/v1/', ...overrides,
});
function generated(type = 'api') {
  const root = temporaryRoot();
  const plan = planProjectOnboarding(configuration(type));
  const result = writeProjectOnboarding(plan, { root, write: true });
  const profilePath = join(result.projectDir, 'project.config.json');
  const metadataPath = join(result.projectDir, 'onboarding.json');
  return { root, result, plan, profilePath, metadataPath };
}

test('Module 10: API scaffold starts disabled, read-only and without credentials', () => {
  const created = generated();
  const profile = validateProjectProfile(JSON.parse(readFileSync(created.profilePath, 'utf8')));
  assert.equal(profile.enabled, false);
  assert.equal(profile.remoteExecution.enabled, false);
  assert.deepEqual(profile.allowedHosts, ['staging.example.org']);
  assert.deepEqual(Object.keys(profile.environments), ['staging']);
  assert.equal(profile.environments.staging.readOnly, true);
  assert.equal(profile.environments.staging.apiBaseUrl, 'https://staging.example.org/v1/');
  assert.equal(readFileSync(join(created.result.projectDir, 'tests/safe/api/smoke.spec.ts'),'utf8').includes('test.todo'), true);
});

test('Module 10: website scaffold creates a separate safe UI directory', () => {
  const created = generated('web');
  const profile = validateProjectProfile(JSON.parse(readFileSync(created.profilePath, 'utf8')));
  assert.equal(profile.type, 'web');
  assert.equal(profile.environments.staging.webBaseUrl, 'https://staging.example.org/v1/');
  assert.ok(readFileSync(join(created.result.projectDir, 'tests/safe/ui/smoke.spec.ts'), 'utf8').includes('ONBOARDING_PLACEHOLDER'));
});

test('Module 10: preview does not touch the repository', () => {
  const root = temporaryRoot();
  const plan = planProjectOnboarding(configuration());
  assert.equal(writeProjectOnboarding(plan, { root }).written, false);
  assert.equal(hasProfile(join(root, 'projects', plan.id)), false);
});
function hasProfile(path) { try { readFileSync(join(path, 'project.config.json')); return true; } catch { return false; } }

test('Module 10: never overwrites an existing project', () => {
  const created = generated();
  assert.throws(() => writeProjectOnboarding(created.plan, { root: created.root, write: true }), /already exists/);
  const profile = JSON.parse(readFileSync(created.profilePath, 'utf8'));
  assert.equal(profile.enabled, false);
});

test('Module 10: rejects unsafe URLs and project IDs before any file creation', () => {
  const unsafe = [
    { url: 'http://staging.example.org/' },
    { url: 'https://user:password@staging.example.org/' },
    { url: 'https://staging.example.org/?token=abc' },
    { url: 'https://staging.example.org/#token' },
    { url: 'https://127.0.0.1/' },
    { url: 'https://10.1.1.25/' },
    { url: 'https://staging.example.org:8443/' },
    { url: 'file:///etc/passwd' },
    { url: 'https://staging.example.org/\n' },
    { id: '../../escape' },
    { id: 'ABC' },
    { name: '<script>alert(1)</script>' },
    { type: 'hybrid' },
  ];
  for (const change of unsafe) assert.throws(() => planProjectOnboarding(configuration('api', change)), undefined, JSON.stringify(change));
});

test('Module 10: rejects unknown input fields and JavaScript-like name strings', () => {
  assert.throws(() => planProjectOnboarding({ ...configuration(), command: 'rm -rf .' }), /Unsupported input field/);
  assert.throws(() => planProjectOnboarding(configuration('api', { name: 'Unsafe ${process.env.SECRET}' })), /Invalid project name/);
});

test('Module 10: gate refuses drafts and does not mistake them for verified projects', () => {
  const created = generated();
  const profile = validateProjectProfile(JSON.parse(readFileSync(created.profilePath, 'utf8')));
  const status = onboardingStatus(created.result.projectDir, profile);
  assert.equal(status.applicable, true);
  assert.equal(status.ready, false);
  assert.ok(status.checks.filter((item) => !item.passed).length >= 3);
  assert.throws(() => assertOnboardingReady(created.result.projectDir, profile), /onboarding is incomplete/);
});

test('Module 10: runner blocks a partially enabled draft before any HTTP request', () => {
  const created = generated();
  const profile = JSON.parse(readFileSync(created.profilePath, 'utf8'));
  profile.enabled = true;
  profile.remoteExecution.enabled = true;
  writeFileSync(created.profilePath, JSON.stringify(profile));
  assert.throws(() => resolveProjectRun({ projectId: profile.id, environment: 'staging', suite: 'api' }, {
    registry: [validateProjectProfile(profile)], repositoryRoot: created.root,
    remoteOptIn: true, environmentVariables: { QA_REMOTE_APPROVAL: 'staging.example.org' },
  }), RunConfigurationError);
});

test('Module 10: review and safe assertions are required together to complete preflight', () => {
  const created = generated();
  const profile = JSON.parse(readFileSync(created.profilePath, 'utf8'));
  profile.enabled = true;
  profile.remoteExecution.enabled = true;
  writeFileSync(created.profilePath, JSON.stringify(profile));
  const manifest = JSON.parse(readFileSync(created.metadataPath, 'utf8'));
  manifest.status = 'reviewed';
  manifest.authorization = { approvedHost: 'staging.example.org', approvedBy: 'Approved reviewer', evidenceReference: 'QA-TICKET-1024' };
  manifest.review = { requirementsReviewed: true, readOnlySuiteReviewed: true, privacyReviewed: true };
  writeFileSync(created.metadataPath, JSON.stringify(manifest));
  const validated = validateProjectProfile(profile);
  assert.equal(onboardingStatus(created.result.projectDir, validated).ready, false, 'A TODO is not an executable test');
  writeFileSync(join(created.result.projectDir, 'tests/safe/api/smoke.spec.ts'),
    "import { test, expect } from '@playwright/test';\ntest('API-01 reviewed health behavior @smoke', async ({ request }) => { const result = await request.get('/health'); expect(result.status()).toBe(200); });\n");
  assert.equal(onboardingStatus(created.result.projectDir, validated).ready, true);
  const selection = resolveProjectRun({ projectId: profile.id, environment: 'staging', suite: 'api' }, {
    registry: [validated], repositoryRoot: created.root,
    remoteOptIn: true, environmentVariables: { QA_REMOTE_APPROVAL: 'staging.example.org' },
  });
  assert.equal(selection.remote, true);
  assert.equal(selection.restricted, true);
  assert.ok(selection.testDir.endsWith(join('tests', 'safe')));
});

test('Module 10: direct CLI preview is offline and has no side effects', () => {
  const result = spawnSync(process.execPath, ['scripts/onboard-project.mjs',
    '--project','client-demo-qa','--name','Client Demo QA','--type','web','--url','https://staging.example.org/'],
  { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PREVIEW ONLY/);
  assert.match(result.stdout, /DISABLED/i);
});

test('Module 10: static readiness command cannot silently approve an unknown target', () => {
  const result = spawnSync(process.execPath, ['scripts/project-readiness.mjs','--project','unknown-app'],
    { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown project/);
});

test('Module 10: existing fixture projects retain their original runner behavior', () => {
  const status = onboardingStatus(join(process.cwd(), 'projects', 'sample-api'), { id: 'sample-api' });
  assert.equal(status.applicable, false);
  assert.equal(status.ready, true);
  assert.doesNotThrow(() => resolveProjectRun({ projectId: 'sample-api', environment: 'local', suite: 'api' }));
});
