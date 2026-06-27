import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function runAnalyticsWorker() {
  const { data: jobs, error } = await supabase
    .from("analytics_jobs")
    .select("*")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !jobs || jobs.length === 0) return;

  const CHUNK_SIZE = 5;
  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (job) => {
      try {
        const { error: procErr } = await supabase.from("analytics_jobs").update({ status: "PROCESSING" }).eq("id", job.id);
        if (procErr) throw new Error(`Failed to mark job PROCESSING: ${procErr.message}`);

        let artifactCount = 0;

        const { data: attempt } = await supabase
          .from("cbt_attempts")
          .select("*")
          .eq("id", job.attempt_id)
          .single();
        if (!attempt) throw new Error("Attempt not found");

        const { data: answers } = await supabase
          .from("cbt_attempt_answers")
          .select("question_id, is_correct, marks_awarded, selected_answer, time_taken_seconds")
          .eq("attempt_id", attempt.id);
        if (!answers || answers.length === 0) throw new Error("No answers found");

        // 1. Update cbt_results counts
        let correct = 0;
        let incorrect = 0;
        let unattempted = 0;

        answers.forEach(a => {
          if (a.selected_answer === null || a.selected_answer === undefined || a.selected_answer === "") {
            unattempted++;
          } else if (a.is_correct) {
            correct++;
          } else {
            incorrect++;
          }
        });

        const { error: resErr } = await supabase.from("cbt_results").update({
          correct_count: correct,
          incorrect_count: incorrect,
          unattempted_count: unattempted
        }).eq("attempt_id", attempt.id);
        if (resErr) throw new Error(`cbt_results update failed: ${resErr.message}`);

        const realExamId = job.exam_id.startsWith("cbt-") ? job.exam_id.split("-paper-")[0].replace("cbt-", "") : job.exam_id;

        const { data: realQuestions } = await supabase
          .from("exam_questions")
          .select("id, question_number")
          .eq("exam_id", realExamId);
        
        const realQuestionsMap = new Map();
        if (realQuestions) {
          realQuestions.forEach(rq => {
            realQuestionsMap.set(String(rq.question_number), rq.id);
          });
        }

        const mappedAnswers = answers.map(ans => {
           const qNumMatch = ans.question_id.match(/question-(\d+)/);
           const qNum = qNumMatch ? qNumMatch[1] : null;
           const realId = qNum && realQuestionsMap.has(String(qNum)) ? realQuestionsMap.get(String(qNum)) : ans.question_id;
           return {
             ...ans,
             real_question_id: realId
           };
        });

        // 2. Rank Engine
        await runRankEngine(job.exam_id, attempt.institute_id);

        // 3. Question Analytics
        await updateQuestionAnalytics(realExamId, mappedAnswers);

        // 4. Generate Relational & Cumulative Analytics
        artifactCount += await generateStudentAnalytics(job.student_id, realExamId, job.batch_id, mappedAnswers);

        // 5. Generate Overall Snapshot
        artifactCount += await generateOverallSnapshot(job.student_id, job.exam_id, job.batch_id, {
          score: attempt.score,
          correct, incorrect, unattempted,
          total: answers.length
        });

        if (artifactCount === 0) {
          throw new Error("Analytics job completed without generating artifacts");
        }

        const { error: compErr } = await supabase.from("analytics_jobs").update({ 
          status: "COMPLETED", 
          completed_at: new Date().toISOString() 
        }).eq("id", job.id);
        if (compErr) throw new Error(`Failed to mark job COMPLETED: ${compErr.message}`);

      } catch (err: any) {
        console.error("Job failed:", err);
        await supabase.from("analytics_jobs").update({ 
          status: "FAILED", 
          error_text: err.message,
          completed_at: new Date().toISOString() 
        }).eq("id", job.id);
      }
    }));
  }
}

async function runRankEngine(examId: string, instituteId: string) {
  // Scope results to this exam + institute only.
  // Join through cbt_attempts to get both test_id and institute_id.
  // Standard competition ranking: equal scores share a rank (1,1,3 — not 1,1,2).
  const { data: results } = await supabase
    .from("cbt_results")
    .select("id, score, cbt_attempts!inner(test_id, institute_id)")
    .eq("cbt_attempts.test_id", examId)
    .eq("cbt_attempts.institute_id", instituteId)
    .order("score", { ascending: false })
    .order("id", { ascending: true });

  if (!results || results.length === 0) return;

  const totalCandidates = results.length;
  let currentRank = 1;

  for (let i = 0; i < totalCandidates; i++) {
    if (i > 0 && results[i].score < results[i - 1].score) {
      currentRank = i + 1;
    }
    // Percentile: percentage of candidates scored strictly below this rank.
    const percentile = parseFloat(
      (((totalCandidates - currentRank) / totalCandidates) * 100).toFixed(2)
    );

    const { error } = await supabase.from("cbt_results").update({
      rank: currentRank,
      percentile,
      total_candidates: totalCandidates,
    }).eq("id", results[i].id);
    if (error) throw new Error(`runRankEngine update failed: ${error.message}`);
  }
}

async function updateQuestionAnalytics(examId: string, answers: any[]) {
  if (!answers || answers.length === 0) return;

  const payload = answers.map(ans => {
    const isAttempted = ans.selected_answer !== null && ans.selected_answer !== "";
    const isCorrect = ans.is_correct;
    const isIncorrect = isAttempted && !isCorrect;
    const isUnattempted = !isAttempted;

    return {
      question_id: ans.real_question_id,
      exam_id: examId,
      attempt_count: isAttempted ? 1 : 0,
      correct_count: isCorrect ? 1 : 0,
      incorrect_count: isIncorrect ? 1 : 0,
      unattempted_count: isUnattempted ? 1 : 0,
      average_time_seconds: isAttempted ? (ans.time_taken_seconds || 0) : 0
    };
  });

  const { error } = await supabase.rpc("upsert_question_analytics_batch", {
    p_analytics_data: payload
  });
  if (error) {
    throw new Error(`upsert_question_analytics_batch failed: ${error.message}`);
  }
}

async function generateStudentAnalytics(studentId: string, examId: string, batchId: string | null, answers: any[]): Promise<number> {
  if (!batchId) return 0;
  let artifactCount = 0;

  const questionIds = answers.map(a => a.real_question_id);
  const { data: mappings } = await supabase
    .from("question_syllabus_mappings")
    .select("*")
    .in("question_id", questionIds)
    .eq("batch_id", batchId);

  if (!mappings || mappings.length === 0) return artifactCount;

  const subjectStats: Record<string, any> = {};
  const chapterStats: Record<string, any> = {};
  const conceptStats: Record<string, any> = {};

  answers.forEach(ans => {
    const mapping = mappings.find(m => m.question_id === ans.real_question_id);
    if (!mapping) return;

    const isAttempted = ans.selected_answer !== null && ans.selected_answer !== "";
    const isCorrect = ans.is_correct;
    const isIncorrect = isAttempted && !isCorrect;
    const timeSpent = ans.time_taken_seconds || 0;
    const marks = ans.marks_awarded || 0;

    const aggregate = (statsObj: any, key: string) => {
      if (!statsObj[key]) statsObj[key] = { attempted: 0, correct: 0, incorrect: 0, marks: 0, time: 0 };
      if (isAttempted) statsObj[key].attempted++;
      if (isCorrect) statsObj[key].correct++;
      if (isIncorrect) statsObj[key].incorrect++;
      statsObj[key].marks += marks;
      statsObj[key].time += timeSpent;
    };

    if (mapping.syllabus_subject_id) aggregate(subjectStats, mapping.syllabus_subject_id);
    if (mapping.syllabus_chapter_id) aggregate(chapterStats, mapping.syllabus_chapter_id);
    if (mapping.syllabus_topic_id) aggregate(conceptStats, mapping.syllabus_topic_id);
  });

  // Function to process upserts for exam-specific and cumulative tables
  const processStats = async (statsMap: any, examTableName: string, cumulativeTableName: string) => {
    const examUpserts = [];
    const cumulativeUpserts = [];

    for (const [nodeId, stats] of Object.entries(statsMap)) {
      const s = stats as any;
      const accuracy = s.attempted > 0 ? (s.correct / s.attempted) * 100 : 0;
      
      examUpserts.push({
        student_id: studentId, exam_id: examId, batch_id: batchId, syllabus_node_id: nodeId,
        attempted_count: s.attempted, correct_count: s.correct, incorrect_count: s.incorrect,
        accuracy, marks_awarded: s.marks, time_spent_seconds: s.time
      });

      // Fetch existing cumulative
      const { data: existingCum } = await supabase.from(cumulativeTableName)
        .select("*").eq("student_id", studentId).eq("syllabus_node_id", nodeId).maybeSingle();

      const newTotalAtt = (existingCum?.total_attempted || 0) + s.attempted;
      const newTotalCorr = (existingCum?.total_correct || 0) + s.correct;
      const newTotalInc = (existingCum?.total_incorrect || 0) + s.incorrect;
      const newTotalTime = (existingCum?.total_time_seconds || 0) + s.time;
      const newOverallAcc = newTotalAtt > 0 ? (newTotalCorr / newTotalAtt) * 100 : 0;

      cumulativeUpserts.push({
        student_id: studentId, batch_id: batchId, syllabus_node_id: nodeId,
        total_attempted: newTotalAtt, total_correct: newTotalCorr, total_incorrect: newTotalInc,
        overall_accuracy: newOverallAcc, total_time_seconds: newTotalTime
      });
    }

    if (examUpserts.length > 0) {
      const { error: examErr } = await supabase.from(examTableName).upsert(examUpserts, { onConflict: "student_id,exam_id,syllabus_node_id" });
      if (examErr) throw new Error(`Exam upsert failed: ${examErr.message}`);
      artifactCount += examUpserts.length;
    }
    if (cumulativeUpserts.length > 0) {
      const { error: cumErr } = await supabase.from(cumulativeTableName).upsert(cumulativeUpserts, { onConflict: "student_id,syllabus_node_id" });
      if (cumErr) throw new Error(`Cumulative upsert failed: ${cumErr.message}`);
      artifactCount += cumulativeUpserts.length;
    }
  };

  await processStats(subjectStats, "student_exam_subject_analytics", "student_cumulative_subject_analytics");
  await processStats(chapterStats, "student_exam_chapter_analytics", "student_cumulative_chapter_analytics");
  await processStats(conceptStats, "student_exam_concept_analytics", "student_cumulative_concept_analytics");

  // Generate Structured Recommendations
  const recommendations = [];
  for (const [cId, stats] of Object.entries(chapterStats)) {
    const s = stats as any;
    const accuracy = s.attempted > 0 ? (s.correct / s.attempted) * 100 : 0;

    if (accuracy < 50 && s.attempted >= 3) {
      recommendations.push({
        student_id: studentId, exam_id: examId, batch_id: batchId,
        code: 'NEEDS_REVISION',
        payload: { syllabus_node_id: cId, accuracy: Math.round(accuracy), attempts: s.attempted }
      });
    }
    if (accuracy >= 80 && s.attempted < 3 && s.attempted > 0) {
      recommendations.push({
        student_id: studentId, exam_id: examId, batch_id: batchId,
        code: 'GOOD_ACCURACY_LOW_ATTEMPTS',
        payload: { syllabus_node_id: cId, accuracy: Math.round(accuracy), attempts: s.attempted }
      });
    }
    if (accuracy <= 40 && s.attempted >= 5) {
      recommendations.push({
        student_id: studentId, exam_id: examId, batch_id: batchId,
        code: 'HIGH_ATTEMPTS_LOW_ACCURACY',
        payload: { syllabus_node_id: cId, accuracy: Math.round(accuracy), attempts: s.attempted }
      });
    }
    if (accuracy >= 80 && s.attempted >= 3) {
      recommendations.push({
        student_id: studentId, exam_id: examId, batch_id: batchId,
        code: 'STRONG_CONCEPT',
        payload: { syllabus_node_id: cId, accuracy: Math.round(accuracy), attempts: s.attempted }
      });
    }
  }

  if (recommendations.length > 0) {
    const { error: recErr } = await supabase.from("student_recommendations").insert(recommendations);
    if (recErr) throw new Error(`student_recommendations insert failed: ${recErr.message}`);
    artifactCount += recommendations.length;
  }
  
  return artifactCount;
}

async function generateOverallSnapshot(studentId: string, examId: string, batchId: string | null, metrics: any): Promise<number> {
  const overall = {
    score: metrics.score,
    accuracy: metrics.total > 0 ? (metrics.correct / metrics.total) * 100 : 0,
    correct: metrics.correct,
    incorrect: metrics.incorrect,
    unattempted: metrics.unattempted
  };

  const { error: snapErr } = await supabase.from("analytics_snapshots").upsert({
    student_id: studentId,
    exam_id: examId,
    batch_id: batchId,
    snapshot_type: 'OVERALL',
    overall_metrics: overall
  }, { onConflict: "student_id,exam_id,snapshot_type" });
  if (snapErr) throw new Error(`generateOverallSnapshot upsert failed: ${snapErr.message}`);
  
  return 1;
}
