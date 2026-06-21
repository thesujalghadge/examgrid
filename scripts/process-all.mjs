import { loadEnvFiles } from "./supabase/load-env.mjs";

async function processAll() {
  const secret = process.env.CRON_SECRET || 'dev-secret';
  let processedCount = 1;

  while (processedCount > 0) {
    console.log("Triggering worker...");
    try {
      const res = await fetch("http://localhost:3000/api/internal/process-solution-queue", {
        method: "POST",
        headers: { "authorization": `Bearer ${secret}` }
      });
      const data = await res.json();
      processedCount = data.jobsProcessed || 0;
      console.log(`Processed ${processedCount} jobs.`, data);
      
      if (processedCount > 0) {
        // Wait 5 seconds before next batch to respect rate limits
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error("Error:", e.message);
      break;
    }
  }
  console.log("All done!");
}

processAll();
