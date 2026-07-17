import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: sb } = await supabase.from('exam_schedules').select('*');
  console.log('Exam schedules:', sb);
  
  const { data: batches } = await supabase.from('exam_schedule_batches').select('*');
  console.log('Exam schedule batches:', batches);
}
run();
