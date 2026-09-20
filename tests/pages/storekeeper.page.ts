import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class StorekeeperPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openDirectBilling() {
    await this.page.getByRole('button', { name: /direct billing|store billing/i }).first().click();
  }

  async openStockReceive() {
    await this.page.getByRole('button', { name: /stock receive|inward/i }).first().click();
  }

  async openReturnsVerification() {
    await this.page.getByRole('button', { name: /returns|verify returns/i }).first().click();
  }

  async expectDashboardLoaded() {
    await expect(this.page.getByText(/store keeper|keeper dashboard/i).first()).toBeVisible({ timeout: 6000 });
  }
}
