import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting e2e backend test...");

  // Use the institute that has the Gemini API Key
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";

  const answerKeyText = fs.readFileSync("C:\\AI\\SGIS\\testing data\\3 question test\\answerkey.txt", "utf-8");
  const { parseAnswerKeyForTest } = require("../src/lib/cbt/paper-processing");
  const parsedAnswers = parseAnswerKeyForTest(answerKeyText);
  const answerMap = new Map<number, string>();
  parsedAnswers.forEach((entry: any) => answerMap.set(entry.questionNumber, entry.answer));

  const jobId = "my_test_job_id";
  const cropsMetaPath = path.join(process.cwd(), "public", "uploads", "cbt_assets", jobId, "crops_meta.json");
  const cropsMeta = JSON.parse(fs.readFileSync(cropsMetaPath, "utf8"));

  const examId = crypto.randomUUID();
  const { error: examErr } = await supabase.from("exams").insert({
    id: examId,
    institute_id: instituteId,
    title: "E2E Backend Test (PDF)",
    exam_type: "JEE_MAIN",
    duration_minutes: 60,
    scheduled_at: new Date().toISOString(),
    is_published: true
  });
  if (examErr) throw new Error(`Exam insert failed: ${examErr.message}`);

  const sectionId = crypto.randomUUID();
  const { error: secErr } = await supabase.from("exam_sections").insert({
    id: sectionId,
    exam_id: examId,
    institute_id: instituteId,
    name: "Main Section",
    sort_order: 1
  });
  if (secErr) throw new Error(`Exam section insert failed: ${secErr.message}`);

  const qIds: string[] = [];
  for (let i = 0; i < cropsMeta.questions.length; i++) {
    const q = cropsMeta.questions[i];
    const qNum = Number(q.q_num) || (i + 1);
    const qId = crypto.randomUUID();
    qIds.push(qId);
    const imageUrl = `/uploads/cbt_assets/${jobId}/${q.crop_image}`;
    const teacherKey = answerMap.get(qNum) || "MISSING";

    const { error: eqErr } = await supabase.from("exam_questions").insert({
      id: qId,
      exam_id: examId,
      section_id: sectionId,
      institute_id: instituteId,
      question_type: "MCQ_SINGLE",
      question_text: `Mock question ${qNum}`,
      question_number: qNum,
      published_image_url: imageUrl,
      published_answer_key: teacherKey,
      published_at: new Date().toISOString(),
      sort_order: qNum
    });
    if (eqErr) throw new Error(`Exam question insert failed: ${eqErr.message}`);
  }

  console.log("Enqueuing solutions...");
  const queueItems = qIds.map(qid => ({
    question_id: qid,
    institute_id: instituteId,
    status: 'PENDING',
    priority: 100,
    attempts: 0
  }));

  const { error } = await supabase.from('solution_generation_queue').insert(queueItems);
  if (error) {
    console.error("Queue insert error:", error);
  } else {
    console.log(`Enqueued ${queueItems.length} jobs.`);
  }

  console.log("Done seeding.");
}

run().catch(console.error);
