import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('solution_generation_queue').select('*').eq('institute_id', 'ddcc7407-fbb6-42bd-9751-576ef43e2241').order('created_at', { ascending: false }).limit(15);
  
  if (data) {
    console.log("SECTION F: List ALL failed questions with exact failure reason.");
    data.forEach(job => {
      console.log(`Question: ${job.question_id}`);
      console.log(`Status: ${job.status}`);
      console.log(`Failure Stage: ${job.failure_stage || 'None'}`);
      console.log(`Failure Reason: ${job.failure_reason || 'None'}`);
      console.log("-----------------------------------------");
    });
  }
}
run();
