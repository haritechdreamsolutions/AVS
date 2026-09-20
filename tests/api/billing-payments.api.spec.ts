import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('Billing & Payments API Suite', () => {
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

  test('GET /api/sales returns sales invoices with valid numeric balances', async () => {
    const res = await ownerContext.get('/api/sales');
    expect(res.status()).toBe(200);

    const sales = await res.json();
    expect(Array.isArray(sales)).toBe(true);

    if (sales.length > 0) {
      const invoice = sales[0];
      expect(invoice).toHaveProperty('id');
      expect(invoice.bill_number || invoice.invoice_number || invoice.invoice_no || invoice.id).toBeDefined();
      expect(Number(invoice.total_amount || invoice.final_total || invoice.grand_total || 0)).toBeGreaterThanOrEqual(0);
    }
  });

  test('GET /api/settlements returns payment and settlement records', async () => {
    const res = await ownerContext.get('/api/settlements');
    expect(res.status()).toBe(200);

    const settlements = await res.json();
    expect(Array.isArray(settlements)).toBe(true);
  });
});
