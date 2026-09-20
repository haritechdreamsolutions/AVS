import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class DriverPosPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async selectRoute(routeName: string | RegExp) {
    await this.page.getByText(routeName).first().click();
  }

  async selectShop(shopName: string | RegExp) {
    await this.page.getByText(shopName).first().click();
  }

  async addItemToCart(productName: string, quantity: number = 1) {
    const productCard = this.page.locator(`text=${productName}`).first();
    await productCard.click();
  }

  async proceedToPayment() {
    await this.page.getByRole('button', { name: /payment|proceed|checkout/i }).click();
  }

  async collectCashPayment(amount?: number) {
    const cashBtn = this.page.getByRole('button', { name: /cash/i }).first();
    await cashBtn.click();
    if (amount) {
      const input = this.page.locator('input[type="number"]').first();
      await input.fill(String(amount));
    }
    await this.page.getByRole('button', { name: /confirm|complete|submit|save/i }).first().click();
  }

  async expectOrderSuccess() {
    await expect(this.page.getByText(/success|completed|bill generated/i)).toBeVisible({ timeout: 6000 });
  }
}
