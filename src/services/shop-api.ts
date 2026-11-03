import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface Credentials {
  email: string;
  password: string;
}

export interface OrderItem {
  productId: number;
  quantity: number;
}

/** Small API client: tests own assertions; this service owns HTTP request mechanics. */
export class ShopApi {
  constructor(private readonly request: APIRequestContext) {}

  getProducts(params?: { q?: string; category?: string }): Promise<APIResponse> {
    return this.request.get('/api/products', { params });
  }

  login(credentials: Credentials): Promise<APIResponse> {
    return this.request.post('/api/auth/login', { data: credentials });
  }

  createOrder(token: string, items: OrderItem[]): Promise<APIResponse> {
    return this.request.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: { items },
    });
  }
}
