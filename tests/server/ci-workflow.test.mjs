import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const manual = readFileSync('.github/workflows/project-tests.yml', 'utf8');
const release = readFileSync('.github/workflows/playwright.yml', 'utf8');

test('Module 8: scoped workflow allows only manual and weekly triggers', () => {
  assert.match(manual, /workflow_dispatch:/);
  assert.match(manual, /schedule:/);
  assert.match(manual, /cron: '17 3 \* \* 1'/);
  assert.doesNotMatch(manual, /\n {2}push:/);
});

test('Module 8: workflows never inject selected command input into a shell', () => {
  assert.match(manual, /node scripts\/ci-project\.mjs --preflight/);
  assert.match(manual, /node scripts\/ci-project\.mjs --execute/);
  assert.match(manual, /QA_REMOTE_APPROVAL: ''/);
  assert.doesNotMatch(manual, /run:.*\$\{\{.*inputs\./);
  assert.match(manual, /contents: read/);
  assert.match(manual, /retention-days: 14/);
});

test('Module 8: release CI uses locked installs and preserves regression/test stages', () => {
  assert.match(release, /npm ci --no-audit --no-fund/);
  assert.match(release, /npm --prefix dashboard ci --no-audit --no-fund/);
  for (const command of ['npm test', 'npm run test:sample-api', 'npm run test:sample-web',
    'npm run test:sample-api-staging', 'npm run test:dashboard', 'npm run test:server']) {
    assert.ok(release.includes(`run: ${command}`), `Missing release check ${command}`);
  }
});
