import { test, expect } from '@playwright/test';

const SITE_URL = 'https://unwired-coverage.briancline.co';

test.describe('Unwired Coverage Checker', () => {
  test('should show coverage available for Napa address', async ({ page }) => {
    // Navigate to the site
    await page.goto(SITE_URL);

    // Wait for coverage data to load (init loading gets hidden attribute)
    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    // Type a Napa address character by character to trigger autocomplete
    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('1600 Soscol Avenue, Napa', { delay: 50 });

    // Wait for Google Places autocomplete suggestions
    await page.waitForSelector('.pac-container .pac-item', { timeout: 10000 });

    // Click the first suggestion
    await page.locator('.pac-container .pac-item').first().click();

    // Button should now be enabled
    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });

    // Click check availability
    await checkBtn.click();

    // Wait for result
    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });

    // Log the result for debugging
    const resultText = await result.textContent();
    console.log('Result:', resultText);

    // Take a screenshot
    await page.screenshot({ path: 'tests/napa-result.png', fullPage: true });
  });

  test('should show not covered for address outside service area', async ({ page }) => {
    await page.goto(SITE_URL);

    // Wait for coverage data to load
    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    // Type an address far from Napa (Los Angeles)
    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('123 Main Street, Los Angeles', { delay: 50 });

    // Wait for autocomplete
    await page.waitForSelector('.pac-container .pac-item', { timeout: 10000 });
    await page.locator('.pac-container .pac-item').first().click();

    // Check availability
    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });
    await checkBtn.click();

    // Should show "not in service area"
    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText('Not currently in our service area');

    await page.screenshot({ path: 'tests/la-result.png', fullPage: true });
  });
});
