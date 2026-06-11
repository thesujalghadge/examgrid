import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: tests, error } = await supabase.from('cbt_tests').select('id, title');
  console.log("CBT Tests:", tests);
  
  const { data: schedules, error: err2 } = await supabase.from('exam_schedules').select('*');
  console.log("Schedules:", schedules);
}

check().catch(console.error);
