/** Crash-resistant local dashboard history. Never silently discard corrupted history. */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function loadRunHistory(path, limit = 100) {
  if (!existsSync(path)) return [];
  let records;
  try {
    records = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Dashboard history at '${path}' is unreadable. The original file was preserved; back it up and repair the JSON before restarting. ${error.message}`);
  }
  if (!Array.isArray(records) || records.some((run) =>
    !run || typeof run !== 'object' || Array.isArray(run) ||
    typeof run.id !== 'string' || !run.id ||
    (run.logs !== undefined && !Array.isArray(run.logs)) ||
    (run.cases !== undefined && !Array.isArray(run.cases)))) {
    throw new Error(`Dashboard history at '${path}' has invalid records. The original file was preserved; back it up and repair the JSON before restarting.`);
  }
  return records.slice(0, limit);
}

/** Same-directory temporary file + rename prevents partial JSON from replacing history. */
export function saveRunHistory(path, records, limit = 100) {
  const temp = join(dirname(path), `.runs-${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, JSON.stringify(records.slice(0, limit), null, 2), {
      encoding: 'utf8', flag: 'wx', flush: true,
    });
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}
