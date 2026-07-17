import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const artifactDir = "C:\\Users\\SOURAV\\.gemini\\antigravity\\brain\\3dec838c-22eb-43bc-9d33-90610ea0ee2d";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to root to inject localstorage...");
  await page.goto("http://localhost:3000/");
  await page.evaluate(() => {
    localStorage.setItem("examgrid:platform-institutes", JSON.stringify([{
      id: "183235f9-1535-4e51-925e-8fffaebf1c85",
      name: "ExamGrid Institute",
      city: "Test",
      adminEmail: "admin@examgrid.com",
      status: "active"
    }]));
  });

  console.log("Navigating to Student Login...");
  await page.goto("http://localhost:3000/student/login");
  
  // Fill login
  await page.fill('#roll', "26JEE001");
  await page.click('button[type="submit"]');
  
  await page.waitForURL("**/student/**", { timeout: 10000 }).catch(() => {});
  console.log("Logged in as 26JEE001");

  // Go to All Tests / Completed (Result Page)
  console.log("Navigating to Result Page for test a2893afc-97e6-42ca-9d31-f510aa23c9cf...");
  await page.goto("http://localhost:3000/student/tests/a2893afc-97e6-42ca-9d31-f510aa23c9cf/result", { timeout: 90000 });
  await page.waitForTimeout(5000);
  
  const resultText = await page.textContent("body");
  console.log("RESULT PAGE RENDERED TEXT: ", resultText?.includes("Rank") ? "Has Rank" : "Missing Rank");
  console.log("RESULT PAGE RENDERED TEXT: ", resultText?.includes("Percentile") ? "Has Percentile" : "Missing Percentile");
  console.log("RESULT PAGE RENDERED TEXT: ", resultText?.includes("Negative") ? "Has Negative Marks" : "Missing Negative Marks");
  
  await page.screenshot({ path: path.join(artifactDir, "student_result.png"), fullPage: true });
  
  // Go to Solutions
  console.log("Navigating to Solutions Page...");
  await page.goto("http://localhost:3000/student/tests/a2893afc-97e6-42ca-9d31-f510aa23c9cf/solutions", { timeout: 90000 });
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: path.join(artifactDir, "student_solutions.png"), fullPage: true });
  const solText = await page.textContent("body");
  console.log("SOLUTIONS RENDERED: ", solText?.includes("Time Spent") ? "Has Time Spent" : "Missing Time Spent");
  console.log("SOLUTIONS RENDERED: ", solText?.includes("Exam Strategy") ? "Has Solutions" : "Missing Solutions");

  // Go to Student Reports
  console.log("Navigating to Student Reports...");
  await page.goto("http://localhost:3000/student/reports", { timeout: 90000 });
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: path.join(artifactDir, "student_reports.png"), fullPage: true });
  const repText = await page.textContent("body");
  console.log("REPORTS RENDERED: ", repText?.includes("Strong Areas") ? "Has Strong Areas" : "Missing Strong Areas");
  console.log("REPORTS RENDERED: ", repText?.includes("Needs Attention") ? "Has Needs Attention" : "Missing Needs Attention");
  console.log("REPORTS RENDERED: ", repText?.includes("Performance History") ? "Has Performance History" : "Missing Performance History");

  // Institute Flow
  await context.clearCookies();
  console.log("Navigating to Institute Login...");
  await page.goto("http://localhost:3000/institute/login");
  
  // Fill login
  await page.fill('input[type="email"]', "admin@examgrid.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  
  await page.waitForURL("**/institute");
  console.log("Logged in as Institute");

  // Go to Analytics
  console.log("Navigating to Institute Analytics...");
  await page.goto("http://localhost:3000/institute/analytics");
  await page.waitForLoadState("networkidle");
  
  await page.screenshot({ path: path.join(artifactDir, "institute_analytics.png"), fullPage: true });

  await browser.close();
  console.log("Done taking screenshots!");
}

run().catch(console.error);
