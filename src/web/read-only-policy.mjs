/** Pure rule used by opt-in public browser smoke tests; not a network sandbox. */
export function isReadOnlyOriginRequest(approvedOrigin, requestUrl, method) {
  let approved;
  let requested;
  try {
    approved = new URL(approvedOrigin);
    requested = new URL(requestUrl);
  } catch { return false; }
  return approved.protocol === 'https:' && !approved.username && !approved.password &&
    requested.protocol === 'https:' && requested.origin === approved.origin &&
    ['GET', 'HEAD'].includes(method);
}
