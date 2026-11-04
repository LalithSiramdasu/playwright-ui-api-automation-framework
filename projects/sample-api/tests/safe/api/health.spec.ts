import { test, expect } from '@playwright/test';
import { ReadOnlyApiClient } from '../../../../../src/api/read-only-client';
import { expectJsonResponse } from '../../../../../src/api/expect-response';

/** Staging/restricted suites never perform writes or password-grant requests. */
test.describe('Sample API | restricted staging checks', () => {
  test('health response is available without mutation @smoke @regression', async ({ request }) => {
    const client = new ReadOnlyApiClient(request);
    const response = await client.get('/health');
    expect(await expectJsonResponse(response, 200, {
      type: 'object', required: ['status', 'service'], additionalProperties: false,
      properties: { status: { type: 'string', enum: ['ok'] }, service: { type: 'string', enum: ['sample-api'] } },
    })).toEqual({ status: 'ok', service: 'sample-api' });
  });

  test('read-only inventory contract remains valid @regression', async ({ request }) => {
    const client = new ReadOnlyApiClient(request);
    const response = await client.get('/api/inventory');
    const body = await expectJsonResponse(response, 200, {
      type: 'object', required: ['items'], additionalProperties: false,
      properties: {
        items: { type: 'array', items: { type: 'object', required: ['sku', 'title', 'available'], additionalProperties: false,
          properties: { sku: { type: 'string' }, title: { type: 'string' }, available: { type: 'boolean' } } } },
      },
    }) as { items: Array<{ sku: string }> };
    expect(body.items[0]?.sku).toBe('S-001');
  });
});
