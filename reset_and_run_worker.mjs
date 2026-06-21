import { runGeminiWorker } from "./src/lib/background-jobs/gemini-worker.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const examId = "be5f852f-fc50-4559-9660-22a461bc80d6"; // P0.8B Publish Flow Test
  
  // 1. Get all question IDs
  const { data: qData } = await supabase.from('exam_questions').select('id').eq('exam_id', examId);
  if (!qData || !qData.length) { console.log('No questions found'); return; }
  const qIds = qData.map(q => q.id);
  
  console.log(`Resetting ${qIds.length} solutions for exam ${examId}...`);
  // 2. Delete existing solutions
  await supabase.from('question_solutions').delete().in('question_id', qIds);
  
  // 3. Reset queue to PENDING
  await supabase.from('solution_generation_queue').update({ status: 'PENDING', attempts: 0, failure_stage: null, failure_reason: null }).in('question_id', qIds);
  
  console.log("Starting worker...");
  while (true) {
    const result = await runGeminiWorker();
    if (!result.success && result.reason === "Queue empty") {
      console.log("Queue empty. Done.");
      break;
    }
    console.log("Worker result:", result);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

main().catch(console.error);
