/* global URL */
/**
 * Module 10: static gate for project onboarding. No HTTP calls and no code execution.
 * Onboarding metadata is a review checklist, NOT independent proof of authorization.
 * Existing fixture projects (without onboarding.json) preserve their current behavior.
 */
const { existsSync, readFileSync, readdirSync, lstatSync } = require('node:fs');
const { join } = require('node:path');

function listSpecs(root) {
  if (!existsSync(root)) return [];
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.spec\.(ts|js|mjs)$/.test(entry.name)) files.push(file);
    }
  }
  if (lstatSync(root).isDirectory()) walk(root);
  return files;
}

function onboardingStatus(projectDir, profile) {
  const metadataPath = join(projectDir, 'onboarding.json');
  if (!existsSync(metadataPath)) {
    return { applicable: false, ready: true, checks: [] };
  }
  const checks = [];
  const check = (id, passed, description) => checks.push({ id, passed: Boolean(passed), description });
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    check('metadata', false, 'onboarding.json is not valid JSON');
    return { applicable: true, ready: false, checks };
  }
  const staging = profile.environments?.staging;
  const urls = [staging?.webBaseUrl, staging?.apiBaseUrl].filter(Boolean);
  const host = urls.length ? new URL(urls[0]).hostname : null;
  check('identity', metadata?.schemaVersion === 1 && metadata?.projectId === profile.id,
    'Onboarding version and project ID must match the registered profile');
  check('restricted-target', Boolean(staging?.readOnly) && urls.length > 0 && urls.every((url) => {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === host;
  }), 'Staging must use read-only HTTPS on one host');
  check('approved-profile', profile.enabled === true && profile.remoteExecution?.enabled === true,
    'Project and reviewed remote execution must both be enabled');
  check('review-state', metadata?.status === 'reviewed', 'Review status must be reviewed');
  const approval = metadata?.authorization;
  check('authorization', Boolean(host) && approval?.approvedHost === host &&
    typeof approval?.approvedBy === 'string' && approval.approvedBy.trim().length >= 3 &&
    typeof approval?.evidenceReference === 'string' && approval.evidenceReference.trim().length >= 8 &&
    !/^(todo|tbd|placeholder)/i.test(approval.evidenceReference.trim()),
  'Record who authorized testing, the exact host and a non-secret evidence reference');
  const review = metadata?.review;
  check('checklist', review?.requirementsReviewed === true &&
    review?.readOnlySuiteReviewed === true && review?.privacyReviewed === true,
  'Requirements, read-only test source and data/privacy handling must be reviewed');
  const safeDir = join(projectDir, 'tests', 'safe');
  const specs = listSpecs(safeDir);
  check('test-sources', specs.length > 0 && specs.every((file) => {
    const source = readFileSync(file, 'utf8');
    return !/ONBOARDING_PLACEHOLDER|\btest\.todo\s*\(/.test(source);
  }), 'Replace all generated placeholder specs with reviewed assertions in tests/safe/');
  return { applicable: true, ready: checks.every((item) => item.passed), checks };
}

function assertOnboardingReady(projectDir, profile) {
  const status = onboardingStatus(projectDir, profile);
  if (status.applicable && !status.ready) {
    const failed = status.checks.filter((item) => !item.passed).map((item) => item.id).join(', ');
    throw Error(`Project '${profile.id}' onboarding is incomplete (${failed}). Run npm run project:readiness -- --project ${profile.id}`);
  }
  return status;
}

module.exports = { onboardingStatus, assertOnboardingReady };
