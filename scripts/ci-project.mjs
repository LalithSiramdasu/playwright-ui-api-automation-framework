/** Module 8: bounded, project-aware GitHub Actions dispatcher.
 * Selection comes exclusively from validated repository project profiles.
 * No shell invocation, arbitrary test paths, or remote opt-in in CI.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProjectRun, REPOSITORY_ROOT } from '../src/core/project-runner.mjs';

export const WEEKLY_SELECTION = Object.freeze({
  projectId: 'sample-api', environment: 'staging', suite: 'api', browser: 'all',
});

/** The scheduled check is hardcoded to a local safe suite; user dispatch can only
 * select pre-registered projects. Remote approvals must not be injected by CI. */
export function resolveCiSelection(env = process.env) {
  const event = env.GITHUB_EVENT_NAME ?? 'workflow_dispatch';
  if (!['workflow_dispatch', 'schedule'].includes(event)) {
    throw Error('Only manual dispatch and the approved weekly schedule may use this CI entrypoint');
  }
  const requested = event === 'schedule' ? WEEKLY_SELECTION : {
    projectId: env.QA_CI_PROJECT ?? 'sample-api',
    environment: env.QA_CI_ENVIRONMENT ?? 'local',
    suite: env.QA_CI_SUITE ?? 'smoke',
    browser: env.QA_CI_BROWSER ?? 'all',
  };
  const selection = resolveProjectRun(requested, {
    remoteOptIn: false,
    environmentVariables: { QA_REMOTE_APPROVAL: '' },
  });
  if (selection.remote) throw Error('Remote targets are prohibited in this CI workflow');
  return Object.freeze(selection);
}

function safeMetadata(selection, env) {
  const valid = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : null;
  return {
    schemaVersion: 1,
    projectId: selection.projectId,
    environment: selection.environment,
    suite: selection.suite,
    browser: selection.browser,
    restricted: selection.restricted,
    remote: false,
    github: {
      event: valid(env.GITHUB_EVENT_NAME, /^(workflow_dispatch|schedule)$/),
      runId: valid(env.GITHUB_RUN_ID, /^\d{1,25}$/),
      sha: valid(env.GITHUB_SHA, /^[0-9a-f]{40}$/),
    },
  };
}

/** Structured release evidence contains selection metadata only; never tokens or URLs. */
export function recordCiSelection(selection, { root = REPOSITORY_ROOT, env = process.env } = {}) {
  const metadata = safeMetadata(selection, env);
  const location = join(root, 'reports', 'ci-selection.json');
  mkdirSync(join(root, 'reports'), { recursive: true });
  writeFileSync(location, JSON.stringify(metadata, null, 2) + '\n');
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY,
      `## Selected QA suite\n\nProject: \`${metadata.projectId}\` · Environment: \`${metadata.environment}\` · Suite: \`${metadata.suite}\` · Browser: \`${metadata.browser}\`\n\nRestricted tests: ${metadata.restricted ? 'yes' : 'no'} · Remote network target: no\n\n`);
  }
  return metadata;
}

function run() {
  const mode = process.argv[2] ?? '--preflight';
  if (!['--preflight', '--execute'].includes(mode) || process.argv.length > 3) {
    throw Error('Use --preflight or --execute; arbitrary arguments are not accepted');
  }
  const selection = resolveCiSelection();
  console.log(`CI selection: ${selection.projectId} / ${selection.environment} / ${selection.suite} / ${selection.browser}`);
  if (mode === '--preflight') {
    recordCiSelection(selection);
    console.log('CI preflight passed: project, suite, environment and target policy validated.');
    return;
  }
  const args = [
    fileURLToPath(new URL('./run-project.mjs', import.meta.url)),
    '--project', selection.projectId,
    '--environment', selection.environment,
    '--suite', selection.suite,
    '--browser', selection.browser,
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: REPOSITORY_ROOT,
    env: { ...process.env, QA_REMOTE_APPROVAL: '', QA_ALLOW_REMOTE: '0' },
    stdio: 'inherit', shell: false, windowsHide: true,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { run(); }
  catch (error) { console.error(`CI project selection rejected: ${error.message}`); process.exitCode = 1; }
}
