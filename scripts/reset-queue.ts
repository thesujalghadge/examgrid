import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('solution_generation_queue')
    .update({ status: 'PENDING', attempts: 0, next_retry_at: null, failure_reason: null, failure_stage: null })
    .eq('status', 'WAITING_RETRY')
    .select('*');
    
  console.log("Reset jobs:", data?.length);
  if (error) console.error("Error:", error);
}
run();
