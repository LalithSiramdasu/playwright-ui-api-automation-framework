import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TestDataScope } from '../../src/core/test-data.mjs';

test('Module 5: each test scope creates distinct safe data IDs', async () => {
  const a = new TestDataScope('project-a/test-1');
  const b = new TestDataScope('project-b/test-1');
  assert.notEqual(a.namespace, b.namespace);
  assert.notEqual(a.unique('order'), b.unique('order'));
  assert.match(a.unique('customer'), /^customer-qa-[a-f0-9]+-[a-f0-9]+$/);
  assert.throws(() => a.unique('../escape'), /Invalid test data prefix/);
  await Promise.all([a.close(), b.close()]);
});

test('Module 5: data cleanup runs in reverse order exactly once', async () => {
  const scope = new TestDataScope('sample');
  const order = [];
  scope.onCleanup(async () => order.push('created-first'));
  scope.onCleanup(async () => order.push('created-last'));
  await scope.close();
  await scope.close();
  assert.deepEqual(order, ['created-last', 'created-first']);
  assert.throws(() => scope.unique(), /closed/);
  assert.throws(() => scope.onCleanup(() => {}), /closed/);
});

test('Module 5: failed cleanup still executes remaining cleanup callbacks', async () => {
  const scope = new TestDataScope('sample');
  let recovered = false;
  scope.onCleanup(() => { recovered = true; });
  scope.onCleanup(() => { throw Error('cleanup failed'); });
  await assert.rejects(scope.close(), AggregateError);
  assert.equal(recovered, true);
});
