/** Module 10: offline-only, non-overwriting project onboarding scaffold. */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { validateProjectProfile } from './project-registry.mjs';
import { REPOSITORY_ROOT } from './project-runner.mjs';

const FIELDS = new Set(['id', 'name', 'type', 'url']);
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

export function planProjectOnboarding(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Provide a project configuration');
  for (const key of Object.keys(input)) if (!FIELDS.has(key)) throw Error(`Unsupported input field '${key}'`);
  const { id, name, type, url: targetUrl } = input;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{2,39}$/.test(id)) throw Error('Invalid project ID (3–40 lowercase letters, digits and hyphens)');
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 ._()-]{2,79}$/.test(name)) throw Error('Invalid project name');
  if (!['web', 'api'].includes(type)) throw Error('Project type must be web or api');
  let parsed;
  try { parsed = new URL(targetUrl); } catch { throw Error('Provide a valid staging HTTPS URL'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.port || loopback.has(parsed.hostname) || isIP(parsed.hostname) !== 0 || !/^[a-z0-9.-]+$/.test(parsed.hostname) ||
      !parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) {
    throw Error('Staging URL must use HTTPS with a named non-loopback host, without credentials, query, fragment or custom port');
  }
  // Reject concealed or normalized hosts/paths and control characters.
  if (typeof targetUrl !== 'string' || (parsed.href !== targetUrl && parsed.href !== `${targetUrl}/`)) {
    throw Error('Staging URL must be canonical and contain no hidden characters');
  }
  const profile = validateProjectProfile({
    schemaVersion: 1, id, name, type, enabled: false,
    allowedHosts: [parsed.hostname],
    environments: { staging: { [type === 'web' ? 'webBaseUrl' : 'apiBaseUrl']: parsed.href, readOnly: true } },
    suites: type === 'web' ? ['smoke', 'ui', 'regression'] : ['smoke', 'api', 'regression'],
    credentialEnv: {}, remoteExecution: { enabled: false },
  });
  const testsPath = `tests/safe/${type === 'web' ? 'ui' : 'api'}/smoke.spec.ts`;
  const spec = type === 'web'
    ? `import { test } from '@playwright/test';\n\n// ONBOARDING_PLACEHOLDER: REPLACE with assertions for your approved web app.\n// Use useReadOnlyOrigin(page, testInfo.project.use.baseURL) in a beforeEach hook.\n// Do not run against external hosts until authorization, privacy review and readiness pass.\ntest.todo('APP-01 define an actual read-only website acceptance check @smoke');\n`
    : `import { test } from '@playwright/test';\n\n// ONBOARDING_PLACEHOLDER: REPLACE with assertions for your documented API.\n// Prefer ReadOnlyApiClient and verify documented status/schema/response values.\n// Do not send POST/PUT/PATCH/DELETE to third-party or production systems.\ntest.todo('API-01 define an actual read-only API acceptance check @smoke');\n`;
  const metadata = {
    schemaVersion: 1, projectId: id, status: 'draft',
    authorization: { approvedHost: null, approvedBy: '', evidenceReference: '' },
    review: { requirementsReviewed: false, readOnlySuiteReviewed: false, privacyReviewed: false },
  };
  const plan = `# ${name} — onboarding checklist\n\n` +
    `Project ID: \`${id}\`  \nType: \`${type}\`  \nStaging host: \`${parsed.hostname}\`\n\n` +
    `## Before enabling this target\n\n` +
    `- [ ] Confirm ownership or obtain explicit permission for this exact staging host\n` +
    `- [ ] Define at least 5 meaningful requirements/expected outcomes from the real product specification\n` +
    `- [ ] Replace the TODO in \`${testsPath}\` with actual assertions and appropriate error handling\n` +
    `- [ ] Use low-volume read-only checks; do not create/modify/delete live data\n` +
    `- [ ] Review secrets, test data, privacy and logging (never put credentials in this public repository)\n` +
    `- [ ] Record a non-secret authorization reference in onboarding.json\n` +
    `- [ ] After manual review, change status and review flags in onboarding.json and explicitly enable the profile\n` +
    `- [ ] Run \`npm run project:readiness -- --project ${id}\` and require all checks to pass\n` +
    `- [ ] Run the local CLI with \`--allow-remote\` and \`QA_REMOTE_APPROVAL=${parsed.hostname}\` only with approval\n\n` +
    `This scaffold does not validate real business behavior or prove service-owner permission.\n`;
  const files = Object.freeze({
    'project.config.json': JSON.stringify(profile, null, 2) + '\n',
    'onboarding.json': JSON.stringify(metadata, null, 2) + '\n',
    'TEST_PLAN.md': plan,
    [testsPath]: spec,
  });
  return Object.freeze({ id, name, type, host: parsed.hostname, files });
}

export function writeProjectOnboarding(plan, options = {}) {
  if (!plan || typeof plan.id !== 'string' || !/^[a-z][a-z0-9-]{2,39}$/.test(plan.id) || !plan.files || typeof plan.files !== 'object') {
    throw Error('Invalid onboarding plan');
  }
  for (const path of Object.keys(plan.files)) {
    if (!['project.config.json', 'onboarding.json', 'TEST_PLAN.md', 'tests/safe/ui/smoke.spec.ts', 'tests/safe/api/smoke.spec.ts'].includes(path)) {
      throw Error('Onboarding plans cannot write arbitrary file paths');
    }
  }
  const root = options.root ?? REPOSITORY_ROOT;
  const projectsDir = resolve(root, 'projects');
  const projectDir = join(projectsDir, plan.id);
  if (!existsSync(projectsDir)) throw Error('Projects directory is missing');
  if (existsSync(projectDir)) throw Error(`Project '${plan.id}' already exists; no files were overwritten`);
  if (options.write !== true) return { written: false, projectDir, files: Object.keys(plan.files) };
  // mkdir is intentionally nonrecursive to fail on races rather than overwrite.
  mkdirSync(projectDir);
  try {
    for (const [relativePath, contents] of Object.entries(plan.files)) {
      const target = join(projectDir, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents, { flag: 'wx', encoding: 'utf8' });
    }
  } catch (error) {
    rmSync(projectDir, { recursive: true, force: true });
    throw error;
  }
  return { written: true, projectDir, files: Object.keys(plan.files) };
}
