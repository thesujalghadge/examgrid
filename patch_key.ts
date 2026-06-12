import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function patchKey() {
  const legacyId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';
  const { data: examData } = await supabase.from('exams').select('id').eq('legacy_id', legacyId).single();
  const examId = examData.id;

  // Q1 -> A
  await supabase.from('exam_questions').update({ correct_option_id: `${legacyId}-question-1-opt-A`, marks: 4, negative_marks: 1 }).eq('exam_id', examId).eq('id', `${legacyId}-question-1`);
  // Q2 -> B
  await supabase.from('exam_questions').update({ correct_option_id: `${legacyId}-question-2-opt-B`, marks: 4, negative_marks: 1 }).eq('exam_id', examId).eq('id', `${legacyId}-question-2`);
  // Q3 -> C
  await supabase.from('exam_questions').update({ correct_option_id: `${legacyId}-question-3-opt-C`, marks: 4, negative_marks: 1 }).eq('exam_id', examId).eq('id', `${legacyId}-question-3`);
  // Q4 -> A
  await supabase.from('exam_questions').update({ correct_option_id: `${legacyId}-question-4-opt-A`, marks: 4, negative_marks: 1 }).eq('exam_id', examId).eq('id', `${legacyId}-question-4`);
  // Q5 -> D
  await supabase.from('exam_questions').update({ correct_option_id: `${legacyId}-question-5-opt-D`, marks: 4, negative_marks: 1 }).eq('exam_id', examId).eq('id', `${legacyId}-question-5`);

  console.log("Patched Answer Key");
}

patchKey().catch(console.error);
