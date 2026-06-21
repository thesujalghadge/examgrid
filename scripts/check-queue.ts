import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('solution_generation_queue').select('*');
  console.log("Total jobs:", data?.length);
  if (data?.length) {
    const statuses = data.reduce((acc: any, val: any) => {
      acc[val.status] = (acc[val.status] || 0) + 1;
      return acc;
    }, {});
    console.log("Statuses:", statuses);
    console.log("First job:", data[0]);
  }
}
run();
