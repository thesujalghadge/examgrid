const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function backfill() {
  const benchmarkData = JSON.parse(fs.readFileSync('scripts/benchmark-data.json', 'utf8'));
  
  // Update all exam_questions sequentially to assign an answer key from the benchmark data
  const { data: questions } = await s.from('exam_questions').select('id');
  if (!questions) return;
  
  let i = 0;
  for (const q of questions) {
    const key = benchmarkData[i % benchmarkData.length].answer_key;
    await s.from('exam_questions').update({ published_answer_key: key }).eq('id', q.id);
    i++;
  }
  console.log("Backfilled", i, "answer keys.");
}
backfill();
