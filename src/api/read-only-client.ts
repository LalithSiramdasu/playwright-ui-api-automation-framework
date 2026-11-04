import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ApiCallOptions } from './api-client';
import { ApiClient } from './api-client';

/** Deliberately exposes GET only; rejects redirects and off-origin URLs via ApiClient. */
export class ReadOnlyApiClient {
  private readonly client: ApiClient;
  constructor(context: APIRequestContext, bearer?: string) {
    const base = new ApiClient(context);
    this.client = bearer ? base.withBearer(bearer) : base;
  }
  get(path: string, options?: ApiCallOptions): Promise<APIResponse> {
    return this.client.get(path, options);
  }
}
