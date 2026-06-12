import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function prepTest() {
  const legacyId = 'cbt-20aa8688-cd2e-4f3e-bb83-0a0509faf5e1-paper-1781086077049';

  const { data: examData, error: examErr } = await supabase.from('exams').update({
    institute_id: '00000000-0000-0000-0000-000000000001'
  }).eq('legacy_id', legacyId);
  console.log("Updated exam:", examErr || "success");

}

prepTest().catch(console.error);
