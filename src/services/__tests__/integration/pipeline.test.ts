import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testSupabase } from "./setup";

describe("Pipeline E2E Validation", () => {
  const MOCK_INSTITUTE_ID = "00000000-0000-0000-0000-000000000001";
  const SMOKE_EXAM_ID = `smoke-pipeline-${Date.now()}`;
  
  beforeAll(async () => {
    // 1. Setup mock exam
    await testSupabase.from("exams").insert({
      id: SMOKE_EXAM_ID,
      institute_id: MOCK_INSTITUTE_ID,
      title: "Pipeline Smoke Exam",
      duration_minutes: 60,
      total_questions: 1,
      is_published: false
    });

    await testSupabase.from("exam_questions").insert({
      id: `${SMOKE_EXAM_ID}-q1`,
      exam_id: SMOKE_EXAM_ID,
      institute_id: MOCK_INSTITUTE_ID,
      question_number: 1,
      question_type: "MCQ_SINGLE",
      question_text: "Pipeline Q1",
      correct_option_id: "opt1",
      options: [{ id: "opt1", label: "A", text: "Answer A" }],
      marks: 4,
      negative_marks: 1
    });
  });

  afterAll(async () => {
    // Teardown
    await testSupabase.from("cbt_attempts").delete().eq("test_id", SMOKE_EXAM_ID);
    await testSupabase.from("exam_questions").delete().eq("exam_id", SMOKE_EXAM_ID);
    await testSupabase.from("exams").delete().eq("id", SMOKE_EXAM_ID);
  });

  it("publishes exam, freezing questions and generating queue rows", async () => {
    // In integration tests, we can directly update DB to simulate publish
    // and then call enqueueSolutionsForExam
    const { enqueueSolutionsForExam } = await import("@/lib/background-jobs/queue-trigger");
    
    await testSupabase.from("exams").update({ is_published: true }).eq("id", SMOKE_EXAM_ID);
    
    // Freeze questions
    await testSupabase.from("exam_questions").update({
      published_question_text: "Pipeline Q1",
      published_answer_key: "A: Answer A"
    }).eq("exam_id", SMOKE_EXAM_ID);

    const result = await enqueueSolutionsForExam(SMOKE_EXAM_ID, MOCK_INSTITUTE_ID);
    expect(result.enqueued).toBe(1);

    // Verify queue row
    const { data: q } = await testSupabase.from("solution_generation_queue").select("*").eq("institute_id", MOCK_INSTITUTE_ID);
    expect(q?.length).toBeGreaterThan(0);
  });

  it("analytics worker generates correct cumulative metrics", async () => {
    // Insert mock attempt
    const attemptId = `smoke-attempt-${Date.now()}`;
    await testSupabase.from("cbt_attempts").insert({
      id: attemptId,
      test_id: SMOKE_EXAM_ID,
      student_id: "student123",
      institute_id: MOCK_INSTITUTE_ID,
      status: "submitted",
      score: 4,
      answers: { [`${SMOKE_EXAM_ID}-q1`]: "opt1" }
    });

    await testSupabase.from("cbt_attempt_answers").insert({
      attempt_id: attemptId,
      question_id: `${SMOKE_EXAM_ID}-q1`,
      is_correct: true,
      marks_awarded: 4,
      selected_answer: "opt1"
    });

    await testSupabase.from("cbt_results").insert({
      attempt_id: attemptId,
      student_id: "student123",
      score: 4,
      exam_id: SMOKE_EXAM_ID
    });

    // Insert analytics job
    await testSupabase.from("analytics_jobs").insert({
      attempt_id: attemptId,
      exam_id: SMOKE_EXAM_ID,
      student_id: "student123",
      institute_id: MOCK_INSTITUTE_ID,
      status: "PENDING"
    });

    const { runAnalyticsWorker } = await import("@/lib/analytics/worker");
    
    // Process jobs
    await runAnalyticsWorker();

    // Verify analytics job completed
    const { data: job } = await testSupabase.from("analytics_jobs").select("status").eq("attempt_id", attemptId).single();
    expect(job?.status).toBe("COMPLETED");

    // Verify ranks were calculated
    const { data: res } = await testSupabase.from("cbt_results").select("rank").eq("attempt_id", attemptId).single();
    expect(res?.rank).toBeDefined();
  });
});
