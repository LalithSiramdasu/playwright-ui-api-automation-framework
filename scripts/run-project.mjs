/** Module 2 CLI. Run named, allowlisted projects without accepting arbitrary commands. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPOSITORY_ROOT, resolveProjectRun, makePlaywrightArguments, selectionEnvironment,
} from '../src/core/project-runner.mjs';

function parseArgs(argv) {
  const selection = {};
  let dryRun = false;
  const flags = new Map([
    ['--project', 'projectId'], ['--environment', 'environment'],
    ['--suite', 'suite'], ['--browser', 'browser'],
  ]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') { dryRun = true; continue; }
    const key = flags.get(arg);
    if (!key || selection[key] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error(`Invalid argument '${arg}'. Use --project, --environment, --suite, --browser and optional --dry-run`);
    }
    selection[key] = argv[++i];
  }
  return { selection, dryRun };
}

try {
  const { selection: input, dryRun } = parseArgs(process.argv.slice(2));
  const selection = resolveProjectRun(input);
  const cli = join(REPOSITORY_ROOT, 'node_modules', 'playwright', 'cli.js');
  const outputDir = join(REPOSITORY_ROOT, 'test-results', selection.projectId, selection.environment);
  const args = [cli, ...makePlaywrightArguments(selection), '--output', outputDir];
  console.log(`QA run: ${selection.projectName} (${selection.projectId}) / ${selection.environment} / ${selection.suite} / ${selection.browser}`);
  if (dryRun) {
    console.log('Preflight successful. No server or tests were started.');
  } else if (!existsSync(cli)) {
    throw new Error('Playwright is not installed. Run npm ci before executing project tests.');
  } else {
    const child = spawn(process.execPath, args, {
      cwd: REPOSITORY_ROOT, shell: false, stdio: 'inherit', windowsHide: true,
      env: {
        ...selectionEnvironment(selection),
        PLAYWRIGHT_HTML_OUTPUT_DIR: join(REPOSITORY_ROOT, 'playwright-report', selection.projectId, selection.environment),
      },
    });
    child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
    child.once('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
  }
} catch (error) {
  console.error(`Project execution rejected: ${error.message}`);
  process.exitCode = 1;
}
