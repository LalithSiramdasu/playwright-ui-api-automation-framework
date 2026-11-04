/** Module 1: validated, read-only configuration discovery. No requests or tests run here. */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../projects');
export const SUPPORTED_SUITES = Object.freeze([
  'smoke', 'regression', 'ui', 'api', 'negative', 'accessibility',
]);

const projectIdPattern = /^[a-z][a-z0-9-]{2,39}$/;
const environmentNamePattern = /^(local|development|test|staging|production)$/;
const envVarPattern = /^[A-Z][A-Z0-9_]{1,63}$/;
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const profileKeys = ['schemaVersion', 'id', 'name', 'type', 'enabled', 'environments', 'allowedHosts', 'suites', 'credentialEnv', 'remoteExecution'];
const environmentKeys = ['webBaseUrl', 'apiBaseUrl', 'readOnly'];
const credentialKeys = ['username', 'password', 'token', 'apiKey'];

const hasOwn = (value, name) => Object.prototype.hasOwnProperty.call(value, name);
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}
function exactKeys(value, allowed, context) {
  for (const name of Object.keys(value)) {
    if (!allowed.includes(name)) fail(context, `unknown property '${name}'`);
  }
}
function requiredString(value, context, maxLength = 80) {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 3 || value.length > maxLength) {
    fail(context, `must be a nonempty trimmed string (3-${maxLength} characters)`);
  }
}
function verifyHost(host, context) {
  if (typeof host !== 'string' || !host || host.length > 253 || host.includes('*')) {
    fail(context, 'must be an explicit hostname, without wildcards');
  }
  try {
    const parsed = new URL(`https://${host}`);
    if (parsed.hostname !== host.toLowerCase() || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      fail(context, `invalid or noncanonical allowed host '${host}'`);
    }
  } catch {
    fail(context, `invalid allowed host '${host}'`);
  }
}
function verifyUrl(raw, allowedHosts, context, environment) {
  if (typeof raw !== 'string' || raw.length > 2048 || raw.trim() !== raw) fail(context, 'URL must be a string');
  let url;
  try { url = new URL(raw); } catch { fail(context, 'invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) fail(context, 'only HTTP(S) URLs are supported');
  if (url.username || url.password || url.search || url.hash) fail(context, 'URLs may not contain credentials, query strings or fragments');
  if (!allowedHosts.includes(url.hostname)) fail(context, `host '${url.hostname}' is not in allowedHosts`);
  if (url.protocol === 'http:' && !localHosts.has(url.hostname)) fail(context, 'HTTP is permitted only on loopback hosts');
  if (environment === 'production' && url.protocol !== 'https:') fail(context, 'production must use HTTPS');
  if (url.href !== raw && url.href !== `${raw}/`) fail(context, 'URL must be canonical (no hidden whitespace or normalization)');
  return url.href;
}

/** Validate a data-only profile. Unknown properties and embedded secrets are rejected. */
export function validateProjectProfile(raw, context = 'project profile') {
  if (!isPlainObject(raw)) fail(context, 'must be a JSON object');
  exactKeys(raw, profileKeys, context);
  if (raw.schemaVersion !== 1) fail(context, 'schemaVersion must equal 1');
  if (typeof raw.id !== 'string' || !projectIdPattern.test(raw.id)) fail(context, 'invalid project id');
  requiredString(raw.name, `${context}.name`);
  if (!['web', 'api', 'hybrid'].includes(raw.type)) fail(context, 'type must be web, api or hybrid');
  if (typeof raw.enabled !== 'boolean') fail(context, 'enabled must be true or false');
  if (!Array.isArray(raw.allowedHosts) || raw.allowedHosts.length === 0 || raw.allowedHosts.length > 20) {
    fail(context, 'allowedHosts must be a non-empty list of at most 20 hosts');
  }
  raw.allowedHosts.forEach((host, i) => verifyHost(host, `${context}.allowedHosts[${i}]`));
  if (new Set(raw.allowedHosts).size !== raw.allowedHosts.length) fail(context, 'duplicate allowedHosts');
  if (!Array.isArray(raw.suites) || raw.suites.length === 0 || raw.suites.some((suite) => !SUPPORTED_SUITES.includes(suite))) {
    fail(context, 'suites must contain known suite ids');
  }
  if (new Set(raw.suites).size !== raw.suites.length) fail(context, 'duplicate suites');
  if (raw.type === 'api' && raw.suites.some((x) => x === 'ui' || x === 'accessibility')) fail(context, 'API-only projects cannot declare UI/accessibility suites');
  if (raw.type === 'web' && raw.suites.includes('api')) fail(context, 'web-only projects cannot declare API suites');
  if (!isPlainObject(raw.environments) || !Object.keys(raw.environments).length || Object.keys(raw.environments).length > 5) {
    fail(context, 'environments must contain 1-5 named environments');
  }
  const environments = {};
  for (const [environment, target] of Object.entries(raw.environments)) {
    if (!environmentNamePattern.test(environment)) fail(context, `unsupported environment '${environment}'`);
    const targetContext = `${context}.environments.${environment}`;
    if (!isPlainObject(target)) fail(targetContext, 'must be an object');
    exactKeys(target, environmentKeys, targetContext);
    if (typeof target.readOnly !== 'boolean') fail(targetContext, 'readOnly must be explicit');
    if (environment === 'production' && !target.readOnly) fail(targetContext, 'production cannot opt out of read-only mode');
    if (raw.type !== 'api' && !hasOwn(target, 'webBaseUrl')) fail(targetContext, 'webBaseUrl is required');
    if (raw.type !== 'web' && !hasOwn(target, 'apiBaseUrl')) fail(targetContext, 'apiBaseUrl is required');
    if (raw.type === 'api' && hasOwn(target, 'webBaseUrl')) fail(targetContext, 'API-only profile must not contain webBaseUrl');
    if (raw.type === 'web' && hasOwn(target, 'apiBaseUrl')) fail(targetContext, 'web-only profile must not contain apiBaseUrl');
    const output = { readOnly: target.readOnly };
    for (const prop of ['webBaseUrl', 'apiBaseUrl']) {
      if (hasOwn(target, prop)) output[prop] = verifyUrl(target[prop], raw.allowedHosts, `${targetContext}.${prop}`, environment);
    }
    environments[environment] = Object.freeze(output);
  }
  if (hasOwn(raw, 'credentialEnv')) {
    if (!isPlainObject(raw.credentialEnv)) fail(context, 'credentialEnv must be an object');
    exactKeys(raw.credentialEnv, credentialKeys, `${context}.credentialEnv`);
    for (const [name, envName] of Object.entries(raw.credentialEnv)) {
      if (typeof envName !== 'string' || !envVarPattern.test(envName)) {
        fail(context, `credentialEnv.${name} must be a variable name, never a secret value`);
      }
    }
  }
  if (hasOwn(raw, 'remoteExecution')) {
    if (!isPlainObject(raw.remoteExecution)) fail(context, 'remoteExecution must be an object');
    exactKeys(raw.remoteExecution, ['enabled'], `${context}.remoteExecution`);
    if (typeof raw.remoteExecution.enabled !== 'boolean') fail(context, 'remoteExecution.enabled must be a boolean');
  }
  return Object.freeze({
    schemaVersion: 1,
    id: raw.id,
    name: raw.name,
    type: raw.type,
    enabled: raw.enabled,
    environments: Object.freeze(environments),
    allowedHosts: Object.freeze([...raw.allowedHosts]),
    suites: Object.freeze([...raw.suites]),
    credentialEnv: Object.freeze({ ...(raw.credentialEnv ?? {}) }),
    remoteExecution: Object.freeze({ enabled: raw.remoteExecution?.enabled === true }),
  });
}

/** Discover profiles only under trusted project directories; no code execution or HTTP traffic. */
export function loadProjectRegistry(projectsDir = PROJECTS_DIR) {
  const entries = readdirSync(projectsDir, { withFileTypes: true });
  const profiles = [];
  for (const item of entries) {
    if (!item.isDirectory()) continue;
    if (!projectIdPattern.test(item.name)) fail('projects', `invalid profile folder '${item.name}'`);
    const profileFile = join(projectsDir, item.name, 'project.config.json');
    let profile;
    try { profile = JSON.parse(readFileSync(profileFile, 'utf8')); }
    catch (error) { fail(profileFile, `missing or malformed JSON (${error.message})`); }
    const validated = validateProjectProfile(profile, profileFile);
    if (validated.id !== item.name) fail(profileFile, `id must match directory name '${item.name}'`);
    profiles.push(validated);
  }
  if (!profiles.length) fail(projectsDir, 'no registered projects');
  return Object.freeze(profiles.sort((a, b) => a.id.localeCompare(b.id)));
}

/** Lookup never accepts file paths. Unknown/disabled projects cannot be selected. */
export function getEnabledProject(projectId, registry = loadProjectRegistry()) {
  if (typeof projectId !== 'string' || !projectIdPattern.test(projectId)) fail('project lookup', 'invalid id');
  const profile = registry.find((item) => item.id === projectId);
  if (!profile) fail('project lookup', `unknown project '${projectId}'`);
  if (!profile.enabled) fail('project lookup', `project '${projectId}' is a disabled template`);
  return profile;
}
