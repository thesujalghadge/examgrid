import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function prepTest() {
  const testId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';

  const now = new Date();
  const startAt = new Date(now.getTime() - 5 * 60000).toISOString();
  const endAt = new Date(now.getTime() + 120 * 60000).toISOString();
  
  const { data: schedData, error: schedErr } = await supabase.from('exam_schedules').update({
    institute_id: '00000000-0000-0000-0000-000000000001',
    start_at: startAt,
    end_at: endAt,
    visibility_rule: 'all_active_students'
  }).eq('exam_id', testId);
  
  console.log("Updated schedule:", schedErr || "success");

  // Clear previous attempts for student
  await supabase.from('cbt_attempts').delete().eq('student_id', '44444444-4444-4444-8444-444444444402').eq('test_id', testId);
  
  console.log("Test prepped for student:", testId);
}

prepTest().catch(console.error);
