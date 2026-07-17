"use server";

import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { createClient } from "@supabase/supabase-js";

export async function fetchStudentExamAnalytics(examId: string) {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "student") {
    return {
      result: null,
      subjects: [],
      chapters: [],
      concepts: [],
      recommendations: [],
      cumulative: [],
      answers: [],
      qAnalytics: [],
      nodes: [],
      isGenerating: false
    };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const studentId = session.userId;
  const resolvedExamId = examId;


  // 1. Fetch result & attempt (Validating Ownership)
  const { data: result, error: resultError } = await supabase
    .from("cbt_results")
    .select("*, cbt_attempts!inner(id, test_id, student_id)")
    .eq("cbt_attempts.student_id", studentId)
    .eq("cbt_attempts.test_id", examId)
    .single();

  if (resultError || !result) {
    throw new Error("No results found or access denied.");
  }

  // 2. Fetch specific analytics data
  const [
    { data: subjects },
    { data: chapters },
    { data: concepts },
    { data: recommendations },
    { data: cumulative },
    { data: answers },
    { data: qAnalytics },
    { data: jobsData }
  ] = await Promise.all([
    supabase.from("student_subject_analytics").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_chapter_analytics").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_concept_analytics").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_recommendations").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_cumulative_subject_analytics").select("*").eq("student_id", studentId),
    supabase.from("cbt_attempt_answers").select("question_id, is_correct, selected_answer, time_taken_seconds").eq("attempt_id", result.cbt_attempts.id),
    supabase.from("question_analytics").select("*").eq("exam_id", resolvedExamId),
    supabase.from("analytics_jobs").select("status").eq("attempt_id", result.cbt_attempts.id).in("status", ["PENDING", "PROCESSING", "WAITING_RETRY", "WAITING_DAILY_BUDGET"])
  ]);

  const nodeIds = new Set<string>();
  subjects?.forEach(s => nodeIds.add(s.syllabus_node_id));
  chapters?.forEach(c => nodeIds.add(c.syllabus_node_id));
  concepts?.forEach(c => nodeIds.add(c.syllabus_node_id));
  recommendations?.forEach(r => {
      if (r.payload?.syllabus_node_id) nodeIds.add(r.payload.syllabus_node_id);
  });

  const { data: fetchedNodes } = await supabase.from("batch_syllabus_nodes").select("id, name").in("id", Array.from(nodeIds));

  return {
    result,
    subjects: subjects || [],
    chapters: chapters || [],
    concepts: concepts || [],
    recommendations: recommendations || [],
    cumulative: cumulative || [],
    answers: answers || [],
    qAnalytics: qAnalytics || [],
    nodes: fetchedNodes || [],
    isGenerating: (jobsData?.length ?? 0) > 0
  };
}

export async function fetchStudentReports() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "student") {
    return {
      results: [],
      sub: [],
      chap: [],
      con: [],
      recs: [],
      nodes: [],
      isGenerating: false
    };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const studentId = session.userId;

  const [
    { data: results },
    { data: sub },
    { data: chap },
    { data: con },
    { data: recs },
    { data: jobsData }
  ] = await Promise.all([
    supabase.from("cbt_results").select("*, cbt_attempts!inner(id, test_id, student_id)").eq("cbt_attempts.student_id", studentId),
    supabase.from("student_cumulative_subject_analytics").select("*").eq("student_id", studentId),
    supabase.from("student_cumulative_chapter_analytics").select("*").eq("student_id", studentId),
    supabase.from("student_cumulative_concept_analytics").select("*").eq("student_id", studentId),
    supabase.from("student_recommendations").select("*").eq("student_id", studentId),
    supabase.from("analytics_jobs").select("status").eq("student_id", studentId).in("status", ["PENDING", "PROCESSING", "WAITING_RETRY", "WAITING_DAILY_BUDGET"])
  ]);

  const allNodeIds = new Set<string>();
  sub?.forEach(s => allNodeIds.add(s.syllabus_node_id));
  chap?.forEach(c => allNodeIds.add(c.syllabus_node_id));
  con?.forEach(c => allNodeIds.add(c.syllabus_node_id));
  recs?.forEach(r => { if(r.payload?.syllabus_node_id) allNodeIds.add(r.payload.syllabus_node_id); });

  const { data: nData } = await supabase.from("batch_syllabus_nodes").select("id, name, parent_id").in("id", Array.from(allNodeIds));

  return {
    results: results || [],
    sub: sub || [],
    chap: chap || [],
    con: con || [],
    recs: recs || [],
    nodes: nData || [],
    isGenerating: (jobsData?.length ?? 0) > 0
  };
}

export async function fetchStudentAttemptedExams() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "student") {
    return [];
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const studentIdentifier = session.userId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentIdentifier);
  if (!isUuid) return [];

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentIdentifier)
    .eq("institute_id", session.instituteId ?? "")
    .maybeSingle();

  if (!student) return [];

  let attemptsQuery = supabase
    .from("cbt_attempts")
    .select("id, test_id, student_id")
    .eq("institute_id", session.instituteId ?? "")
    .eq("student_id", student.id);

  const { data: attempts, error: attemptsError } = await attemptsQuery;
  if (attemptsError) {
    console.error("fetchStudentAttemptedExams attempts error:", attemptsError);
    throw new Error(`Failed to load attempted exams: ${attemptsError.message}`);
  }

  if (!attempts || attempts.length === 0) return [];

  const attemptsById = new Map(attempts.map((attempt: any) => [attempt.id, attempt]));
  const { data: resultRows, error } = await supabase
    .from("cbt_results")
    .select("*")
    .in("attempt_id", attempts.map((attempt: any) => attempt.id))
    .order("generated_at", { ascending: false });

  if (error) {
    console.error("fetchStudentAttemptedExams error:", error);
    throw new Error(`Failed to load attempted exams: ${error.message}`);
  }

  const results = (resultRows ?? []).map((result: any) => ({
    ...result,
    cbt_attempts: attemptsById.get(result.attempt_id),
  }));
  
  if (results.length === 0) return [];

  const examIds = [...new Set(results.map((r: any) => r.cbt_attempts?.test_id).filter(Boolean))];
  const { data: exams, error: examsError } = examIds.length > 0
    ? await supabase.from("exams").select("id, title, exam_type").in("id", examIds)
    : { data: [], error: null };

  if (examsError) {
    console.error("fetchStudentAttemptedExams exams error:", examsError);
    throw new Error(`Failed to load attempted exams: ${examsError.message}`);
  }

  const examsById = new Map((exams ?? []).map((exam: any) => [exam.id, exam]));
  const fallbackExam = { title: "Unknown", exam_type: "UNKNOWN" };

  const merged = results.map((r: any) => ({
    ...r,
    exams: examsById.get(r.cbt_attempts?.test_id) || fallbackExam,
    cbt_attempts: {
      ...r.cbt_attempts,
      exams: examsById.get(r.cbt_attempts?.test_id) || fallbackExam,
    },
  }));

  return merged;
}

