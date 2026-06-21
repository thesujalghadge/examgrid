import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";
import crypto from "crypto";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const pdfPath = "C:\\AI\\SGIS\\testing data\\Jee PYQ-3\\pyq3.pdf";
  const csvPath = "C:\\AI\\SGIS\\testing data\\Jee PYQ-3\\answer-key-3.csv";
  
  if (!fs.existsSync(pdfPath)) throw new Error("PDF not found: " + pdfPath);
  if (!fs.existsSync(csvPath)) throw new Error("CSV not found: " + csvPath);

  const buffer = fs.readFileSync(pdfPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const jobId = `vision_job_${hash.substring(0, 16)}_v4`;
  const cbtAssetsDir = path.join(process.cwd(), 'public', 'uploads', 'cbt_assets', jobId);
  const cropsMetaPath = path.join(cbtAssetsDir, 'crops_meta.json');
  
  if (!fs.existsSync(cropsMetaPath)) {
    console.log("Running vision orchestrator...");
    execSync(`python scripts/pipeline/vision_orchestrator.py "${pdfPath}" ${jobId} mock_key`, { stdio: 'inherit' });
  } else {
    console.log("Using cached crops_meta.json");
  }

  const cropsData = JSON.parse(fs.readFileSync(cropsMetaPath, "utf-8"));
  const crops = cropsData.questions || cropsData;
  
  // Read CSV
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const answers: Record<string, string> = {};
  csvText.split('\n').forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 2) {
      answers[parts[0].trim()] = parts[1].trim();
    }
  });

  const instituteId = "babb0669-a6ec-454f-923a-440f0144f68f";
  const examId = "72a98ee6-1fda-45ab-bd5f-8a9d81ec6dee"; // I will use a NEW exam ID! wait, let's keep it random.
  const newExamId = crypto.randomUUID();

  let examErr = await supabase.from("exams").insert({
    id: newExamId,
    institute_id: instituteId,
    title: "JEE PYQ-3",
    subtitle: "Automated test upload for JEE PYQ-3",
    is_published: false,
    exam_type: "JEE_MAIN",
    duration_minutes: 180,
    scheduled_at: new Date().toISOString(),
    total_questions: 15
  });
  if (examErr.error) console.error("Exam Error", examErr.error);

  const sectionPhysics = crypto.randomUUID();
  const sectionChem = crypto.randomUUID();
  const sectionMath = crypto.randomUUID();

  let secErr = await supabase.from("exam_sections").insert([
    { id: sectionPhysics, exam_id: newExamId, name: "Physics", sort_order: 1, institute_id: instituteId },
    { id: sectionChem, exam_id: newExamId, name: "Chemistry", sort_order: 2, institute_id: instituteId },
    { id: sectionMath, exam_id: newExamId, name: "Mathematics", sort_order: 3, institute_id: instituteId }
  ]);
  if (secErr.error) console.error("Section Error", secErr.error);

  let qNumber = 1;
  const dbQuestions = [];

  for (const crop of crops) {
    if (crop.type && crop.type !== "question") continue;
    
    // Assign subject based on question number (1-5 Math, 6-10 Phys, 11-15 Chem etc based on standard order? No, let's just put them anywhere or spread them evenly)
    let sectionId = sectionPhysics;
    if (qNumber > 5 && qNumber <= 10) sectionId = sectionChem;
    if (qNumber > 10) sectionId = sectionMath;
    
    const ansKey = answers[qNumber.toString()] || "A";
    let qType = "MCQ_SINGLE";
    if (!["A","B","C","D"].includes(ansKey.toUpperCase())) {
       qType = "NUMERICAL";
    }

    const options = [
      { id: `opt-A-${qNumber}`, label: "A", text: "A" },
      { id: `opt-B-${qNumber}`, label: "B", text: "B" },
      { id: `opt-C-${qNumber}`, label: "C", text: "C" },
      { id: `opt-D-${qNumber}`, label: "D", text: "D" },
      { id: "__metadata__", text: JSON.stringify({
          stemImage: `/uploads/cbt_assets/${jobId}/vision_crops/${crop.file || crop.id + '_crop.jpg'}`,
          hasImage: true,
          images: []
        }), label: "__metadata__" }
    ];

    dbQuestions.push({
      id: crypto.randomUUID(),
      exam_id: newExamId,
      section_id: sectionId,
      institute_id: instituteId,
      question_number: qNumber,
      question_type: qType,
      options: options,
      question_text: "",
      correct_option_id: qType === "MCQ_SINGLE" ? `opt-${ansKey.toUpperCase()}-${qNumber}` : null,
      correct_numerical_answer: qType === "NUMERICAL" ? ansKey : null,
      marks: 4,
      negative_marks: 1,
      sort_order: qNumber,
      published_answer_key: ansKey
    });
    
    qNumber++;
  }

  let qErr = await supabase.from("exam_questions").insert(dbQuestions);
  if (qErr.error) console.error("Question Error", qErr.error);

  console.log("Inserted exam and questions. Now publishing...");

  const res = await fetch(`http://localhost:3000/api/institute/${instituteId}/tests/${newExamId}/publish`, {
    method: "POST"
  });
  
  const text = await res.text();
  console.log("Publish result:", text);
}

run().catch(console.error);
