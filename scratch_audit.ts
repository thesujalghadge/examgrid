import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const instituteId = 'da368ae6-633e-4665-9fb1-44bf37ded332';
  const studentId = 'e2b380bd-8e31-4d37-bccd-616999a4e402'; 
  
  // 0. DEEP COUNT VERIFICATION
  console.log("\n--- DEEP COUNT VERIFICATION ---");
  const { data: syllabi } = await supabase.from('master_syllabi').select('id, exam_type');
  for (const s of syllabi!) {
    const { data: nodes } = await supabase.from('master_syllabus_nodes').select('node_type').eq('syllabus_id', s.id);
    const counts = nodes!.reduce((acc, n) => {
        acc[n.node_type] = (acc[n.node_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    console.log(`${s.exam_type}:`, counts);
  }
  
  // 1. CREATE JEE BATCH
  console.log("\n--- CREATING JEE BATCH ---");
  const batchId = crypto.randomUUID();
  const { error: rpcErr } = await supabase.rpc("create_batch_with_syllabus", {
    p_id: batchId,
    p_institute_id: instituteId,
    p_name: "JEE RPC Verification " + Math.random(),
    p_course_type: "JEE",
    p_academic_year: "2026",
    p_is_active: true
  });
  if (rpcErr) throw rpcErr;

  const { data: batchData } = await supabase.from("batches").select("*").eq("id", batchId).single();
  console.log("Batch Created:", batchData.name);
  console.log("Syllabus ID:", batchData.syllabus_id);
  console.log("Syllabus Version:", batchData.syllabus_version);

  const { count: bsnCount } = await supabase.from("batch_syllabus_nodes").select("*", { count: "exact", head: true }).eq("batch_id", batchId);
  console.log(`Batch Syllabus Nodes Created: ${bsnCount}`);

  // 1a. DUPLICATE CLONE VERIFICATION
  console.log("\n--- TESTING DUPLICATE CLONE ---");
  const { error: dupErr } = await supabase.rpc("create_batch_with_syllabus", {
    p_id: batchId,
    p_institute_id: instituteId,
    p_name: batchData.name,
    p_course_type: "JEE",
    p_academic_year: "2026",
    p_is_active: true
  });
  console.log("Duplicate error message:", dupErr?.message);

  // 2. EXAM FLOW
  console.log("\n--- EXAM FLOW ---");
  const examId = crypto.randomUUID();
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60 * 1000);

  const { error: examErr } = await supabase.from("exams").insert({
    id: examId,
    institute_id: instituteId,
    title: "Verification Exam",
    exam_type: "JEE_MAIN",
    duration_minutes: 60,
    is_published: true,
    scheduled_at: now.toISOString()
  });
  if (examErr) throw examErr;

  const sectionId = crypto.randomUUID();
  const { error: secErr } = await supabase.from("exam_sections").insert({
    id: sectionId,
    institute_id: instituteId,
    exam_id: examId,
    name: "Physics"
  });
  if (secErr) throw secErr;

  const questionId = crypto.randomUUID();
  const { error: qErr } = await supabase.from("exam_questions").insert({
    id: questionId,
    institute_id: instituteId,
    exam_id: examId,
    section_id: sectionId,
    question_type: "NUMERICAL",
    question_number: 1,
    question_text: "A particle moves along x axis. What is its velocity?",
    correct_numerical_answer: "5",
    marks: 4
  });
  if (qErr) throw qErr;

  const { data: schedData, error: schedErr } = await supabase.from("exam_schedules").insert({
    id: crypto.randomUUID(),
    exam_id: examId,
    institute_id: instituteId,
    start_at: now.toISOString(),
    end_at: future.toISOString(),
    duration_minutes: 60
  }).select("id").single();
  if (schedErr) throw schedErr;
  
  await supabase.from("exam_schedule_batches").insert({
    schedule_id: schedData!.id,
    batch_id: batchId
  });
  
  console.log("Mocking solution & mapping...");
  await supabase.from("question_solutions").insert({
    id: crypto.randomUUID(),
    question_id: questionId,
    institute_id: instituteId,
    content_markdown: "Solve it",
    final_answer: "5",
    version: 1,
    generation_status: "COMPLETED",
    ai_metadata: { subject: "Physics", chapter: "Kinematics", topic: "Motion in a straight line", confidence: 95 }
  });

  const { mapQuestionsToSyllabus } = await import("./src/lib/syllabus/mapper");
  await mapQuestionsToSyllabus(instituteId, batchId);

  const { count: qsmCount } = await supabase.from("question_syllabus_mappings").select("*", { count: "exact", head: true }).eq("question_id", questionId);
  console.log(`Question Syllabus Mappings: ${qsmCount}`);

  const attemptId = crypto.randomUUID();
  await supabase.from("cbt_attempts").insert({
    id: attemptId,
    student_id: studentId,
    exam_id: examId,
    institute_id: instituteId,
    status: "COMPLETED"
  });

  await supabase.from("cbt_results").insert({
    id: attemptId,
    student_id: studentId,
    exam_id: examId,
    institute_id: instituteId,
    total_score: 4
  });

  await supabase.from("student_question_answers").insert({
    id: crypto.randomUUID(),
    attempt_id: attemptId,
    question_id: questionId,
    student_id: studentId,
    is_attempted: true,
    is_correct: true,
    marks_awarded: 4,
    time_spent_seconds: 30
  });

  const { generateStudentAnalytics } = await import("./src/lib/analytics/worker");
  console.log(`Generating analytics for exam ${examId}...`);
  await generateStudentAnalytics(examId, instituteId, attemptId);

  const { count: subCount } = await supabase.from("student_exam_subject_analytics").select("*", { count: "exact", head: true }).eq("attempt_id", attemptId);
  const { count: chapCount } = await supabase.from("student_exam_chapter_analytics").select("*", { count: "exact", head: true }).eq("attempt_id", attemptId);
  const { count: recCount } = await supabase.from("analytics_snapshots").select("*", { count: "exact", head: true }).eq("attempt_id", attemptId); 
  
  console.log(`Subject Analytics rows: ${subCount}`);
  console.log(`Chapter Analytics rows: ${chapCount}`);
  console.log(`Recommendation Analytics snapshots rows: ${recCount}`);

  // 3. DELETE BATCH VERIFICATION
  console.log("\n--- DELETING BATCH ---");
  await supabase.from("batches").delete().eq("id", batchId);
  const { count: postDelCount } = await supabase.from("batch_syllabus_nodes").select("*", { count: "exact", head: true }).eq("batch_id", batchId);
  console.log(`Batch Syllabus Nodes After Delete: ${postDelCount}`);

  console.log("\nE2E Verification Complete.");
}

main().catch(console.error);
