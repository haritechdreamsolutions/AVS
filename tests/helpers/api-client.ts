import { APIRequestContext, request } from '@playwright/test';
import { API_BASE_URL } from '../fixtures/auth.fixtures.js';

export class ApiClient {
  private context: APIRequestContext | null = null;
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async init() {
    this.context = await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    return this;
  }

  async login(login_id: string, pin: string) {
    if (!this.context) await this.init();
    const response = await this.context!.post('/api/auth/login', {
      data: { login_id, pin },
    });
    return response;
  }

  async logout() {
    if (!this.context) return;
    return await this.context.post('/api/auth/logout');
  }

  async get(endpoint: string, params?: Record<string, string | number>) {
    if (!this.context) await this.init();
    return await this.context!.get(endpoint, { params });
  }

  async post(endpoint: string, data?: unknown) {
    if (!this.context) await this.init();
    return await this.context!.post(endpoint, { data });
  }

  async put(endpoint: string, data?: unknown) {
    if (!this.context) await this.init();
    return await this.context!.put(endpoint, { data });
  }

  async delete(endpoint: string) {
    if (!this.context) await this.init();
    return await this.context!.delete(endpoint);
  }

  async dispose() {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
  }
}
