import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== EXAMGRID E2E AUDIT REPORT ===\n");

  // Fetch data
  const { data: exams } = await supabase.from("exams").select("*").order("created_at", { ascending: false }).limit(1);
  const exam = exams && exams.length > 0 ? exams[0] : null;
  
  const { data: questions } = exam ? await supabase.from("exam_questions").select("*").eq("exam_id", exam.id) : { data: [] };
  const { data: attempts } = exam ? await supabase.from("cbt_attempts").select("*").eq("test_id", exam.id).order("created_at", { ascending: false }).limit(1) : { data: [] };
  const attempt = attempts && attempts.length > 0 ? attempts[0] : null;

  // Queue and solutions
  const qIds = questions?.map(q => q.id) || [];
  const { data: queue } = qIds.length > 0 ? await supabase.from("solution_generation_queue").select("*").in("question_id", qIds) : { data: [] };
  const { data: solutions } = qIds.length > 0 ? await supabase.from("question_solutions").select("*").in("question_id", qIds) : { data: [] };

  // UPLOAD REPORT
  console.log("UPLOAD REPORT");
  console.log(`* question count: ${questions?.length || 0}`);
  const imageCount = questions?.filter(q => q.published_image_url).length || 0;
  console.log(`* image count: ${imageCount}`);
  const keyCount = questions?.filter(q => q.published_answer_key).length || 0;
  console.log(`* answer key count: ${keyCount}\n`);

  // ATTEMPT REPORT
  console.log("ATTEMPT REPORT");
  console.log(`* student id: ${attempt?.student_id || "NOT FOUND"}`);
  console.log(`* attempt id: ${attempt?.id || "NOT FOUND"}`);
  const responseCount = attempt?.answers ? Object.keys(attempt.answers).length : 0;
  console.log(`* response count: ${responseCount}\n`);

  // SOLUTION REPORT
  console.log("SOLUTION REPORT");
  console.log(`* total queue jobs: ${queue?.length || 0}`);
  const completedJobs = queue?.filter(q => q.status === "COMPLETED").length || 0;
  console.log(`* completed jobs: ${completedJobs}`);
  const failedJobs = queue?.filter(q => q.status === "FAILED").length || 0;
  console.log(`* failed jobs: ${failedJobs}`);
  console.log(`* solution rows created: ${solutions?.length || 0}\n`);

  // MISMATCH REPORT
  console.log("MISMATCH REPORT");
  const disputed = solutions?.filter(s => s.review_status === "DISPUTED") || [];
  if (disputed.length === 0) {
    console.log("No mismatches found.");
  } else {
    disputed.forEach(sol => {
      const q = questions?.find(qx => qx.id === sol.question_id);
      console.log(`* question id: ${sol.question_id}`);
      console.log(`* teacher key: ${q?.published_answer_key || "UNKNOWN"}`);
      console.log(`* model answer: ${sol.final_answer}`);
      console.log(`* confidence: ${sol.answer_confidence || "Unknown"}`);
      console.log(`* reasoning summary: Model final answer mismatched teacher key.\n`);
    });
  }

  console.log("\n=== END OF REPORT ===");
}

run();
