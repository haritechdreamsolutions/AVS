import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(path: string = '/') {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  async getHeading(text: string | RegExp): Promise<Locator> {
    return this.page.getByRole('heading', { name: text });
  }

  async clickButton(name: string | RegExp) {
    await this.page.getByRole('button', { name }).click();
  }

  async expectToastMessage(text: string | RegExp) {
    const toast = this.page.locator('.toast, [role="alert"], .notification, .alert');
    await expect(toast.filter({ hasText: text })).toBeVisible({ timeout: 5000 });
  }
}
