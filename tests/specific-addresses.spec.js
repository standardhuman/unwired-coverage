import { test, expect } from '@playwright/test';

const SITE_URL = 'https://unwired-coverage.briancline.co';

test.describe('Specific Address Tests', () => {
  test('153 Granville Way SF should be OUT of coverage', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.type()}: ${msg.text()}`));

    await page.goto(SITE_URL);

    // Wait for coverage data to load
    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('153 Granville Way, San Francisco', { delay: 50 });

    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });
    await page.locator('.pac-container .pac-item').first().click();

    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });
    await checkBtn.click();

    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText('Not currently in our service area');

    await page.screenshot({ path: 'tests/granville-result.png', fullPage: true });
  });

  test('28 W Portal Ave SF should be IN coverage', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.type()}: ${msg.text()}`));

    await page.goto(SITE_URL);

    // Wait for coverage data to load
    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('28 W Portal Ave, San Francisco', { delay: 50 });

    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });
    await page.locator('.pac-container .pac-item').first().click();

    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });
    await checkBtn.click();

    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText('Service is available');

    await page.screenshot({ path: 'tests/wportal-result.png', fullPage: true });
  });

  test('1054 Taraval St SF should be OUT of coverage', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.type()}: ${msg.text()}`));

    await page.goto(SITE_URL);

    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('1054 Taraval St, San Francisco', { delay: 50 });

    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });
    await page.locator('.pac-container .pac-item').first().click();

    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });
    await checkBtn.click();

    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText('Not currently in our service area');

    await page.screenshot({ path: 'tests/taraval-result.png', fullPage: true });
  });
});
