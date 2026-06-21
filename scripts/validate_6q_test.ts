import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== ExamGrid E2E Validation Report ===\n");

  // 1. Upload Validation
  console.log("--- Upload Validation ---");
  const { data: exams, error: eErr } = await supabase.from("exams").select("*").order("created_at", { ascending: false }).limit(1);
  if (!exams || exams.length === 0) {
    console.log("No exams found. Upload failed or test not published.");
    return;
  }
  const exam = exams[0];
  console.log(`Exam Found: ${exam.title} (ID: ${exam.id})`);

  const { data: questions, error: qErr } = await supabase.from("exam_questions").select("*").eq("exam_id", exam.id).order("question_number");
  
  console.log(`Total Questions Published: ${questions?.length || 0}/6`);
  
  if (questions) {
    questions.forEach((q, idx) => {
      const hasImage = !!q.published_image_url;
      const hasKey = !!q.published_answer_key;
      const status = (hasImage && hasKey) ? "PASS" : "FAIL";
      console.log(`Q${idx + 1} (${q.id}): ${status} (Image: ${hasImage}, Key: ${q.published_answer_key})`);
    });
  }

  // 2. Student Validation
  console.log("\n--- Student Attempt Validation ---");
  const { data: attempts, error: attErr } = await supabase.from("cbt_attempts").select("*").eq("exam_id", exam.id);
  const attemptCount = attempts?.length || 0;
  console.log(`Student Attempts: ${attemptCount}`);
  if (attemptCount > 0) {
    console.log(`Attempt ID: ${attempts![0].id}`);
    console.log(`Score Generated: ${attempts![0].score !== null ? 'Yes' : 'No'} (${attempts![0].score})`);
  } else {
    console.log("FAIL: No student attempt found.");
  }

  // 3. Solution Pipeline Validation
  console.log("\n--- Solution Pipeline Validation ---");
  if (questions) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const { data: solution, error: solErr } = await supabase.from("question_solutions").select("*").eq("question_id", q.id).maybeSingle();
      
      const hasSolution = !!solution;
      const hasMetadata = solution ? !!solution.ai_metadata : false;
      
      const status = (hasSolution && hasMetadata) ? "PASS" : "FAIL";
      console.log(`Q${i + 1} (${q.id}): ${status} (Stored: ${hasSolution}, Metadata: ${hasMetadata})`);
    }
  }

  // 4. Wrong Answer Key Validation
  console.log("\n--- Wrong Answer Key Detection Report ---");
  const { data: solutions, error: solsErr } = await supabase.from("question_solutions").select("*").eq("review_status", "DISPUTED");
  
  if (solutions && solutions.length > 0) {
    console.log(`Detected ${solutions.length} DISPUTED mismatch(es):`);
    for (const sol of solutions) {
      const q = questions?.find(qx => qx.id === sol.question_id);
      console.log(`Question Number: ${q?.question_number || 'Unknown'}`);
      console.log(`Teacher Key: ${q?.published_answer_key}`);
      console.log(`Model Answer: ${sol.final_answer}`);
      console.log(`Confidence: ${sol.answer_confidence || 'Unknown'}`);
      console.log(`Detected Status: ${sol.review_status}`);
      console.log(`Reasoning: Model final answer mismatched teacher key.\n`);
    }
  } else {
    console.log("No DISPUTED mismatches found yet. (Ensure solution worker has finished running)");
  }

  console.log("=== End of Report ===");
}

run();
