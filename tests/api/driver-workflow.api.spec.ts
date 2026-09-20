import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('Driver Workflow API Suite', () => {
  let driverContext: any;

  test.beforeAll(async ({ playwright }) => {
    driverContext = await playwright.request.newContext({ baseURL: API_BASE_URL });
    await driverContext.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.driverTharun.login_id,
        pin: TEST_USERS.driverTharun.pin,
      },
    });
  });

  test.afterAll(async () => {
    if (driverContext) await driverContext.dispose();
  });

  test('GET /api/driver/active-session returns current session status for driver', async () => {
    const res = await driverContext.get(`/api/driver/active-session?driver_id=${TEST_USERS.driverTharun.employee_id}`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const session = await res.json();
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('status');
    }
  });

  test('GET /api/driver/day-summary returns calculated totals for driver', async () => {
    const res = await driverContext.get(`/api/driver/day-summary?driver_id=${TEST_USERS.driverTharun.employee_id}`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const summary = await res.json();
      expect(summary).toBeDefined();
    }
  });

  test('GET /api/shops returns shops for the assigned driver routes', async () => {
    const res = await driverContext.get('/api/shops');
    expect(res.status()).toBe(200);

    const shops = await res.json();
    expect(Array.isArray(shops)).toBe(true);
    expect(shops.length).toBeGreaterThan(0);
  });
});
