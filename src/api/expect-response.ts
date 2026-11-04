import { expect, type APIResponse } from '@playwright/test';
import { validateJsonContract, type JsonContract } from './json-contract.mjs';

/** Verify HTTP status, JSON media type and a documented response contract. */
export async function expectJsonResponse(response: APIResponse, status: number, schema: JsonContract): Promise<unknown> {
  expect(response.status(), 'Unexpected HTTP status').toBe(status);
  expect(response.headers()['content-type'] ?? '', 'Expected JSON Content-Type').toMatch(/^application\/json(?:;|$)/i);
  const body: unknown = await response.json();
  const violations = validateJsonContract(body, schema);
  expect(violations, violations.join('\n')).toEqual([]);
  return body;
}
