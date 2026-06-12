import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  const testId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';
  console.log("Cleaning DB for test", testId);
  await supabase.from('cbt_attempts').delete().eq('student_id', 'f94f99dd-48d6-4e59-a2e6-a0afc07881e3').eq('test_id', testId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to home to set localStorage...");
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

  console.log("Navigating to login...");
  await page.goto('http://localhost:3000/student/login');
  
  await page.fill('#roll', 'CAM-JEE-26002');
  await page.click('button[type="submit"]', { timeout: 5000 });
  await page.waitForURL('**/student/tests', { timeout: 10000 });
  console.log("Logged in successfully.");

  await page.waitForTimeout(2000);
  const startBtns = await page.$$('a:has-text("Start test"), a:has-text("Resume test")');
  if (startBtns.length > 0) {
     await startBtns[0].click();
  } else {
     console.log("No start test button found.");
     await browser.close(); return;
  }
  
  console.log("At instructions page...");
  const checkboxLabel = await page.waitForSelector('label[for="declaration"]', { timeout: 5000 });
  if (checkboxLabel) await checkboxLabel.click();
  
  const proceedBtn = await page.waitForSelector('button:has-text("PROCEED"), button:has-text("Proceed")', { timeout: 5000 });
  if (proceedBtn) await proceedBtn.click();

  await page.waitForTimeout(4000);

  // Q1 -> A (Option 1)
  console.log("Answering Q1...");
  await page.locator('li:nth-child(1) label').nth(0).click();
  await page.click('button:has-text("Save & Next")');
  await page.waitForTimeout(1000);

  // Q2 -> B (Option 2)
  console.log("Answering Q2...");
  await page.locator('li:nth-child(2) label').nth(0).click();
  await page.click('button:has-text("Save & Next")');
  await page.waitForTimeout(1000);

  // Q3 -> C (Option 3)
  console.log("Answering Q3...");
  await page.locator('li:nth-child(3) label').nth(0).click();
  await page.click('button:has-text("Save & Next")');
  await page.waitForTimeout(1000);

  // Q4 -> Leave unanswered
  console.log("Skipping Q4...");
  await page.click('button:has-text("Next >>")');
  await page.waitForTimeout(1000);

  // Q5 -> D (Option 4)
  console.log("Answering Q5...");
  await page.locator('li:nth-child(4) label').nth(0).click();
  await page.click('button:has-text("Save & Next")');
  await page.waitForTimeout(1000);

  // Submit
  console.log("Submitting...");
  await page.click('button:has-text("Submit")');
  await page.waitForTimeout(1000);
  
  const confirmBtn = await page.waitForSelector('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Final Submit")', { timeout: 3000 });
  if (confirmBtn) await confirmBtn.click();
  
  await page.waitForTimeout(5000);
  console.log("After submit URL:", page.url());

  await browser.close();
})();
