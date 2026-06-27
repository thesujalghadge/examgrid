import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser for student workflow...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to student login...');
  await page.goto('http://localhost:3000/student/login');
  
  // Enter student credentials
  await page.getByLabel(/Roll number/i).fill('12345');
  // Wait a bit just in case
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Enter tests/i }).click();
  console.log('Logged into student.');

  await page.waitForTimeout(2000);

  // We should be on the dashboard. Look for "Start test" or similar.
  console.log('Clicking Start test...');
  // The test is in a card with a link "Start test" or "Resume test"
  try {
    const startBtn = page.getByRole('link', { name: /Start test|Resume test/i }).first();
    await startBtn.click({ force: true });
  } catch (e) {
    console.log("Could not find start button. Page text:", await page.locator('body').innerText());
    throw e;
  }

  // Instructions screen
  console.log('Accepting instructions...');
  await page.waitForSelector('text=PROCEED', { timeout: 15000 });
  await page.locator('label[for="declaration"]').click();
  await page.getByRole('button', { name: /PROCEED/i }).click();

  // Test screen - wait for it to load
  await page.waitForSelector('text=Time Left', { timeout: 15000 });
  console.log('Test started successfully.');

  // Answer Q1
  console.log('Answering Q1...');
  try {
    await page.getByRole('radio').nth(0).click({ timeout: 5000 }); // Option A
  } catch (e) {
    console.log("Could not find radio. Page text:", await page.locator('.flex-1.overflow-y-auto').innerText());
    throw e;
  }
  await page.getByRole('button', { name: /Save & Next/i }).click();
  await page.waitForTimeout(1000); // Wait for autosave

  // Next Question
  console.log('Answering Q2...');
  await page.getByRole('radio').nth(1).click(); // Option B
  await page.getByRole('button', { name: /Save & Next/i }).click();
  await page.waitForTimeout(1000);

  // Refresh page to test persistence
  console.log('Refreshing page...');
  await page.reload();
  
  console.log('Accepting instructions again after reload...');
  await page.waitForSelector('text=PROCEED', { timeout: 15000 });
  await page.locator('label[for="declaration"]').click();
  await page.getByRole('button', { name: /PROCEED/i }).click();
  
  await page.waitForSelector('text=Time Left', { timeout: 15000 });
  console.log('Page reloaded.');

  // Go to Q3
  console.log('Answering Q3...');
  try {
    await page.getByRole('radio').nth(2).click({ timeout: 5000 }); // Option C
  } catch (e) {
    console.log('Radio not found, trying numerical keypad for 5...');
    await page.getByRole('button', { name: '5', exact: true }).click({ timeout: 5000 });
  }
  await page.getByRole('button', { name: /Save & Next/i }).click();

  // Submit test
  console.log('Submitting test...');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  
  // Confirm submission
  await page.getByRole('button', { name: /Yes, Submit/i }).click();

  console.log('Waiting for result page...');
  try {
    await page.waitForSelector('text=Test submitted', { timeout: 15000 });
  } catch (e) {
    console.log("Result page text:", await page.locator('body').innerText());
    throw e;
  }
  console.log('Test submitted successfully!');
  
  await browser.close();
})();
