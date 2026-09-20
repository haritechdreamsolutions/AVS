import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('Inventory Lifecycle API Suite', () => {
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

  test('GET /api/inventory/warehouse-stock returns current warehouse stock levels', async () => {
    const res = await ownerContext.get('/api/inventory/warehouse-stock');
    expect(res.status()).toBe(200);

    const inventory = await res.json();
    expect(Array.isArray(inventory)).toBe(true);

    if (inventory.length > 0) {
      const item = inventory[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('selling_unit');
      expect(item).toHaveProperty('pieces_per_unit');
    }
  });

  test('GET /api/inventory/movements returns stock ledger history', async () => {
    const res = await ownerContext.get('/api/inventory/movements');
    expect(res.status()).toBe(200);

    const movements = await res.json();
    expect(Array.isArray(movements)).toBe(true);
  });

  test('GET /api/inventory/alerts returns stock alerts and thresholds', async () => {
    const res = await ownerContext.get('/api/inventory/alerts');
    expect(res.status()).toBe(200);

    const alerts = await res.json();
    expect(alerts).toBeDefined();
    expect(Array.isArray(alerts.alerts) || Array.isArray(alerts)).toBe(true);
  });
});
