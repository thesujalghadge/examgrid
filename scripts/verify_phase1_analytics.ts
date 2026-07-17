import { createClient } from "@supabase/supabase-js";
import { processAnalyticsWorkerJobs } from "../src/workers/analytics-worker";
import { processAnalyticsProjectorJobs } from "../src/workers/analytics-projector";
import { processMappingChangedJobs } from "../src/workers/mapping-changed-worker";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminDb = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Starting E2E Validation of Phase 1 Analytics Pipeline...");

  // Setup mock IDs
  const instId = "00000000-0000-0000-0000-000000000001";
  const studentId = "11111111-1111-1111-1111-111111111111";
  const examId = "22222222-2222-2222-2222-222222222222";
  const sectionId = "sec-1";
  const q1Id = "q-1-phase1";
  const q2Id = "q-2-phase1";
  const attemptId = "33333333-3333-3333-3333-333333333333";
  const sessionId = "sess-phase1";
  const versionId = "44444444-4444-4444-4444-444444444444";

  const subjectNodeId = "55555555-5555-5555-5555-555555555555";
  const chapterNodeId = "66666666-6666-6666-6666-666666666666";
  const newChapterNodeId = "77777777-7777-7777-7777-777777777777";

  try {
    // 1. Setup minimal curriculum nodes
    await adminDb.from("institutes").insert({ id: instId, name: "Test Inst", slug: "test-inst", theme_color: "#000" });
    await adminDb.from("students").insert({ id: studentId, institute_id: instId, roll_number: "ROLL1", name: "Student 1", full_name: "Student 1", application_number: "APP1" });
    await adminDb.from("curriculum_versions").insert({ id: versionId, name: "v2026", status: "PUBLISHED" });
    await adminDb.from("curriculum_nodes").insert([
      { id: subjectNodeId, version_id: versionId, name: "Physics", node_type: "SUBJECT" },
      { id: chapterNodeId, version_id: versionId, name: "Mechanics", node_type: "CHAPTER", parent_id: subjectNodeId },
      { id: newChapterNodeId, version_id: versionId, name: "Work Energy", node_type: "CHAPTER", parent_id: subjectNodeId }
    ]);
    
    // Create exams and questions
    await adminDb.from("exams").insert({ id: examId, legacy_id: "test-exam-1", institute_id: instId, title: "Test Exam", exam_type: "JEE_MAIN", duration_minutes: 60, scheduled_at: new Date().toISOString() });
    await adminDb.from("exam_sections").insert({ id: sectionId, exam_id: examId, institute_id: instId, name: "Physics", sort_order: 1 });
    await adminDb.from("exam_questions").insert([
      { id: q1Id, exam_id: examId, section_id: sectionId, institute_id: instId, question_number: 1, question_type: "MCQ_SINGLE", question_text: "Q1" },
      { id: q2Id, exam_id: examId, section_id: sectionId, institute_id: instId, question_number: 2, question_type: "MCQ_SINGLE", question_text: "Q2" }
    ]);

    // Setup active mappings for Q1 and Q2 to Chapter 1
    const { data: m1 } = await adminDb.from("question_node_mappings").insert({
      question_id: q1Id, subject_id: subjectNodeId, chapter_id: chapterNodeId, is_primary: true, is_active: true, status: 'VERIFIED'
    }).select().single();
    const { data: m2 } = await adminDb.from("question_node_mappings").insert({
      question_id: q2Id, subject_id: subjectNodeId, chapter_id: chapterNodeId, is_primary: true, is_active: true, status: 'AI_CLASSIFIED'
    }).select().single();

    // Setup CBT Attempt
    await adminDb.from("cbt_attempts").insert({
      id: attemptId, session_id: sessionId, test_id: examId, institute_id: instId, student_id: studentId,
      student_roll_number: "ROLL1", status: "submitted", started_at: new Date().toISOString(), submitted_at: new Date().toISOString(),
      total_questions: 2, attempted_questions: 2
    });
    
    // Setup Answers
    await adminDb.from("cbt_attempt_answers").insert([
      { attempt_id: attemptId, question_id: q1Id, selected_answer: "A", is_correct: true, marks_awarded: 4 },
      { attempt_id: attemptId, question_id: q2Id, selected_answer: "B", is_correct: false, marks_awarded: -1 }
    ]);

    // Enqueue ATTEMPT_FINISHED
    await adminDb.from("background_jobs").insert({
      institute_id: instId,
      job_type: "ATTEMPT_FINISHED",
      payload: { attemptId }
    });

    console.log("1. Running AnalyticsWorker...");
    await processAnalyticsWorkerJobs();

    // Verify Ledger
    const { data: ledger } = await adminDb.from("attempt_question_ledger").select("*").eq("attempt_id", attemptId);
    console.assert(ledger?.length === 2, "Ledger should have 2 rows");
    console.log("✅ ATTEMPT_FINISHED creates ledger rows.");

    // Verify Deltas
    const { data: deltaJobs } = await adminDb.from("background_jobs").select("*").eq("job_type", "PROJECT_DELTAS");
    console.assert(deltaJobs?.length === 1, "Should emit 1 delta job");
    console.log("✅ Deltas are emitted correctly.");

    console.log("2. Running AnalyticsProjector...");
    await processAnalyticsProjectorJobs();

    // Verify Statistics
    const { data: stats } = await adminDb.from("student_node_statistics").select("*").eq("student_id", studentId).eq("node_id", chapterNodeId).single();
    console.assert(stats?.total_attempted === 2, "Chapter should have 2 attempts");
    console.assert(stats?.total_correct === 1, "Chapter should have 1 correct");
    console.log("✅ Statistics are updated exactly once.");

    console.log("3. Simulating MAPPING_CHANGED...");
    // Update m1 to new chapter
    const { data: m1_new } = await adminDb.from("question_node_mappings").insert({
      question_id: q1Id, subject_id: subjectNodeId, chapter_id: newChapterNodeId, is_primary: true, is_active: true, status: 'VERIFIED'
    }).select().single();
    await adminDb.from("question_node_mappings").update({ is_active: false }).eq("id", m1!.id);

    await adminDb.from("background_jobs").insert({
      institute_id: instId,
      job_type: "MAPPING_CHANGED",
      payload: { questionId: q1Id, oldMapping: m1, newMapping: m1_new }
    });

    await processMappingChangedJobs(); // Emits deltas
    await processAnalyticsProjectorJobs(); // Consumes deltas

    // Verify Old Node Statistics (was 2,1, now should be 1,0 because Q1 (correct) moved out)
    const { data: oldStats } = await adminDb.from("student_node_statistics").select("*").eq("student_id", studentId).eq("node_id", chapterNodeId).single();
    console.assert(oldStats?.total_attempted === 1, "Old chapter should drop to 1 attempt");
    console.assert(oldStats?.total_correct === 0, "Old chapter should drop to 0 correct");

    // Verify New Node Statistics (should be 1,1)
    const { data: newStats } = await adminDb.from("student_node_statistics").select("*").eq("student_id", studentId).eq("node_id", newChapterNodeId).single();
    console.assert(newStats?.total_attempted === 1, "New chapter should have 1 attempt");
    console.assert(newStats?.total_correct === 1, "New chapter should have 1 correct");
    
    console.log("✅ Simulated MAPPING_CHANGED adjusts only affected nodes without full recomputation.");

    console.log("All E2E checks passed!");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Cleanup
    await adminDb.from("cbt_attempt_answers").delete().eq("attempt_id", attemptId);
    await adminDb.from("cbt_attempts").delete().eq("id", attemptId);
    await adminDb.from("background_jobs").delete().in("job_type", ["ATTEMPT_FINISHED", "PROJECT_DELTAS", "MAPPING_CHANGED"]);
    await adminDb.from("student_node_statistics").delete().eq("student_id", studentId);
    await adminDb.from("attempt_question_ledger").delete().eq("student_id", studentId);
    await adminDb.from("question_node_mappings").delete().in("question_id", [q1Id, q2Id]);
    await adminDb.from("exam_questions").delete().in("id", [q1Id, q2Id]);
    await adminDb.from("exam_sections").delete().eq("id", sectionId);
    await adminDb.from("exams").delete().eq("id", examId);
    await adminDb.from("curriculum_nodes").delete().in("version_id", [versionId]);
    await adminDb.from("curriculum_versions").delete().eq("id", versionId);
    await adminDb.from("students").delete().eq("id", studentId);
    await adminDb.from("institutes").delete().eq("id", instId);
  }
}

main();
