import { test, expect } from '@playwright/test';
import { TEST_USERS, API_BASE_URL } from '../fixtures/auth.fixtures.js';

test.describe('Authentication API Suite', () => {
  test('Owner login with valid PIN succeeds with session cookie', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const response = await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.owner.login_id,
        pin: TEST_USERS.owner.pin,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.role).toBe(TEST_USERS.owner.role);

    // Verify session persistence by requesting me/user
    const meRes = await context.get('/api/auth/me');
    expect(meRes.status()).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.role).toBe('OWNER');

    await context.dispose();
  });

  test('Storekeeper login with valid PIN succeeds', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const response = await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.storekeeper.login_id,
        pin: TEST_USERS.storekeeper.pin,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('STORE_KEEPER');
    await context.dispose();
  });

  test('Driver Tharun login succeeds and returns driver employee record', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const response = await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.driverTharun.login_id,
        pin: TEST_USERS.driverTharun.pin,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('DRIVER');
    await context.dispose();
  });

  test('Login fails with invalid PIN', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const response = await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.owner.login_id,
        pin: '9999', // incorrect PIN
      },
    });

    const body = await response.json();
    expect(body.success).toBe(false);
    await context.dispose();
  });

  test('Login fails with non-existent user ID', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const response = await context.post('/api/auth/login', {
      data: {
        login_id: 'non_existent_user_9999',
        pin: '1234',
      },
    });

    const body = await response.json();
    expect(body.success).toBe(false);
    await context.dispose();
  });

  test('Logout terminates the active session', async ({ playwright }) => {
    const context = await playwright.request.newContext({ baseURL: API_BASE_URL });
    // First login
    await context.post('/api/auth/login', {
      data: {
        login_id: TEST_USERS.owner.login_id,
        pin: TEST_USERS.owner.pin,
      },
    });

    // Then logout
    const logoutRes = await context.post('/api/auth/logout');
    expect(logoutRes.status()).toBe(200);

    // After logout, session check should fail or return unauthenticated
    const meRes = await context.get('/api/auth/me');
    expect([401, 403, 200]).toContain(meRes.status());
    if (meRes.status() === 200) {
      const meBody = await meRes.json();
      expect(meBody.authenticated).toBeFalsy();
    }
    await context.dispose();
  });
});
