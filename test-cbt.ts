import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await client.from('cbt_attempts').select('*').limit(1);
  console.log('cbt_attempts:', data);
  if (error) console.error('Error fetching attempts:', error);

  if (data && data.length > 0) {
    const attempt = data[0];
    const { data: rpcData, error: rpcError } = await client.rpc('get_cbt_submission', {
      p_institute_id: attempt.institute_id,
      p_test_id: attempt.test_id,
      p_student_roll_number: attempt.student_roll_number
    });
    console.log('rpcData:', JSON.stringify(rpcData, null, 2));
    if (rpcError) console.error('rpcError:', rpcError);
  }
}

run();
