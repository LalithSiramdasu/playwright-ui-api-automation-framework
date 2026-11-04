import { randomUUID } from 'node:crypto';

/** One independently named data namespace per Playwright test (including retries). */
export class TestDataScope {
  #cleanups = [];
  #closed = false;
  constructor(label) {
    if (typeof label !== 'string' || !label.trim()) throw Error('Test scope label is required');
    this.namespace = `qa-${randomUUID().replaceAll('-', '').slice(0,12)}`;
    this.label = label;
  }
  unique(prefix = 'item') {
    if (this.#closed) throw Error('Cannot allocate data in a closed test scope');
    if (!/^[a-z][a-z0-9-]{0,24}$/.test(prefix)) throw Error('Invalid test data prefix');
    return `${prefix}-${this.namespace}-${randomUUID().slice(0,8)}`;
  }
  onCleanup(callback) {
    if (this.#closed) throw Error('Cannot register cleanup on a closed scope');
    if (typeof callback !== 'function') throw Error('Cleanup must be a function');
    this.#cleanups.push(callback);
  }
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    const errors = [];
    for (const cleanup of this.#cleanups.reverse()) {
      try { await cleanup(); }
      catch (error) { errors.push(error); }
    }
    this.#cleanups.length = 0;
    if (errors.length) throw new AggregateError(errors, `${errors.length} test-data cleanup operation(s) failed`);
  }
}
