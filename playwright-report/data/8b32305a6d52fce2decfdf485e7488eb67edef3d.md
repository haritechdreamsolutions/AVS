# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke\smoke.spec.ts >> AVS Smoke Test Suite - Critical Path Verification >> Smoke: Driver Tharun can login with PIN 0000
- Location: tests\smoke\smoke.spec.ts:38:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/tharun|driver|today|route|shop/i).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/tharun|driver|today|route|shop/i).first() with timeout 10000ms
  - waiting for getByText(/tharun|driver|today|route|shop/i).first()

```

```yaml
- region "Notifications alt+T"
- text: A
- heading "AVS AGENCIES" [level=1]
- paragraph: AVS MANAGEMENT SYSTEM
- img
- text: Login ID
- textbox "Enter your Login ID (e.g. owner)": tharun
- img
- text: Security PIN (4 Digits)
- paragraph: Invalid PIN. 4 left.
- button "1"
- button "2"
- button "3"
- button "4"
- button "5"
- button "6"
- button "7"
- button "8"
- button "9"
- button "Clear"
- button "0"
- button "Enter" [disabled]
- paragraph: "Owner login: ID = owner | PIN = 1234"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { LoginPage } from '../pages/login.page.js';
  3  | import { TEST_USERS, API_BASE_URL } from '../fixtures/auth.fixtures.js';
  4  | 
  5  | test.describe('AVS Smoke Test Suite - Critical Path Verification', () => {
  6  |   test('Smoke: Backend Health Check is 200 and PostgreSQL connected', async ({ request }) => {
  7  |     const res = await request.get(`${API_BASE_URL}/health`);
  8  |     expect(res.status()).toBe(200);
  9  |     const body = await res.json();
  10 |     expect(body.status).toBe('ok');
  11 |     expect(body.database).toBe('connected');
  12 |   });
  13 | 
  14 |   test('Smoke: Login Screen renders brand headers and numeric pad', async ({ page }) => {
  15 |     const loginPage = new LoginPage(page);
  16 |     await loginPage.goto('/');
  17 | 
  18 |     await expect(page.getByText('AVS AGENCIES').first()).toBeVisible({ timeout: 5000 });
  19 |     await expect(page.getByPlaceholder('Enter your Login ID (e.g. owner)')).toBeVisible();
  20 |     await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
  21 |   });
  22 | 
  23 |   test('Smoke: Owner can login with PIN 1234 and see dashboard', async ({ page }) => {
  24 |     const loginPage = new LoginPage(page);
  25 |     await loginPage.loginAs(TEST_USERS.owner.login_id, TEST_USERS.owner.pin);
  26 | 
  27 |     // Verify owner view loaded
  28 |     await expect(page.getByRole('button', { name: /logout/i })).toBeVisible({ timeout: 10000 });
  29 |   });
  30 | 
  31 |   test('Smoke: Storekeeper can login with PIN 1111', async ({ page }) => {
  32 |     const loginPage = new LoginPage(page);
  33 |     await loginPage.loginAs(TEST_USERS.storekeeper.login_id, TEST_USERS.storekeeper.pin);
  34 | 
  35 |     await expect(page.getByText(/store keeper|keeper|warehouse|inventory/i).first()).toBeVisible({ timeout: 10000 });
  36 |   });
  37 | 
  38 |   test('Smoke: Driver Tharun can login with PIN 0000', async ({ page }) => {
  39 |     const loginPage = new LoginPage(page);
  40 |     await loginPage.loginAs(TEST_USERS.driverTharun.login_id, TEST_USERS.driverTharun.pin);
  41 | 
> 42 |     await expect(page.getByText(/tharun|driver|today|route|shop/i).first()).toBeVisible({ timeout: 10000 });
     |                                                                             ^ Error: expect(locator).toBeVisible() failed
  43 |   });
  44 | });
  45 | 
```