/** Static acceptance traceability check. No network, scripts, or test processes run. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEnabledProject, loadProjectRegistry } from './project-registry.mjs';
import { REPOSITORY_ROOT, resolveProjectRun } from './project-runner.mjs';

export const PILOT_TARGETS = Object.freeze([
  { id: 'pilot-jsonplaceholder', host: 'jsonplaceholder.typicode.com', file: 'api/contracts.spec.ts', prefix: 'PAPI' },
  { id: 'pilot-the-internet', host: 'the-internet.herokuapp.com', file: 'ui/site.spec.ts', prefix: 'PWEB' },
]);

export function auditPilotProjects({ root = REPOSITORY_ROOT, registry = loadProjectRegistry() } = {}) {
  const result = [];
  for (const pilot of PILOT_TARGETS) {
    const profile = getEnabledProject(pilot.id, registry);
    if (profile.remoteExecution?.enabled !== true) throw Error(`${pilot.id}: remote test profile is not explicitly approved`);
    const target = profile.environments.staging;
    if (!target?.readOnly || profile.allowedHosts.length !== 1 || profile.allowedHosts[0] !== pilot.host) {
      throw Error(`${pilot.id}: staging must be read-only with one exact expected host`);
    }
    const args = { projectId: pilot.id, environment: 'staging', suite: profile.type === 'api' ? 'api' : 'smoke', browser: profile.type === 'api' ? 'all' : 'chromium' };
    const selection = resolveProjectRun(args, { registry, repositoryRoot: root, remoteOptIn: true, environmentVariables: { QA_REMOTE_APPROVAL: pilot.host } });
    if (!selection.remote || !selection.restricted || !selection.testDir.endsWith(join('tests', 'safe'))) {
      throw Error(`${pilot.id}: unsafe runner resolution`);
    }
    const manifest = JSON.parse(readFileSync(join(root, 'projects', pilot.id, 'pilot-coverage.json'), 'utf8'));
    const source = readFileSync(join(selection.testDir, pilot.file), 'utf8');
    const ids = [...source.matchAll(/\btest\('(PAPI-\d{2}|PWEB-\d{2}) /g)].map((m) => m[1]);
    const declared = (manifest.testCases ?? []).map((item) => item.requirementId);
    if (manifest.projectId !== pilot.id || ids.length < 5 || new Set(ids).size !== ids.length ||
        JSON.stringify(ids) !== JSON.stringify(declared) ||
        ids.some((id) => !id.startsWith(`${pilot.prefix}-`))) {
      throw Error(`${pilot.id}: pilot coverage matrix and executable test IDs do not match`);
    }
    result.push(Object.freeze({ projectId: pilot.id, host: pilot.host, cases: ids.length, remote: true, restricted: true }));
  }
  return Object.freeze(result);
}
