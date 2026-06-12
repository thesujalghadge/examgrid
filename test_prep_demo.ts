import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function prep() {
  const testId = "demo-neet-upcoming";
  const studentId = "44444444-4444-4444-8444-444444444402";

  console.log(`Deleting attempts for student ${studentId} and test ${testId}...`);
  await supabase.from('cbt_attempts').delete().eq('student_id', studentId).eq('test_id', testId);
  console.log("Done.");
}

prep().catch(console.error);
