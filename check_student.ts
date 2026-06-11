import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: student } = await supabase.from('students').select('id, roll_number').eq('roll_number', 'CAM-JEE-26002').single();
  console.log("Student ID for CAM-JEE-26002:", student?.id);

  if (student) {
      const { data: attemptData } = await supabase.from('cbt_attempts').select('*').eq('student_id', student.id).order('created_at', { ascending: false }).limit(1).single();
      console.log("== LATEST ATTEMPT FOR THIS STUDENT ==");
      console.log(attemptData);

      if (attemptData) {
          const { data: answersData } = await supabase.from('cbt_attempt_answers').select('*').eq('attempt_id', attemptData.id).order('question_id');
          console.log("\n== cbt_attempt_answers ==");
          answersData?.forEach(ans => {
            console.log(`Q: ${ans.question_id.split('-').pop()} | Answer: ${ans.answer_text} | SavedAt: ${ans.saved_at}`);
          });

          const { data: resultData } = await supabase.from('cbt_results').select('*').eq('attempt_id', attemptData.id).single();
          console.log("\n== cbt_results ==");
          console.log(resultData);
      }
  }
}

check().catch(console.error);
