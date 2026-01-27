import { test, expect } from '@playwright/test';

/**
 * Tests for "maybe" coverage - addresses that are outside coverage
 * but within MAYBE_DISTANCE_MILES of a coverage polygon boundary.
 *
 * Note: Run against local dev server to test new features:
 *   SITE_URL=http://localhost:5173 npx playwright test tests/maybe-coverage.spec.js
 */

const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

test.describe('Maybe Coverage Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`PAGE: ${msg.type()}: ${msg.text()}`));
  });

  test('address near coverage boundary should show "maybe" result', async ({ page }) => {
    await page.goto(SITE_URL);

    // Wait for coverage data to load
    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    // Use an address that's close to but outside SF coverage
    // 153 Granville Way is ~0.5 miles from the coverage boundary
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

    // Should show "maybe" result since it's within 2 miles of coverage
    await expect(result).toContainText('Service may be available');
    await expect(result).toHaveClass(/uwc-result--maybe/);

    await page.screenshot({ path: 'test-results/maybe-coverage.png', fullPage: true });
  });

  test('address far from coverage should show "not covered" result', async ({ page }) => {
    await page.goto(SITE_URL);

    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    // Los Angeles - definitely not within 2 miles of SF coverage
    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('123 Main St, Los Angeles', { delay: 50 });

    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });
    await page.locator('.pac-container .pac-item').first().click();

    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });
    await checkBtn.click();

    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });

    // Should show "not covered" since it's far from any coverage
    await expect(result).toContainText('Not currently in our service area');
    await expect(result).toHaveClass(/uwc-result--error/);
  });

  test('address inside coverage should show "covered" result', async ({ page }) => {
    await page.goto(SITE_URL);

    await page.waitForFunction(() => {
      const el = document.getElementById('init-loading');
      return el && el.hasAttribute('hidden');
    }, { timeout: 15000 });

    // 1 Market St SF - inside coverage
    const addressInput = page.locator('#address-input');
    await addressInput.click();
    await addressInput.pressSequentially('1 Market St, San Francisco', { delay: 50 });

    await page.waitForSelector('.pac-container .pac-item', { timeout: 15000 });
    await page.locator('.pac-container .pac-item').first().click();

    const checkBtn = page.locator('#check-btn');
    await expect(checkBtn).toBeEnabled({ timeout: 5000 });
    await checkBtn.click();

    const result = page.locator('#result');
    await expect(result).toBeVisible({ timeout: 5000 });

    await expect(result).toContainText('Service is available');
    await expect(result).toHaveClass(/uwc-result--success/);
  });
});
