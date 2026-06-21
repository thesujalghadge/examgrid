import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceRegen() {
  console.log("Deleting old question_solutions...");
  const { error: delErr } = await supabase.from('question_solutions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.error("Error deleting solutions:", delErr.message);

  console.log("Resetting solution_generation_queue to PENDING...");
  const { error: updateErr } = await supabase.from('solution_generation_queue').update({ status: 'PENDING', attempts: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (updateErr) console.error("Error updating queue:", updateErr.message);

  console.log("Done.");
}
forceRegen();
