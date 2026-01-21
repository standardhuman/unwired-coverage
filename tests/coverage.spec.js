import { test, expect } from '@playwright/test';

const SITE_URL = 'https://unwired-coverage.briancline.co';

test.describe('Unwired Coverage Checker', () => {
  test('should show coverage available for SF address', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => console.log(`PAGE: ${msg.type()}: ${msg.text()}`));

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
    await addressInput.pressSequentially('1 Market Street, San Francisco', { delay: 50 });

    // Wait a moment for autocomplete to respond
    await page.waitForTimeout(2000);

    // Take a screenshot to see the state
    await page.screenshot({ path: 'tests/after-typing.png', fullPage: true });

    // Check what's in the pac-container
    const pacContainer = page.locator('.pac-container');
    const pacExists = await pacContainer.count();
    console.log('PAC container exists:', pacExists);

    if (pacExists > 0) {
      const isVisible = await pacContainer.isVisible();
      console.log('PAC container visible:', isVisible);

      const itemCount = await page.locator('.pac-container .pac-item').count();
      console.log('PAC items count:', itemCount);
    }

    // Wait for Google Places autocomplete suggestions
    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });

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

    // Should show service available
    await expect(result).toContainText('Service is available');

    // Log the result for debugging
    const resultText = await result.textContent();
    console.log('Result:', resultText);

    // Take a screenshot
    await page.screenshot({ path: 'tests/sf-result.png', fullPage: true });
  });

  test('should show not covered for address outside service area', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.type()}: ${msg.text()}`));

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
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/la-after-typing.png', fullPage: true });

    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });
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
