import { loadEnvFiles } from "./supabase/load-env.mjs";
import { runGeminiWorker } from "../src/lib/background-jobs/gemini-worker";

async function testWorker() {
  await loadEnvFiles();
  console.log("Running worker...");
  try {
    const res = await runGeminiWorker();
    console.log("Worker result:", res);
  } catch (err) {
    console.error("Worker CRASHED:", err);
  }
}

testWorker();
