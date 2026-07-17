import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";

export interface EnqueueResult {
  enqueued: number;
  skipped: number;
}

export async function enqueueQuestionsForGeneration(
  questionIds: string[],
  instituteId: string,
  priority: number = 100
): Promise<EnqueueResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  if (questionIds.length === 0) return { enqueued: 0, skipped: 0 };

  // 1. Filter out questions that already have an active solution
  const { data: existingSolutions, error: fetchError } = await supabase
    .from("question_solutions")
    .select("question_id")
    .in("question_id", questionIds)
    .eq("is_active", true);

  if (fetchError) throw fetchError;
  const existingSet = new Set(existingSolutions?.map((s: any) => s.question_id) || []);
  let toEnqueue = questionIds.filter(id => !existingSet.has(id));

  if (toEnqueue.length === 0) {
    return { enqueued: 0, skipped: questionIds.length };
  }

  // 1.5 Filter out unpublished questions
  const { data: publishedQuestions, error: pubError } = await supabase
    .from("exam_questions")
    .select("id")
    .in("id", toEnqueue)
    .not("published_at", "is", null);

  if (pubError) throw pubError;
  const publishedSet = new Set(publishedQuestions?.map((q: any) => q.id) || []);
  toEnqueue = toEnqueue.filter(id => publishedSet.has(id));

  if (toEnqueue.length === 0) {
    return { enqueued: 0, skipped: questionIds.length };
  }

  // 2. Filter out questions that are already in the queue (pending/processing)
  const { data: queuedAlready, error: queueError } = await supabase
    .from("solution_generation_queue")
    .select("question_id")
    .in("question_id", toEnqueue)
    .in("status", ["PENDING", "PROCESSING", "WAITING_RETRY"]);

  if (queueError) throw queueError;
  const queueSet = new Set(queuedAlready?.map((s: any) => s.question_id) || []);
  toEnqueue = toEnqueue.filter(id => !queueSet.has(id));

  if (toEnqueue.length === 0) {
    return { enqueued: 0, skipped: questionIds.length };
  }

  // 3. Insert into queue
  const { data: queued, error: insertError } = await supabase
    .from("solution_generation_queue")
    .insert(
      toEnqueue.map(qId => ({
        question_id: qId,
        institute_id: instituteId,
        priority: priority,
        status: "PENDING"
      }))
    )
    .select("id, institute_id");

  if (insertError) {
    if (insertError.code === '23505') {
      console.warn("Caught queue unique constraint violation (concurrent publish). Ignoring duplicate jobs.");
      return { enqueued: 0, skipped: questionIds.length };
    }
    throw insertError;
  }

  // 4. Insert audit events
  if (queued && queued.length > 0) {
    const events = queued.map((q: any) => ({
      queue_id: q.id,
      institute_id: q.institute_id,
      event_type: "queued"
    }));
    await supabase.from("solution_generation_events").insert(events);
  }

  return {
    enqueued: queued?.length || 0,
    skipped: questionIds.length - (queued?.length || 0)
  };
}

export interface LeasedJob {
  id: string;
  question_id: string;
  institute_id: string;
  attempts: number;
}

export async function leaseJob(): Promise<LeasedJob | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("lease_solution_generation_job_v2");
  if (error) {
    console.error("Error leasing job:", error);
    return null;
  }
  
  if (data && data.length > 0 && data[0].id) {
    const { data: qItem } = await supabase.from('solution_generation_queue').select('question_id, institute_id, attempts').eq('id', data[0].id).single();
    if (!qItem) return null;
    return {
      id: data[0].id,
      question_id: qItem.question_id,
      institute_id: qItem.institute_id || "ddcc7407-fbb6-42bd-9751-576ef43e2241",
      attempts: qItem.attempts || 0
    };
  }
  return null;
}

export async function markJobComplete(jobId: string, instituteId: string) {
  const supabase = createServiceRoleClient();
  if (!supabase) return;

  await supabase
    .from("solution_generation_queue")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", jobId);

  await supabase.from("solution_generation_events").insert({
    queue_id: jobId,
    institute_id: instituteId,
    event_type: "completed"
  });
}

export async function markJobFailed(jobId: string, instituteId: string, errorMsg: string, currentAttempts: number, maxAttempts: number = 3) {
  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const isPermanent = currentAttempts >= maxAttempts;
  const nextStatus = isPermanent ? "FAILED" : "PENDING";
  
  // Exponential backoff: 1 min, 2 min, 4 min...
  const delayMinutes = Math.pow(2, currentAttempts - 1);
  const nextRetryAt = new Date(Date.now() + delayMinutes * 60000).toISOString();

  await supabase
    .from("solution_generation_queue")
    .update({ 
      status: nextStatus,
      next_retry_at: isPermanent ? null : nextRetryAt,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  await supabase.from("solution_generation_events").insert({
    queue_id: jobId,
    institute_id: instituteId,
    event_type: isPermanent ? "failed" : "retry",
    metadata: { error: errorMsg }
  });
}
