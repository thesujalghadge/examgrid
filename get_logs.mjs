import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`PAGE LOG [${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', exception => {
    console.log(`PAGE ERROR:`, exception);
  });

  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED [${request.url()}]:`, request.failure().errorText);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 10000 });
    console.log("Navigated successfully.");
  } catch (err) {
    console.error("Navigation error:", err);
  }

  // wait a bit to ensure all scripts execute
  await page.waitForTimeout(2000);
  
  const content = await page.content();
  console.log("PAGE CONTENT LENGTH:", content.length);
  
  await browser.close();
})();
