import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runGeminiWorker } from "../src/lib/background-jobs/gemini-worker";

import { getInstituteGeminiKey } from "../src/lib/institute/get-institute-api-key";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  process.env.GEMINI_API_KEY = await getInstituteGeminiKey("ddcc7407-fbb6-42bd-9751-576ef43e2241");
  console.log("SECTION D: Terminal output from Gemini worker execution.");
  for (let i = 0; i < 20; i++) {
    console.log(`\n--- Worker Execution ${i + 1} ---`);
    const res = await runGeminiWorker();
    console.log("Result:", res);
    
    // If no jobs left, break early
    if (res.processed === 0 && res.success) {
      console.log("No more jobs. Exiting.");
      break;
    }

    console.log("Sleeping 5 seconds to respect rate limit...");
    await sleep(5000);
  }
}

run();
