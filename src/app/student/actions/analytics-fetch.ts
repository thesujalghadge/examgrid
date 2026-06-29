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
      nodes: []
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
    { data: qAnalytics }
  ] = await Promise.all([
    supabase.from("student_subject_analytics").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_chapter_analytics").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_concept_analytics").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_recommendations").select("*").eq("student_id", studentId).eq("exam_id", resolvedExamId),
    supabase.from("student_cumulative_subject_analytics").select("*").eq("student_id", studentId),
    supabase.from("cbt_attempt_answers").select("question_id, is_correct, selected_answer, time_taken_seconds").eq("attempt_id", result.cbt_attempts.id),
    supabase.from("question_analytics").select("*").eq("exam_id", resolvedExamId)
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
    nodes: fetchedNodes || []
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
      nodes: []
    };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const studentId = session.userId;

  const [
    { data: results },
    { data: sub },
    { data: chap },
    { data: con },
    { data: recs }
  ] = await Promise.all([
    supabase.from("cbt_results").select("*, cbt_attempts!inner(id, test_id, student_id)").eq("cbt_attempts.student_id", studentId),
    supabase.from("student_cumulative_subject_analytics").select("*").eq("student_id", studentId),
    supabase.from("student_cumulative_chapter_analytics").select("*").eq("student_id", studentId),
    supabase.from("student_cumulative_concept_analytics").select("*").eq("student_id", studentId),
    supabase.from("student_recommendations").select("*").eq("student_id", studentId)
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
    nodes: nData || []
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

  const { data: student } = isUuid
    ? await supabase
        .from("students")
        .select("id, roll_number")
        .eq("id", studentIdentifier)
        .eq("institute_id", session.instituteId ?? "")
        .maybeSingle()
    : await supabase
        .from("students")
        .select("id, roll_number")
        .eq("roll_number", studentIdentifier)
        .eq("institute_id", session.instituteId ?? "")
        .maybeSingle();

  let attemptsQuery = supabase
    .from("cbt_attempts")
    .select("id, test_id, student_id, student_roll_number")
    .eq("institute_id", session.instituteId ?? "");

  attemptsQuery = student?.id
    ? attemptsQuery.eq("student_id", student.id)
    : attemptsQuery.eq("student_roll_number", studentIdentifier);

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

