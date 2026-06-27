import { test, expect } from '@playwright/test';

// Use fixed accounts as per user request
const STUDENT_ROLL = process.env.TEST_STUDENT_ROLL || 'TEST_STUDENT_001';
const STUDENT_PASS = process.env.TEST_STUDENT_PASS || 'password123';

test.describe('Student CBT Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    // Assuming a simple roll number + password form exists for students
    // Adjust selectors to match actual application UI
    await page.fill('input[name="rollNumber"]', STUDENT_ROLL);
    await page.fill('input[name="password"]', STUDENT_PASS);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('completes full CBT attempt and views solution/analytics', async ({ page }) => {
    // 1. Dashboard: Upcoming Tests
    await page.click('text=Upcoming Tests');
    
    // Find the smoke test
    const startTestButton = page.locator('button:has-text("Start Test")').first();
    await expect(startTestButton).toBeVisible();
    await startTestButton.click();

    // 2. Start Test (Instructions page)
    await expect(page).toHaveURL(/\/student\/cbt\/.*\/instructions/);
    await page.click('text=I agree and start test');

    // 3. CBT Interface
    await expect(page).toHaveURL(/\/student\/cbt\/.*\/attempt/);
    
    // Answer 5 questions
    for (let i = 0; i < 5; i++) {
      // Select the first available option for simplicity
      const option = page.locator('.cbt-option').first();
      if (await option.isVisible()) {
        await option.click();
      } else {
        // Handle Numerical questions if needed
        const input = page.locator('input[type="text"]').first();
        if (await input.isVisible()) {
          await input.fill('42');
        }
      }
      // Click "Save & Next"
      await page.click('button:has-text("Save & Next")');
    }

    // 4. Submit Test
    await page.click('button:has-text("Submit Test")');
    // Confirm submission modal
    const confirmButton = page.locator('button:has-text("Confirm Submit")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // 5. Result Page
    await expect(page).toHaveURL(/\/student\/reports/);
    await expect(page.locator('text=Test Submitted Successfully')).toBeVisible();

    // 6. View Solution Page
    // Assuming there's a link to the solutions in the report
    await page.click('text=View Solutions');
    await expect(page).toHaveURL(/\/student\/solutions/);
    
    // Verify pedagogical layout
    await expect(page.locator('text=Concept').first()).toBeVisible();
    await expect(page.locator('text=Step-by-Step Solution').first()).toBeVisible();

    // 7. Analysis Page
    await page.goto('/student/dashboard');
    await page.click('text=Report');
    await expect(page.locator('text=Performance Analytics')).toBeVisible();
  });
});
