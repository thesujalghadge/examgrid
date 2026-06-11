import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function patchQ5() {
  const legacyId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';
  const { data: examData } = await supabase.from('exams').select('id').eq('legacy_id', legacyId).single();
  
  const options = [
    { id: `${legacyId}-question-5-opt-A`, label: "A", text: "" },
    { id: `${legacyId}-question-5-opt-B`, label: "B", text: "" },
    { id: `${legacyId}-question-5-opt-C`, label: "C", text: "" },
    { id: `${legacyId}-question-5-opt-D`, label: "D", text: "" }
  ];

  await supabase.from('exam_questions').update({
    question_type: 'MCQ_SINGLE',
    options: options
  }).eq('exam_id', examData.id).eq('id', `${legacyId}-question-5`);
  
  console.log("Patched Q5");
}

patchQ5().catch(console.error);
