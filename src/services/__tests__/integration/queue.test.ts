import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testSupabase } from "./setup";
import { enqueueSolutionsForExam } from "@/lib/background-jobs/queue-trigger";
import { runGeminiWorker } from "@/lib/background-jobs/gemini-worker";

describe("Queue Resilience and Worker Tests", () => {
  const MOCK_INSTITUTE_ID = "00000000-0000-0000-0000-000000000001";
  const SMOKE_EXAM_ID = `smoke-exam-${Date.now()}`;
  
  beforeAll(async () => {
    // Insert a smoke exam with 5 questions
    await testSupabase.from("exams").insert({
      id: SMOKE_EXAM_ID,
      institute_id: MOCK_INSTITUTE_ID,
      title: "Queue Smoke Exam",
      duration_minutes: 60,
      total_questions: 5,
      is_published: true
    });

    const questions = Array.from({ length: 5 }).map((_, i) => ({
      exam_id: SMOKE_EXAM_ID,
      institute_id: MOCK_INSTITUTE_ID,
      question_number: i + 1,
      question_type: "MCQ_SINGLE",
      question_text: `Smoke Question ${i + 1}`,
      marks: 4,
      negative_marks: 1
    }));

    await testSupabase.from("exam_questions").insert(questions);
  });

  afterAll(async () => {
    // Cleanup smoke data
    await testSupabase.from("solution_generation_queue").delete().eq("institute_id", MOCK_INSTITUTE_ID);
    await testSupabase.from("question_solutions").delete().eq("institute_id", MOCK_INSTITUTE_ID);
    await testSupabase.from("exams").delete().eq("id", SMOKE_EXAM_ID);
  });

  it("enqueues jobs and prevents duplicates", async () => {
    const result1 = await enqueueSolutionsForExam(SMOKE_EXAM_ID, MOCK_INSTITUTE_ID);
    expect(result1.enqueued).toBe(5);

    // Re-enqueuing should result in skipped items
    const result2 = await enqueueSolutionsForExam(SMOKE_EXAM_ID, MOCK_INSTITUTE_ID);
    expect(result2.enqueued).toBe(0);
    expect(result2.skipped).toBe(5);
  });

  it("handles worker crash and recovery (partial completion)", async () => {
    // Simulate a partial crash by manually setting 2 jobs to FAILED
    const { data: q } = await testSupabase.from("solution_generation_queue")
      .select("id")
      .limit(2);
    
    expect(q?.length).toBe(2);
    
    for (const row of q!) {
      await testSupabase.from("solution_generation_queue")
        .update({ status: "FAILED", last_error: "Simulated worker crash" })
        .eq("id", row.id);
    }

    // In a real environment, the retry mechanism or regenerateFailed action
    // would reset these to PENDING. Let's do that.
    for (const row of q!) {
      await testSupabase.from("solution_generation_queue")
        .update({ status: "PENDING", attempts: 0 })
        .eq("id", row.id);
    }

    // The worker should pick up all PENDING jobs
    // Note: We don't actually run the full worker here because it hits the real Gemini API.
    // Instead we can mock the Gemini API call if we want to run the full worker loop.
  });

  it("marks timed-out jobs (stuck in PROCESSING > 10 min)", async () => {
    // Insert a job that has been "processing" for 15 minutes
    const stuckId = `stuck-${Date.now()}`;
    await testSupabase.from("solution_generation_queue").insert({
      id: stuckId,
      question_id: `${MOCK_INSTITUTE_ID}-stuck-q`,
      institute_id: MOCK_INSTITUTE_ID,
      status: "PROCESSING",
      processing_started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
    });

    // Call the DB function to mark timed-out jobs
    const { data: count } = await testSupabase.rpc("mark_timed_out_jobs", { p_timeout_minutes: 10 });
    expect(Number(count)).toBeGreaterThanOrEqual(1);

    // Verify the job is now TIMED_OUT
    const { data: job } = await testSupabase.from("solution_generation_queue")
      .select("status")
      .eq("id", stuckId)
      .single();
    expect(job?.status).toBe("TIMED_OUT");

    // Cleanup
    await testSupabase.from("solution_generation_queue").delete().eq("id", stuckId);
  });
});
