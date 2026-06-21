const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const examId = 'e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1';
  const { data: qs } = await s.from('exam_questions').select('id').eq('exam_id', examId);
  const qIds = qs.map(q => q.id);
  const qIdsStr = '(' + qIds.map(id => "'" + id + "'").join(',') + ')';
  await s.from('solution_generation_queue').update({ status: 'COMPLETED' }).not('question_id', 'in', qIdsStr);
  await s.from('solution_generation_queue').update({ status: 'PENDING', attempts: 0 }).in('question_id', qIds);
  console.log('Reset done for ' + examId);
}
run();
