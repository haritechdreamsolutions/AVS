import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class OwnerDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToTab(tabName: string | RegExp) {
    const tab = this.page.getByRole('button', { name: tabName }).or(this.page.getByText(tabName)).first();
    await tab.click();
  }

  async expectMetricVisible(metricLabel: string | RegExp) {
    await expect(this.page.getByText(metricLabel).first()).toBeVisible({ timeout: 5000 });
  }

  async expectOwnerViewLoaded() {
    await expect(this.page.getByRole('button', { name: /logout/i })).toBeVisible({ timeout: 10000 });
  }
}
