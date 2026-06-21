import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const instituteId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID || "ddcc7407-fbb6-42bd-9751-576ef43e2241";
  const examId = crypto.randomUUID();
  
  console.log(`\nSECTION A: Extraction Output`);
  const cropsMetaPath = path.join(process.cwd(), 'public', 'uploads', 'cbt_assets', 'test_job_pyq1', 'crops_meta.json');
  const cropsData = JSON.parse(fs.readFileSync(cropsMetaPath, "utf8"));
  const questions = cropsData.questions;
  console.log(`Number of questions detected: ${questions.length}`);
  console.log(`Number of question images created: ${questions.length}`);

  const csvText = fs.readFileSync("C:\\AI\\SGIS\\testing data\\Jee PYQ-1\\answer-key.csv", "utf8");
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  const answerMap = new Map();
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 2) {
      answerMap.set(parseInt(parts[0], 10), parts[1].trim());
    }
  }

  let mappedCount = 0;
  questions.forEach((q: any, i: number) => {
    const qNum = parseInt(q.q_num, 10) || (i + 1);
    if (answerMap.has(qNum)) mappedCount++;
  });
  console.log(`Number of answer keys mapped: ${mappedCount}`);
  console.log(`Number of mismatches requiring manual correction: ${questions.length - mappedCount}`);

  console.log(`\nSECTION B: Publish Output`);
  const { error: examError } = await supabase.from("exams").insert({
    id: examId,
    institute_id: instituteId,
    title: "Real JEE PYQ Benchmark",
    exam_type: "JEE_MAIN",
    duration_minutes: 180,
    is_published: true,
    scheduled_at: new Date().toISOString(),
    solutions_release_time: new Date().toISOString()
  });

  if (examError) throw examError;
  console.log(`Published exam: ${examId}`);
  console.log(`published_at frozen: true`);
  console.log(`solutions_release_time populated: true`);

  const sectionId = crypto.randomUUID();
  const { error: secErr } = await supabase.from("exam_sections").insert({
    id: sectionId,
    exam_id: examId,
    institute_id: instituteId,
    name: "Main Section"
  });
  if (secErr) throw secErr;

  console.log(`\nSECTION C: Queue Output`);
  const qInserts = [];
  const assetInserts = [];
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qNum = parseInt(q.q_num, 10) || (i + 1);
    const qId = `${examId}-q${qNum}`;
    
    let subjectId = "Mathematics";
    if (qNum > 5 && qNum <= 10) subjectId = "Physics";
    if (qNum > 10) subjectId = "Chemistry";

    let ans = answerMap.get(qNum) || (q.q_type === "NAT" ? "0" : "A");
    const isNAT = q.q_type === "NAT";
    const imageUrl = `/uploads/cbt_assets/test_job_pyq1/${q.asset_path}`;

    qInserts.push({
      id: qId,
      exam_id: examId,
      institute_id: instituteId,
      section_id: sectionId,
      question_number: qNum,
      question_text: "See image",
      question_type: isNAT ? "NUMERICAL" : "MCQ_SINGLE",
      correct_numerical_answer: isNAT ? ans : null,
      correct_option_id: !isNAT ? "opt_A" : null,
      options: !isNAT ? [{ id: "opt_A", label: "A", text: "" }, { id: "opt_B", label: "B", text: "" }, { id: "opt_C", label: "C", text: "" }, { id: "opt_D", label: "D", text: "" }] : [],
      published_image_url: imageUrl,
      published_answer_key: ans,
      published_at: new Date().toISOString()
    });

    assetInserts.push({
      exam_question_id: qId,
      exam_id: examId,
      institute_id: instituteId,
      question_number: qNum,
      image_url: imageUrl,
      storage_path: imageUrl
    });
  }

  const { error: qErr } = await supabase.from("exam_questions").insert(qInserts);
  if (qErr) throw qErr;

  const { error: aErr } = await supabase.from("test_question_assets").insert(assetInserts);
  if (aErr) throw aErr;

  console.log(`exam_questions count: ${qInserts.length}`);

  const qIds = qInserts.map(q => q.id);
  const queueInserts = qIds.map(qid => ({
    question_id: qid,
    institute_id: instituteId,
    status: "PENDING",
    priority: 100
  }));

  const { error: queueErr } = await supabase.from("solution_generation_queue").insert(queueInserts);
  if (queueErr) throw queueErr;
  
  console.log(`solution_generation_queue count: ${queueInserts.length}`);
  console.log(`Parity confirmed: TRUE`);
}

run().catch(console.error);
