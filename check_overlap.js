require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: exams } = await supabase.from('exams').select('id, legacy_id, title').order('created_at', { ascending: false }).limit(1);
  const exam = exams[0];
  const { data: questions } = await supabase.from('exam_questions').select('id, bank_question_id').eq('exam_id', exam.id);
  const qIds = questions.map(q => q.id);
  
  const { data: solutions } = await supabase.from('question_solutions').select('id, question_id, is_active, generation_status').in('question_id', qIds);
  console.log(`Matching solutions in question_solutions for this exam: ${solutions.length}`);
  
  const { data: queue } = await supabase.from('solution_generation_queue').select('id, question_id, status').in('question_id', qIds);
  console.log(`Matching queue items for this exam: ${queue.length}`);
}
run();
