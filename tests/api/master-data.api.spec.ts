import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('Master Data API Suite', () => {
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

  test('GET /api/products returns product list with valid packaging attributes', async () => {
    const res = await ownerContext.get('/api/products');
    expect(res.status()).toBe(200);

    const products = await res.json();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);

    const first = products[0];
    expect(first).toHaveProperty('id');
    expect(first.name || first.product_name).toBeDefined();
    expect(first).toHaveProperty('selling_unit');
    expect(first).toHaveProperty('pieces_per_unit');
    expect(Number(first.pieces_per_unit)).toBeGreaterThan(0);
  });

  test('GET /api/categories returns product categories', async () => {
    const res = await ownerContext.get('/api/categories');
    expect(res.status()).toBe(200);

    const categories = await res.json();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  test('GET /api/shops returns registered customer shops', async () => {
    const res = await ownerContext.get('/api/shops');
    expect(res.status()).toBe(200);

    const shops = await res.json();
    expect(Array.isArray(shops)).toBe(true);
    expect(shops.length).toBeGreaterThan(0);

    const firstShop = shops[0];
    expect(firstShop).toHaveProperty('id');
    expect(firstShop.name || firstShop.shop_name).toBeDefined();
  });

  test('GET /api/villages returns registered villages/areas', async () => {
    const res = await ownerContext.get('/api/villages');
    expect(res.status()).toBe(200);

    const villages = await res.json();
    expect(Array.isArray(villages)).toBe(true);
    expect(villages.length).toBeGreaterThan(0);
  });

  test('GET /api/drivers returns active driver records', async () => {
    const res = await ownerContext.get('/api/drivers');
    expect(res.status()).toBe(200);

    const drivers = await res.json();
    expect(Array.isArray(drivers)).toBe(true);
    expect(drivers.length).toBeGreaterThan(0);
  });

  test('GET /api/employees returns system employees', async () => {
    const res = await ownerContext.get('/api/employees');
    expect(res.status()).toBe(200);

    const employees = await res.json();
    expect(Array.isArray(employees)).toBe(true);
    expect(employees.length).toBeGreaterThan(0);
  });

  test('GET /api/routes returns defined delivery routes', async () => {
    const res = await ownerContext.get('/api/routes');
    expect(res.status()).toBe(200);

    const routes = await res.json();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });
});
