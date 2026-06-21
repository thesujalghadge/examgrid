require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: exams } = await supabase.from('exams').select('id, legacy_id, title').order('created_at', { ascending: false }).limit(5);
  console.log("Recent exams:");
  console.log(exams);
  
  if (exams.length > 0) {
    const exam = exams[0];
    const { data: questions } = await supabase.from('exam_questions').select('id').eq('exam_id', exam.id);
    const qIds = questions.map(q => q.id);
    console.log(`Exam ${exam.id} (${exam.legacy_id}) has ${qIds.length} questions.`);
    
    const { data: solutions } = await supabase.from('question_solutions').select('id, question_id, is_active, generation_status').in('question_id', qIds);
    console.log(`Exam ${exam.id} has ${solutions.length} solutions.`);
    if (solutions.length > 0) {
      console.log('Sample solution question_id:', solutions[0].question_id, 'Type:', typeof solutions[0].question_id);
      console.log('Sample exam question_id:', qIds[0], 'Type:', typeof qIds[0]);
    } else {
      // Check if solutions exist without matching UUID perfectly?
      const { data: anySols } = await supabase.from('question_solutions').select('id, question_id').limit(5);
      console.log("Random solutions:");
      console.log(anySols);
    }
  }
}
run();
