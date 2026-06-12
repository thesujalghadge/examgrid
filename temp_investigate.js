require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: attempts, error } = await supabase
    .from('cbt_attempts')
    .select('id, test_id, result_breakdown, submitted_at, answers:cbt_attempt_answers(question_id, selected_answer, is_correct, marks_awarded)')
    .order('submitted_at', { ascending: false })
    .limit(1);
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  if (!attempts || attempts.length === 0) {
    console.log('No attempts found');
    return;
  }
  
  console.log('LATEST ATTEMPT ID:', attempts[0].id);
  console.log('TEST ID:', attempts[0].test_id);
  console.log('ANSWERS DB RECORDS:', JSON.stringify(attempts[0].answers, null, 2));
  
  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, question_type, correct_option_id, correct_numerical_answer, marks, negative_marks')
    .eq('exam_id', attempts[0].test_id);
    
  console.log('EXAM QUESTIONS (Answer Key):', JSON.stringify(questions, null, 2));
  console.log('RESULT BREAKDOWN:', JSON.stringify(attempts[0].result_breakdown, null, 2));
}
run();
