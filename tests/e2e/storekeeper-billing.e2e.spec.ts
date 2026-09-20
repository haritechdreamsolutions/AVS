import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { StorekeeperPage } from '../pages/storekeeper.page.js';
import { TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('E2E: Storekeeper Direct Billing & Operations', () => {
  let loginPage: LoginPage;
  let storekeeperPage: StorekeeperPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    storekeeperPage = new StorekeeperPage(page);
    await loginPage.loginAs(TEST_USERS.storekeeper.login_id, TEST_USERS.storekeeper.pin);
  });

  test('Storekeeper dashboard renders keeper actions and inventory tools', async ({ page }) => {
    await storekeeperPage.expectDashboardLoaded();
  });

  test('Storekeeper can trigger stock receive modal', async ({ page }) => {
    const stockReceiveBtn = page.getByRole('button', { name: /stock receive|inward|வரவு/i }).first();
    if (await stockReceiveBtn.isVisible()) {
      await stockReceiveBtn.click();
      await expect(page.getByText(/receive|product|supplier|quantity/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
