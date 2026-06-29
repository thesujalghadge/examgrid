"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);


export async function verifyAndFetchSolution(
  instituteId: string,
  testId: string,
  studentRoll: string,
  questionId: string,
  hasAttempted: boolean,
  index?: number
) {
  if (!instituteId || !testId || !studentRoll || !questionId) {
    return { error: "400: Missing required parameters" };
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, batch_id, is_active")
    .eq("institute_id", instituteId)
    .eq("roll_number", studentRoll)
    .maybeSingle();

  if (!student || !student.is_active) {
    return { error: "403: Student not found in tenant or tenant mismatch" };
  }

  const { data: exam, error } = await supabase
    .from("exams")
    .select("id, solutions_release_time")
    .eq("institute_id", instituteId)
    .eq("id", testId)
    .maybeSingle();

  if (error) {
    console.error("Exam lookup error:", error);
  }

  if (!exam) {
    return { error: "403: Exam not found in tenant" };
  }

  const { data: schedules, error: scheduleError } = await supabase
    .from("exam_schedules")
    .select("id, end_at, solutions_release_time, visibility_rule")
    .eq("institute_id", instituteId)
    .eq("exam_id", exam.id)
    .eq("is_active", true);

  if (scheduleError) {
    console.error("Solution schedule lookup error:", scheduleError);
    return { error: "403: Exam schedule not available" };
  }

  if (!schedules || schedules.length === 0) {
    return { error: "403: Exam schedule not available" };
  }

  const assignedScheduleIds = schedules
    .filter((schedule: any) => schedule.visibility_rule === "assigned_batches")
    .map((schedule: any) => schedule.id);
  const assignedBatchLinks = assignedScheduleIds.length > 0 && student.batch_id
    ? await supabase
        .from("exam_schedule_batches")
        .select("schedule_id")
        .in("schedule_id", assignedScheduleIds)
        .eq("batch_id", student.batch_id)
        .eq("institute_id", instituteId)
    : { data: [], error: null };

  if (assignedBatchLinks.error) {
    console.error("Solution schedule batch lookup error:", assignedBatchLinks.error);
    return { error: "403: Exam schedule not available" };
  }

  const accessibleAssignedSchedules = new Set((assignedBatchLinks.data ?? []).map((row: any) => row.schedule_id));
  const accessibleSchedules = schedules.filter((schedule: any) =>
    schedule.visibility_rule === "all_active_students" || accessibleAssignedSchedules.has(schedule.id),
  );

  if (accessibleSchedules.length === 0) {
    return { error: "403: Student is not assigned to this exam" };
  }

  const now = Date.now();
  const releasedSchedule = accessibleSchedules.find((schedule: any) => {
    const endTime = new Date(schedule.end_at).getTime();
    const releaseTime = new Date(schedule.solutions_release_time ?? exam.solutions_release_time ?? schedule.end_at).getTime();
    return now >= endTime && now >= releaseTime;
  });

  if (!releasedSchedule) {
    const nextRelease = Math.min(
      ...accessibleSchedules.map((schedule: any) =>
        Math.max(
          new Date(schedule.end_at).getTime(),
          new Date(schedule.solutions_release_time ?? exam.solutions_release_time ?? schedule.end_at).getTime(),
        ),
      ),
    );
    return { error: `403: Solutions unavailable. Will be released at ${new Date(nextRelease).toLocaleString()}` };
  }
  // 1. Get all questions for this exam
  const { data: questions } = await supabase.from("exam_questions").select("id").eq("exam_id", exam.id).order('sort_order', { ascending: true });
  const total = questions?.length || 0;

  // Resolve legacy questionId to actual UUID if necessary
  let resolvedQuestionId = questionId;
  const isQuestionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionId);
  if (!isQuestionUuid && questions && index !== undefined && questions[index]) {
    resolvedQuestionId = questions[index].id;
  } else if (!isQuestionUuid && questions) {
    const match = questionId.match(/(\d+)$/);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const { data: qb } = await supabase.from("exam_questions").select("id").eq("exam_id", exam.id).eq("question_number", qNum).maybeSingle();
      if (qb) resolvedQuestionId = qb.id;
    }
  }

  // Phase 4.3 Lazy Loading: Fetch the solution
  const { data: solution } = await supabase
    .from("question_solutions")
    .select("content_markdown, final_answer, ai_metadata")
    .eq("institute_id", instituteId)
    .eq("question_id", resolvedQuestionId)
    .eq("is_active", true)
    .maybeSingle();

  if (!solution) {
    // 0. Check if this specific question failed
    const { data: qItem } = await supabase
      .from('solution_generation_queue')
      .select('status')
      .eq('question_id', resolvedQuestionId)
      .maybeSingle();
      
    if (qItem && qItem.status === 'FAILED') {
      return { error: "Solution unavailable. Institute has been notified." };
    }

    // 2. Count completed solutions

    let completed = 0;
    if (total > 0) {
      const qIds = questions!.map(q => q.id);
      const { count } = await supabase
        .from("question_solutions")
        .select("id", { count: "exact", head: true })
        .in("question_id", qIds)
        .eq("is_active", true)
        .eq("generation_status", "COMPLETED");
      completed = count || 0;
    }

    const remaining = total - completed;
    // ETA: Assuming 4 jobs per minute throughput (15 seconds per job)
    const estimatedMinutes = Math.max(1, Math.ceil(remaining * 0.25));

    return { 
      progress: { 
        completed, 
        total, 
        estimatedMinutes 
      } 
    };
  }

  return {
    data: {
      content_markdown: solution.content_markdown,
      final_answer: solution.final_answer,
      ai_metadata: solution.ai_metadata,
    }
  };
}
