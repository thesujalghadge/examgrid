const { createClient } = require('@supabase/supabase-js'); 
require('dotenv').config({path:'.env.local'}); 
const fs = require('fs'); 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey); 

async function run() { 
  const { data: qs } = await supabase.from('exam_questions').select('id, question_number, correct_option_id, correct_numerical_answer').eq('exam_id', '98c1aec2-bdbb-401e-a9af-d5f722c51e7a'); 
  const qIds = qs.map(q => q.id); 
  const { data: sols } = await supabase.from('question_solutions').select('question_id, model_answer, mismatch_reason, is_active').in('question_id', qIds); 
  
  let report = '# Clean Room Validation Benchmark\n\n| Q | Teacher Key | Model Derived | Match | Mismatch Reason |\n|---|---|---|---|---|\n'; 
  let matchCount = 0; 
  qs.sort((a, b) => a.question_number - b.question_number).forEach(q => { 
    const sol = sols.find(s => s.question_id === q.id); 
    const key = q.correct_option_id || q.correct_numerical_answer; 
    
    if (!sol) { 
      report += `| ${q.question_number} | ${key} | MISSING | ❌ | Generation Failed |\n`; 
      return; 
    } 
    
    const match = sol.is_active ? '✅' : '❌'; 
    if (sol.is_active) matchCount++; 
    let reason = sol.mismatch_reason || ''; 
    reason = reason.replace(/\n/g, ' '); 
    report += `| ${q.question_number} | ${key} | ${sol.model_answer} | ${match} | ${reason} |\n`; 
  }); 
  
  report += `\n**Total Questions Uploaded:** 15\n**Total Queued:** 15\n**Total Completed:** ${sols.length}\n**Convergence Rate:** ${((matchCount/15)*100).toFixed(1)}% (${matchCount}/15)\n`; 
  fs.writeFileSync('clean_room_benchmark.md', report); 
  console.log('Done'); 
} 

run();
