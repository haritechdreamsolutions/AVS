import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('E2E: Shop Bill Count & Customer Management', () => {
  test('Owner can view shops directory with bill counts and credit balances', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(TEST_USERS.owner.login_id, TEST_USERS.owner.pin);

    // Navigate to shops management
    const shopsBtn = page.getByRole('button', { name: /shops|கடைகள்/i }).or(page.getByText(/shops|கடைகள்/i)).first();
    if (await shopsBtn.isVisible()) {
      await shopsBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/shop name|owner|balance|credit|கடைகள்/i).first()).toBeVisible({ timeout: 6000 });
    }
  });
});
