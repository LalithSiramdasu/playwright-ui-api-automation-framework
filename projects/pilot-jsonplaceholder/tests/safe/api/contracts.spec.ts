import { test, expect } from '@playwright/test';
import { ReadOnlyApiClient } from '../../../../../src/api/read-only-client';
import { expectJsonResponse } from '../../../../../src/api/expect-response';

// This suite targets a public API intentionally provided for testing. It never
// creates or modifies data, is opt-in only, and is not scheduled by CI.
test.describe.configure({ mode: 'serial' });

const post = {
  type: 'object', required: ['id', 'userId', 'title', 'body'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    userId: { type: 'integer', minimum: 1 },
    title: { type: 'string', minLength: 1 },
    body: { type: 'string', minLength: 1 },
  },
} as const;
const user = {
  type: 'object', required: ['id', 'name', 'username', 'email'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    username: { type: 'string', minLength: 1 },
    email: { type: 'string', minLength: 3 },
  },
} as const;
const todo = {
  type: 'object', required: ['id', 'userId', 'title', 'completed'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    userId: { type: 'integer', minimum: 1 },
    title: { type: 'string', minLength: 1 },
    completed: { type: 'boolean' },
  },
} as const;

test.describe('External QA Pilot | JSONPlaceholder read-only API', () => {
  test('PAPI-01 post lookup returns contract fields @smoke @regression', async ({ request }) => {
    const body = await expectJsonResponse(await new ReadOnlyApiClient(request).get('/posts/1'), 200, post);
    expect((body as { id: number; userId: number }).id).toBe(1);
    expect((body as { id: number; userId: number }).userId).toBe(1);
  });

  test('PAPI-02 user lookup returns identity contract @smoke @regression', async ({ request }) => {
    const body = await expectJsonResponse(await new ReadOnlyApiClient(request).get('/users/1'), 200, user);
    expect((body as { id: number }).id).toBe(1);
  });

  test('PAPI-03 listing posts filtered by user respects parent ID @regression', async ({ request }) => {
    const response = await new ReadOnlyApiClient(request).get('/posts', { params: { userId: 1 } });
    const data = await expectJsonResponse(response, 200, { type: 'array', minItems: 1, items: post });
    expect((data as Array<{ userId: number }>).every((item) => item.userId === 1)).toBe(true);
  });

  test('PAPI-04 nested post comments belong to requested post @regression', async ({ request }) => {
    const response = await new ReadOnlyApiClient(request).get('/posts/1/comments');
    const data = await expectJsonResponse(response, 200, {
      type: 'array', minItems: 1, items: {
        type: 'object', required: ['id', 'postId', 'name', 'email', 'body'],
        properties: {
          id: { type: 'integer', minimum: 1 }, postId: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 }, email: { type: 'string', minLength: 3 },
          body: { type: 'string', minLength: 1 },
        },
      },
    });
    expect((data as Array<{ postId: number }>).every((item) => item.postId === 1)).toBe(true);
  });

  test('PAPI-05 todo item contract contains boolean completion @regression', async ({ request }) => {
    const body = await expectJsonResponse(await new ReadOnlyApiClient(request).get('/todos/1'), 200, todo);
    expect((body as { id: number }).id).toBe(1);
  });

  test('PAPI-06 filtered user albums respect their owner @regression', async ({ request }) => {
    const response = await new ReadOnlyApiClient(request).get('/albums', { params: { userId: 1 } });
    const data = await expectJsonResponse(response, 200, {
      type: 'array', minItems: 1, items: {
        type: 'object', required: ['id', 'userId', 'title'], properties: {
          id: { type: 'integer', minimum: 1 }, userId: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1 },
        },
      },
    });
    expect((data as Array<{ userId: number }>).every((item) => item.userId === 1)).toBe(true);
  });

  test('PAPI-07 missing post returns HTTP 404 @negative @regression', async ({ request }) => {
    const response = await new ReadOnlyApiClient(request).get('/posts/0');
    expect(response.status()).toBe(404);
  });

  test('PAPI-08 unrecognized user filter returns empty collection @negative @regression', async ({ request }) => {
    const response = await new ReadOnlyApiClient(request).get('/posts', { params: { userId: 999999 } });
    const body = await expectJsonResponse(response, 200, { type: 'array', items: post, maxItems: 0 });
    expect(body).toEqual([]);
  });
});
