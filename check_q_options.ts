import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const legacyId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';

  // get exam id
  const { data: examData, error: examErr } = await supabase.from('exams').select('id').eq('legacy_id', legacyId).single();
  if (examErr || !examData) {
     console.error(examErr); return;
  }
  const examId = examData.id;

  const { data: qData, error: qErr } = await supabase.from('exam_questions').select('id, question_type, options').eq('exam_id', examId).limit(5);
  console.log("Questions:", JSON.stringify(qData, null, 2));
}

check().catch(console.error);
