import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { enqueueSolutionsForExam } from "../src/lib/background-jobs/queue-trigger";
import { runWorkerTick } from "../src/lib/background-jobs/gemini-worker";
import { runAnalyticsWorker } from "../src/lib/analytics/worker";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const RUN = Date.now().toString(36);
const ids = {
  institute: crypto.randomUUID(),
  batch: crypto.randomUUID(),
  student: crypto.randomUUID(),
  exam: crypto.randomUUID(),
  section: crypto.randomUUID(),
  schedule: crypto.randomUUID(),
  subject: crypto.randomUUID(),
  chapter: crypto.randomUUID(),
  q1: crypto.randomUUID(),
  q2: crypto.randomUUID(),
};

let attemptId = "";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`  PASS ${message}`);
}

async function cleanup() {
  const qIds = [ids.q1, ids.q2];
  if (attemptId) await supabase.from("analytics_jobs").delete().eq("attempt_id", attemptId);
  if (attemptId) await supabase.from("cbt_attempts").delete().eq("id", attemptId);
  await supabase.from("question_solutions").delete().in("question_id", qIds);
  await supabase.from("solution_generation_queue").delete().in("question_id", qIds);
  await supabase.from("question_syllabus_mappings").delete().in("question_id", qIds);
  await supabase.from("question_analytics").delete().in("question_id", qIds);
  await supabase.from("student_exam_subject_analytics").delete().eq("student_id", ids.student);
  await supabase.from("student_exam_chapter_analytics").delete().eq("student_id", ids.student);
  await supabase.from("student_exam_concept_analytics").delete().eq("student_id", ids.student);
  await supabase.from("student_cumulative_subject_analytics").delete().eq("student_id", ids.student);
  await supabase.from("student_cumulative_chapter_analytics").delete().eq("student_id", ids.student);
  await supabase.from("student_cumulative_concept_analytics").delete().eq("student_id", ids.student);
  await supabase.from("student_recommendations").delete().eq("student_id", ids.student);
  await supabase.from("analytics_snapshots").delete().eq("student_id", ids.student);
  await supabase.from("exam_solution_status").delete().eq("exam_id", ids.exam);
  await supabase.from("exam_schedule_batches").delete().eq("schedule_id", ids.schedule);
  await supabase.from("exam_schedules").delete().eq("id", ids.schedule);
  await supabase.from("exam_questions").delete().in("id", qIds);
  await supabase.from("exam_sections").delete().eq("id", ids.section);
  await supabase.from("batch_syllabus_nodes").delete().in("id", [ids.subject, ids.chapter]);
  await supabase.from("exams").delete().eq("id", ids.exam);
  await supabase.from("students").delete().eq("id", ids.student);
  await supabase.from("batches").delete().eq("id", ids.batch);
  await supabase.from("institutes").delete().eq("id", ids.institute);
}

async function main() {
  console.log("Fresh E2E verifier", { run: RUN, exam: ids.exam });
  try {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60_000);

    let res = await supabase.from("institutes").insert({ id: ids.institute, name: `Fresh Institute ${RUN}`, slug: `fresh-${RUN}` });
    assert(!res.error, `institute created (${res.error?.message ?? "ok"})`);

    const defaultInstituteId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID;
    assert(defaultInstituteId, "default institute id configured for Gemini key lookup");
    let { data: keySource, error: keySourceError } = await supabase
      .from("institutes")
      .select("gemini_api_key_encrypted, gemini_api_key_iv")
      .eq("id", defaultInstituteId)
      .maybeSingle();
    if (!keySource?.gemini_api_key_encrypted || !keySource?.gemini_api_key_iv) {
      const fallback = await supabase
        .from("institutes")
        .select("gemini_api_key_encrypted, gemini_api_key_iv")
        .not("gemini_api_key_encrypted", "is", null)
        .not("gemini_api_key_iv", "is", null)
        .limit(1)
        .maybeSingle();
      keySource = fallback.data;
      keySourceError = fallback.error;
    }
    assert(!keySourceError && keySource?.gemini_api_key_encrypted && keySource?.gemini_api_key_iv, `institute Gemini key readable (${keySourceError?.message ?? "ok"})`);
    res = await supabase
      .from("institutes")
      .update({
        gemini_api_key_encrypted: keySource.gemini_api_key_encrypted,
        gemini_api_key_iv: keySource.gemini_api_key_iv,
        gemini_api_key_set_at: new Date().toISOString(),
      })
      .eq("id", ids.institute);
    assert(!res.error, `fresh institute Gemini key configured (${res.error?.message ?? "ok"})`);

    res = await supabase.from("batches").insert({ id: ids.batch, institute_id: ids.institute, name: "Fresh Batch", course_type: "JEE", academic_year: "2026", is_active: true });
    assert(!res.error, `batch created (${res.error?.message ?? "ok"})`);

    res = await supabase.from("students").insert({ id: ids.student, institute_id: ids.institute, batch_id: ids.batch, roll_number: `fresh-roll-${RUN}`, name: "Fresh Student", full_name: "Fresh Student", application_number: `fresh-app-${RUN}` });
    assert(!res.error, `student created (${res.error?.message ?? "ok"})`);

    res = await supabase.from("batch_syllabus_nodes").insert([
      { id: ids.subject, institute_id: ids.institute, batch_id: ids.batch, node_type: "SUBJECT", name: "Mathematics", parent_id: null },
      { id: ids.chapter, institute_id: ids.institute, batch_id: ids.batch, node_type: "CHAPTER", name: "Arithmetic", parent_id: ids.subject },
    ]);
    assert(!res.error, `syllabus nodes created (${res.error?.message ?? "ok"})`);

    res = await supabase.from("exams").insert({ id: ids.exam, legacy_id: `fresh-display-${RUN}`, institute_id: ids.institute, title: "Fresh E2E Exam", exam_type: "JEE_MAIN", duration_minutes: 30, is_published: false, scheduled_at: now.toISOString() });
    assert(!res.error, `exam created with UUID (${res.error?.message ?? "ok"})`);

    res = await supabase.from("exam_sections").insert({ id: ids.section, exam_id: ids.exam, institute_id: ids.institute, name: "Math", sort_order: 1 });
    assert(!res.error, `section created (${res.error?.message ?? "ok"})`);

    const questions = [
      { id: ids.q1, exam_id: ids.exam, institute_id: ids.institute, section_id: ids.section, question_number: 1, question_type: "MCQ_SINGLE", question_text: "What is 2 + 2?", options: [{ id: "A", label: "A", text: "4" }, { id: "B", label: "B", text: "5" }], correct_option_id: "A", marks: 4, negative_marks: 1, sort_order: 1 },
      { id: ids.q2, exam_id: ids.exam, institute_id: ids.institute, section_id: ids.section, question_number: 2, question_type: "MCQ_SINGLE", question_text: "What is 3 + 3?", options: [{ id: "A", label: "A", text: "5" }, { id: "B", label: "B", text: "6" }], correct_option_id: "B", marks: 4, negative_marks: 1, sort_order: 2 },
    ];
    res = await supabase.from("exam_questions").insert(questions);
    assert(!res.error, `questions extracted/persisted (${res.error?.message ?? "ok"})`);

    res = await supabase.from("question_syllabus_mappings").insert(questions.map(q => ({ question_id: q.id, institute_id: ids.institute, batch_id: ids.batch, syllabus_subject_id: ids.subject, syllabus_chapter_id: ids.chapter, mapping_method: "MANUAL_CORRECTION" })));
    assert(!res.error, `question syllabus mappings created (${res.error?.message ?? "ok"})`);

    res = await supabase.from("exam_schedules").insert({ id: ids.schedule, institute_id: ids.institute, exam_id: ids.exam, start_at: now.toISOString(), end_at: end.toISOString(), duration_minutes: 30, visibility_rule: "assigned_batches", is_active: true });
    assert(!res.error, `schedule created with UUID exam_id (${res.error?.message ?? "ok"})`);

    res = await supabase.from("exam_schedule_batches").insert({ schedule_id: ids.schedule, batch_id: ids.batch, institute_id: ids.institute });
    assert(!res.error, `schedule assigned to student batch (${res.error?.message ?? "ok"})`);

    const releaseTime = new Date(end.getTime() + 5 * 60_000).toISOString();
    res = await supabase.from("exams").update({ is_published: true, solutions_release_time: releaseTime }).eq("id", ids.exam).eq("institute_id", ids.institute);
    assert(!res.error, `exam published (${res.error?.message ?? "ok"})`);

    for (const q of questions) {
      const correct = q.options.find(o => o.id === q.correct_option_id)!;
      res = await supabase.from("exam_questions").update({ published_question_text: q.question_text, published_options: q.options, published_answer_key: `${correct.label}: ${correct.text}`, published_at: new Date().toISOString() }).eq("id", q.id).is("published_at", null);
      assert(!res.error, `question ${q.question_number} frozen (${res.error?.message ?? "ok"})`);
    }

    const queue = await enqueueSolutionsForExam(ids.exam, ids.institute);
    assert(queue.enqueued === 2 && queue.skipped === 0, `publish enqueued two solution jobs (${JSON.stringify(queue)})`);

    const { data: visibleTests, error: visibleErr } = await supabase
      .from("exam_schedules")
      .select("id, exam_id, exams!inner(id, title, is_published), exam_schedule_batches!inner(batch_id)")
      .eq("institute_id", ids.institute)
      .eq("is_active", true)
      .eq("exam_id", ids.exam)
      .eq("exam_schedule_batches.batch_id", ids.batch)
      .eq("exams.is_published", true);
    assert(!visibleErr && visibleTests?.length === 1, `published test visible to assigned student batch (${visibleErr?.message ?? visibleTests?.length})`);

    const submit = await supabase.rpc("submit_cbt_attempt", {
      p_session_id: `fresh-session-${RUN}`,
      p_test_id: ids.exam,
      p_institute_id: ids.institute,
      p_student_roll_number: `fresh-roll-${RUN}`,
      p_status: "submitted",
      p_started_at: now.toISOString(),
      p_submitted_at: new Date(now.getTime() + 60_000).toISOString(),
      p_answers: { [ids.q1]: "A", [ids.q2]: "A" },
      p_result_breakdown: {
        perQuestion: [
          { questionId: ids.q1, selected: "A", correct: true, marksAwarded: 4, maxMarks: 4, timeSpentSeconds: 10 },
          { questionId: ids.q2, selected: "A", correct: false, marksAwarded: -1, maxMarks: 4, timeSpentSeconds: 12 },
        ],
        durationSeconds: 60,
        attempted: 2,
        correct: 1,
        incorrect: 1,
        unattempted: 0,
        rawScore: 3,
        finalScore: 3,
        maxScore: 8,
        integrityPenalty: 0,
      },
      p_integrity_score: 100,
      p_flagged: false,
    });
    assert(!submit.error, `manual submit saved via RPC (${submit.error?.message ?? "ok"})`);
    attemptId = submit.data.attempt.id;

    const { data: resultRow, error: resultErr } = await supabase.from("cbt_results").select("id, score, percentage, accuracy").eq("attempt_id", attemptId).single();
    assert(!resultErr && Number(resultRow.score) === 3, `cbt_results score calculated correctly (${resultErr?.message ?? resultRow.score})`);

    res = await supabase.from("analytics_jobs").insert({ attempt_id: attemptId, student_id: ids.student, exam_id: ids.exam, batch_id: ids.batch, status: "PENDING" });
    assert(!res.error, `analytics job created on submission (${res.error?.message ?? "ok"})`);

    await runAnalyticsWorker();
    const { data: analyticsJob } = await supabase.from("analytics_jobs").select("status, error_text").eq("attempt_id", attemptId).single();
    assert(analyticsJob?.status === "COMPLETED" && !analyticsJob.error_text, `analytics worker completed (${JSON.stringify(analyticsJob)})`);

    const { data: analyticsRows } = await supabase.from("student_exam_chapter_analytics").select("id").eq("student_id", ids.student).eq("exam_id", ids.exam);
    assert((analyticsRows?.length ?? 0) > 0, `student analytics populated (${analyticsRows?.length ?? 0})`);

    const worker = await runWorkerTick();
    const { data: postWorkerQueue } = await supabase
      .from("solution_generation_queue")
      .select("question_id, status, attempts, last_error, failure_stage, next_retry_at")
      .in("question_id", [ids.q1, ids.q2]);
    console.log("  Worker queue detail", JSON.stringify(postWorkerQueue, null, 2));
    assert(worker.succeeded === 2 && worker.failed === 0, `solution worker completed queued jobs (${JSON.stringify(worker)})`);

    const { data: solutionRows } = await supabase.from("question_solutions").select("id").in("question_id", [ids.q1, ids.q2]);
    assert(solutionRows?.length === 2, `question_solutions populated (${solutionRows?.length ?? 0})`);

    const { data: queueRows } = await supabase.from("solution_generation_queue").select("status").in("question_id", [ids.q1, ids.q2]);
    assert(queueRows?.every(row => row.status === "COMPLETED"), `no stuck solution queue rows (${JSON.stringify(queueRows)})`);

    const { data: idRows } = await supabase.from("cbt_attempts").select("test_id").eq("id", attemptId);
    assert(idRows?.[0]?.test_id === ids.exam, `attempt references UUID exam id (${idRows?.[0]?.test_id})`);

    console.log("Fresh E2E verifier completed successfully.");
  } finally {
    await cleanup();
    console.log("Fresh E2E verifier cleanup completed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});









