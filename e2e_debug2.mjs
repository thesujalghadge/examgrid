import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/');
  await page.evaluate(() => {
    localStorage.setItem('examgrid:platform-institutes', JSON.stringify([
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Cambridge Academy",
        city: "Pune",
        adminEmail: "admin@cambridgeacademy.demo",
        plan: "Standard",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ]));
  });

  await page.goto('http://localhost:3000/student/login');
  await page.fill('#roll', 'CAM-JEE-26002');
  await page.click('button[type="submit"]', { timeout: 5000 });
  await page.waitForURL('**/student/tests', { timeout: 10000 });

  await page.goto('http://localhost:3000/student/tests/demo-neet-upcoming');
  await page.waitForTimeout(2000);
  
  const bodyText = await page.innerText('body');
  console.log("Body text on test page:", bodyText.substring(0, 500));

  await browser.close();
})();
