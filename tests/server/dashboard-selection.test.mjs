import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  runsForProject, enabledProjects, selectableSuites, chooseSuite,
  effectiveBrowser, runProjectId, runEnvironment,
} from '../../dashboard/src/project-selection.mjs';

const projects = [
  { id: 'northline-goods', type: 'hybrid', enabled: true, environments: ['local'], suites: ['smoke', 'api', 'ui'] },
  { id: 'sample-api', type: 'api', enabled: true, environments: ['local', 'staging'], suites: ['smoke', 'api', 'negative'] },
  { id: 'sample-web', type: 'web', enabled: true, environments: ['local'], suites: ['smoke', 'ui'] },
  { id: 'starter-api', type: 'api', enabled: false, environments: ['staging'], suites: ['api'] },
];
const suites = ['all', 'smoke', 'regression', 'ui', 'api', 'negative', 'accessibility'].map((id) => ({ id }));

test('Module 6: filters disabled profile from selectable projects', () => {
  assert.deepEqual(enabledProjects(projects).map((p) => p.id), ['northline-goods','sample-api','sample-web']);
  assert.deepEqual(selectableSuites(suites, projects[3]), []);
});
test('Module 6: suite choices follow profile type and declared suites', () => {
  assert.deepEqual(selectableSuites(suites, projects[1]).map((s) => s.id), ['all', 'smoke', 'api', 'negative']);
  assert.deepEqual(selectableSuites(suites, projects[2]).map((s) => s.id), ['all', 'smoke', 'ui']);
  assert.equal(chooseSuite(projects[1], suites, 'ui'), 'smoke');
  assert.equal(chooseSuite(projects[1], suites, 'api'), 'api');
  assert.equal(effectiveBrowser(projects[1], 'smoke', 'chromium'), 'all');
  assert.equal(effectiveBrowser(projects[0], 'api', 'firefox'), 'all');
  assert.equal(effectiveBrowser(projects[2], 'ui', 'webkit'), 'webkit');
});
test('Module 6: segregates history by both selected project and environment', () => {
  const runs = [
    { id: 'legacy' },
    { id: 'a', projectId: 'northline-goods', environment: 'local' },
    { id: 'b', projectId: 'sample-api', environment: 'local' },
    { id: 'c', projectId: 'sample-api', environment: 'staging' },
  ];
  assert.equal(runProjectId(runs[0]), 'northline-goods');
  assert.equal(runEnvironment(runs[0]), 'local');
  assert.deepEqual(runsForProject(runs, 'northline-goods', 'local').map((r) => r.id), ['legacy', 'a']);
  assert.deepEqual(runsForProject(runs, 'sample-api', 'local').map((r) => r.id), ['b']);
  assert.deepEqual(runsForProject(runs, 'sample-api', 'staging').map((r) => r.id), ['c']);
});
