import { test, expect } from '../../../../src/core/test-data-fixture';
import { ApiClient } from '../../../../src/api/api-client';

/** Sample local CRUD fixture; scoped records are removed even if a test fails. */
test.describe('Sample API | isolated test entities', () => {
  test('creates a unique entity and verifies independent retrieval @regression', async ({ request, isolatedData }) => {
    const api = new ApiClient(request);
    const label = isolatedData.unique('qa');
    const create = await api.post('/api/test-entities', { label });
    expect(create.status()).toBe(201);
    const entity = await create.json() as { id: string; label: string };
    isolatedData.onCleanup(async () => {
      const response = await api.delete(`/api/test-entities/${entity.id}`);
      expect(response.status()).toBe(200);
    });
    expect(entity.label).toBe(label);
    const fetched = await api.get(`/api/test-entities/${entity.id}`);
    expect(fetched.status()).toBe(200);
    expect(await fetched.json()).toEqual(entity);
  });
});
