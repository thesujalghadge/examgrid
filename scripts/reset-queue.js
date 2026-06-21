const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  await supabase.from('solution_generation_queue').update({status: 'PENDING', next_retry_at: new Date().toISOString()}).in('status', ['WAITING_RETRY', 'VALIDATION_FAILED']);
  console.log('Reset queue');
}
run();
