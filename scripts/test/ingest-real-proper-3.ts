import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const INSTITUTE_ID = 'bd3fb232-98ea-480e-a80e-6cc991e38fb1';

function evaluateStudent(studentName: string, responseBlock: string, answerKey: Record<string, string>, allQuestionIds: string[]) {
  const lines = responseBlock.split('\n').map(l => l.trim()).filter(l => l && !l.includes(studentName));
  const studentAnswers = new Map<string, string>();
  
  for (const line of lines) {
    let qIndex, ans;
    if (line.includes(':')) {
      const parts = line.split(':');
      const val = parts[parts.length - 1].trim();
      [qIndex, ans] = val.split(',');
    } else {
      [qIndex, ans] = line.split(',');
    }
    if (qIndex && ans) {
      studentAnswers.set(qIndex.trim(), ans.trim());
    }
  }

  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let rawScore = 0;
  const answersPayload: Record<string, string | null> = {};

  allQuestionIds.forEach((qId, i) => {
    const qIndexStr = (i + 1).toString();
    const correctAns = answerKey[qIndexStr];
    const studentAns = studentAnswers.get(qIndexStr);

    if (!studentAns) {
      unattempted++;
      answersPayload[qId] = null;
    } else {
      answersPayload[qId] = studentAns;
      if (studentAns === correctAns) {
        correct++;
        rawScore += 4;
      } else {
        incorrect++;
        // Determine if it's numerical. Usually Q21-30 are numerical for each subject.
        // For simplicity, let's just do -1 for all incorrect as a generic proxy, or we can assume if answer has >1 character it might be numerical.
        // MathonGo format usually: options 1,2,3,4 are MCQ. Anything else is numerical.
        const isNumerical = correctAns.length > 1 || !['1','2','3','4'].includes(correctAns);
        if (!isNumerical) {
          rawScore -= 1;
        }
      }
    }
  });

  return {
    breakdown: {
      correct,
      incorrect,
      unattempted,
      attempted: correct + incorrect,
      maxScore: allQuestionIds.length * 4, // roughly 300
      rawScore,
      negativeMarks: 0,
      integrityPenalty: 0,
      finalScore: rawScore,
      durationSeconds: 10800,
      perQuestion: [] // can be filled but not strictly required by DB schema for basic analytics
    },
    answersPayload,
    totalScore: rawScore
  };
}

async function main() {
  console.log('Starting Proper Validation Data Ingestion...');

  // 1. Read Answer Key
  const ansKeyPath = "C:\\Users\\SOURAV\\Documents\\examgrid data demo\\jee main 2025 (24 shift1)\\JEE Main 2025 (24 Jan Shift 1) answerkey.txt";
  const ansContent = fs.readFileSync(ansKeyPath, 'utf-8');
  const ansLines = ansContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('question_id'));
  const answerKeyMap: Record<string, string> = {};
  for (const line of ansLines) {
    const [qIndex, ans] = line.split(',');
    if (qIndex && ans) {
      answerKeyMap[qIndex] = ans;
    }
  }

  // 2. Read Student Responses
  const responsePath = "C:\\Users\\SOURAV\\Documents\\examgrid data demo\\24 shift student response.txt";
  const resContent = fs.readFileSync(responsePath, 'utf-8');
  
  // Custom parsing based on the file format you provided
  const blocks = resContent.split(/---+\n?/);
  
  // 3. Prepare Crops & Database Entities
  const cropsPath = path.join(process.cwd(), 'public', 'uploads', 'cbt_assets', 'real_exam_3', 'crops_meta.json');
  const cropsMeta = JSON.parse(fs.readFileSync(cropsPath, 'utf-8'));
  const crops = cropsMeta.questions;

  const examId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();

  // Create Exam
  console.log('Inserting Clean Exam...');
  const { error: eErr } = await supabase.from('exams').insert({
    id: examId,
    institute_id: INSTITUTE_ID,
    title: 'JEE Main 2025 (24 Jan Shift 1) - Production Validation',
    exam_type: 'JEE_MAIN',
    duration_minutes: 180,
    total_questions: crops.length,
    is_published: true,
    scheduled_at: new Date().toISOString()
  });
  if (eErr) throw new Error("Exam Insert Failed: " + JSON.stringify(eErr));

  // Create Section
  console.log('Inserting Exam Section...');
  await supabase.from('exam_sections').insert({
    id: sectionId,
    exam_id: examId,
    institute_id: INSTITUTE_ID,
    name: 'Main Section'
  });

  // Create Questions
  console.log('Inserting Exam Questions...');
  const publishedEqRows: any[] = [];
  const allQuestionIds: string[] = [];

  for (let i = 0; i < crops.length; i++) {
    const q = crops[i];
    const qId = crypto.randomUUID();
    allQuestionIds.push(qId);
    
    // Add to question bank first
    const bId = crypto.randomUUID();
    const correctAns = answerKeyMap[(i + 1).toString()] || '1';

    const { error: qErr } = await supabase.from('questions').insert({
      id: bId,
      institute_id: INSTITUTE_ID,
      question_type: correctAns.length > 1 || !['1','2','3','4'].includes(correctAns) ? 'NUMERICAL' : 'MCQ_SINGLE',
      subject: 'PHYSICS',
      difficulty: 'medium',
      correct_answer: correctAns,
      question_text: `Question ${i + 1}`,
      metadata: { published_image_url: q.filename ? `/uploads/cbt_assets/real_exam_3/${q.filename}` : null }
    });
    if (qErr) {
      console.error('Questions Insert Failed:', qErr);
      throw new Error("Questions Insert Failed");
    }
    
    publishedEqRows.push({
      id: qId,
      exam_id: examId,
      section_id: sectionId,
      bank_question_id: bId,
      question_number: i + 1,
      institute_id: INSTITUTE_ID,
      question_type: correctAns.length > 1 || !['1','2','3','4'].includes(correctAns) ? 'NUMERICAL' : 'MCQ_SINGLE',
      marks: 4,
      negative_marks: correctAns.length > 1 || !['1','2','3','4'].includes(correctAns) ? 0 : 1,
      question_text: `Question ${i + 1}`,
      published_options: {},
      published_answer_key: correctAns,
      published_at: new Date().toISOString(),
      published_image_url: q.filename ? `/uploads/cbt_assets/real_exam_3/${q.filename}` : null
    });
  }

  const { error: eqErr } = await supabase.from('exam_questions').insert(publishedEqRows);
  if (eqErr) throw new Error("Questions Insert Failed: " + JSON.stringify(eqErr));

  // Schedule the Exam
  console.log('Scheduling Exam...');
  const scheduleId = crypto.randomUUID();
  await supabase.from('exam_schedules').insert({
    id: scheduleId,
    exam_id: examId,
    institute_id: INSTITUTE_ID,
    start_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 180,
    is_active: true
  });

  const { data: batches } = await supabase.from('batches').select('id').eq('institute_id', INSTITUTE_ID);
  if (batches && batches.length > 0) {
    const batchInserts = batches.map(b => ({
      schedule_id: scheduleId,
      batch_id: b.id,
      institute_id: INSTITUTE_ID
    }));
    await supabase.from('exam_schedule_batches').insert(batchInserts);
  }

  // 4. Submit Student Attempts
  console.log('Submitting Real Student Attempts...');
  
  // Mappings to find the right student_id
  const studentMap: Record<string, string> = {
    'topper': '26JEE001',
    'above average': '26JEE002',
    'average': '26JEE003',
    'below average': '26JEE004',
    'noob': '26JEE005'
  };

  const { data: students } = await supabase.from('students').select('id, roll_number').eq('institute_id', INSTITUTE_ID);

  for (const block of blocks) {
    const blockTrim = block.trim();
    if (!blockTrim) continue;

    let studentLabel = '';
    for (const key of Object.keys(studentMap)) {
      if (blockTrim.toLowerCase().startsWith(key.toLowerCase())) {
        studentLabel = key;
        break;
      }
    }
    if (!studentLabel) continue;

    const roll = studentMap[studentLabel];
    const studentRec = students?.find(s => s.roll_number === roll);
    if (!studentRec) continue;

    const { breakdown, answersPayload, totalScore } = evaluateStudent(studentLabel, blockTrim, answerKeyMap, allQuestionIds);
    const sessionId = crypto.randomUUID();

    console.log(`Submitting for ${studentLabel} - Score Calculated: ${totalScore}`);

    const { error: cbtErr } = await supabase.rpc('submit_cbt_attempt', {
      p_session_id: sessionId,
      p_test_id: examId,
      p_student_id: studentRec.id,
      p_institute_id: INSTITUTE_ID,
      p_answers: answersPayload,
      p_result_breakdown: breakdown,
      p_integrity_score: 100,
      p_status: 'submitted',
      p_started_at: new Date(Date.now() - 10800000).toISOString(),
      p_submitted_at: new Date().toISOString(),
      p_flagged: false,
    });

    if (cbtErr) {
      console.error(`Error submitting for ${studentLabel}:`, cbtErr);
    }
  }

  console.log('Data ingestion complete! Waking up background workers...');
  
  try {
    const headers = { 'Authorization': 'Bearer CRON_SECRET' };
    await fetch('http://localhost:3000/api/internal/solution-worker', { method: 'GET', headers });
    await fetch('http://localhost:3000/api/internal/analytics/trigger-worker', { method: 'POST', headers });
    console.log('Background workers triggered successfully.');
  } catch (e) {
    console.log('Note: Could not automatically trigger background workers. Ensure Next.js dev server is running, or trigger manually.', e.message);
  }

  console.log('DONE!');
}

main().catch(console.error);
