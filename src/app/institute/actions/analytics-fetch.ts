"use server";

import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { createClient } from "@supabase/supabase-js";

export async function fetchInstituteStudents() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: students, error } = await supabase
    .from("students")
    .select("*, batches!inner(id, name, institute_id)")
    .eq("batches.institute_id", session.instituteId);

  if (error) throw new Error("Failed to load students.");
  return students || [];
}

export async function verifyBatchExistsRemote(batchId: string) {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data, error } = await supabase
    .from("batches")
    .select("id")
    .eq("id", batchId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();
    
  if (error) return false;
  return Boolean(data);
}

export async function fetchInstituteReports() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: exams } = await supabase.from("exams").select("id, title").eq("institute_id", session.instituteId);
  if (!exams || exams.length === 0) return { exams: [] };

  const examStats = await Promise.all(
    exams.map(async (exam) => {
      const { count } = await supabase.from("cbt_results").select("*", { count: "exact", head: true }).eq("exam_id", exam.id);
      const { data: results } = await supabase.from("cbt_results").select("score, total_marks").eq("exam_id", exam.id);
      
      const avgScore = results?.length ? results.reduce((acc, r) => acc + (r.score || 0), 0) / results.length : 0;
      
      return {
        id: exam.id,
        title: exam.title,
        studentsCount: count || 0,
        averageScore: avgScore,
      };
    })
  );

  return { exams: examStats };
}

export async function fetchInstituteExamAnalytics(examId: string) {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // 1. Ensure exam belongs to institute
  const { data: exam, error: examErr } = await supabase.from("exams").select("id").eq("id", examId).eq("institute_id", session.instituteId).maybeSingle();
  if (examErr || !exam) throw new Error("Unauthorized or Exam not found.");

  const [
    { data: results },
    { count: studentsCount },
    { data: qAnalytics },
    { data: subjects },
    { data: fetchedNodes }
  ] = await Promise.all([
    supabase.from("cbt_results").select("*, cbt_attempts!inner(student_id)").eq("exam_id", examId),
    supabase.from("cbt_results").select("*", { count: "exact", head: true }).eq("exam_id", examId),
    supabase.from("question_analytics").select("*").eq("exam_id", examId),
    supabase.from("student_exam_subject_analytics").select("*").eq("exam_id", examId),
    supabase.from("batch_syllabus_nodes").select("id, name") // Optimization: Only fetch what's needed later if required
  ]);

  return {
    results: results || [],
    studentsCount: studentsCount || 0,
    qAnalytics: qAnalytics || [],
    subjects: subjects || [],
    nodes: fetchedNodes || []
  };
}

export async function fetchInstituteUnmappedQuestions() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1. Fetch unmapped mappings
  const { data: mappings } = await supabase
    .from("question_syllabus_mappings")
    .select(
      `
      id, batch_id, question_id,
      batches:batch_id (name)
    `
    )
    .eq("institute_id", session.instituteId)
    .eq("is_unmapped", true);

  if (!mappings || mappings.length === 0) {
    return { combined: [], nodes: [] };
  }

  // 2. Fetch AI solutions for these questions to show what Gemini guessed
  const qIds = mappings.map((m: any) => m.question_id);
  const { data: solutions } = await supabase
    .from("question_solutions")
    .select("question_id, ai_metadata")
    .in("question_id", qIds)
    .eq("is_active", true);

  // 3. Fetch questions text/images
  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id, published_question_text, published_image_url")
    .in("id", qIds);

  // 4. Fetch syllabus nodes for the involved batches
  const batchIds = [...new Set(mappings.map((m: any) => m.batch_id))];
  const { data: nodes } = await supabase
    .from("batch_syllabus_nodes")
    .select("*")
    .in("batch_id", batchIds);

  const combined = mappings.map((m: any) => {
    const sol = solutions?.find((s: any) => s.question_id === m.question_id);
    const q = questions?.find((q: any) => q.id === m.question_id);
    return {
      ...m,
      ai_metadata: sol?.ai_metadata,
      question: q,
    };
  });

  return { combined, nodes: nodes || [] };
}

