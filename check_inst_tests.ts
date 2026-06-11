import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: schedules, error: err2 } = await supabase.from('exam_schedules').select('*').eq('institute_id', '00000000-0000-0000-0000-000000000001');
  console.log("Schedules for institute:", schedules);
}

check().catch(console.error);
