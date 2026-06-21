import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const examId = '98c1aec2-bdbb-401e-a9af-d5f722c51e7a'; // most recent

  const { data: q } = await supabase.from('exam_questions').select('*').eq('exam_id', examId).limit(1);
  if (!q?.length) { console.log('No questions'); return; }
  
  const { data: sol } = await supabase.from('question_solutions').select('*').eq('question_id', q[0].id).limit(1);
  if (!sol?.length) { console.log('No solutions for q0'); return; }

  console.log("prompt_snapshot:", sol[0].prompt_snapshot ? JSON.stringify(sol[0].prompt_snapshot).substring(0, 500) + '...' : "null");
  console.log("ai_metadata:", sol[0].ai_metadata ? JSON.stringify(sol[0].ai_metadata).substring(0, 500) + '...' : "null");
  console.log("model_answer:", sol[0].model_answer);
  console.log("content_markdown:", sol[0].content_markdown ? "Present" : "null");
}

run().catch(console.error);
