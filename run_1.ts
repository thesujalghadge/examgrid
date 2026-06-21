import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const { runGeminiWorker } = await import("./src/lib/background-jobs/gemini-worker");
    const res = await runGeminiWorker();
    console.log(res);
}

run();
