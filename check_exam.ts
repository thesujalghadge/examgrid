import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: tests, error } = await supabase.from('cbt_tests').select('id, title').eq('id', 'cbt-55a81001-93b9-4e74-bd33-ff573ebcfdf1');
  console.log("CBT Test:", tests);
  
  const { data: exams, error: err2 } = await supabase.from('exams').select('id, title').eq('id', 'cbt-55a81001-93b9-4e74-bd33-ff573ebcfdf1');
  console.log("Exam:", exams);
}

check().catch(console.error);
