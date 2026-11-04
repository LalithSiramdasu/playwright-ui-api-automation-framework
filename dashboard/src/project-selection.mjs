/** Pure selectors for the Module 6 UI; legacy records belong to Northline/local. */
export const DEFAULT_PROJECT_ID = 'northline-goods';
export const DEFAULT_ENVIRONMENT = 'local';

export function runProjectId(run) {
  return run?.projectId || DEFAULT_PROJECT_ID;
}
export function runEnvironment(run) {
  return run?.environment || DEFAULT_ENVIRONMENT;
}
export function runsForProject(runs, projectId, environment) {
  return runs.filter((run) => runProjectId(run) === projectId && runEnvironment(run) === environment);
}
export function enabledProjects(projects) {
  return projects.filter((project) => project.enabled);
}
export function selectableSuites(suites, project) {
  if (!project?.enabled) return [];
  return suites.filter((suite) => suite.id === 'all' || project.suites.includes(suite.id));
}
export function allowedEnvironments(project) {
  return project?.environments ?? [];
}
export function chooseSuite(project, suites, preferred = 'smoke') {
  const choices = selectableSuites(suites, project);
  return choices.some((item) => item.id === preferred) ? preferred : (choices.find((item) => item.id !== 'all')?.id ?? choices[0]?.id ?? 'all');
}
export function effectiveBrowser(project, suite, browser) {
  return project?.type === 'api' || suite === 'api' ? 'all' : browser;
}
