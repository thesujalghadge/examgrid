import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { leaseJob } from "../src/lib/solutions/queue";
import { processLeasedJob } from "../src/lib/solutions/solution-generator";

async function run() {
  console.log("Running new solution generator pipeline...");
  for (let i = 0; i < 20; i++) {
    const job = await leaseJob();
    if (!job) {
      console.log("No more jobs. Exiting.");
      break;
    }
    console.log(`Processing job ${job.id} for question ${job.question_id}`);
    await processLeasedJob(job);
    await new Promise(r => setTimeout(r, 4500)); // rate limit delay
  }
}

run();
