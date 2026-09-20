import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async fillLoginId(loginId: string) {
    const input = this.page.getByPlaceholder('Enter your Login ID (e.g. owner)');
    await input.fill(loginId);
  }

  async enterPin(pin: string) {
    for (const digit of pin) {
      // Click the button with exact digit or type
      await this.page.getByRole('button', { name: digit, exact: true }).click();
    }
  }

  async submitLogin() {
    const enterBtn = this.page.getByRole('button', { name: /enter|login/i }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
    } else {
      await this.page.keyboard.press('Enter');
    }
  }

  async loginAs(loginId: string, pin: string) {
    await this.goto('/');
    await this.fillLoginId(loginId);
    await this.enterPin(pin);
    await this.submitLogin();
    await this.page.waitForTimeout(1000);
  }

  async expectErrorMessage(message?: string | RegExp) {
    if (message) {
      await expect(this.page.getByText(message)).toBeVisible({ timeout: 5000 });
    } else {
      const errorEl = this.page.locator('.text-rose-600, .bg-rose-50');
      await expect(errorEl).toBeVisible({ timeout: 5000 });
    }
  }
}
