import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { TEST_USERS, API_BASE_URL } from '../fixtures/auth.fixtures.js';

test.describe('AVS Smoke Test Suite - Critical Path Verification', () => {
  test('Smoke: Backend Health Check is 200 and PostgreSQL connected', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
  });

  test('Smoke: Login Screen renders brand headers and numeric pad', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/');

    await expect(page.getByText('AVS AGENCIES').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Enter your Login ID (e.g. owner)')).toBeVisible();
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
  });

  test('Smoke: Owner can login with PIN 1234 and see dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(TEST_USERS.owner.login_id, TEST_USERS.owner.pin);

    // Verify owner view loaded
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible({ timeout: 10000 });
  });

  test('Smoke: Storekeeper can login with PIN 1111', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(TEST_USERS.storekeeper.login_id, TEST_USERS.storekeeper.pin);

    await expect(page.getByText(/store keeper|keeper|warehouse|inventory/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Smoke: Driver Tharun can login with PIN 0000', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(TEST_USERS.driverTharun.login_id, TEST_USERS.driverTharun.pin);

    await expect(page.getByText(/tharun|driver|today|route|shop/i).first()).toBeVisible({ timeout: 10000 });
  });
});
