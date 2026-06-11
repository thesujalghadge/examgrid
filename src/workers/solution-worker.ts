import { leaseJob } from "../lib/solutions/queue";
import { processLeasedJob } from "../lib/solutions/solution-generator";

// Graceful shutdown handling
let isShuttingDown = false;

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down worker gracefully...");
  isShuttingDown = true;
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down worker gracefully...");
  isShuttingDown = true;
});

async function main() {
  console.log("Solution Generation Worker started.");
  
  while (!isShuttingDown) {
    try {
      const job = await leaseJob();
      
      if (job) {
        console.log(`Leased job ${job.id} for question ${job.question_id}`);
        await processLeasedJob(job);
        
        // Rate Limiting & Politeness (e.g., max 12 RPM for free tier)
        // Fixed delay of 5 seconds after a successful/failed processing attempt
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        // No jobs available, sleep for 10 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (err: any) {
      console.error("Worker encountered a critical error during loop:", err.message);
      // Backoff slightly on systemic errors
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  console.log("Solution Generation Worker exited gracefully.");
  process.exit(0);
}

// Support running directly via Node/tsx
if (require.main === module) {
  main();
}
