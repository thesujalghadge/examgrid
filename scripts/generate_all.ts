import "dotenv/config";
import { runGeminiWorker } from "@/lib/background-jobs/gemini-worker";

async function run() {
  for (let i = 0; i < 11; i++) {
    console.log(`Job ${i+1}...`);
    console.log(await runGeminiWorker("test"));
  }
}
run().catch(console.error);
