import { test, expect } from '@playwright/test';

const SITE_URL = 'https://unwired-coverage.briancline.co';

test('debug - check page state', async ({ page }) => {
  // Capture console logs
  const logs = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));

  await page.goto(SITE_URL);

  // Wait a bit for everything to load
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: 'tests/debug-screenshot.png', fullPage: true });

  // Check if Google Maps loaded
  const googleLoaded = await page.evaluate(() => {
    return typeof google !== 'undefined' && typeof google.maps !== 'undefined';
  });

  console.log('Google Maps loaded:', googleLoaded);
  console.log('Console logs:', logs);

  // Check input placeholder
  const placeholder = await page.locator('#address-input').getAttribute('placeholder');
  console.log('Input placeholder:', placeholder);

  // Try typing and see what happens
  await page.locator('#address-input').fill('1600 Soscol Avenue, Napa');
  await page.waitForTimeout(3000);

  // Check if pac-container exists
  const pacExists = await page.locator('.pac-container').count();
  console.log('PAC container count:', pacExists);

  await page.screenshot({ path: 'tests/debug-after-type.png', fullPage: true });
});
