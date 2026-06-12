"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function verifyAndFetchSolution(
  instituteId: string,
  testId: string,
  studentRoll: string,
  questionId: string,
  hasAttempted: boolean
) {
  if (!instituteId || !testId || !studentRoll || !questionId) {
    return { error: "400: Missing required parameters" };
  }

  // Phase 3.5 Test E: Attempted exam verification
  if (!hasAttempted) {
    return { error: "403: Student never attempted this exam" };
  }

  // Phase 3.5 Test D & Tenant Isolation: Verify student belongs to institute
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("institute_id", instituteId)
    .eq("roll_number", studentRoll)
    .maybeSingle();

  if (!student) {
    return { error: "403: Student not found in tenant or tenant mismatch" };
  }

  // Phase 3.5 Test A & B: Release time enforcement
  const { data: exam } = await supabase
    .from("exams")
    .select("id, solutions_release_time")
    .or(`id.eq.${testId},legacy_id.eq.${testId}`)
    .eq("institute_id", instituteId)
    .maybeSingle();

  if (!exam) {
    return { error: "403: Exam not found in tenant" };
  }

  // If no release time is set, assume it's NOT released. Or we can allow it for testing if it's null?
  // Usually, exams have a default. Let's assume if it's null, it's not released.
  if (exam.solutions_release_time) {
    const releaseTime = new Date(exam.solutions_release_time).getTime();
    const now = Date.now();
    if (now < releaseTime) {
      return { error: `403: Solutions unavailable. Will be released at ${new Date(releaseTime).toLocaleString()}` };
    }
  }

  // Phase 4.3 Lazy Loading: Fetch the solution
  const { data: solution } = await supabase
    .from("question_solutions")
    .select("content_markdown, final_answer, ai_metadata")
    .eq("institute_id", instituteId)
    .eq("question_id", questionId)
    .eq("is_active", true)
    .maybeSingle();

  if (!solution) {
    return { error: "404: Solution not generated yet" };
  }

  return {
    data: {
      content_markdown: solution.content_markdown,
      final_answer: solution.final_answer,
      ai_metadata: solution.ai_metadata,
    }
  };
}
