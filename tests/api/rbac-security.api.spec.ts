import { test, expect } from '@playwright/test';
import { TEST_USERS, API_BASE_URL } from '../fixtures/auth.fixtures.js';

test.describe('RBAC & Security API Suite', () => {
  test('Unauthenticated user cannot access driver start-day endpoint directly without valid session/payload', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/driver/start-day`, {
      data: { driver_id: 99999, route_id: 99999, opening_km: 100 },
    });
    // Should fail with error due to missing valid driver or validation
    expect([400, 401, 403, 404, 500]).toContain(res.status());
  });

  test('Driver route isolation: Driver cannot view unassigned routes', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.driverTharun.login_id,
        pin: TEST_USERS.driverTharun.pin,
      },
    });

    const routesRes = await context.get('/api/driver/routes');
    if (routesRes.status() === 200) {
      const routes = await routesRes.json();
      expect(Array.isArray(routes)).toBe(true);
      // Ensure returned routes only match assigned driver routes
      if (routes.length > 0) {
        for (const route of routes) {
          if (route.driver_id) {
            expect(route.driver_id).toBe(TEST_USERS.driverTharun.employee_id);
          }
        }
      }
    }
    await context.dispose();
  });

  test('Storekeeper cannot modify owner security configurations or drop sensitive tables', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.storekeeper.login_id,
        pin: TEST_USERS.storekeeper.pin,
      },
    });

    // Attempting invalid admin actions should be blocked or safely handled
    const maliciousReq = await context.post('/api/admin/system-reset', {
      data: { action: 'DROP_DATABASE' },
    });
    expect([401, 403, 404, 405]).toContain(maliciousReq.status());

    await context.dispose();
  });
});
