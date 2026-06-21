import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function runAudit() {
  console.log("=== BACKEND SOLUTION PIPELINE AUDIT ===\n");

  // Get the most recent exam
  const { data: exams, error: examErr } = await supabase
    .from("exams")
    .select("id, title, is_published, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (examErr || !exams || exams.length === 0) {
    console.log("CRITICAL FAILURE: No exams found in the database.");
    console.log("The persistence layer is still failing to save the 6-question test.");
    return;
  }

  const exam = exams[0];
  console.log(`Exam Found: ${exam.title} (ID: ${exam.id})`);
  console.log(`Published: ${exam.is_published}`);
  console.log(`Created: ${exam.created_at}\n`);

  // Get questions for this exam
  const { data: questions, error: qErr } = await supabase
    .from("exam_questions")
    .select("*")
    .eq("exam_id", exam.id);

  if (qErr || !questions || questions.length === 0) {
    console.log(`CRITICAL FAILURE: No questions found for exam ${exam.id}.`);
    return;
  }

  console.log(`Questions Found: ${questions.length}\n`);

  // Get queue jobs and solutions
  const qIds = questions.map((q) => q.id);
  const { data: queue } = await supabase
    .from("solution_generation_queue")
    .select("*")
    .in("question_id", qIds);

  const { data: solutions } = await supabase
    .from("question_solutions")
    .select("*")
    .in("question_id", qIds);

  // Generate Report
  console.log("QUESTION-LEVEL AUDIT REPORT:");
  console.log("--------------------------------------------------");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const job = queue?.find((j) => j.question_id === q.id);
    const sol = solutions?.find((s) => s.question_id === q.id);

    console.log(`Question #${i + 1} (ID: ${q.id})`);
    console.log(`  Image Present:     ${q.published_image_url ? "YES" : "NO"}`);
    console.log(`  Teacher Key:       ${q.published_answer_key || "MISSING"}`);
    console.log(`  Gemini Called:     ${job ? (job.status === "COMPLETED" || job.status === "FAILED" ? "YES" : "PENDING") : "NO JOB ENQUEUED"}`);
    
    if (sol) {
      console.log(`  Solution Stored:   YES`);
      console.log(`  Metadata Stored:   YES (Subject: ${sol.subject || 'None'}, Chapter: ${sol.chapter || 'None'})`);
      console.log(`  Model Answer:      ${sol.final_answer || "MISSING"}`);
      console.log(`  Confidence:        ${sol.answer_confidence || "MISSING"}`);
      console.log(`  Review Status:     ${sol.review_status || "NONE"}`);
    } else {
      console.log(`  Solution Stored:   NO`);
      console.log(`  Metadata Stored:   NO`);
      console.log(`  Model Answer:      NONE`);
      if (job && job.status === "FAILED") {
        console.log(`  Failure Reason:    ${job.error_message}`);
      }
    }
    console.log("--------------------------------------------------");
  }
}

runAudit().catch(console.error);
