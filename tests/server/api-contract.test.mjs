import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateJsonContract } from '../../src/api/json-contract.mjs';

const schema = {
  type: 'object', additionalProperties: false, required: ['items', 'total'],
  properties: {
    items: { type: 'array', minItems: 1, items: {
      type: 'object', required: ['sku', 'available'], additionalProperties: false,
      properties: { sku: { type: 'string', minLength: 2 }, available: { type: 'boolean' } },
    } },
    total: { type: 'integer', minimum: 0 },
  },
};

test('Module 4: structural validation accepts typed nested objects', () => {
  assert.deepEqual(validateJsonContract({ items: [{ sku: 'S1', available: true }], total: 1 }, schema), []);
});
test('Module 4: reports missing fields, type mismatch and unexpected keys without echoing values', () => {
  const errors = validateJsonContract({ items: [{ sku: 123, available: 'password', token: 'SECRET' }], extra: 'SECRET' }, schema);
  assert.match(errors.join('\n'), /total: required property missing/);
  assert.match(errors.join('\n'), /sku: expected string/);
  assert.match(errors.join('\n'), /available: expected boolean/);
  assert.match(errors.join('\n'), /unexpected property/);
  assert.equal(errors.join('\n').includes('SECRET'), false);
});
test('Module 4: rejects incorrect array, number, enum and string limits', () => {
  const issues = validateJsonContract({ items: [], total: -1 }, schema);
  assert.match(issues.join('\n'), /minItems|fewer items/);
  assert.match(issues.join('\n'), /below minimum/);
  assert.match(validateJsonContract('bad', { type: 'string', enum: ['ok'] }).join(), /allowed enum/);
  assert.match(validateJsonContract('x', { type: 'string', minLength: 2 }).join(), /minLength/);
});
test('Module 4: invalid schema rules fail with a descriptive error', () => {
  assert.match(validateJsonContract({ a: 1 }, { type: 'unsupported' }).join(), /unsupported contract rule/);
});
