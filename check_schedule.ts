import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: schedules, error } = await supabase.from('exam_schedules').select('*').eq('exam_id', 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049');
  console.log("Schedules:", schedules);
}

check().catch(console.error);
