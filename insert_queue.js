const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const examId = 'e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1';
  const { data: qs } = await s.from('exam_questions').select('id, institute_id').eq('exam_id', examId);
  for (const q of qs) {
    const { data: existing } = await s.from('solution_generation_queue').select('id').eq('question_id', q.id);
    if (!existing || existing.length === 0) {
      await s.from('solution_generation_queue').insert({
        question_id: q.id,
        institute_id: q.institute_id,
        status: 'PENDING',
        priority: 1,
        attempts: 0
      });
    } else {
      await s.from('solution_generation_queue').update({ status: 'PENDING', attempts: 0 }).eq('question_id', q.id);
    }
  }
  console.log('Inserted/Updated queue for ' + examId);
}
run();
