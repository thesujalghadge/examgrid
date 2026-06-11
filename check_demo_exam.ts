import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: tests, error } = await supabase.from('cbt_tests').select('*').eq('id', 'demo-neet-upcoming');
  console.log("CBT Test demo-neet-upcoming:", tests);
  
  const { data: exams, error: err2 } = await supabase.from('exams').select('*').eq('id', 'demo-neet-upcoming');
  console.log("Exam demo-neet-upcoming:", exams);
}

check().catch(console.error);
