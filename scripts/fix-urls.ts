import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: questions } = await supabase.from('exam_questions').select('id, published_image_url').like('published_image_url', '%/uploads/cbt_assets/test_job_pyq1/%');
  
  if (questions) {
    for (const q of questions) {
      if (q.published_image_url && q.published_image_url.startsWith('/uploads/cbt_assets/test_job_pyq1//uploads/cbt_assets/test_job_pyq1/')) {
        const newUrl = q.published_image_url.replace('/uploads/cbt_assets/test_job_pyq1//uploads/cbt_assets/test_job_pyq1/', '/uploads/cbt_assets/test_job_pyq1/');
        await supabase.from('exam_questions').update({ published_image_url: newUrl }).eq('id', q.id);
        console.log(`Updated ${q.id} to ${newUrl}`);
      }
    }
  }

  // Also reset the queue again!
  const { data, error } = await supabase
    .from('solution_generation_queue')
    .update({ status: 'PENDING', attempts: 0, next_retry_at: null, failure_reason: null, failure_stage: null })
    .in('status', ['WAITING_RETRY', 'FAILED', 'PENDING'])
    .select('id');
    
  console.log(`Reset ${data?.length} queue jobs.`);
}
run();
