import { test, expect } from '@playwright/test';

const INSTITUTE_EMAIL = process.env.TEST_INSTITUTE_EMAIL || 'admin@testinstitute.com';
const INSTITUTE_PASS = process.env.TEST_INSTITUTE_PASS || 'password123';

test.describe('Institute Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to institute login
    await page.goto('/institute/login');
    await page.fill('input[type="email"]', INSTITUTE_EMAIL);
    await page.fill('input[type="password"]', INSTITUTE_PASS);
    await page.click('button[type="submit"]');

    // Wait for redirect to institute dashboard
    await expect(page).toHaveURL(/\/institute/);
  });

  test('uploads paper, publishes exam, and monitors solutions', async ({ page }) => {
    // 1. Upload Paper (Draft)
    await page.click('text=Upload Paper');
    await expect(page).toHaveURL(/\/institute\/tests\/create/);
    
    // Fill in basic details
    await page.fill('input[name="title"]', 'Smoke E2E Exam');
    // Assuming there's a file input for PDF
    // await page.setInputFiles('input[type="file"]', 'tests/fixtures/sample_exam.pdf');
    await page.click('button:has-text("Save Draft")');

    // Wait for creation
    await expect(page).toHaveURL(/\/institute\/tests\/.+/);

    // 2. Publish Exam
    await page.click('button:has-text("Publish Exam")');
    // Confirm publish
    const confirmPublish = page.locator('button:has-text("Confirm Publish")');
    if (await confirmPublish.isVisible()) {
      await confirmPublish.click();
    }
    
    // 3. Monitor Solution Progress
    await page.goto('/institute/solution-queue');
    
    // Verify the exam appears in the Exam Status panel
    await expect(page.locator('text=Smoke E2E Exam')).toBeVisible();
    
    // We expect the progress bar to show up
    await expect(page.locator('.progress-bar, [role="progressbar"]').first()).toBeVisible();

    // 4. View Leaderboard
    await page.goto('/institute/tests');
    await page.click('text=Smoke E2E Exam');
    await page.click('text=Leaderboard');
    await expect(page.locator('table')).toBeVisible();

    // 5. View Analytics
    await page.click('text=Analytics');
    await expect(page.locator('text=Completion Rate')).toBeVisible();
  });
});
