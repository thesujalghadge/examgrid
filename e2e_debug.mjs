import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/');
  await page.evaluate(() => {
    localStorage.setItem('examgrid:platform-institutes', JSON.stringify([
      { id: "00000000-0000-0000-0000-000000000001", name: "Cambridge Academy", status: "active" }
    ]));
  });

  await page.goto('http://localhost:3000/student/login');
  await page.fill('#roll', 'CAM-JEE-26002');
  await page.click('button[type="submit"]', { timeout: 5000 });
  await page.waitForURL('**/student/tests', { timeout: 10000 });
  
  const startBtns = await page.$$('a:has-text("Start test"), a:has-text("Resume test")');
  if (startBtns.length > 0) {
     await startBtns[0].click();
  } else {
     console.log("No start button.");
     await browser.close(); return;
  }
  
  const checkboxLabel = await page.waitForSelector('label[for="declaration"]', { timeout: 5000 });
  await checkboxLabel.click();
  const proceedBtn = await page.waitForSelector('button:has-text("PROCEED"), button:has-text("Proceed")', { timeout: 5000 });
  await proceedBtn.click();

  await page.waitForTimeout(4000);
  console.log("Body text on exam page:");
  console.log(await page.innerText('body'));
  
  await browser.close();
})();
