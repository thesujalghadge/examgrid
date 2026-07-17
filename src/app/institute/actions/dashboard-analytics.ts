"use server";

import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchInstituteOverview,
  fetchBatchOverview,
  fetchTestOverview,
  fetchStudentOverview,
} from "@/lib/analytics/institute/dashboard";
import { fetchInstituteAcademicInsights } from "@/lib/analytics/institute/academic-insights";

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getInstituteOverview() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }
  return fetchInstituteOverview(getSupabaseClient(), session.instituteId);
}

export async function getBatchOverview() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }
  return fetchBatchOverview(getSupabaseClient(), session.instituteId);
}

export async function getTestOverview() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }
  return fetchTestOverview(getSupabaseClient(), session.instituteId);
}

export async function getStudentOverview() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }
  return fetchStudentOverview(getSupabaseClient(), session.instituteId);
}

export async function getInstituteStudentReports(studentId: string) {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }

  const supabase = getSupabaseClient();
  
  // Verify ownership
  const { data: student } = await supabase
    .from("students")
    .select("institute_id, name")
    .eq("id", studentId)
    .single();

  if (!student || student.institute_id !== session.instituteId) {
    throw new Error("Student not found or unauthorized");
  }

  const [
    { data: results },
    { data: sub },
    { data: jobsData }
  ] = await Promise.all([
    supabase.from("cbt_results").select("*, cbt_attempts!inner(id, test_id, student_id)").eq("cbt_attempts.student_id", studentId),
    supabase.from("student_cumulative_subject_analytics").select("*").eq("student_id", studentId),
    supabase.from("analytics_jobs").select("status").eq("student_id", studentId).in("status", ["PENDING", "PROCESSING", "WAITING_RETRY", "WAITING_DAILY_BUDGET"])
  ]);

  const allNodeIds = new Set<string>();
  sub?.forEach(s => allNodeIds.add(s.syllabus_node_id));

  const { data: nData } = await supabase.from("batch_syllabus_nodes").select("id, name, parent_id").in("id", Array.from(allNodeIds));

  return {
    studentName: student.name,
    results: results || [],
    sub: sub || [],
    nodes: nData || [],
    isGenerating: (jobsData?.length ?? 0) > 0
  };
}

export async function getInstituteAcademicInsights() {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "institute" || !session.instituteId) {
    throw new Error("Unauthorized");
  }
  return fetchInstituteAcademicInsights(getSupabaseClient(), session.instituteId);
}
