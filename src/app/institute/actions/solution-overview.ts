"use server";

import { createClient } from "@supabase/supabase-js";
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getSolutionHealthOverview(instituteId: string) {
  if (!instituteId) return null;

  // Aggregate from exam_solution_status
  const { data: exams, error: examsErr } = await supabase
    .from("exam_solution_status")
    .select("completed_solutions, pending_solutions, failed_solutions")
    .eq("institute_id", instituteId);

  let generated = 0;
  let failed = 0;

  if (!examsErr && exams) {
    for (const row of exams) {
      generated += row.completed_solutions || 0;
      failed += row.failed_solutions || 0;
    }
  }

  // Aggregate from queue
  const { count: pending, error: queueErr } = await supabase
    .from("solution_generation_queue")
    .select("*", { count: "exact", head: true })
    .eq("institute_id", instituteId)
    .eq("status", "pending");

  const { count: queueDepth } = await supabase
    .from("solution_generation_queue")
    .select("*", { count: "exact", head: true })
    .eq("institute_id", instituteId);

  // Aggregate validation failures from events
  const { count: validationMismatches } = await supabase
    .from("solution_generation_events")
    .select("*", { count: "exact", head: true })
    .eq("institute_id", instituteId)
    .eq("event_type", "validation_failed");

  return {
    generated,
    pending: pending || 0,
    failed,
    queueDepth: queueDepth || 0,
    validationMismatches: validationMismatches || 0,
    successRate: generated + failed > 0 ? ((generated / (generated + failed)) * 100).toFixed(1) : "100.0"
  };
}

export async function getExamSolutionProgress(testId: string) {
  if (!testId) return null;

  // Find DB exam ID
  const { data: exam } = await supabase
    .from("exams")
    .select("id")
    .or(`id.eq.${testId},legacy_id.eq.${testId}`)
    .maybeSingle();

  if (!exam) return null;

  const { data: status } = await supabase
    .from("exam_solution_status")
    .select("*")
    .eq("exam_id", exam.id)
    .maybeSingle();

  // We should also check solution_generation_events if we want to show validation mismatches specific to this exam
  // But wait, the events are tracked by institute and queue_id. We can just show validation mismatches for the exam's questions.
  // Actually, let's just return the status.
  return status || {
    total_questions: 0,
    completed_solutions: 0,
    pending_solutions: 0,
    failed_solutions: 0
  };
}
