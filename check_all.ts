import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: students } = await supabase.from('students').select('*');
  console.log("Students:", students);
  
  const { data: attempts } = await supabase.from('cbt_attempts').select('*');
  console.log("All Attempts:", attempts);
}

check().catch(console.error);
