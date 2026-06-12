require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const testId = "cbt-9762d28a-3bbe-42dd-895d-88f0c8a859cb-paper-1781206506027";
  
  // Find exam
  const { data: exams } = await supabase.from('exams').select('id, legacy_id').or(`id.eq.${testId},legacy_id.eq.${testId}`);
  if (!exams || exams.length === 0) {
    console.log("Exam not found in DB");
    return;
  }
  
  const examUuid = exams[0].id;
  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, question_type, correct_option_id, correct_numerical_answer, marks, negative_marks')
    .eq('exam_id', examUuid);
    
  console.log('ANSWER KEY FOR QUESTIONS 1, 5, 10:');
  const relevant = questions.filter(q => q.id.includes('question-1') || q.id.includes('question-5') || q.id.includes('question-10'));
  console.log(JSON.stringify(relevant, null, 2));
}
run();
