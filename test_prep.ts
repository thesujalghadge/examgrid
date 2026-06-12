import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function prep() {
  const testId = "cbt-55a81001-93b9-4e74-bd33-ff573ebcfdf1";
  
  console.log("Fetching student...");
  const { data: student, error: studentError } = await supabase.from('students').select('id, email').limit(1).single();
  if (studentError) {
    console.error("Student error:", studentError);
    return;
  }
  console.log("Student:", student);
  
  // Can we delete it without logging in? Let's try.
  console.log(`Deleting attempts for student ${student.id} and test ${testId}...`);
  const { error: delError } = await supabase.from('cbt_attempts').delete().eq('student_id', student.id).eq('test_id', testId);
  if (delError) {
     console.error("Delete attempt error:", delError);
  }
  const { error: delResultError } = await supabase.from('cbt_results').delete().eq('student_id', student.id).eq('test_id', testId);
  if (delResultError) {
     console.error("Delete result error:", delResultError);
  }

  console.log("Done.");
}

prep().catch(console.error);
