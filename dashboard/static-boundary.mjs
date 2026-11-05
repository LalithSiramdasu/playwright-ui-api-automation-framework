/** Resolve every report boundary to block symlink escapes from local report artifacts. */
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';

function inside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

/**
 * Boundaries go from trusted artifact root to one run's html directory.
 * The target must be a regular file below the last boundary in both its
 * lexical and real (symlink-resolved) location.
 */
export function isSafeStaticFile(target, boundaries) {
  if (!Array.isArray(boundaries) || boundaries.length === 0) return false;
  try {
    const resolved = [...boundaries, target].map((path) => realpathSync(path));
    for (let i = 1; i < resolved.length; i++) {
      if (!inside(resolved[i - 1], resolved[i])) return false;
    }
    return statSync(resolved.at(-1)).isFile();
  } catch {
    return false; // Missing file, permission failure or symlink loop: fail closed.
  }
}
