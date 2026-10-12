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

  // Navigate to Insights
  await page.click('[aria-label="Insights"], [accessibilitylabel="Insights"]');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Category Breakdown') && document.body.innerText.includes('Total Spending');
  }, { timeout: 35000 });
  await wait(2000);

  // Scroll to Forecast Card
  console.log('Scrolling to Projected Spending Outlook (Forecast)...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('Projected Spending Outlook'));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    else window.scrollTo(0, 680);
  });
  await wait(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_forecast.png') });

  // Scroll to Flagged Transactions (Anomalies)
  console.log('Scrolling to Flagged Transactions (Anomalies)...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('Flagged Transactions'));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    else window.scrollTo(0, 1150);
  });
  await wait(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_anomaly_insights.png') });

  console.log('14_forecast.png and 12_anomaly_insights.png captured successfully!');
  await browser.close();
}

main().catch(console.error);
