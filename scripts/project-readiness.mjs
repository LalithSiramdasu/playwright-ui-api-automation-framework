#!/usr/bin/env node
/** Static, network-free readiness check for a user-onboarded project. */
import { join } from 'node:path';
import { getEnabledProject, loadProjectRegistry } from '../src/core/project-registry.mjs';
import { onboardingStatus } from '../src/core/onboarding-gate.cjs';
import { REPOSITORY_ROOT } from '../src/core/project-runner.mjs';

try {
  const argv = process.argv.slice(2);
  if (argv.length !== 2 || argv[0] !== '--project') throw Error('Use --project PROJECT_ID');
  const projectId = argv[1];
  const registry = loadProjectRegistry();
  // A disabled newly generated profile must also be auditable.
  const profile = registry.find((project) => project.id === projectId);
  if (!profile) throw Error(`Unknown project '${projectId}'`);
  const outcome = onboardingStatus(join(REPOSITORY_ROOT, 'projects', projectId), profile);
  if (!outcome.applicable) throw Error(`Project '${projectId}' has no onboarding.json; it is not a Module 10 onboarding target`);
  for (const check of outcome.checks) console.log(`${check.passed ? 'PASS' : 'BLOCKED'} ${check.id}: ${check.description}`);
  if (!outcome.ready) {
    console.error(`Project '${projectId}' is NOT ready. No live requests were made.`);
    process.exitCode = 1;
  } else {
    getEnabledProject(projectId, registry);
    console.log(`Project '${projectId}' passed the static onboarding checklist. This does not independently verify authorization or business correctness.`);
  }
} catch (error) {
  console.error(`Project readiness check failed: ${error.message}`);
  process.exitCode = 1;
}
