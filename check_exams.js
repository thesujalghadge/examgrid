require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: exams } = await supabase.from('exams').select('id, legacy_id, title').order('created_at', { ascending: false }).limit(5);
  for (const exam of exams) {
    const { data: questions } = await supabase.from('exam_questions').select('id').eq('exam_id', exam.id);
    const qIds = questions.map(q => q.id);
    
    if (qIds.length === 0) continue;
    
    const { data: solutions } = await supabase.from('question_solutions').select('id').in('question_id', qIds).eq('generation_status', 'COMPLETED');
    const { data: queue } = await supabase.from('solution_generation_queue').select('id').in('question_id', qIds);
    
    console.log(`Exam ${exam.legacy_id}: Total ${qIds.length}, Queue ${queue.length}, Completed ${solutions.length}`);
  }
}
run();
