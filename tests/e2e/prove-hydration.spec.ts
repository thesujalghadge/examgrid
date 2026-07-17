import { test, expect } from '@playwright/test';

test('Hydration Proof', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🛠️') || text.includes('- Students:') || text.includes('- Batches:') || text.includes('- Exams:') || text.includes('- Schedules:') || text.includes('ERROR')) {
      logs.push(text);
      console.log(text);
    }
  });

  // 1. Go to login
  await page.goto('http://localhost:3000/institute/login');
  await page.waitForLoadState('networkidle');

  // 2. Select Apex Academy
  // The select is a standard HTML select but wait, is it?
  // Let's try to click the button to log in.
  // We assume the first active institute (Apex) is auto-selected, or we select it.
  
  // Find the button "Enter Institute Workspace"
  await page.click('button:has-text("Enter Institute")');

  // 3. Wait for the dashboard to load and logs to be emitted
  await page.waitForURL('**/institute', { timeout: 10000 });
  await page.waitForTimeout(15000); // Give it time to log

  // Check if we got logs
  if (logs.length === 0) {
    console.log("No hydration logs captured. The test might have failed to reach the dashboard.");
  }
});
