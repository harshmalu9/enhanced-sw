const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  // Find expenses tab and click
  const tabHandle = await page.evaluateHandle(() => {
    const els = Array.from(document.querySelectorAll('*'));
    return els.find(el => el.textContent && el.textContent.trim() === 'Expenses' && el.children.length === 0);
  });
  if (tabHandle) {
    const box = await tabHandle.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  // Find Add Expense button on screen and click
  const addBtnHandle = await page.evaluateHandle(() => {
    const els = Array.from(document.querySelectorAll('*'));
    return els.find(el => el.textContent && el.textContent.trim() === 'Add Expense' && el.children.length === 0);
  });
  if (addBtnHandle) {
    const box = await addBtnHandle.boundingBox();
    if (box) {
      console.log('Clicking Add Expense button at', box);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  const shotPath = path.join(__dirname, 'screenshots/03_expense_add_form.png');
  await page.screenshot({ path: shotPath });
  console.log(`Saved screenshot to ${shotPath}`);

  await browser.close();
})();
