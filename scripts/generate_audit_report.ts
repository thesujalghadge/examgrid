import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== EXAMGRID E2E BACKEND AUDIT ===\n");

  // Get the latest exam
  const { data: exams } = await s
    .from("exams")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!exams || exams.length === 0) {
    console.log("No exams found.");
    return;
  }

  const exam = exams[0];
  const examId = exam.id;
  
  console.log(`Test ID: ${examId}\n`);

  // --- ATTEMPT REPORT ---
  console.log("--- ATTEMPT REPORT ---");
  const { data: attempts } = await s
    .from("student_attempts")
    .select("*")
    .eq("exam_id", examId);

  if (!attempts || attempts.length === 0) {
    console.log("No attempts found for this exam.\n");
  } else {
    for (const attempt of attempts) {
      const { count: resCount } = await s
        .from("student_responses")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", attempt.id);
      
      const scoreGenerated = attempt.score !== null ? "Yes" : "No";
      
      console.log(`Attempt ID: ${attempt.id}`);
      console.log(`Student ID: ${attempt.student_id}`);
      console.log(`Exam ID: ${attempt.exam_id}`);
      console.log(`Response Count: ${resCount || 0}`);
      console.log(`Score Generated: ${scoreGenerated}\n`);
    }
  }

  // --- QUEUE REPORT ---
  console.log("--- QUEUE REPORT ---");
  const { data: qData } = await s.from("exam_questions").select("id").eq("exam_id", examId);
  const qIds = qData?.map(q => q.id) || [];
  
  let pending = 0, completed = 0, failed = 0;
  if (qIds.length > 0) {
    const { data: queue } = await s.from("solution_generation_queue").select("status").in("question_id", qIds);
    pending = queue?.filter(q => q.status === "PENDING").length || 0;
    completed = queue?.filter(q => q.status === "COMPLETED").length || 0;
    failed = queue?.filter(q => q.status === "FAILED").length || 0;
  }
  
  console.log(`Pending Jobs: ${pending}`);
  console.log(`Completed Jobs: ${completed}`);
  console.log(`Failed Jobs: ${failed}\n`);

  // --- SOLUTION REPORT ---
  console.log("--- SOLUTION REPORT ---");
  const { data: questions } = await s
    .from("exam_questions")
    .select("id, question_number, published_answer_key")
    .eq("exam_id", examId)
    .order("question_number", { ascending: true });
    
  const { data: solutions } = await s
    .from("question_solutions")
    .select("question_id, model_answer, ai_metadata, content_markdown")
    .in("question_id", qIds);

  const mismatchList = [];

  for (const q of questions || []) {
    const sol = solutions?.find(s => s.question_id === q.id);
    const teacherKey = q.published_answer_key || "N/A";
    let modelAnswer = "N/A";
    let metadataExists = "No";
    let solutionExists = "No";

    if (sol) {
      modelAnswer = sol.model_answer || "N/A";
      metadataExists = sol.ai_metadata ? "Yes" : "No";
      solutionExists = sol.content_markdown ? "Yes" : "No";
      
      const cleanTeacher = String(teacherKey).trim().toLowerCase();
      const cleanModel = String(modelAnswer).trim().toLowerCase();
      if (cleanTeacher !== cleanModel && cleanTeacher !== "n/a") {
         mismatchList.push({
            question_id: q.id,
            teacher_key: teacherKey,
            model_answer: modelAnswer,
            status: "DISPUTED"
         });
      }
    }

    console.log(`Question ID: ${q.id}`);
    console.log(`Teacher Key: ${teacherKey}`);
    console.log(`Model Answer: ${modelAnswer}`);
    console.log(`Metadata Exists?: ${metadataExists}`);
    console.log(`Solution Exists?: ${solutionExists}`);
    console.log("------------------------");
  }
  console.log("");

  // --- MISMATCH REPORT ---
  console.log("--- MISMATCH REPORT ---");
  if (mismatchList.length === 0) {
    console.log("No mismatches found.\n");
  } else {
    for (const m of mismatchList) {
      console.log(`Question ID: ${m.question_id}`);
      console.log(`Teacher Key: ${m.teacher_key}`);
      console.log(`Model Answer: ${m.model_answer}`);
      console.log(`Matching Option: ${m.model_answer}`); // In pyq pipeline, model_answer usually stores the matched option if it's an MCQ
      console.log(`Status: ${m.status}`);
      console.log("------------------------");
    }
  }

}

run().catch(console.error);
