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

  // Navigate to Expenses tab
  await page.click('[aria-label="Expenses"], [accessibilitylabel="Expenses"]');
  await wait(1500);

  // Click "+ Add Expense" button (at top right of transaction count or FAB)
  console.log('Clicking Add Expense button...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.innerText && e.innerText.includes('Add Expense'));
    if (btn) btn.click();
  });
  await wait(1500);

  // SNAPSHOT 03: Add Expense Form (empty modal)
  console.log('Capturing 03_expense_add_form.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_expense_add_form.png') });

  // SNAPSHOT 04: Add Expense Form with inputs and auto-categorization
  console.log('Populating expense form...');
  const inputs = await page.$$('input');
  for (const inp of inputs) {
    const ph = await page.evaluate((el) => el.getAttribute('placeholder') || '', inp);
    if (ph.includes('Latte') || ph.includes('description') || ph.includes('e.g.')) {
      await inp.type('Blue Tokai Cold Brew Coffee', { delay: 20 });
    } else if (ph.includes('0.00')) {
      await inp.type('280.00', { delay: 20 });
    } else if (ph.includes('Starbucks') || ph.includes('Merchant') || ph.includes('D-Mart')) {
      await inp.type('Blue Tokai Roasters', { delay: 20 });
    }
  }
  await wait(1500);
  console.log('Capturing 04_expense_added.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_expense_added.png') });

  // Save the expense
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.innerText && e.innerText.trim() === 'Save Expense');
    if (btn) btn.click();
  });
  await wait(1500);

  console.log('Recapturing 10_split_added_to_expenses.png with confirmed share...');
  // Go to Split tab
  await page.click('[aria-label="Split"], [accessibilitylabel="Split"]');
  await wait(1500);

  // Upload receipt
  const sampleReceiptPath = path.resolve(__dirname, '../ai-service/test_fixtures/sample_receipt.png');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(sampleReceiptPath);
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }).catch(() => null),
      page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const btn = all.find(e => e.innerText && e.innerText.includes('Choose from Gallery'));
        if (btn) btn.click();
      }),
    ]);
    if (fileChooser) {
      await fileChooser.accept([sampleReceiptPath]);
    }
  }
  await wait(1500);

  // Step 2
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.innerText && e.innerText.includes('Continue to Participants'));
    if (btn) btn.click();
  });
  await wait(1500);

  // Calculate split
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.innerText && e.innerText.includes('Calculate Split'));
    if (btn) btn.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Per-Person Breakdown'), { timeout: 35000 });
  await wait(1500);

  // Click Add My Share
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.innerText && e.innerText.includes('Add My Share'));
    if (btn) btn.click();
  });
  await wait(1800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_split_added_to_expenses.png') });

  console.log('Done recapturing targeted screens!');
  await browser.close();
}

main().catch(console.error);
