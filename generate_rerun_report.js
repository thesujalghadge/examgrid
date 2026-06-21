const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const examId = 'e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1';
  const { data: qData } = await s.from('exam_questions').select('id, question_number, published_answer_key').eq('exam_id', examId);
  const { data: solData } = await s.from('question_solutions').select('*').in('question_id', qData.map(q => q.id));

  let out = `## Post-Recovery Benchmark Report\n\n`;
  out += '| Question | Subject | Chapter | Teacher Key | Model Answer | Status |\n';
  out += '|---|---|---|---|---|---|\n';

  let matches = 0;
  let mismatches = 0;

  for (let i = 1; i <= 15; i++) {
    const q = qData.find(q => q.question_number === i);
    const sol = solData.find(s => s.question_id === q.id);
    
    if (!sol) continue;

    const teacherKey = q.published_answer_key || 'UNKNOWN';
    let status = 'MISMATCH';
    if (sol.validation_passed) {
      status = 'MATCH';
      matches++;
    } else {
      mismatches++;
    }

    const subject = sol.ai_metadata?.subject || sol.subject || 'N/A';
    const chapter = sol.ai_metadata?.chapter || sol.chapter || 'N/A';
    const modelAns = sol.ai_metadata?.model_answer || sol.model_answer || 'N/A';

    out += `| Q${i} | ${subject} | ${chapter} | ${teacherKey} | ${modelAns} | ${status} |\n`;
  }

  const total = matches + mismatches;
  const acc = total > 0 ? (matches / total * 100).toFixed(1) : 0;
  out += `\n**Total Analyzed:** ${total}\n`;
  out += `**Matches:** ${matches}\n`;
  out += `**Mismatches:** ${mismatches}\n`;
  out += `**Overall Accuracy:** ${acc}%\n`;

  console.log(out);
  fs.writeFileSync('artifacts/benchmark_rerun_report.md', out);
}

run();
