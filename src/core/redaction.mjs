/** Local operator UI only: best-effort log redaction, not a secret-safe artifact exporter. */
import { loadProjectRegistry } from './project-registry.mjs';

export function configuredSecretValues(source = process.env, registry = loadProjectRegistry()) {
  const values = new Set();
  for (const profile of registry) {
    for (const variableName of Object.values(profile.credentialEnv ?? {})) {
      const value = source[variableName];
      // Short values can be generic text; never print them but don't corrupt reports.
      if (typeof value === 'string' && value.length >= 4) values.add(value);
    }
  }
  return [...values].sort((a, b) => b.length - a.length);
}

export function redactSensitiveText(input, secretValues = []) {
  let text = String(input);
  text = text.replace(/(Authorization\s*[:=]\s*Bearer\s+)[^\s,;"']+/gi, '$1[REDACTED]');
  text = text.replace(/(x-api-key\s*[:=]\s*)[^\s,;"']+/gi, '$1[REDACTED]');
  text = text.replace(/(password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?([^\s,"'};]+)/gi, '$1=[REDACTED]');
  for (const value of secretValues) {
    if (typeof value !== 'string' || value.length < 4) continue;
    text = text.split(value).join('[REDACTED]');
  }
  return text;
}
