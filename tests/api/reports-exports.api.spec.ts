import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('Reports & Exports API Suite', () => {
  let ownerContext: any;

  test.beforeAll(async ({ playwright }) => {
    ownerContext = await playwright.request.newContext({ baseURL: API_BASE_URL });
    await ownerContext.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.owner.login_id,
        pin: TEST_USERS.owner.pin,
      },
    });
  });

  test.afterAll(async () => {
    if (ownerContext) await ownerContext.dispose();
  });

  test('GET /api/dashboard/summary returns executive business metrics', async () => {
    const res = await ownerContext.get('/api/dashboard/summary');
    expect(res.status()).toBe(200);

    const summary = await res.json();
    expect(summary).toBeDefined();
  });

  test('GET /api/export/sales?format=csv returns CSV export with valid headers', async () => {
    const res = await ownerContext.get('/api/export/sales?format=csv');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('text/csv');
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test('GET /api/export/inventory?format=csv returns CSV export with valid stock headers', async () => {
    const res = await ownerContext.get('/api/export/inventory?format=csv');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('text/csv');
  });

  test('GET /api/audit-logs returns security audit events', async () => {
    const res = await ownerContext.get('/api/audit-logs');
    expect(res.status()).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
  });
});
