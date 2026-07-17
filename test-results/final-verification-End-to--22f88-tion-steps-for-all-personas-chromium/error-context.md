# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-verification.spec.ts >> End-to-End Final Verification >> should pass all verification steps for all personas
- Location: tests\e2e\final-verification.spec.ts:7:7

# Error details

```
Error: expect(locator).not.toHaveText(expected) failed

Locator:  locator('div[data-slot="card"]').filter({ hasText: 'Active institutes' }).first().locator('.text-2xl')
Expected: not "0"
Received: "0"
Timeout:  5000ms

Call log:
  - Expect "not toHaveText" with timeout 5000ms
  - waiting for locator('div[data-slot="card"]').filter({ hasText: 'Active institutes' }).first().locator('.text-2xl')
    14 × locator resolved to <div data-slot="card-content" class="px-4 group-data-[size=sm]/card:px-3 text-2xl font-semibold text-[#14213d]">0</div>
       - unexpected value "0"

```

```yaml
- text: "0"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('End-to-End Final Verification', () => {
  4   |   // Use a long timeout for the entire suite to accommodate all the checks
  5   |   test.setTimeout(120000);
  6   | 
  7   |   test('should pass all verification steps for all personas', async ({ page, context }) => {
  8   |     // We will navigate manually and check assertions.
  9   |     page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.text()}`));
  10  |     
  11  |     console.log("=== STARTING E2E VERIFICATION ===");
  12  | 
  13  |     console.log("[CHECK] Platform Admin Login");
  14  |     await page.goto('http://localhost:3000/platform/login');
  15  |     await page.locator('button:has-text("Enter Platform")').click();
  16  |     await page.waitForURL('http://localhost:3000/platform');
  17  | 
  18  |     console.log("[CHECK] Platform Admin Portal");
  19  |     await expect(page.locator('text=Platform overview')).toBeVisible();
  20  |     
  21  |     // Check Active institutes card
  22  |     const activeInstitutesCard = page.locator('div[data-slot="card"]').filter({ hasText: 'Active institutes' }).first();
> 23  |     await expect(activeInstitutesCard.locator('.text-2xl')).not.toHaveText('0');
      |                                                                 ^ Error: expect(locator).not.toHaveText(expected) failed
  24  |     console.log("  -> Platform Admin PASS");
  25  | 
  26  |     // 2. Verify Institute Admin Portal Login
  27  |     console.log("[CHECK] Institute Admin Login");
  28  |     await page.goto('http://localhost:3000/institute/login');
  29  |     // It should automatically fetch active institutes and populate the select
  30  |     await page.waitForSelector('select');
  31  |     // Select the first institute (Apex Academy)
  32  |     const select = page.locator('select');
  33  |     await select.selectOption({ index: 0 });
  34  |     // Click continue
  35  |     await page.locator('button:has-text("Enter Institute")').click();
  36  |     
  37  |     console.log("[CHECK] Institute Dashboard");
  38  |     await page.waitForURL('http://localhost:3000/institute');
  39  |     await expect(page.locator('text=Apex Academy').first()).toBeVisible();
  40  |     
  41  |     // Verify hydrated data
  42  |     // We expect students > 0, batches > 0, live tests > 0
  43  |     await page.waitForSelector('.grid');
  44  |     
  45  |     // Check Students card
  46  |     const studentsCard = page.locator('div[data-slot="card"]').filter({ hasText: 'Students' }).first();
  47  |     await expect(studentsCard.locator('.text-3xl')).not.toHaveText('0');
  48  |     
  49  |     // Check Batches card
  50  |     const batchesCard = page.locator('div[data-slot="card"]').filter({ hasText: 'Batches' }).first();
  51  |     await expect(batchesCard.locator('.text-3xl')).not.toHaveText('0');
  52  |     console.log(`  -> Hydrated data visible`);
  53  |     console.log("  -> Institute Dashboard PASS");
  54  | 
  55  |     // Check Institute specific pages
  56  |     console.log("[CHECK] Institute Batches Page");
  57  |     await page.goto('http://localhost:3000/institute/batches');
  58  |     await expect(page.locator('text=Zenith Batch')).toBeVisible();
  59  |     console.log("  -> Institute Batches PASS");
  60  | 
  61  |     console.log("[CHECK] Institute Tests Page");
  62  |     await page.goto('http://localhost:3000/institute/tests');
  63  |     await expect(page.locator('text=Test Creation Wizard').first()).toBeVisible();
  64  |     console.log("  -> Institute Tests PASS");
  65  | 
  66  |     // 3. Log out of Institute
  67  |     console.log("[CHECK] Institute Logout");
  68  |     await page.locator('button:has-text("Logout")').click();
  69  |     await page.waitForURL('http://localhost:3000/institute/login');
  70  | 
  71  |     // 4. Verify Student Portal Login
  72  |     console.log("[CHECK] Student Login");
  73  |     await page.goto('http://localhost:3000/student/login');
  74  |     // Find the correct institute
  75  |     await page.waitForSelector('select');
  76  |     await page.locator('select').selectOption({ index: 0 });
  77  |     
  78  |     // Login as Aryan (JEE)
  79  |     await page.fill('#roll', 'DEMO-001'); // Aryan's roll
  80  |     await page.locator('button:has-text("Enter Student Portal")').click();
  81  | 
  82  |     console.log("[CHECK] Student Dashboard");
  83  |     await page.waitForURL('http://localhost:3000/student/tests');
  84  |     await expect(page.locator('text=Aryan').first()).toBeVisible();
  85  |     
  86  |     // Check for tests
  87  |     await page.waitForSelector('text=Upcoming');
  88  |     const upcomingTestsCount = await page.locator('text=Take Test').count();
  89  |     console.log(`  -> Found ${upcomingTestsCount} upcoming tests available to take`);
  90  |     
  91  |     console.log("  -> Student Dashboard PASS");
  92  | 
  93  | 
  94  | 
  95  |     console.log("[CHECK] Student Progress/Reports Page");
  96  |     await page.goto('http://localhost:3000/student/reports');
  97  |     await expect(page.locator('text=Your performance story starts after test one.')).toBeVisible();
  98  |     console.log("  -> Student Reports PASS");
  99  | 
  100 |     console.log("=== ALL CHECKS COMPLETED SUCCESSFULLY ===");
  101 |   });
  102 | });
  103 | 
```