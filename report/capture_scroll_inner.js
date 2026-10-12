const puppeteer = require('puppeteer-core');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=430,932'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2500);

  // Click Insights tab
  await page.click('[aria-label="Insights"], [accessibilitylabel="Insights"]');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Category Breakdown') && document.body.innerText.includes('Total Spending');
  }, { timeout: 35000 });
  await wait(2000);

  // Find the inner scrollable container
  console.log('Finding inner scroll container and scrolling...');
  await page.evaluate(() => {
    // Look for all scrollable divs
    const allDivs = Array.from(document.querySelectorAll('div'));
    const scrollables = allDivs.filter(d => d.scrollHeight > d.clientHeight && d.clientHeight > 200);
    console.log('Found scrollables:', scrollables.length);
    if (scrollables.length > 0) {
      // Scroll the main content container to show forecast
      scrollables[0].scrollTop = 480;
    }
  });
  await wait(1000);
  console.log('Capturing 14_forecast.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_forecast.png') });

  // Scroll further down to show anomalies
  await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const scrollables = allDivs.filter(d => d.scrollHeight > d.clientHeight && d.clientHeight > 200);
    if (scrollables.length > 0) {
      scrollables[0].scrollTop = 850;
    }
  });
  await wait(1000);
  console.log('Capturing 12_anomaly_insights.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_anomaly_insights.png') });

  console.log('Done!');
  await browser.close();
}

main().catch(console.error);
