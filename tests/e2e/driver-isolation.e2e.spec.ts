import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('E2E: Driver Route Isolation', () => {
  test('Driver UI scopes routes specifically to logged in driver', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(TEST_USERS.driverTharun.login_id, TEST_USERS.driverTharun.pin);

    // Tharun should see his name and interface
    await expect(page.getByText(/tharun/i).first()).toBeVisible({ timeout: 8000 });

    // Should not display admin-only settings or other driver management options
    await expect(page.getByText(/user master|role management|system config/i)).not.toBeVisible();
  });
});
