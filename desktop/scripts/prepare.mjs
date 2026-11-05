import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const dest = join(root, 'desktop', 'build', 'runtime');

if (process.platform !== 'win32') {
  console.error('Run Windows desktop packaging on a Windows machine.');
  process.exitCode = 1;
} else {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const name of ['demo-app', 'src', 'tests', 'projects']) {
    cpSync(join(root, name), join(dest, name), {
      recursive: true,
      filter: (path) => !/(^|[\\/])(?:node_modules|\.env(?:\..*)?|\.auth|test-results|playwright-report|reports)(?:[\\/]|$)/i.test(path),
    });
  }
  for (const name of ['package.json', 'playwright.config.ts', 'tsconfig.json']) {
    copyFileSync(join(root, name), join(dest, name));
  }
  mkdirSync(join(dest, 'dashboard'), { recursive: true });
  for (const name of ['server.mjs', 'analytics.mjs', 'reporting.mjs', 'storage.mjs', 'static-boundary.mjs']) {
    copyFileSync(join(root, 'dashboard', name), join(dest, 'dashboard', name));
  }
  if (!existsSync(join(root, 'dashboard', 'dist', 'index.html'))) throw Error('Build dashboard before packaging.');
  cpSync(join(root, 'dashboard', 'dist'), join(dest, 'dashboard', 'dist'), { recursive: true });
  for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    const from = join(root, 'node_modules', ...name.split('/'));
    if (!existsSync(from)) throw Error('Playwright dependency missing: ' + name);
    cpSync(from, join(dest, 'node_modules', ...name.split('/')), { recursive: true });
  }
  mkdirSync(join(dest, 'bin'), { recursive: true });
  copyFileSync(process.execPath, join(dest, 'bin', 'node.exe'));
  console.log('Windows runtime prepared. No private dashboard history or credentials copied.');
  console.log('Install Playwright browsers into:', join(dest, 'browsers'));
}
