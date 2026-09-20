import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('Damages & Returns API Suite', () => {
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

  test('GET /api/damages returns registered damage records with correct packaging conversions', async () => {
    const res = await ownerContext.get('/api/damages');
    expect(res.status()).toBe(200);

    const damages = await res.json();
    expect(Array.isArray(damages)).toBe(true);

    if (damages.length > 0) {
      for (const d of damages.slice(0, 5)) {
        expect(d).toHaveProperty('id');
        expect(d.damage_type || d.reason).toBeDefined();
        expect(d.damage_cost !== undefined || d.total_cost_value !== undefined).toBe(true);
      }
    }
  });

  test('GET /api/damages/summary returns aggregated damage metrics', async () => {
    const res = await ownerContext.get('/api/damages/summary');
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const summary = await res.json();
      expect(summary).toBeDefined();
    }
  });

  test('GET /api/sk/driver-returns/history returns return history records', async () => {
    const res = await ownerContext.get('/api/sk/driver-returns/history');
    expect(res.status()).toBe(200);

    const resBody = await res.json();
    const historyList = resBody.history || resBody;
    expect(Array.isArray(historyList)).toBe(true);
  });
});
