import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function prepTest() {
  const testId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';

  const now = new Date();
  const startAt = new Date(now.getTime() - 2 * 60000).toISOString();
  const endAt = new Date(now.getTime() + 120 * 60000).toISOString();
  
  const { data: schedData, error: schedErr } = await supabase.from('exam_schedules').update({
    start_at: startAt,
    end_at: endAt
  }).eq('exam_id', testId);
  
  console.log("Updated schedule start_at to", startAt);
}

prepTest().catch(console.error);
