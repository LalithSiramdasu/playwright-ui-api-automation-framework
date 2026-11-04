import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  loadProjectRegistry, validateProjectProfile, getEnabledProject, SUPPORTED_SUITES,
} from '../../src/core/project-registry.mjs';

const fixture = () => ({
  schemaVersion: 1, id: 'sample-web', name: 'Sample Website', type: 'web', enabled: true,
  allowedHosts: ['staging.example.test'],
  environments: { staging: { webBaseUrl: 'https://staging.example.test/', readOnly: true } },
  suites: ['smoke', 'ui', 'regression'], credentialEnv: { username: 'SAMPLE_USERNAME', password: 'SAMPLE_PASSWORD' },
});
const workdirs = [];
after(() => { for (const dir of workdirs) rmSync(dir, { recursive: true, force: true }); });
const makeRegistry = () => { const dir = mkdtempSync(join(tmpdir(), 'qa-projects-')); workdirs.push(dir); return dir; };
const writeProfile = (root, dirName, profile) => {
  const dir = join(root, dirName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'project.config.json'), JSON.stringify(profile));
};

test('Module 1: bundled Northline and API-template profiles both validate', () => {
  const profiles = loadProjectRegistry();
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const id of ['northline-goods', 'pilot-jsonplaceholder', 'pilot-the-internet', 'sample-api', 'sample-web', 'starter-api']) {
    assert.ok(byId.has(id), `Bundled project '${id}' should exist`);
  }
  assert.equal(byId.get('northline-goods').environments.local.webBaseUrl, 'http://127.0.0.1:4173/');
  assert.equal(byId.get('northline-goods').type, 'hybrid');
  assert.equal(byId.get('sample-api').enabled, true);
  assert.equal(byId.get('sample-api').type, 'api');
  assert.equal(byId.get('starter-api').enabled, false);
  assert.deepEqual(byId.get('starter-api').credentialEnv, { token: 'STARTER_API_TOKEN' });
  assert.ok(SUPPORTED_SUITES.includes('api'));
});

test('Module 1: lookup refuses malformed IDs, unknown projects and disabled templates', () => {
  const registry = loadProjectRegistry();
  assert.equal(getEnabledProject('northline-goods', registry).name, 'Northline Goods');
  assert.throws(() => getEnabledProject('../starter-api', registry), /invalid id/);
  assert.throws(() => getEnabledProject('starter-api', registry), /disabled template/);
  assert.throws(() => getEnabledProject('unknown-id', registry), /unknown project/);
});

test('Module 1: rejects credentials embedded in URL and unrecognized secret-bearing properties', () => {
  const embedded = fixture();
  embedded.environments.staging.webBaseUrl = 'https://admin:password@staging.example.test/';
  assert.throws(() => validateProjectProfile(embedded), /credentials/);
  const secret = fixture();
  secret.password = 'secret';
  assert.throws(() => validateProjectProfile(secret), /unknown property 'password'/);
  const variable = fixture();
  variable.credentialEnv.password = 'super-secret-password';
  assert.throws(() => validateProjectProfile(variable), /variable name/);
});

test('Module 1: rejects unexpected target host, wildcard hosts and unsafe protocols', () => {
  const host = fixture();
  host.environments.staging.webBaseUrl = 'https://attacker.example.test/';
  assert.throws(() => validateProjectProfile(host), /not in allowedHosts/);
  const wildcard = fixture();
  wildcard.allowedHosts = ['*.example.test'];
  assert.throws(() => validateProjectProfile(wildcard), /without wildcards/);
  const protocol = fixture();
  protocol.environments.staging.webBaseUrl = 'file:///etc/passwd';
  assert.throws(() => validateProjectProfile(protocol), /only HTTP\(S\)/);
});

test('Module 1: rejects remote HTTP, invalid production mode and query tokens', () => {
  const insecure = fixture();
  insecure.environments.staging.webBaseUrl = 'http://staging.example.test/';
  assert.throws(() => validateProjectProfile(insecure), /loopback/);
  const production = fixture();
  production.environments = { production: { webBaseUrl: 'https://staging.example.test/', readOnly: false } };
  assert.throws(() => validateProjectProfile(production), /production cannot opt out/);
  const query = fixture();
  query.environments.staging.webBaseUrl = 'https://staging.example.test/?token=abc';
  assert.throws(() => validateProjectProfile(query), /query strings/);
});

test('Module 1: enforces type-specific URL and suite requirements', () => {
  const api = fixture();
  api.type = 'api';
  assert.throws(() => validateProjectProfile(api), /API-only projects/);
  api.suites = ['api'];
  assert.throws(() => validateProjectProfile(api), /apiBaseUrl is required/);
  const duplicates = fixture();
  duplicates.suites = ['smoke', 'smoke'];
  assert.throws(() => validateProjectProfile(duplicates), /duplicate suites/);
});

test('Module 1: rejects profile folder mismatches and malformed files', () => {
  const dir = makeRegistry();
  writeProfile(dir, 'not-the-id', fixture());
  assert.throws(() => loadProjectRegistry(dir), /id must match directory name/);
  const malformed = makeRegistry();
  mkdirSync(join(malformed, 'broken-profile'));
  assert.throws(() => loadProjectRegistry(malformed), /missing or malformed JSON/);
});

test('Module 1: accepts two independent authorized-profile declarations without network calls', () => {
  const dir = makeRegistry();
  writeProfile(dir, 'sample-web', fixture());
  writeProfile(dir, 'sample-api', {
    schemaVersion: 1, id: 'sample-api', name: 'Sample API', type: 'api', enabled: false,
    allowedHosts: ['api.example.test'],
    environments: { test: { apiBaseUrl: 'https://api.example.test/v1/', readOnly: true } },
    suites: ['api', 'negative'], credentialEnv: { apiKey: 'SAMPLE_API_KEY' },
  });
  const profiles = loadProjectRegistry(dir);
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].type, 'api');
  assert.equal(profiles[1].type, 'web');
});
