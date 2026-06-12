import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const testId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';
  const studentId = '44444444-4444-4444-8444-444444444402';

  const { data: attemptData } = await supabase.from('cbt_attempts').select('*').eq('test_id', testId).eq('student_id', studentId).single();
  console.log("== cbt_attempts.answers ==");
  console.log(JSON.stringify(attemptData?.answers, null, 2));

  if (!attemptData) {
     console.log("No attempt found!"); return;
  }

  const { data: answersData } = await supabase.from('cbt_attempt_answers').select('*').eq('attempt_id', attemptData.id).order('question_id');
  console.log("\n== cbt_attempt_answers ==");
  answersData?.forEach(ans => {
    console.log(`Q: ${ans.question_id.split('-').pop()} | Answer: ${ans.answer_text} | SavedAt: ${ans.saved_at}`);
  });

  const { data: resultData } = await supabase.from('cbt_results').select('*').eq('attempt_id', attemptData.id).single();
  console.log("\n== cbt_results ==");
  console.log(JSON.stringify(resultData, null, 2));
}

check().catch(console.error);
