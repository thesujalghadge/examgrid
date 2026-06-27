import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to institute login...');
  await page.goto('http://localhost:3000/institute/login');
  
  // Enter institute
  await page.getByRole('button', { name: /Enter institute/i }).click();
  console.log('Logged into institute.');

  // Go to Batches and Create a Batch
  await page.getByRole('link', { name: 'Conduct CBT', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: 'Batches', exact: true }).click();
  await page.getByLabel(/Batch name/i).fill('Demo Batch');
  await page.getByLabel(/Course/i).fill('JEE');
  await page.getByRole('button', { name: /Create/i }).click();
  console.log('Batch created.');
  await page.waitForTimeout(1000);

  // Go to Students and create a Student
  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await page.getByLabel(/Full name/i).fill('Test Student');
  await page.getByLabel(/Roll number/i).fill('12345');
  await page.getByLabel(/Email/i).fill('teststudent@examgrid.com');
  await page.getByLabel(/Course/i).fill('JEE');
  await page.getByRole('button', { name: /Add/i }).click();
  console.log('Student created.');
  await page.waitForTimeout(1000);

  // Go to Conduct CBT
  await page.getByRole('link', { name: 'Conduct CBT', exact: true }).click();
  await page.getByLabel(/Test Title/i).fill('Verification Exam');
  await page.getByLabel(/Expected questions/i).fill('6');
  
  // Set date to today/now
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16);
  await page.getByLabel(/Available from/i).fill(dateStr);

  // Set Subject Ranges for 6 questions (2 each)
  console.log('Setting subject ranges...');
  const rows = page.locator('tbody tr');
  // Row 0: Physics
  await rows.nth(0).locator('input').nth(0).fill('1');
  await rows.nth(0).locator('input').nth(0).blur();
  await rows.nth(0).locator('input').nth(1).fill('2');
  await rows.nth(0).locator('input').nth(1).blur();

  // Row 1: Chemistry
  await rows.nth(1).locator('input').nth(0).fill('3');
  await rows.nth(1).locator('input').nth(0).blur();
  await rows.nth(1).locator('input').nth(1).fill('4');
  await rows.nth(1).locator('input').nth(1).blur();

  // Row 2: Mathematics
  await rows.nth(2).locator('input').nth(0).fill('5');
  await rows.nth(2).locator('input').nth(0).blur();
  await rows.nth(2).locator('input').nth(1).fill('6');
  await rows.nth(2).locator('input').nth(1).blur();

  await page.waitForTimeout(500);

  // Wait for the dropzone or file input
  console.log('Uploading PDF and Answer Key...');
  // The dropzone input file element for paper (first)
  const paperInput = page.locator('input[type="file"]').nth(0);
  await paperInput.setInputFiles('C:\\AI\\SGIS\\testing data\\3 question test\\testing test 6q.pdf');
  
  // The dropzone input file element for answer key (second)
  const keyInput = page.locator('input[type="file"]').nth(1);
  await keyInput.setInputFiles('C:\\AI\\SGIS\\testing data\\3 question test\\answerkey.txt');

  console.log('Files uploaded.');

  // Process Paper & Continue
  console.log('Clicking Process Paper & Continue...');
  await page.getByRole('button', { name: /Process Paper & Continue/i }).click();

  console.log('Waiting for processing... this may take a while.');
  // Wait for the publish button to appear
  await page.waitForSelector('button:has-text("Publish CBT")', { timeout: 120000 });
  console.log('Processing done. Clicking Publish CBT...');
  
  // Publish
  await page.getByRole('button', { name: /Publish CBT/i }).click();
  
  console.log('Waiting for publish success message...');
  await page.waitForSelector('text=CBT published', { timeout: 30000 });
  console.log('Test published successfully!');
  
  await browser.close();
})();
