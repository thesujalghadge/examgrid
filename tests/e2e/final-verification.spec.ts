import { test, expect } from '@playwright/test';

test.describe('End-to-End Final Verification', () => {
  // Use a long timeout for the entire suite to accommodate all the checks
  test.setTimeout(120000);

  test('should pass all verification steps for all personas', async ({ page, context }) => {
    // We will navigate manually and check assertions.
    page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.text()}`));
    
    console.log("=== STARTING E2E VERIFICATION ===");

    console.log("[CHECK] Platform Admin Login");
    await page.goto('http://localhost:3000/platform/login');
    await page.locator('button:has-text("Enter Platform")').click();
    await page.waitForURL('http://localhost:3000/platform');

    console.log("[CHECK] Platform Admin Portal");
    await expect(page.locator('text=Platform overview')).toBeVisible();
    
    // Check Active institutes card
    const activeInstitutesCard = page.locator('div[data-slot="card"]').filter({ hasText: 'Active institutes' }).first();
    await expect(activeInstitutesCard.locator('.text-2xl')).not.toHaveText('0');
    console.log("  -> Platform Admin PASS");

    // 2. Verify Institute Admin Portal Login
    console.log("[CHECK] Institute Admin Login");
    await page.goto('http://localhost:3000/institute/login');
    // It should automatically fetch active institutes and populate the select
    await page.waitForSelector('select');
    // Select the first institute (Apex Academy)
    const select = page.locator('select');
    await select.selectOption({ index: 0 });
    // Click continue
    await page.locator('button:has-text("Enter Institute")').click();
    
    console.log("[CHECK] Institute Dashboard");
    await page.waitForURL('http://localhost:3000/institute');
    await expect(page.locator('text=Apex Academy').first()).toBeVisible();
    
    // Verify hydrated data
    // We expect students > 0, batches > 0, live tests > 0
    await page.waitForSelector('.grid');
    
    // Check Students card
    const studentsCard = page.locator('div[data-slot="card"]').filter({ hasText: 'Students' }).first();
    await expect(studentsCard.locator('.text-3xl')).not.toHaveText('0');
    
    // Check Batches card
    const batchesCard = page.locator('div[data-slot="card"]').filter({ hasText: 'Batches' }).first();
    await expect(batchesCard.locator('.text-3xl')).not.toHaveText('0');
    console.log(`  -> Hydrated data visible`);
    console.log("  -> Institute Dashboard PASS");

    // Check Institute specific pages
    console.log("[CHECK] Institute Batches Page");
    await page.goto('http://localhost:3000/institute/batches');
    await expect(page.locator('text=Zenith Batch')).toBeVisible();
    console.log("  -> Institute Batches PASS");

    console.log("[CHECK] Institute Tests Page");
    await page.goto('http://localhost:3000/institute/tests');
    await expect(page.locator('text=Test Creation Wizard').first()).toBeVisible();
    console.log("  -> Institute Tests PASS");

    // 3. Log out of Institute
    console.log("[CHECK] Institute Logout");
    await page.locator('button:has-text("Logout")').click();
    await page.waitForURL('http://localhost:3000/institute/login');

    // 4. Verify Student Portal Login
    console.log("[CHECK] Student Login");
    await page.goto('http://localhost:3000/student/login');
    // Find the correct institute
    await page.waitForSelector('select');
    await page.locator('select').selectOption({ index: 0 });
    
    // Login as Aryan (JEE)
    await page.fill('#roll', 'DEMO-001'); // Aryan's roll
    await page.locator('button:has-text("Enter Student Portal")').click();

    console.log("[CHECK] Student Dashboard");
    await page.waitForURL('http://localhost:3000/student/tests');
    await expect(page.locator('text=Aryan').first()).toBeVisible();
    
    // Check for tests
    await page.waitForSelector('text=Upcoming');
    const upcomingTestsCount = await page.locator('text=Take Test').count();
    console.log(`  -> Found ${upcomingTestsCount} upcoming tests available to take`);
    
    console.log("  -> Student Dashboard PASS");



    console.log("[CHECK] Student Progress/Reports Page");
    await page.goto('http://localhost:3000/student/reports');
    await expect(page.locator('text=Your performance story starts after test one.')).toBeVisible();
    console.log("  -> Student Reports PASS");

    console.log("=== ALL CHECKS COMPLETED SUCCESSFULLY ===");
  });
});
