import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Must use service role key to update bypassing RLS or if RLS allows it
const supabaseKey = process.env.SUPABASE_ACCESS_TOKEN!; // wait we need service role or use Anon
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateSchedule() {
  const now = new Date();
  const startAt = new Date(now.getTime() - 5 * 60000).toISOString(); // 5 mins ago
  const endAt = new Date(now.getTime() + 120 * 60000).toISOString(); // 2 hours from now

  const { data, error } = await supabase.from('exam_schedules')
    .update({ start_at: startAt, end_at: endAt })
    .eq('exam_id', 'demo-neet-upcoming')
    .eq('institute_id', '00000000-0000-0000-0000-000000000001');

  if (error) {
    console.error("Failed to update schedule:", error);
  } else {
    console.log("Successfully updated schedule for demo-neet-upcoming");
  }
}

updateSchedule().catch(console.error);
