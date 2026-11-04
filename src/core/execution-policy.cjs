/* global URL, process */
/**
 * Module 5. Portable CJS policy, shared by the Node runner and Playwright's
 * configuration loader (which may transform its TS config to CommonJS).
 * This is an execution gate, NOT a sandbox for untrusted test source code.
 */
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const STAGING_ENVIRONMENTS = new Set(['development', 'test', 'staging']);

function assessTargetPolicy(profile, environment, options = {}) {
  const target = profile?.environments?.[environment];
  if (!target) throw Error(`Unknown environment '${environment}'`);
  const urls = [target.webBaseUrl, target.apiBaseUrl].filter(Boolean).map((value) => new URL(value));
  if (!urls.length) throw Error('Missing project target URL');
  const remoteHosts = [...new Set(urls.filter((url) => !LOOPBACK.has(url.hostname)).map((url) => url.hostname))];
  const remote = remoteHosts.length > 0;
  if (!remote) {
    if (environment !== 'local' && !target.readOnly) {
      throw Error('Non-local environments must be explicitly read-only');
    }
    return Object.freeze({ remote: false, restricted: Boolean(target.readOnly), host: null });
  }
  // Remote, mixed-host and production targets fail closed. No exceptions via UI or CLI.
  if (remoteHosts.length !== 1 || urls.some((url) => LOOPBACK.has(url.hostname))) {
    throw Error('Remote targets must use one dedicated approved host');
  }
  if (!STAGING_ENVIRONMENTS.has(environment)) throw Error('Remote execution is only supported for development, test and staging');
  if (urls.some((url) => url.protocol !== 'https:')) throw Error('Remote execution requires HTTPS');
  if (!target.readOnly) throw Error('Remote environments must be read-only');
  if (profile.remoteExecution?.enabled !== true) throw Error('Remote execution is not enabled in the reviewed project profile');
  const approval = options.approval ?? process.env.QA_REMOTE_APPROVAL;
  if (options.remoteOptIn !== true || approval !== remoteHosts[0]) {
    throw Error(`Remote target '${remoteHosts[0]}' requires --allow-remote and QA_REMOTE_APPROVAL set to the exact approved host`);
  }
  return Object.freeze({ remote: true, restricted: true, host: remoteHosts[0] });
}

module.exports = { assessTargetPolicy };
