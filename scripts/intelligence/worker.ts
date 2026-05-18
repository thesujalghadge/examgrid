/**
 * BullMQ worker process for the Academic Intelligence pipeline.
 * Run: npm run intelligence:worker
 */
import { startIntelligenceWorkers } from "@/intelligence/queues/workers";

const workers = startIntelligenceWorkers();

console.info(
  `[ExamGrid Intelligence] Started ${workers.length} queue workers. Waiting for jobs…`,
);

async function shutdown() {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
