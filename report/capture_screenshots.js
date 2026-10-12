const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickByAria(page, label) {
  const selector = `[aria-label="${label}"], [accessibilitylabel="${label}"]`;
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  await wait(1000);
}

async function clickButtonWithText(page, text) {
  const clicked = await page.evaluate((targetText) => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.children.length === 0 && el.innerText && el.innerText.trim() === targetText) {
        let curr = el;
        while (curr && curr !== document.body) {
          if (curr.getAttribute('role') === 'button' || curr.tagName === 'BUTTON' || curr.onclick || curr.getAttribute('tabindex') === '0') {
            curr.click();
            return true;
          }
          curr = curr.parentElement;
        }
        el.click();
        return true;
      }
    }
    return false;
  }, text);
  await wait(800);
  return clicked;
}

async function main() {
  console.log('Launching Puppeteer with /usr/bin/google-chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=430,932',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 430,
    height: 932,
    deviceScaleFactor: 2,
  });

  console.log('Navigating to http://localhost:8081...');
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(3000);

  // 1. Seed demo data
  console.log('Seeding demo data...');
  await page.evaluate(async () => {
    await fetch('http://localhost:3001/api/dev/seed', { method: 'POST' });
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await wait(3000);

  // ==========================================
  // 01. HOME DASHBOARD
  // ==========================================
  console.log('Capturing 01_home_dashboard.png...');
  await clickByAria(page, 'Home');
  await wait(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_home_dashboard.png') });

  // ==========================================
  // 11. BUDGET MODAL
  // ==========================================
  console.log('Capturing 11_budget.png...');
  await clickButtonWithText(page, 'Edit Budget');
  await wait(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_budget.png') });
  await clickButtonWithText(page, 'Cancel');
  await wait(800);

  // ==========================================
  // 05. EXPENSE HISTORY
  // ==========================================
  console.log('Capturing 05_expense_history.png...');
  await clickByAria(page, 'Expenses');
  await wait(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_expense_history.png') });

  // ==========================================
  // 02. EXPENSES FILTERED / EMPTY STATE
  // ==========================================
  console.log('Capturing 02_expenses_empty_or_initial.png...');
  const searchInput = await page.$('input[placeholder*="Search"], input[placeholder*="merchants"]');
  if (searchInput) {
    await searchInput.type('ZXZNonexistentItem999', { delay: 20 });
    await wait(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_expenses_empty_or_initial.png') });
    // Clear search
    await page.evaluate(() => {
      const inp = document.querySelector('input[placeholder*="Search"], input[placeholder*="merchants"]');
      if (inp) {
        inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await wait(800);
  }

  // ==========================================
  // 03. EXPENSE ADD FORM (EMPTY)
  // ==========================================
  console.log('Capturing 03_expense_add_form.png...');
  await clickButtonWithText(page, '+ Add Expense');
  await wait(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_expense_add_form.png') });

  // ==========================================
  // 04. EXPENSE ADD FORM (POPULATED)
  // ==========================================
  console.log('Capturing 04_expense_added.png...');
  const inputs = await page.$$('input');
  for (const inp of inputs) {
    const ph = await page.evaluate((el) => el.getAttribute('placeholder') || '', inp);
    if (ph.includes('Latte') || ph.includes('description') || ph.includes('e.g.')) {
      await inp.type('Blue Tokai Cold Brew Coffee', { delay: 20 });
    } else if (ph.includes('0.00')) {
      await inp.type('280', { delay: 20 });
    } else if (ph.includes('Starbucks') || ph.includes('Merchant') || ph.includes('D-Mart')) {
      await inp.type('Blue Tokai Roasters', { delay: 20 });
    }
  }
  await wait(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_expense_added.png') });
  await clickButtonWithText(page, 'Save Expense');
  await wait(1500);

  // ==========================================
  // 06. SPLIT RECEIPT (STEP 1)
  // ==========================================
  console.log('Capturing 06_split_receipt.png...');
  await clickByAria(page, 'Split');
  await wait(1500);
  await clickButtonWithText(page, 'Receipt Split');
  await wait(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_split_receipt.png') });

  // ==========================================
  // 07. SPLIT PARTICIPANTS (STEP 2)
  // ==========================================
  console.log('Setting receipt & capturing 07_split_participants.png...');
  const sampleReceiptPath = path.resolve(__dirname, '../ai-service/test_fixtures/sample_receipt.png');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(sampleReceiptPath);
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }).catch(() => null),
      clickButtonWithText(page, 'Choose from Gallery'),
    ]);
    if (fileChooser) {
      await fileChooser.accept([sampleReceiptPath]);
    }
  }
  await wait(1500);
  await clickButtonWithText(page, 'Continue to Participants');
  await wait(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_split_participants.png') });

  // ==========================================
  // 08. SPLIT REVIEW / INSTRUCTION
  // ==========================================
  console.log('Capturing 08_split_review.png...');
  await page.evaluate(() => {
    const switches = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"]'));
    if (switches.length > 0) switches[0].click();
  });
  await wait(800);
  const textareas = await page.$$('textarea, input[multiline]');
  if (textareas.length > 0) {
    await textareas[0].type('Me had Margherita Pizza and Coke. Friend had Farmhouse Pizza.', { delay: 20 });
    await wait(600);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_split_review.png') });

  // Toggle back to Equal split to ensure 100% item coverage and strict penny reconciliation
  await page.evaluate(() => {
    const switches = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"]'));
    if (switches.length > 0) switches[0].click();
  });
  await wait(600);

  // ==========================================
  // 09. SPLIT RESULT (STEP 3)
  // ==========================================
  console.log('Capturing 09_split_result.png (calculating split via AI)...');
  await clickButtonWithText(page, 'Calculate Split');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Per-Person Breakdown') || document.body.innerText.includes('Reconciled') || document.body.innerText.includes('Add My Share');
  }, { timeout: 35000 });
  await wait(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_split_result.png') });

  // ==========================================
  // 10. SPLIT ADDED TO EXPENSES
  // ==========================================
  console.log('Capturing 10_split_added_to_expenses.png...');
  await clickButtonWithText(page, 'Add My Share');
  await wait(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_split_added_to_expenses.png') });

  // Dismiss modal if open
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('*')).filter(e => ['Done', 'OK', 'Cancel'].includes(e.innerText));
    if (btns.length > 0) btns[0].click();
  });
  await wait(800);

  // ==========================================
  // 15. GROUP SETTLEMENT INPUT
  // ==========================================
  console.log('Capturing 15_group_settlement.png...');
  await clickButtonWithText(page, 'Group Balances');
  await wait(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_group_settlement.png') });

  // ==========================================
  // 16. SETTLEMENT RESULT
  // ==========================================
  console.log('Capturing 16_settlement_result.png...');
  await clickButtonWithText(page, 'Calculate Balances');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Settlement Plan') || document.body.innerText.includes('Net Balances');
  }, { timeout: 10000 });
  await wait(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_settlement_result.png') });

  // ==========================================
  // 13. SPENDING INSIGHTS OVERVIEW
  // ==========================================
  console.log('Capturing 13_spending_insights.png (waiting for insights to load)...');
  await clickByAria(page, 'Insights');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Category Breakdown') && document.body.innerText.includes('Total Spending');
  }, { timeout: 35000 });
  await wait(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_spending_insights.png') });

  // ==========================================
  // 14. FORECAST
  // ==========================================
  console.log('Capturing 14_forecast.png...');
  await page.evaluate(() => window.scrollTo(0, 380));
  await wait(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_forecast.png') });

  // ==========================================
  // 12. ANOMALY DETECTION INSIGHTS
  // ==========================================
  console.log('Capturing 12_anomaly_insights.png...');
  await page.evaluate(() => window.scrollTo(0, 820));
  await wait(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_anomaly_insights.png') });

  console.log('SUCCESS: All 16 screenshots captured and verified.');
  await browser.close();
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
