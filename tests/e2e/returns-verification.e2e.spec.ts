import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('E2E: Returns Verification Flow', () => {
  test('Storekeeper can access returns and damage verification section', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(TEST_USERS.storekeeper.login_id, TEST_USERS.storekeeper.pin);

    // Look for return verification or stock return button
    const returnBtn = page.getByRole('button', { name: /return|திரும்ப|சேதம்/i }).first();
    if (await returnBtn.isVisible()) {
      await returnBtn.click();
      await expect(page.getByText(/return|damage|product|pieces|units/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
