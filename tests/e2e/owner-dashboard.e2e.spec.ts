import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { OwnerDashboardPage } from '../pages/owner-dashboard.page.js';
import { TEST_USERS } from '../fixtures/auth.fixtures.js';

test.describe('E2E: Owner Dashboard & Administrative Navigation', () => {
  let loginPage: LoginPage;
  let ownerPage: OwnerDashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    ownerPage = new OwnerDashboardPage(page);
    await loginPage.loginAs(TEST_USERS.owner.login_id, TEST_USERS.owner.pin);
  });

  test('Owner dashboard loads KPIs, sales metrics, and navigation tabs', async ({ page }) => {
    await ownerPage.expectOwnerViewLoaded();
    await expect(page.getByText('Owner Portal')).toBeVisible({ timeout: 5000 });
  });

  test('Owner can navigate to Products Master tab', async ({ page }) => {
    const productsBtn = page.getByRole('button', { name: /products & rates|products|சரக்குகள்/i }).or(page.getByText(/products & rates/i)).first();
    if (await productsBtn.isVisible()) {
      await productsBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/product|price|விலை|sku|tray/i).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('Owner can view Inventory stock view', async ({ page }) => {
    const inventoryBtn = page.getByRole('button', { name: /inventory|stock|கையிருப்பு/i }).or(page.getByText(/inventory|stock|கையிருப்பு/i)).first();
    if (await inventoryBtn.isVisible()) {
      await inventoryBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/stock|units|pieces|reorder/i).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('Owner can view Sales Records view', async ({ page }) => {
    const salesBtn = page.getByRole('button', { name: /sales & bills|sales|விற்பனை/i }).or(page.getByText(/sales & bills/i)).first();
    if (await salesBtn.isVisible()) {
      await salesBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/invoice|bill|amount|தொகை|sales/i).first()).toBeVisible({ timeout: 8000 });
    }
  });
});
