require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("No URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const qs = await supabase.from('question_solutions').select('id, question_id, is_active, generation_status');
  console.log('Solutions:', qs.data?.length || 0);
  if (qs.data && qs.data.length > 0) {
    console.log(qs.data.slice(0, 5));
  }
  
  const queue = await supabase.from('solution_generation_queue').select('*');
  console.log('Queue:', queue.data?.length || 0);
  if (queue.data && queue.data.length > 0) {
    console.log(queue.data.slice(0, 5));
  }

  const exams = await supabase.from('exams').select('id, title, is_published');
  console.log('Exams:', exams.data?.length || 0);
  
  const events = await supabase.from('solution_generation_events').select('*');
  console.log('Events:', events.data?.length || 0);
}
run();
