import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  const { enqueueSolutionsForExam } = await import("../src/lib/background-jobs/queue-trigger");
  const examId = "d18c20cf-7c4b-455c-b2b5-098e0919ebac";
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";

  try {
    const result = await enqueueSolutionsForExam(examId, instituteId);
    console.log("Result:", result);
  } catch (e) {
    console.error("Error calling enqueueSolutionsForExam:", e);
  }
}

run().catch(console.error);
