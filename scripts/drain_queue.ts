import { leaseJob } from "../src/lib/solutions/queue";
import { processLeasedJob } from "../src/lib/solutions/solution-generator";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function drainQueue() {
  console.log("Draining solution generation queue using real generator...");
  let count = 0;
  while (true) {
    try {
      const job = await leaseJob();
      if (!job) {
        console.log("Queue is empty. Exiting.");
        break;
      }
      
      console.log(`\n--- Processing Job ${job.id} (Question: ${job.question_id}) ---`);
      await processLeasedJob(job);
      count++;
      
      // small delay to respect rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error("Worker loop error:", err.message);
      break;
    }
  }
  console.log(`\nDrained ${count} jobs successfully.`);
}

drainQueue().catch(console.error);
