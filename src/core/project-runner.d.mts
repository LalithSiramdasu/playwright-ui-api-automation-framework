export interface ProjectRunSelection {
  projectId: string;
  projectName: string;
  projectType: 'web' | 'api' | 'hybrid';
  environment: string;
  readOnly: boolean;
  suite: string;
  browser: string;
  webBaseUrl: string | null;
  apiBaseUrl: string | null;
  testDir: string;
}
export function resolveProjectRun(input?: {
  projectId?: string;
  environment?: string;
  suite?: string;
  browser?: string;
}): ProjectRunSelection;
export function makePlaywrightArguments(selection: ProjectRunSelection): string[];
