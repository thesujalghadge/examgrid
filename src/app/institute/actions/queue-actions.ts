"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchQueueItems(instituteId: string, filter: string) {
  if (!instituteId) return [];

  // If we want "Needs Review", we need to look at question_solutions where answer_confidence <= 0.1
  // If we want "Validation Failed", we look at solution_generation_events or queue items that failed.
  // For simplicity, let's fetch pending, failed from queue.
  let query = supabase
    .from("solution_generation_queue")
    .select("*, exam_questions(exam_id, question_text)")
    .eq("institute_id", instituteId)
    .order("updated_at", { ascending: false });

  if (filter === "pending") {
    query = query.in("status", ["PENDING", "WAITING_RETRY"]);
  } else if (filter === "failed") {
    query = query.in("status", ["FAILED", "TIMED_OUT"]);
  } else if (filter === "needs_review") {
    // This requires a join with question_solutions
    const { data: solutions } = await supabase.from("question_solutions")
      .select("question_id, answer_confidence, is_active, content_markdown")
      .eq("institute_id", instituteId)
      .eq("is_active", true)
      .lte("answer_confidence", 0.1);
      
    // We can just return these directly shaped like queue items for the UI
    return (solutions || []).map(s => ({
       id: `review-${s.question_id}`,
       question_id: s.question_id,
       status: "needs_review",
       attempts: 0,
       last_error: "Confidence <= 0.1. Validation mismatched answer key.",
       updated_at: new Date().toISOString(),
       questions: { question_text: "Low confidence solution flagged for review." }
    }));
  }

  const { data, error } = await query.limit(50);
  if (error) {
    console.error("fetchQueueItems error:", error);
    return [];
  }
  // Normalise: expose exam_id from the join so the UI can group by exam
  return (data || []).map((row: any) => ({
    ...row,
    exam_id: row.exam_questions?.exam_id ?? null,
    questions: { question_text: row.exam_questions?.question_text ?? null },
  }));
}

/** Returns list of exam_solution_status rows for this institute (for dashboard panels) */
export async function fetchExamStatusList(instituteId: string) {
  if (!instituteId) return [];
  const { data, error } = await supabase
    .from("exam_solution_status")
    .select("*")
    .eq("institute_id", instituteId)
    .order("last_updated_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return data || [];
}

export async function regenerateJob(instituteId: string, questionId: string) {
  // Simple regeneration: Delete active solution if exists, then enqueue
  await supabase.from("question_solutions").update({ is_active: false }).eq("question_id", questionId).eq("institute_id", instituteId);
  
  // Wipe old queue item
  await supabase.from("solution_generation_queue").delete().eq("question_id", questionId).eq("institute_id", instituteId);

  // Enqueue
  await supabase.from("solution_generation_queue").insert({
    question_id: questionId,
    institute_id: instituteId,
    priority: 100,
    status: "pending",
  });
  
  return true;
}

export async function regenerateFailed(instituteId: string) {
  // Find all failed jobs
  const { data: failed } = await supabase.from("solution_generation_queue").select("question_id").eq("institute_id", instituteId).in("status", ["FAILED", "TIMED_OUT"]);
  
  if (!failed || failed.length === 0) return 0;

  for (const row of failed) {
    await supabase
      .from("solution_generation_queue")
      .update({ status: "PENDING", attempts: 0, next_retry_at: new Date().toISOString() })
      .eq("question_id", row.question_id)
      .eq("institute_id", instituteId);
  }
  return failed.length;
}

export async function regenerateNeedsReview(instituteId: string) {
  const { data: solutions } = await supabase.from("question_solutions")
    .select("question_id")
    .eq("institute_id", instituteId)
    .eq("is_active", true)
    .lte("answer_confidence", 0.1);

  if (!solutions || solutions.length === 0) return 0;

  for (const row of solutions) {
    await regenerateJob(instituteId, row.question_id);
  }
  return solutions.length;
}
