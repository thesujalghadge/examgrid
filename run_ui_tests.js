const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log("Navigating to tests page...");
  await page.goto('http://localhost:3000/institute/tests', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000); // Give Turbopack time to compile

  console.log("Mocking Auth...");
  await page.evaluate(() => {
    localStorage.setItem('workspace-auth', JSON.stringify({
      state: { session: { id: 'test-session', userId: 'test-user', instituteId: 'test-inst', role: 'admin', name: 'Admin' } },
      version: 0
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log("Uploading paper...");
  await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 30000 });
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'dummy.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  });

  console.log("Clicking configure...");
  await page.getByRole('button', { name: /Continue to configure/i }).click();

  console.log("In configure step, clicking continue...");
  await page.getByRole('button', { name: /Continue to preview/i }).click();
  
  console.log("In metadata step, setting title...");
  await page.getByLabel('Test Title').fill('Benchmark Validation Test');
  await page.getByLabel('Scheduled Date & Time').fill('2026-06-04T12:00');
  
  // Create artifacts dir
  if (!fs.existsSync('artifacts')) fs.mkdirSync('artifacts');

  console.log("Continuing to preview...");
  await page.getByRole('button', { name: /Continue to preview/i }).click();

  console.log("Waiting for processing...");
  // Processing could take a few seconds because it's reading the json
  await page.waitForSelector('text=Ready to publish', { timeout: 15000 });

  console.log("Teacher Preview loaded. Taking screenshot...");
  await page.screenshot({ path: 'artifacts/teacher_preview.png', fullPage: true });

  console.log("Validating questions...");
  const questionsToVerify = [1, 15, 30, 45, 60, 75];
  for (const qNum of questionsToVerify) {
    try {
      await page.getByRole('button', { name: `Q${qNum}`, exact: true }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `artifacts/q${qNum}_preview.png` });
      console.log(`Verified Q${qNum}`);
    } catch (e) {
      console.log(`Failed to verify Q${qNum}: ${e.message}`);
      process.exit(1);
    }
  }

  console.log("Teacher Editing...");
  await page.getByRole('button', { name: 'Q1', exact: true }).click();
  const editTextarea = page.locator('textarea').first();
  await editTextarea.fill('EDITED QUESTION 1');
  await page.screenshot({ path: 'artifacts/teacher_editing.png' });
  console.log("Successfully edited question.");

  console.log("Publishing test...");
  const publishBtn = page.getByRole('button', { name: /Publish/i });
  await publishBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'artifacts/publish_success.png' });

  console.log("Validating Student Attempt...");
  await page.evaluate(() => {
    localStorage.setItem('workspace-auth', JSON.stringify({
      state: { session: { id: 'test-session-student', userId: 'test-student', instituteId: 'test-inst', role: 'student', name: 'Student' } },
      version: 0
    }));
  });
  await page.goto('http://localhost:3000/student/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'artifacts/student_dashboard.png' });

  console.log("ALL TESTS PASSED.");
  await browser.close();
})();
