import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to test page...");
  const url = 'http://localhost:3000/student/tests/cbt-55a81001-93b9-4e74-bd33-ff573ebcfdf1';
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  console.log("Current URL:", page.url());
  const bodyText = await page.innerText('body');
  console.log("Body text preview:", bodyText.substring(0, 500));

  await browser.close();
})();
