/** Module 2: resolve allowlisted project/environment/test suites before launching Playwright. */
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnabledProject, loadProjectRegistry } from './project-registry.mjs';
import { assessTargetPolicy } from './execution-policy.cjs';

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_PROJECT = 'northline-goods';
export const AVAILABLE_BROWSERS = Object.freeze(['all', 'chromium', 'firefox', 'webkit']);
const ALLOWED_FIELDS = new Set(['projectId', 'environment', 'suite', 'browser']);
const SUITE_LABELS = new Set(['all', 'smoke', 'regression', 'ui', 'api', 'negative', 'accessibility']);

export class RunConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RunConfigurationError';
  }
}
function fail(message) { throw new RunConfigurationError(message); }
function validateFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Run selection must be an object');
  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) fail(`Unknown selection field '${key}'`);
  }
}
function hasSpecs(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    // Do not follow symlinks out of registered test roots.
    if (entry.isFile() && /\.spec\.(ts|js|mjs)$/.test(entry.name)) return true;
    if (entry.isDirectory() && hasSpecs(join(directory, entry.name))) return true;
  }
  return false;
}
function trustedTestDirectory(root, projectId, restricted = false) {
  const target = projectId === DEFAULT_PROJECT
    ? join(root, 'tests') // Existing Northline suite remains untouched.
    : join(root, 'projects', projectId, 'tests');
  const safeTarget = restricted ? join(target, 'safe') : target;
  let canonicalRoot;
  let canonicalTarget;
  try {
    canonicalRoot = realpathSync(root);
    canonicalTarget = realpathSync(safeTarget);
    if (!statSync(canonicalTarget).isDirectory()) fail('Project test directory is not a directory');
  } catch (error) {
    if (error instanceof RunConfigurationError) throw error;
    fail(`Project '${projectId}' has no test directory; add approved tests before enabling execution`);
  }
  const diff = relative(canonicalRoot, canonicalTarget);
  if (!diff || isAbsolute(diff) || diff === '..' || diff.startsWith(`..${sep}`)) fail('Project tests must remain inside the repository');
  if (!hasSpecs(canonicalTarget)) fail(`Project '${projectId}' contains no test specifications`);
  return canonicalTarget;
}
/**
 * Read-only, pure preflight: no requests and no process spawn. Profiles cannot provide
 * their own commands, test paths or Playwright arguments. readOnly blocks writes until M5.
 */
export function resolveProjectRun(input = {}, options = {}) {
  validateFields(input);
  const registry = options.registry ?? loadProjectRegistry();
  const root = options.repositoryRoot ?? REPOSITORY_ROOT;
  const projectId = input.projectId ?? DEFAULT_PROJECT;
  let project;
  try { project = getEnabledProject(projectId, registry); }
  catch (error) { fail(error.message); }
  const environment = input.environment ?? (Object.keys(project.environments).length === 1 ? Object.keys(project.environments)[0] : null);
  if (typeof environment !== 'string' || !Object.hasOwn(project.environments, environment)) {
    fail(`Unknown or missing environment '${String(environment)}' for '${project.id}'`);
  }
  const target = project.environments[environment];
  let policy;
  try {
    policy = assessTargetPolicy(project, environment, {
      remoteOptIn: options.remoteOptIn === true,
      approval: options.environmentVariables?.QA_REMOTE_APPROVAL,
    });
  } catch (error) { fail(error.message); }
  const suite = input.suite ?? 'all';
  const browser = input.browser ?? 'all';
  if (typeof suite !== 'string' || !SUITE_LABELS.has(suite) || (suite !== 'all' && !project.suites.includes(suite))) {
    fail(`Suite '${String(suite)}' is not enabled for project '${project.id}'`);
  }
  if (typeof browser !== 'string' || !AVAILABLE_BROWSERS.includes(browser)) fail(`Unsupported browser '${String(browser)}'`);
  if (project.type === 'api' && browser !== 'all') fail('API-only projects cannot select a browser');
  if (suite === 'api' && browser !== 'all') fail('API-only suite cannot select a browser');
  if (project.type === 'web' && suite === 'api') fail('Web-only projects cannot select API suite');
  const testDir = trustedTestDirectory(root, project.id, policy.restricted);
  return Object.freeze({
    projectId: project.id, projectName: project.name, projectType: project.type,
    environment, readOnly: target.readOnly, remote: policy.remote, restricted: policy.restricted, suite, browser,
    webBaseUrl: target.webBaseUrl ?? null, apiBaseUrl: target.apiBaseUrl ?? null,
    testDir,
  });
}

/** Fixed Playwright switches only. No caller-defined flags, scripts, or test paths. */
export function makePlaywrightArguments(selection) {
  const args = ['test'];
  if (selection.suite !== 'all' && selection.suite !== 'ui' && selection.suite !== 'api') {
    args.push('--grep', `@${selection.suite}`);
  }
  if (selection.suite === 'api' || selection.projectType === 'api') {
    args.push('--project=api');
  } else if (selection.browser !== 'all') {
    args.push(`--project=${selection.browser}`);
  } else if (selection.suite === 'ui' || selection.projectType === 'web') {
    args.push('--project=chromium', '--project=firefox', '--project=webkit');
  }
  return args;
}

export function selectionEnvironment(selection, base = process.env) {
  return {
    ...base,
    QA_PROJECT_ID: selection.projectId,
    QA_ENVIRONMENT: selection.environment,
    QA_SUITE: selection.suite,
    QA_BROWSER: selection.browser,
    QA_ALLOW_REMOTE: selection.remote ? '1' : '0',
  };
}
