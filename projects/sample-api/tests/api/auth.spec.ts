import { test, expect } from '../../../../src/api/fixtures';
import { requiredCredential } from '../../../../src/api/api-client';
import { expectJsonResponse } from '../../../../src/api/expect-response';
import type { JsonContract } from '../../../../src/api/json-contract.mjs';

const credentials = { username: 'api-tester@example.test', password: 'LocalOnly123!' }; // Local fixture only
const tokenContract: JsonContract = {
  type: 'object', required: ['accessToken', 'tokenType', 'expiresIn'], additionalProperties: false,
  properties: {
    accessToken: { type: 'string', minLength: 12 },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'integer', minimum: 1 },
  },
};
const accountContract: JsonContract = {
  type: 'object', required: ['accountId', 'role', 'active'], additionalProperties: false,
  properties: {
    accountId: { type: 'string', minLength: 3 },
    role: { type: 'string', enum: ['tester'] },
    active: { type: 'boolean' },
  },
};
const errorContract: JsonContract = {
  type: 'object', required: ['error'], additionalProperties: false,
  properties: { error: { type: 'string', minLength: 3 } },
};

test.describe('Sample API | reusable authenticated API client', () => {
  test('password grant returns a contract-valid bearer token @smoke @regression', async ({ apiClient }) => {
    const response = await apiClient.post('/api/auth/token', credentials);
    const body = await expectJsonResponse(response, 200, tokenContract) as { accessToken: string };
    expect(body.accessToken).not.toBe('');
  });

  test('bearer token authorizes a project-specific account request @regression', async ({ apiClient }) => {
    const response = await apiClient.post('/api/auth/token', credentials);
    const { accessToken } = await expectJsonResponse(response, 200, tokenContract) as { accessToken: string };
    const account = await apiClient.withBearer(accessToken).get('/api/account');
    const body = await expectJsonResponse(account, 200, accountContract);
    expect(body).toEqual({ accountId: 'sample-account', role: 'tester', active: true });
  });

  test('unauthorized account requests return 401 JSON @negative @regression', async ({ apiClient }) => {
    for (const client of [apiClient, apiClient.withBearer('invalid-demo-token')]) {
      const response = await client.get('/api/account');
      expect(await expectJsonResponse(response, 401, errorContract)).toEqual({ error: 'Unauthorized' });
    }
  });

  test('login rejects absent and incorrect credentials @negative @regression', async ({ apiClient }) => {
    expect(await expectJsonResponse(await apiClient.post('/api/auth/token', {}), 400, errorContract))
      .toEqual({ error: 'Username and password are required' });
    expect(await expectJsonResponse(await apiClient.post('/api/auth/token', { username: credentials.username, password: 'wrong' }), 401, errorContract))
      .toEqual({ error: 'Invalid credentials' });
  });

  test('API-key authentication accepts local fixture key @smoke @regression', async ({ apiClient }) => {
    const key = process.env.SAMPLE_API_KEY ?? 'local-demo-key';
    const response = await apiClient.withApiKey(key).get('/api/metrics');
    const metricsContract: JsonContract = {
      type: 'object', required: ['service', 'healthy', 'requestsProcessed'], additionalProperties: false,
      properties: {
        service: { type: 'string', enum: ['sample-api'] },
        healthy: { type: 'boolean' },
        requestsProcessed: { type: 'integer', minimum: 0 },
      },
    };
    expect(await expectJsonResponse(response, 200, metricsContract)).toEqual({ service: 'sample-api', healthy: true, requestsProcessed: 1 });
  });

  test('API-key authentication rejects missing or invalid keys @negative @regression', async ({ apiClient }) => {
    for (const client of [apiClient, apiClient.withApiKey('invalid-demo-key')]) {
      const response = await client.get('/api/metrics');
      expect(await expectJsonResponse(response, 401, errorContract)).toEqual({ error: 'Invalid API key' });
    }
  });

  test('required credentials are resolved from variables, not project profiles @negative', () => {
    expect(requiredCredential('SAMPLE_API_KEY', { SAMPLE_API_KEY: 'fixture-only-secret' })).toBe('fixture-only-secret');
    expect(() => requiredCredential('SAMPLE_API_KEY', {})).toThrow('Missing required credential: SAMPLE_API_KEY');
    expect(() => requiredCredential('unsafe variable name', {})).toThrow('Invalid credential environment variable name');
  });

  test('client blocks arbitrary URL destinations and malformed auth headers @negative', async ({ apiClient }) => {
    await expect(apiClient.get('https://untrusted.example.test/')).rejects.toThrow(/relative root path/);
    await expect(apiClient.get('//untrusted.example.test/')).rejects.toThrow(/relative root path/);
    expect(() => apiClient.withBearer('bad\r\nHeader: injected')).toThrow(/invalid bearer token/);
    expect(() => apiClient.withApiKey('abc', 'bad header')).toThrow(/header name/);
  });
});
