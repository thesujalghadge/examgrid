import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: exams, error: examError } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });
  
  console.log("Exams:");
  exams?.forEach(e => console.log(`- ${e.title} (${e.id}) [${e.status}]`));
}

run().catch(console.error);
