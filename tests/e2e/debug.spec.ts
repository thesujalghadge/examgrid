import { test, expect } from '@playwright/test';

test('debug students', async ({ page }) => {
  await page.goto('http://localhost:3000/test-students');
  // wait for fetch to complete by waiting for text NOT to be Loading...
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Students: ') && !document.body.innerText.includes('Loading...');
  });
  const text = await page.locator('body').innerText();
  console.log("PAGE TEXT:", text);
});
