import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";

export async function processQuestionClassifiedJobs() {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  // 1. Lock a job
  const { data: job, error: lockError } = await supabase
    .from('background_jobs')
    .update({ status: 'PROCESSING', started_at: new Date().toISOString() })
    .eq('status', 'PENDING')
    .eq('job_type', 'QUESTION_CLASSIFIED')
    .select('*')
    .limit(1)
    .single();

  if (lockError || !job) {
    return; // No jobs
  }

  try {
    const { questionId, oldMapping, newMapping } = job.payload;
    if (!questionId || !newMapping) {
      throw new Error("Invalid payload: missing questionId or newMapping definitions");
    }

    // 2. Find affected ledger rows
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('attempt_question_ledger')
      .select('*, cbt_attempts(institute_id)')
      .eq('bank_question_id', questionId);

    if (ledgerError) throw new Error("Failed to fetch ledger rows: " + ledgerError.message);
    if (!ledgerRows || ledgerRows.length === 0) {
      // No attempts have encountered this question yet. Just complete.
      await supabase.from('background_jobs').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', job.id);
      return;
    }

    const deltas: any[] = [];

    for (const row of ledgerRows) {
      const studentId = row.student_id;
      const instituteId = (row.cbt_attempts as any)?.institute_id;
      const isCorrect = row.is_correct;
      const timeSpent = row.time_taken_ms;

      // Negative delta for OLD nodes
      const addNegative = (nodeId: string, nodeType: string) => {
        if (!nodeId) return;
        deltas.push({
          studentId,
          instituteId,
          nodeId,
          nodeType,
          attemptDelta: -1,
          correctDelta: isCorrect ? -1 : 0,
          timeDelta: -timeSpent
        });
      };
      
      if (oldMapping) {
        addNegative(oldMapping.subject_id, 'SUBJECT');
        addNegative(oldMapping.chapter_id, 'CHAPTER');
        addNegative(oldMapping.topic_id, 'TOPIC');
        addNegative(oldMapping.subtopic_id, 'SUBTOPIC');
      }

      // Positive delta for NEW nodes
      const addPositive = (nodeId: string, nodeType: string) => {
        if (!nodeId) return;
        deltas.push({
          studentId,
          instituteId,
          nodeId,
          nodeType,
          attemptDelta: 1,
          correctDelta: isCorrect ? 1 : 0,
          timeDelta: timeSpent
        });
      };

      addPositive(newMapping.subject_id, 'SUBJECT');
      addPositive(newMapping.chapter_id, 'CHAPTER');
      addPositive(newMapping.topic_id, 'TOPIC');
      addPositive(newMapping.subtopic_id, 'SUBTOPIC');
      
    }

    // 3. Emit NodeStatisticsDelta to Projector
    // Group deltas by studentId to emit PROJECT_DELTAS jobs per student
    const studentDeltas = new Map<string, { instituteId: string, deltas: any[] }>();
    for (const d of deltas) {
      if (!studentDeltas.has(d.studentId)) studentDeltas.set(d.studentId, { instituteId: d.instituteId, deltas: [] });
      studentDeltas.get(d.studentId)!.deltas.push({
        nodeId: d.nodeId,
        nodeType: d.nodeType,
        attemptDelta: d.attemptDelta,
        correctDelta: d.correctDelta,
        timeDelta: d.timeDelta
      });
    }

    for (const [studentId, data] of studentDeltas.entries()) {
      await supabase.from('background_jobs').insert([{
        institute_id: data.instituteId,
        job_type: 'PROJECT_DELTAS',
        payload: {
          studentId: studentId,
          attemptId: 'mapping-changed-' + job.id, // For idempotency
          deltas: data.deltas
        }
      }]);
    }

    // 4. Mark Job Completed
    await supabase.from('background_jobs').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', job.id);

  } catch (err: any) {
    await supabase.from('background_jobs').update({ 
      status: 'FAILED',
      error: err.message
    }).eq('id', job.id);
  }
}
