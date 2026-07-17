import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runWorkerTick } from "./src/lib/background-jobs/gemini-worker";

async function run() {
  let empty = false;
  console.log("Starting worker loop...");
  while (!empty) {
    const r = await runWorkerTick();
    console.log(r);
    if (r.total === 0) empty = true;
  }
  console.log("Queue empty. Done.");
}
run();
