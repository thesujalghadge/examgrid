import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";

export async function processAnalyticsWorkerJobs() {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  // 1. Lock a job
  const { data: job, error: lockError } = await supabase
    .from('background_jobs')
    .update({ status: 'PROCESSING', started_at: new Date().toISOString() })
    .eq('status', 'PENDING')
    .eq('job_type', 'ATTEMPT_FINISHED')
    .select('*')
    .limit(1)
    .single();

  if (lockError || !job) {
    return; // No jobs
  }

  try {
    const attemptId = job.payload.attemptId;
    if (!attemptId) throw new Error("Missing attemptId in payload");

    // 2. Fetch attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('cbt_attempts')
      .select('*, exams(curriculum_version_id)') // Assume exams or something links to curriculum. Wait, CBT attempts might not have exams relation easily if it's test_id. We'll fetch student_id at least.
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) throw new Error("Attempt not found");

    // 3. Fetch answers and resolve bank_question_id
    const { data: answers, error: answersError } = await supabase
      .from('cbt_attempt_answers')
      .select('*, exam_questions(bank_question_id)')
      .eq('attempt_id', attemptId);
      
    if (answersError || !answers) throw new Error("Failed to fetch answers");

    // 4. Fetch effective mappings for these bank questions
    const bankQuestionIds = answers
      .map(a => (a.exam_questions as any)?.bank_question_id)
      .filter(Boolean);
      
    const { data: mappings, error: mappingError } = await supabase
      .from('effective_question_mappings')
      .select('*')
      .in('question_id', bankQuestionIds);
      
    if (mappingError) throw new Error("Failed to fetch effective mappings");

    const mappingMap = new Map(mappings.map(m => [m.question_id, m]));
    
    const ledgerEntries = [];
    const nodeDeltas = new Map<string, any>(); // key: nodeId

    const studentId = attempt.student_id;
    if (!studentId) {
      // If no student ID, we can't aggregate for student. Just mark completed.
      await supabase.from('platform_jobs').update({ status: 'COMPLETED' }).eq('id', job.id);
      return;
    }

    const addDelta = (nodeId: string, nodeType: string, isCorrect: boolean, timeSpent: number) => {
      if (!nodeId) return;
      if (!nodeDeltas.has(nodeId)) {
        nodeDeltas.set(nodeId, {
          nodeId,
          nodeType,
          attemptDelta: 0,
          correctDelta: 0,
          timeDelta: 0
        });
      }
      const entry = nodeDeltas.get(nodeId);
      entry.attemptDelta += 1;
      if (isCorrect) entry.correctDelta += 1;
      entry.timeDelta += timeSpent;
    };

    for (const answer of answers) {
      const bankQuestionId = (answer.exam_questions as any)?.bank_question_id;
      const mapping = bankQuestionId ? mappingMap.get(bankQuestionId) : undefined;
      
      const timeTakenMs = (answer.time_taken_seconds || 0) * 1000;
      
      // Build Ledger Entry
      ledgerEntries.push({
        attempt_id: attemptId,
        student_id: studentId,
        exam_question_id: answer.question_id,
        bank_question_id: bankQuestionId || null,
        curriculum_version_id: null, 
        subject_id: mapping?.subject_id,
        chapter_id: mapping?.chapter_id,
        topic_id: mapping?.topic_id,
        subtopic_id: mapping?.subtopic_id,
        selected_option: answer.selected_answer,
        correct_option: null, 
        marks_awarded: answer.marks_awarded,
        is_correct: answer.is_correct,
        time_taken_ms: timeTakenMs,
        mapping_observation_id: mapping?.mapping_observation_id
      });
      
      // Calculate Deltas for valid mappings
      // Do NOT count as an attempt if they skipped it (selected_answer === null)
      if (mapping && answer.selected_answer !== null) {
        addDelta(mapping.subject_id, 'SUBJECT', answer.is_correct, timeTakenMs);
        addDelta(mapping.chapter_id, 'CHAPTER', answer.is_correct, timeTakenMs);
        addDelta(mapping.topic_id, 'TOPIC', answer.is_correct, timeTakenMs);
        addDelta(mapping.subtopic_id, 'SUBTOPIC', answer.is_correct, timeTakenMs);
      }
    }

    // 5. Insert into Immutable Ledger
    let isAlreadyProcessed = false;
    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await supabase
        .from('attempt_question_ledger')
        .insert(ledgerEntries);
        
      if (ledgerError) {
        if (ledgerError.code === '23505') {
          console.log(`Attempt ${attemptId} ledger already exists. Skipping.`);
          isAlreadyProcessed = true;
        } else {
          throw new Error("Failed to write to ledger: " + ledgerError.message);
        }
      }
    }

    // 6. Emit NodeStatisticsDelta to Projector ONLY if we successfully inserted into the ledger
    if (!isAlreadyProcessed) {
      const deltasArray = Array.from(nodeDeltas.values());
      if (deltasArray.length > 0) {
        const { error: deltaError } = await supabase.from('background_jobs').insert([{
          institute_id: attempt.institute_id,
          job_type: 'PROJECT_DELTAS',
          payload: {
            studentId: studentId,
            attemptId: attemptId, 
            deltas: deltasArray
          }
        }]);
        if (deltaError) throw new Error("Failed to emit delta job: " + deltaError.message);
      }
    }

    // 7. Mark Job Completed
    await supabase.from('background_jobs').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', job.id);

  } catch (err: any) {
    await supabase.from('background_jobs').update({ 
      status: 'FAILED',
      error: err.message
    }).eq('id', job.id);
  }
}
