import type { APIRequestContext, APIResponse } from '@playwright/test';

/** Options apply to a single request; headers are merged without modifying the client. */
export interface ApiCallOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
}
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function safeEndpoint(path: string): string {
  // API requests are constrained to relative paths on the configured API origin.
  if (typeof path !== 'string' || !/^\/(?!\/)[^?#\\]*$/.test(path) || path.split('/').includes('..')) {
    throw new Error('API endpoint must be a relative root path without query strings or traversal');
  }
  return path;
}
function validHeaderValue(value: string, kind: string): string {
  if (typeof value !== 'string' || !value || /[\r\n]/.test(value)) throw new Error(`Missing or invalid ${kind}`);
  return value;
}

/** Creates an immutable credential-aware client around Playwright's request context. */
export class ApiClient {
  constructor(private readonly request: APIRequestContext, private readonly defaults: Readonly<Record<string, string>> = {}) {}

  withBearer(token: string): ApiClient {
    return new ApiClient(this.request, { ...this.defaults, Authorization: `Bearer ${validHeaderValue(token, 'bearer token')}` });
  }

  withApiKey(apiKey: string, header = 'x-api-key'): ApiClient {
    if (!/^[a-z][a-z0-9-]{0,63}$/i.test(header)) throw new Error('Invalid API key header name');
    return new ApiClient(this.request, { ...this.defaults, [header]: validHeaderValue(apiKey, 'API key') });
  }

  /** API paths are relative to the project's Playwright API baseURL, never absolute URLs. */
  async send(method: HttpMethod, endpoint: string, options: ApiCallOptions & { data?: unknown } = {}): Promise<APIResponse> {
    const path = safeEndpoint(endpoint);
    return this.request.fetch(path, {
      method,
      headers: { ...this.defaults, ...options.headers },
      ...(options.params ? { params: options.params } : {}),
      ...(Object.hasOwn(options, 'data') ? { data: options.data } : {}),
      ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
      failOnStatusCode: false,
      maxRedirects: 0,
    });
  }

  get(endpoint: string, options?: ApiCallOptions): Promise<APIResponse> { return this.send('GET', endpoint, options); }
  post(endpoint: string, data: unknown, options?: ApiCallOptions): Promise<APIResponse> {
    return this.send('POST', endpoint, { ...options, data });
  }
  put(endpoint: string, data: unknown, options?: ApiCallOptions): Promise<APIResponse> {
    return this.send('PUT', endpoint, { ...options, data });
  }
  patch(endpoint: string, data: unknown, options?: ApiCallOptions): Promise<APIResponse> {
    return this.send('PATCH', endpoint, { ...options, data });
  }
  delete(endpoint: string, options?: ApiCallOptions): Promise<APIResponse> { return this.send('DELETE', endpoint, options); }
}

/** Resolve a profile's variable name, never a credential value, with no secret in errors. */
export function requiredCredential(variableName: string, source: NodeJS.ProcessEnv = process.env): string {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(variableName)) throw new Error('Invalid credential environment variable name');
  const credential = source[variableName];
  if (!credential) throw new Error(`Missing required credential: ${variableName}`);
  return credential;
}
