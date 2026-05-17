#!/usr/bin/env node
/**
 * Verify remote Supabase schema + run smoke tests using anon key from .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, getProjectRef } from "./load-env.mjs";

const DEFAULT_INSTITUTE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ??
  "00000000-0000-0000-0000-000000000001";

const REQUIRED_TABLES = [
  "institutes",
  "questions",
  "students",
  "batches",
  "exams",
  "exam_sections",
  "exam_questions",
  "exam_schedules",
  "exam_schedule_batches",
  "audit_logs",
];

const TABLE_PROBE_COLUMNS = {
  exam_schedule_batches: "schedule_id",
  audit_logs: "event_id",
};

const REQUIRED_QUESTION_INSERT_FIELDS = [
  "difficulty",
  "question_type",
  "marks",
  "negative_marks",
  "subject",
  "chapter",
  "topic",
];

function assertQuestionInsertPayload(row, context) {
  const missing = REQUIRED_QUESTION_INSERT_FIELDS.filter(
    (field) => row[field] === undefined || row[field] === null,
  );
  if (missing.length > 0) {
    throw new Error(
      `${context}: question insert payload missing required fields: ${missing.join(", ")}`,
    );
  }
}

async function main() {
  const env = loadEnvFiles();
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const instituteId =
    env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID?.trim() || DEFAULT_INSTITUTE_ID;
  const projectRef = getProjectRef(env);

  if (!url || !anonKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  console.log("=== ExamGrid Supabase remote verification ===\n");
  console.log(`Project ref: ${projectRef}`);
  console.log(`Repository mode (env): ${env.NEXT_PUBLIC_REPOSITORY_MODE}`);
  console.log(`Institute ID: ${instituteId}\n`);

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let allOk = true;

  // 1. Tables
  console.log("--- Table access ---");
  for (const table of REQUIRED_TABLES) {
    const column = TABLE_PROBE_COLUMNS[table] ?? "id";
    const { error, count } = await client
      .from(table)
      .select(column, { count: "exact", head: true });
    if (error) {
      console.log(`  ✗ ${table}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✓ ${table}: accessible (${count ?? 0} rows)`);
    }
  }

  // 2. Seed institute
  console.log("\n--- Default institute seed ---");
  const { data: institute, error: instErr } = await client
    .from("institutes")
    .select("id, name, slug")
    .eq("id", instituteId)
    .maybeSingle();

  if (instErr || !institute) {
    console.log(`  ✗ Default institute missing: ${instErr?.message ?? "not found"}`);
    allOk = false;
  } else {
    console.log(`  ✓ ${institute.name} (${institute.slug})`);
  }

  // 3. Question smoke test
  console.log("\n--- Question smoke test (insert → fetch → delete) ---");
  const legacyId = `__examgrid_smoke_${Date.now()}`;
  const rowId = crypto.randomUUID();

  const questionSmokeRow = {
    id: rowId,
    legacy_id: legacyId,
    institute_id: instituteId,
    subject: "Physics",
    chapter: "Smoke",
    topic: "CLI Verify",
    difficulty: "easy",
    question_type: "MCQ_SINGLE",
    question_text: "Smoke test — safe to delete",
    options: [{ label: "A", text: "One" }],
    correct_answer: "A",
    solution: "",
    marks: 4,
    negative_marks: 1,
    metadata: { smoke: true },
  };
  assertQuestionInsertPayload(questionSmokeRow, "question smoke test");

  const { error: insErr } = await client.from("questions").insert(questionSmokeRow);

  if (insErr) {
    console.log(`  ✗ insert: ${insErr.message}`);
    allOk = false;
  } else {
    console.log("  ✓ insert");

    const { data: fetched, error: fetchErr } = await client
      .from("questions")
      .select("id, legacy_id")
      .eq("legacy_id", legacyId)
      .maybeSingle();

    if (fetchErr || !fetched) {
      console.log(`  ✗ fetch: ${fetchErr?.message ?? "not found"}`);
      allOk = false;
    } else {
      console.log("  ✓ fetch");
    }

    const { error: delErr } = await client.from("questions").delete().eq("id", rowId);
    if (delErr) {
      console.log(`  ✗ delete: ${delErr.message}`);
      allOk = false;
    } else {
      console.log("  ✓ delete");
    }
  }

  // 4. Exam persistence smoke
  console.log("\n--- Exam persistence smoke ---");
  const examUuid = crypto.randomUUID();
  const legacyExamId = `__smoke_exam_${Date.now()}`;
  const sectionId = "smoke-sec";
  const questionId = `${legacyExamId}-q1`;

  const { error: examErr } = await client.from("exams").insert({
    id: examUuid,
    legacy_id: legacyExamId,
    institute_id: instituteId,
    title: "Smoke Exam",
    subtitle: "",
    exam_type: "JEE_MAIN",
    duration_minutes: 60,
    total_questions: 1,
    instructions: [],
    scheduled_at: new Date().toISOString(),
    is_published: false,
  });

  if (examErr) {
    console.log(`  ✗ exam insert: ${examErr.message}`);
    allOk = false;
  } else {
    const { error: secErr } = await client.from("exam_sections").insert({
      id: sectionId,
      exam_id: examUuid,
      institute_id: instituteId,
      name: "A",
      sort_order: 0,
    });
    const { error: qErr } = await client.from("exam_questions").insert({
      id: questionId,
      exam_id: examUuid,
      section_id: sectionId,
      institute_id: instituteId,
      question_number: 1,
      question_type: "MCQ_SINGLE",
      question_text: "Q1",
      options: [{ id: "o1", label: "A", text: "A" }],
      correct_option_id: "o1",
      marks: 4,
      negative_marks: 1,
      sort_order: 0,
    });

    if (secErr || qErr) {
      console.log(`  ✗ section/question: ${secErr?.message ?? qErr?.message}`);
      allOk = false;
    } else {
      const { data: readExam, error: readErr } = await client
        .from("exams")
        .select("legacy_id")
        .eq("id", examUuid)
        .maybeSingle();
      if (readErr || !readExam) {
        console.log(`  ✗ exam read: ${readErr?.message ?? "missing"}`);
        allOk = false;
      } else {
        console.log("  ✓ exam + section + question insert/read");
      }
    }

    await client.from("exams").delete().eq("id", examUuid);
    console.log("  ✓ exam cascade delete");
  }

  console.log("\n=== Result ===");
  if (allOk) {
    console.log("PASS — Supabase persistence layer is operational.");
    process.exit(0);
  } else {
    console.log("FAIL — See errors above. Run: npm run db:bootstrap");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
