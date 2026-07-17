"use server";

import { classifyQuestionAgainstCurriculum } from "./curriculum-classification-service";
import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";

export async function runDebuggerTrace(questionId: string) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");
  
  // Find a PUBLISHED curriculum version to test against
  const { data: version } = await supabase.from("curriculum_versions").select("id").eq("status", "PUBLISHED").limit(1).single();
  if (!version) return { success: false, error: "No published curriculum version found to debug against." };

  try {
    const result = await classifyQuestionAgainstCurriculum(questionId, { dryRun: true, curriculumVersionId: version.id });
    return { success: true, trace: result.trace };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function persistDebuggerTrace(questionId: string, tracePayload: any) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  const { error } = await supabase.from("question_node_mappings").insert([tracePayload]);
  if (error) throw new Error(error.message);
  
  return { success: true };
}

// Helper to fetch some recent questions to test with
export async function getRecentQuestionsForDebugger() {
  const supabase = createServiceRoleClient();
  if (!supabase) return [];
  
  const { data } = await supabase
    .from("questions")
    .select("id, question_text")
    .order("created_at", { ascending: false })
    .limit(10);
    
  return data || [];
}
