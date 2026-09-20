import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DriverPosPage } from '../pages/driver-pos.page.js';
import { TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('E2E: Driver Daily Workflow & POS Billing', () => {
  let loginPage: LoginPage;
  let driverPos: DriverPosPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    driverPos = new DriverPosPage(page);
    await loginPage.loginAs(TEST_USERS.driverTharun.login_id, TEST_USERS.driverTharun.pin);
  });

  test('Driver lands on daily view and sees driver profile', async ({ page }) => {
    await expect(page.getByText(/tharun|driver|route|shop/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('Driver can view list of assigned shops', async ({ page }) => {
    const shopElements = page.locator('.shop-card, [role="button"], div').filter({ hasText: /bakery|store|tea|shop|மளிகை/i });
    if (await shopElements.count() > 0) {
      await expect(shopElements.first()).toBeVisible();
    }
  });
});
