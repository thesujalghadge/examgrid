import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPublish() {
  const testId = "d18c20cf-7c4b-455c-b2b5-098e0919ebac";
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";

  // First, verify queue count
  const { count } = await supabase.from("solution_generation_queue").select("*", { count: "exact" }).in("question_id", [
    "cbt-008f2154-e779-450a-b6be-350e880025aa-paper-1781792414097-question-1"
  ]);
  console.log("Existing queue rows:", count);

  // simulate step 2.5 FREEZE EXAM QUESTIONS
  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, question_type, question_text, correct_option_id, correct_numerical_answer, options')
    .eq('exam_id', testId);

  console.log("Questions found for freezing:", questions?.length);

  try {
    const { enqueueSolutionsForExam } = await import("../src/lib/background-jobs/queue-trigger");
    const result = await enqueueSolutionsForExam(testId, instituteId);
    console.log("enqueueSolutionsForExam result:", result);
  } catch (err: any) {
    console.log("enqueueSolutionsForExam threw error:", err.message);
  }
}

testPublish().catch(console.error);
