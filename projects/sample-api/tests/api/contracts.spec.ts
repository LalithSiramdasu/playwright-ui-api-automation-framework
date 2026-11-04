import { test, expect } from '../../../../src/api/fixtures';
import { expectJsonResponse } from '../../../../src/api/expect-response';
import type { JsonContract } from '../../../../src/api/json-contract.mjs';

const inventoryContract: JsonContract = {
  type: 'object', required: ['items'], additionalProperties: false,
  properties: {
    items: { type: 'array', items: {
      type: 'object', required: ['sku', 'title', 'available'], additionalProperties: false,
      properties: {
        sku: { type: 'string', minLength: 2 }, title: { type: 'string', minLength: 2 },
        available: { type: 'boolean' },
      },
    } },
  },
};
const errorContract: JsonContract = {
  type: 'object', required: ['error'], additionalProperties: false,
  properties: { error: { type: 'string', minLength: 3 } },
};

test.describe('Sample API | reusable contract checks', () => {
  test('inventory has the documented typed contract @smoke @regression', async ({ apiClient }) => {
    const response = await apiClient.get('/api/inventory');
    const body = await expectJsonResponse(response, 200, inventoryContract) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  test('query parameters are serialized safely @regression', async ({ apiClient }) => {
    const response = await apiClient.get('/api/inventory', { params: { limit: 1 } });
    const body = await expectJsonResponse(response, 200, inventoryContract) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  test('invalid query returns a contract-valid 400 response @negative @regression', async ({ apiClient }) => {
    const response = await apiClient.get('/api/inventory', { params: { limit: -1 } });
    expect(await expectJsonResponse(response, 400, errorContract)).toEqual({ error: 'limit must be an integer between 1 and 20' });
  });

  test('unsupported method returns a documented 405 @negative @regression', async ({ apiClient }) => {
    const response = await apiClient.post('/api/inventory', { sku: 'S-999' });
    expect(await expectJsonResponse(response, 405, errorContract)).toEqual({ error: 'Method not allowed' });
  });
});
