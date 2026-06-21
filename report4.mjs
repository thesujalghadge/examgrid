import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: queue } = await supabase.from('solution_generation_queue').select('*').limit(1);
  const { data: sol } = await supabase.from('question_solutions').select('*').limit(1);
  console.log("Queue fields:", queue ? Object.keys(queue[0] || {}) : "none");
  console.log("Solution fields:", sol ? Object.keys(sol[0] || {}) : "none");
  if (queue?.[0]) console.log("Queue metadata:", queue[0].metadata);
}

run().catch(console.error);
