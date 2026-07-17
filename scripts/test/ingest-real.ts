import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Starting real ingestion script...");

  // 1. Fetch Institute
  const { data: insts } = await supabase.from('institutes').select('id, name').ilike('name', '%DEMO%');
  if (!insts || insts.length === 0) throw new Error("Demo institute not found");
  const instituteId = insts[0].id;
  console.log(`Found institute: ${instituteId}`);

  // 2. Read files
  const cropsMetaPath = 'public/uploads/cbt_assets/real_exam_1/crops_meta.json';
  const ansKeyPath = 'C:\\Users\\SOURAV\\Documents\\examgrid data demo\\jee main 2025 (22 shift1)\\JEE Main 2025 (22 Jan Shift 1) answerkey - Copy.txt';
  const responsesPath = 'C:\\Users\\SOURAV\\Documents\\examgrid data demo\\22 shift student response.txt';

  const meta = JSON.parse(fs.readFileSync(cropsMetaPath, 'utf8'));
  const crops = meta.questions; // array of { id, q_num, q_type, asset_path, question_text, options }

  const ansText = fs.readFileSync(ansKeyPath, 'utf8');
  const ansLines = ansText.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
  const answerKey: string[] = [];
  ansLines.forEach(l => {
    const [q, a] = l.split(',');
    if (q && a) answerKey[parseInt(q) - 1] = a.trim();
  });

  const studentText = fs.readFileSync(responsesPath, 'utf8');
  const students = [];
  const blocks = studentText.split('----------------------------------------------------');
  for (const block of blocks) {
    if (!block.trim() || block.includes('-----------------------------')) continue;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let name = lines[0].split(':')[0].trim();
    const answers = Array(75).fill(null);
    
    const firstAnsMatch = lines[0].match(/:\s*(\d+),\s*(\d*)/);
    if (firstAnsMatch) {
       const q = parseInt(firstAnsMatch[1]);
       const a = firstAnsMatch[2];
       if (a) answers[q-1] = a;
    }
    
    for(let i=1; i<lines.length; i++) {
       const parts = lines[i].split(',');
       if (parts.length === 2) {
         const q = parseInt(parts[0]);
         const a = parts[1].trim();
         if (a) answers[q-1] = a;
       }
    }
    students.push({ name, answers });
  }

  console.log(`Loaded ${crops.length} crops, ${answerKey.filter(Boolean).length} answers, ${students.length} students.`);

  // 3. Create Exam
  const examId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();
  const questionIds: string[] = [];
  const bankDbQuestions = [];
  const publishedEqRows = [];

  for (let i = 0; i < crops.length; i++) {
    const q = crops[i];
    const bankId = crypto.randomUUID();
    const examQId = crypto.randomUUID();
    questionIds.push(examQId);

    let type = 'MCQ_SINGLE';
    if (i >= 20 && i < 30) type = 'NUMERICAL';
    if (i >= 50 && i < 60) type = 'NUMERICAL';
    
    // Map answer (1,2,3,4 to A,B,C,D if MCQ)
    let correctAns = answerKey[i] || 'UNKNOWN';
    if (type === 'MCQ_SINGLE' && correctAns.length === 1) {
      if (correctAns === '1') correctAns = 'A';
      if (correctAns === '2') correctAns = 'B';
      if (correctAns === '3') correctAns = 'C';
      if (correctAns === '4') correctAns = 'D';
    }

    bankDbQuestions.push({
      id: bankId,
      institute_id: instituteId,
      question_type: type,
      question_text: q.question_text || `Question ${i+1}`,
      subject: i < 30 ? 'Mathematics' : i < 60 ? 'Physics' : 'Chemistry',
      chapter: 'General', // Fallback
      topic: 'General',
      difficulty: 'medium',
      options: q.options || {},
      correct_answer: correctAns
    });

    publishedEqRows.push({
      id: examQId,
      exam_id: examId,
      section_id: sectionId,
      bank_question_id: bankId,
      question_number: i + 1,
      institute_id: instituteId,
      question_type: type,
      marks: 4,
      negative_marks: type === 'NUMERICAL' ? 0 : 1,
      
      question_text: q.question_text || `Question ${i+1}`,
      published_options: q.options || {},
      published_answer_key: correctAns,
      published_at: new Date().toISOString(),
      published_image_url: q.asset_path
    });
  }

  console.log("Inserting Questions into Bank...");
  const { error: qErr } = await supabase.from('questions').insert(bankDbQuestions);
  if (qErr) throw new Error("Insert questions error: " + qErr.message);

  console.log("Inserting Exam...");
  const { error: eErr } = await supabase.from("exams").insert({
    id: examId,
    institute_id: instituteId,
    title: 'JEE Main 2025 (22 Jan Shift 1)',
    exam_type: 'JEE_MAIN',
    duration_minutes: 180,
    total_questions: crops.length,
    is_published: true,
    scheduled_at: new Date().toISOString()
  });
  if (eErr) throw new Error("Insert exam error: " + eErr.message);

  console.log("Inserting Exam Sections...");
  const { error: secErr } = await supabase.from("exam_sections").insert({
    id: sectionId,
    exam_id: examId,
    institute_id: instituteId,
    name: 'Main Section'
  });
  if (secErr) throw new Error("Insert section error: " + secErr.message);

  console.log("Inserting Exam Questions...");
  const { error: eqErr } = await supabase.from("exam_questions").insert(publishedEqRows);
  if (eqErr) throw new Error("Insert exam_questions error: " + eqErr.message);

  // Trigger Solution Generation
  console.log("Enqueuing solutions...");
  const queuePayloads = publishedEqRows.map(eq => ({
    exam_question_id: eq.id,
    institute_id: instituteId,
    status: 'PENDING'
  }));
  await supabase.from('solution_generation_queue').insert(queuePayloads);

  // Create Batch
  const batchId = crypto.randomUUID();
  await supabase.from('batches').upsert({ id: batchId, institute_id: instituteId, name: 'Real Validation Batch' }, { onConflict: 'id' });

  // Students & Submissions
  console.log("Inserting Student Attempts...");
  for (const stu of students) {
    const studentId = crypto.randomUUID();
    const roll = `ROLL-${studentId.substring(0,8)}`;
    await supabase.from('students').upsert({
      id: studentId,
      institute_id: instituteId,
      name: stu.name,
      full_name: stu.name,
      roll_number: roll,
      application_number: roll
    });

    const sessionId = crypto.randomUUID();
    const answersPayload: any = {};
    const answerKeyMap: any = {};

    let totalScore = 0;
    
    for (let i = 0; i < stu.answers.length; i++) {
      const eqId = questionIds[i];
      let ans = stu.answers[i];
      let type = publishedEqRows[i].question_type;
      
      if (ans) {
        if (type === 'MCQ_SINGLE' && ans.length === 1) {
          if (ans === '1') ans = 'A';
          if (ans === '2') ans = 'B';
          if (ans === '3') ans = 'C';
          if (ans === '4') ans = 'D';
        }
        answersPayload[eqId] = ans;
        
        // rudimentary score calculation for the RPC payload requirements
        let correct = answerKey[i] || 'UNKNOWN';
        if (type === 'MCQ_SINGLE' && correct.length === 1) {
          if (correct === '1') correct = 'A';
          if (correct === '2') correct = 'B';
          if (correct === '3') correct = 'C';
          if (correct === '4') correct = 'D';
        }
        
        answerKeyMap[eqId] = correct;
        
        if (ans === correct) totalScore += 4;
        else if (type === 'MCQ_SINGLE') totalScore -= 1;
      }
    }

    // Call RPC to submit attempt
    const resultBreakdown = {
      correct: 0,
      incorrect: 0,
      unattempted: 75, // mock
      attempted: 0,
      maxScore: 300,
      rawScore: totalScore,
      negativeMarks: 0,
      integrityPenalty: 0,
      finalScore: totalScore,
      durationSeconds: 10800,
      perQuestion: []
    };
    
    const { error: cbtErr } = await supabase.rpc('submit_cbt_attempt', {
      p_session_id: sessionId,
      p_test_id: examId,
      p_student_id: studentId,
      p_institute_id: instituteId,
      p_answers: answersPayload,
      p_result_breakdown: resultBreakdown,
      p_integrity_score: 100,
      p_status: 'submitted',
      p_started_at: new Date(Date.now() - 10800000).toISOString(),
      p_submitted_at: new Date().toISOString(),
      p_flagged: false,
    });

    if (cbtErr) {
      console.error(`Error submitting CBT for ${stu.name}:`, cbtErr.message);
    } else {
      console.log(`Submitted attempt for ${stu.name} (Score: ${totalScore})`);
    }
  }

  console.log("DONE!");
  console.log("Run Next.js server and `/api/internal/solution-worker` will process solutions.");
}

main().catch(console.error);
