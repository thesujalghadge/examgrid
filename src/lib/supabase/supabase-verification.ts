import { DEFAULT_INSTITUTE_ID } from "@/config/institute";
import { getRepositoryMode } from "@/lib/repositories/provider";
import { getRepositories } from "@/lib/repositories/provider";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";
import { getClientEnvConfig } from "@/lib/supabase/env-config";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
export interface TableAccessResult {
  table: string;
  ok: boolean;
  rowCount?: number;
  error?: string;
}

export interface SmokeTestResult {
  ok: boolean;
  steps: { step: string; ok: boolean; detail?: string }[];
  durationMs: number;
}

export interface ExamPersistenceVerifyResult {
  ok: boolean;
  steps: { step: string; ok: boolean; detail?: string }[];
  durationMs: number;
}

export interface SupabaseVerificationReport {
  ranAt: string;
  mode: string;
  envOk: boolean;
  envIssues: string[];
  tables: TableAccessResult[];
  smokeTest: SmokeTestResult | null;
  examPersistence: ExamPersistenceVerifyResult | null;
  cacheQuestions: number;
  cacheExams: number;
}

async function probeTable(
  table: string,
  instituteFilter = true,
): Promise<TableAccessResult> {
  try {
    const client = requireSupabaseClient(`verify.${table}`);
    let query = client.from(table).select("*", { count: "exact", head: true });
    if (instituteFilter && table !== "institutes") {
      query = query.eq("institute_id", DEFAULT_INSTITUTE_ID);
    }
    const { count, error } = await query;
    throwIfSupabaseError(error, table, "select");
    return { table, ok: true, rowCount: count ?? 0 };
  } catch (e) {
    return {
      table,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function verifySupabaseTableAccess(): Promise<TableAccessResult[]> {
  const tables = [
    "institutes",
    "questions",
    "exams",
    "exam_sections",
    "exam_questions",
  ];
  const results: TableAccessResult[] = [];
  for (const table of tables) {
    results.push(await probeTable(table, table !== "institutes"));
  }
  return results;
}

const SMOKE_LEGACY_PREFIX = "__examgrid_smoke_";

export async function runSupabaseSmokeTest(): Promise<SmokeTestResult> {
  const t0 = performance.now();
  const steps: SmokeTestResult["steps"] = [];
  const legacyId = `${SMOKE_LEGACY_PREFIX}${Date.now()}`;
  let insertedId: string | null = null;

  try {
    const client = requireSupabaseClient("smoke.insert");
    const row = {
      id: crypto.randomUUID(),
      legacy_id: legacyId,
      institute_id: DEFAULT_INSTITUTE_ID,
      subject: "Physics",
      chapter: "Smoke",
      topic: "Verification",
      difficulty: "easy",
      question_type: "MCQ_SINGLE",
      question_text: "Smoke test question — safe to delete",
      options: [
        { label: "A", text: "One" },
        { label: "B", text: "Two" },
      ],
      correct_answer: "A",
      solution: "",
      marks: 4,
      negative_marks: 1,
      metadata: { smoke: true },
    };

    const { error: insertErr } = await client.from("questions").insert(row);
    if (insertErr) throw new Error(insertErr.message);
    insertedId = row.id;
    steps.push({ step: "insert question", ok: true, detail: legacyId });

    const { data: fetched, error: fetchErr } = await client
      .from("questions")
      .select("id, legacy_id, question_text")
      .eq("legacy_id", legacyId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!fetched) throw new Error("Inserted row not found on read");
    steps.push({ step: "fetch question", ok: true });

    const { error: delErr } = await client
      .from("questions")
      .delete()
      .eq("id", insertedId);
    if (delErr) throw new Error(delErr.message);
    insertedId = null;
    steps.push({ step: "delete question", ok: true });

    return {
      ok: true,
      steps,
      durationMs: Math.round(performance.now() - t0),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: "failed", ok: false, detail: msg });

    if (insertedId) {
      try {
        const client = requireSupabaseClient("smoke.cleanup");
        await client.from("questions").delete().eq("id", insertedId);
        steps.push({ step: "cleanup delete", ok: true });
      } catch {
        steps.push({ step: "cleanup delete", ok: false });
      }
    }

    return {
      ok: false,
      steps,
      durationMs: Math.round(performance.now() - t0),
    };
  }
}

export async function verifyExamPersistence(): Promise<ExamPersistenceVerifyResult> {
  const t0 = performance.now();
  const steps: ExamPersistenceVerifyResult["steps"] = [];
  const legacyId = `${SMOKE_LEGACY_PREFIX}exam_${Date.now()}`;
  let examUuid: string | null = null;

  try {
    const client = requireSupabaseClient("exam-verify.insert");
    examUuid = crypto.randomUUID();
    const sectionId = "smoke-sec-1";
    const questionId = `${legacyId}-q1`;

    const { error: examErr } = await client.from("exams").insert({
      id: examUuid,
      legacy_id: legacyId,
      institute_id: DEFAULT_INSTITUTE_ID,
      title: "Smoke Test Exam",
      subtitle: "Delete me",
      exam_type: "JEE_MAIN",
      duration_minutes: 60,
      total_questions: 1,
      instructions: ["Smoke test only"],
      scheduled_at: new Date().toISOString(),
      is_published: false,
    });
    if (examErr) throw new Error(examErr.message);
    steps.push({ step: "insert exam header", ok: true });

    const { error: secErr } = await client.from("exam_sections").insert({
      id: sectionId,
      exam_id: examUuid,
      institute_id: DEFAULT_INSTITUTE_ID,
      name: "Section A",
      sort_order: 0,
    });
    if (secErr) throw new Error(secErr.message);
    steps.push({ step: "insert exam section", ok: true });

    const { error: qErr } = await client.from("exam_questions").insert({
      id: questionId,
      exam_id: examUuid,
      section_id: sectionId,
      institute_id: DEFAULT_INSTITUTE_ID,
      question_number: 1,
      question_type: "MCQ_SINGLE",
      question_text: "Smoke exam question",
      options: [{ id: "o1", label: "A", text: "Option A" }],
      correct_option_id: "o1",
      marks: 4,
      negative_marks: 1,
      sort_order: 0,
    });
    if (qErr) throw new Error(qErr.message);
    steps.push({ step: "insert exam question", ok: true });

    const { data: readExam, error: readErr } = await client
      .from("exams")
      .select("id, legacy_id, title")
      .eq("legacy_id", legacyId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!readExam) throw new Error("Exam not found after insert");
    steps.push({ step: "read exam header", ok: true });

    const { error: delErr } = await client
      .from("exams")
      .delete()
      .eq("id", examUuid);
    if (delErr) throw new Error(delErr.message);
    examUuid = null;
    steps.push({ step: "delete exam (cascade)", ok: true });

    return {
      ok: true,
      steps,
      durationMs: Math.round(performance.now() - t0),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: "failed", ok: false, detail: msg });

    if (examUuid) {
      try {
        const client = requireSupabaseClient("exam-verify.cleanup");
        await client.from("exams").delete().eq("id", examUuid);
        steps.push({ step: "cleanup delete exam", ok: true });
      } catch {
        steps.push({ step: "cleanup delete exam", ok: false });
      }
    }

    return {
      ok: false,
      steps,
      durationMs: Math.round(performance.now() - t0),
    };
  }
}

export async function runFullSupabaseVerification(options?: {
  includeSmokeTest?: boolean;
  includeExamTest?: boolean;
  refreshCache?: boolean;
}): Promise<SupabaseVerificationReport> {
  const opts = {
    includeSmokeTest: true,
    includeExamTest: true,
    refreshCache: true,
    ...options,
  };

  const env = getClientEnvConfig();
  const mode = getRepositoryMode();

  if (opts.refreshCache && mode === "supabase") {
    await hydrateSupabaseRepositories();
  }

  const bundle = getRepositories();
  const tables = await verifySupabaseTableAccess();
  const smokeTest = opts.includeSmokeTest
    ? await runSupabaseSmokeTest()
    : null;
  const examPersistence = opts.includeExamTest
    ? await verifyExamPersistence()
    : null;

  return {
    ranAt: new Date().toISOString(),
    mode,
    envOk: env.allRequiredForSupabase,
    envIssues: env.issues,
    tables,
    smokeTest,
    examPersistence,
    cacheQuestions: bundle.questions.list().length,
    cacheExams: bundle.exams.list().length,
  };
}

/** Re-hydrate and return counts (for status page refresh). */
export async function refreshHydrationDiagnostics(): Promise<{
  ok: boolean;
  questionsCount: number;
  examsCount: number;
  durationMs: number;
  error?: string;
}> {
  const t0 = performance.now();
  const result = await hydrateSupabaseRepositories();
  return {
    ok: result.ok,
    questionsCount: result.questionsCount,
    examsCount: result.examsCount,
    durationMs: Math.round(performance.now() - t0),
    error: result.error,
  };
}
