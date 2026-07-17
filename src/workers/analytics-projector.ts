import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";

export async function processAnalyticsProjectorJobs() {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  // 1. Lock a job
  const { data: job, error: lockError } = await supabase
    .from('background_jobs')
    .update({ status: 'PROCESSING', started_at: new Date().toISOString() })
    .eq('status', 'PENDING')
    .eq('job_type', 'PROJECT_DELTAS')
    .select('*')
    .limit(1)
    .single();

  if (lockError || !job) {
    return; // No jobs
  }

  try {
    const { studentId, deltas } = job.payload;
    if (!studentId || !deltas || !Array.isArray(deltas)) {
      throw new Error("Invalid payload: missing studentId or deltas array");
    }

    // 2. Map payload to JSON format expected by RPC
    const batchPayload = deltas.map(delta => ({
      student_id: studentId,
      node_id: delta.nodeId,
      node_type: delta.nodeType,
      attempt_delta: delta.attemptDelta,
      correct_delta: delta.correctDelta,
      time_delta: delta.timeDelta
    }));

    const { error: upsertError } = await supabase.rpc('upsert_student_node_statistics_batch', {
      p_job_id: job.id,
      p_deltas: batchPayload
    });

    if (upsertError) {
      throw new Error("Batch upsert failed: " + upsertError.message);
    }

    // 3. Mark Job Completed
    await supabase.from('background_jobs').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', job.id);

  } catch (err: any) {
    await supabase.from('background_jobs').update({ 
      status: 'FAILED',
      error: err.message
    }).eq('id', job.id);
  }
}
