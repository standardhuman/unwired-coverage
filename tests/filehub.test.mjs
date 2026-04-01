import { chromium } from 'playwright';

const BASE = 'https://unwired-coverage.briancline.co';
const PASSWORD = 'pocket';
let browser, page;
const results = [];

function log(name, pass, detail = '') {
  const icon = pass ? 'PASS' : 'FAIL';
  results.push({ name, pass, detail });
  console.log(`  ${icon}: ${name}${detail ? ' — ' + detail : ''}`);
}

async function setup() {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
}

async function testPasswordGate() {
  console.log('\n— Password Gate —');

  await page.goto(`${BASE}/convert.html`);

  // Should see login overlay
  const overlay = await page.locator('#login-overlay').isVisible();
  log('Login overlay visible', overlay);

  // Main content should be hidden
  const mainHidden = await page.locator('#main-content').isHidden();
  log('Main content hidden', mainHidden);

  // Wrong password
  await page.fill('#password-input', 'wrong');
  await page.click('#login-btn');
  const errorVisible = await page.locator('#login-error').isVisible();
  log('Wrong password shows error', errorVisible);

  // Still on login
  const stillOverlay = await page.locator('#login-overlay').isVisible();
  log('Still on login after wrong password', stillOverlay);

  // Correct password
  await page.fill('#password-input', PASSWORD);
  await page.click('#login-btn');
  await page.waitForSelector('#main-content:not(.hidden)');
  const mainVisible = await page.locator('#main-content').isVisible();
  log('Correct password reveals content', mainVisible);

  const overlayGone = await page.locator('#login-overlay').isHidden();
  log('Login overlay hidden after auth', overlayGone);
}

async function testSessionPersistence() {
  console.log('\n— Session Persistence —');

  await page.reload();
  await page.waitForSelector('#main-content:not(.hidden)', { timeout: 5000 });
  const mainVisible = await page.locator('#main-content').isVisible();
  log('Session persists after reload', mainVisible);
}

async function testKmlConverter() {
  console.log('\n— KML Converter —');

  // Check convert button is disabled initially
  const btnDisabled = await page.locator('#convert-btn').isDisabled();
  log('Convert button disabled initially', btnDisabled);

  // Upload a test KML via file input
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <Placemark>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                -122.4,37.7,0 -122.4,37.8,0 -122.3,37.8,0 -122.3,37.7,0 -122.4,37.7,0
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  // Create a file and set it on the input
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#kml-drop-zone'),
  ]);

  const buffer = Buffer.from(kmlContent, 'utf-8');
  await fileChooser.setFiles({
    name: 'test.kml',
    mimeType: 'application/vnd.google-earth.kml+xml',
    buffer,
  });

  // File name should appear
  const fileName = await page.locator('#kml-file-name').textContent();
  log('File name displayed', fileName.includes('test.kml'), fileName);

  // Button should be enabled
  const btnEnabled = await page.locator('#convert-btn').isEnabled();
  log('Convert button enabled after file select', btnEnabled);

  // Set up download listener and click convert
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.click('#convert-btn');

  const download = await downloadPromise;
  log('Download triggered', download.suggestedFilename() === 'coverage.json', download.suggestedFilename());

  // Read downloaded content
  const path = await download.path();
  const { readFileSync } = await import('fs');
  const content = JSON.parse(readFileSync(path, 'utf-8'));
  log('Output is valid CoverageData', content.type === 'CoverageData');
  log('Contains 1 polygon', content.count === 1, `count: ${content.count}`);
  log('Has bbox', content.features[0].bbox !== undefined);
  log('Has coordinates', content.features[0].coordinates.length > 0);

  // Check success message
  const statusText = await page.locator('#convert-status').textContent();
  log('Success message shown', statusText.includes('Done!'), statusText);
}

async function testKmlConverterMultiGeometry() {
  console.log('\n— KML Converter: MultiGeometry —');

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <Placemark>
        <MultiGeometry>
          <Polygon>
            <outerBoundaryIs><LinearRing><coordinates>-122.5,37.7,0 -122.5,37.8,0 -122.4,37.8,0 -122.4,37.7,0 -122.5,37.7,0</coordinates></LinearRing></outerBoundaryIs>
          </Polygon>
          <Polygon>
            <outerBoundaryIs><LinearRing><coordinates>-122.3,37.6,0 -122.3,37.7,0 -122.2,37.7,0 -122.2,37.6,0 -122.3,37.6,0</coordinates></LinearRing></outerBoundaryIs>
          </Polygon>
        </MultiGeometry>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  await page.reload();
  await page.waitForSelector('#main-content:not(.hidden)');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#kml-drop-zone'),
  ]);
  await fileChooser.setFiles({
    name: 'multi.kml',
    mimeType: 'application/vnd.google-earth.kml+xml',
    buffer: Buffer.from(kmlContent, 'utf-8'),
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.click('#convert-btn');
  const download = await downloadPromise;

  const { readFileSync } = await import('fs');
  const content = JSON.parse(readFileSync(await download.path(), 'utf-8'));
  log('MultiGeometry produces 2 polygons', content.count === 2, `count: ${content.count}`);
}

async function testKmlConverterInvalidFile() {
  console.log('\n— KML Converter: Invalid File —');

  await page.reload();
  await page.waitForSelector('#main-content:not(.hidden)');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#kml-drop-zone'),
  ]);
  await fileChooser.setFiles({
    name: 'bad.kml',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is not valid kml', 'utf-8'),
  });

  await page.click('#convert-btn');
  await page.waitForFunction(() => {
    const el = document.querySelector('#convert-status');
    return el && !el.hidden && (el.textContent.includes('Error') || el.textContent.includes('Done'));
  }, { timeout: 10000 });
  const statusText = await page.locator('#convert-status').textContent();
  log('Invalid KML shows error', statusText.includes('Error'), statusText);
}

async function testRecentFiles() {
  console.log('\n— Recent Files —');

  await page.reload();
  await page.waitForSelector('#main-content:not(.hidden)');

  // Should be visible immediately
  const filesVisible = await page.locator('#recent-files').isVisible();
  log('Recent files section visible', filesVisible);

  // Wait for loading to complete
  await page.waitForFunction(() => {
    const el = document.querySelector('#recent-files');
    return !el.textContent.includes('Loading');
  }, { timeout: 15000 });

  // Check files loaded
  const items = await page.locator('#recent-files .file-list li').count();
  log('File list has items', items > 0, `${items} items`);

  // First 3 should be visible
  const visibleItems = await page.locator('#recent-files .file-list li:not(.hidden)').count();
  log('Shows 3 files initially', visibleItems === 3, `visible: ${visibleItems}`);

  // Should have a "show more" button if more than 3
  if (items > 3) {
    const moreBtn = page.locator('#recent-files .toggle-btn');
    const moreBtnVisible = await moreBtn.isVisible();
    log('Show more button visible', moreBtnVisible);

    const moreBtnText = await moreBtn.textContent();
    log('Show more button has count', moreBtnText.includes('more'), moreBtnText);

    // Click show more
    await moreBtn.click();
    const allVisible = await page.locator('#recent-files .file-list li:not(.hidden)').count();
    log('All files visible after show more', allVisible === items, `visible: ${allVisible}/${items}`);

    // Click again to collapse
    await moreBtn.click();
    const collapsed = await page.locator('#recent-files .file-list li:not(.hidden)').count();
    log('Back to 3 after toggle', collapsed === 3, `visible: ${collapsed}`);
  }
}

async function testFileUpload() {
  console.log('\n— File Upload —');

  await page.reload();
  await page.waitForSelector('#main-content:not(.hidden)');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#upload-drop-zone'),
  ]);

  const testContent = `Browser test upload ${Date.now()}`;
  await fileChooser.setFiles({
    name: `browser-test-${Date.now()}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(testContent, 'utf-8'),
  });

  // Wait for upload status
  await page.waitForFunction(() => {
    const el = document.querySelector('#upload-status');
    return el && !el.hidden && (el.textContent.includes('success') || el.textContent.includes('Error'));
  }, { timeout: 15000 });

  const uploadStatus = await page.locator('#upload-status').textContent();
  log('Upload succeeds', uploadStatus.includes('success'), uploadStatus);

  // Check uploaded files list
  const uploadItems = await page.locator('#upload-list .file-list li').count();
  log('Upload list shows files', uploadItems > 0, `${uploadItems} items`);
}

async function testFullRepoDownload() {
  console.log('\n— Full Repo Download —');

  const link = page.locator('a.btn-secondary[href*="github.com"]');
  const href = await link.getAttribute('href');
  log('Download ZIP link present', href.includes('archive/refs/heads/main.zip'), href);
}

async function teardown() {
  await browser.close();
}

// Run all tests
(async () => {
  console.log('=== File Hub Browser Tests ===');
  console.log(`Testing: ${BASE}/convert.html\n`);

  try {
    await setup();
    await testPasswordGate();
    await testSessionPersistence();
    await testKmlConverter();
    await testKmlConverterMultiGeometry();
    await testKmlConverterInvalidFile();
    await testRecentFiles();
    await testFileUpload();
    await testFullRepoDownload();
  } catch (err) {
    console.error('\nFATAL:', err.message);
    // Take a screenshot for debugging
    if (page) {
      await page.screenshot({ path: 'tests/filehub-error.png' });
      console.log('Screenshot saved to tests/filehub-error.png');
    }
  } finally {
    await teardown();
  }

  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed > 0) {
    console.log('\nFailures:');
    results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
})();
