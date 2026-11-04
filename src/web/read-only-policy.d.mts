/** True only for GET/HEAD to an exact approved HTTPS origin. */
export function isReadOnlyOriginRequest(approvedOrigin: string, requestUrl: string, method: string): boolean;
