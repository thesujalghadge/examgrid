import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const { runWorkerTick } = await import('./src/lib/background-jobs/gemini-worker');
  const res = await runWorkerTick();
  console.log("Worker tick completed", res);
}

run().catch(console.error);
