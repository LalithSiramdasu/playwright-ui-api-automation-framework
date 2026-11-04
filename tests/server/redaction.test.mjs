import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactSensitiveText, configuredSecretValues } from '../../src/core/redaction.mjs';

test('Module 5: log redaction hides configured credentials and auth headers', () => {
  const text = 'Authorization: Bearer live-token x-api-key: anotherkey password="sensitive" mysecret-value';
  const out = redactSensitiveText(text, ['mysecret-value']);
  for (const secret of ['live-token', 'anotherkey', 'sensitive', 'mysecret-value']) {
    assert.equal(out.includes(secret), false);
  }
  assert.match(out, /\[REDACTED\]/);
});

test('Module 5: configured secret values only come from declared variable references', () => {
  const registry = [{ credentialEnv: { token: 'SERVICE_TOKEN' } }];
  const values = configuredSecretValues({ SERVICE_TOKEN: 'long-secret', UNDECLARED: 'do-not-collect' }, registry);
  assert.deepEqual(values, ['long-secret']);
});
