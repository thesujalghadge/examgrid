const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const examId = 'e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1';
  
  // 1. Load the original truth
  const csvText = fs.readFileSync('C:\\\\AI\\\\SGIS\\\\testing data\\\\Jee PYQ-1\\\\answer-key.csv', 'utf8');
  const csvLines = csvText.split('\n').filter(l => l.trim() && !l.startsWith('question'));
  const csvMap = {};
  csvLines.forEach(l => {
    const parts = l.split(',');
    if (parts.length >= 2) csvMap[parts[0].trim()] = parts[1].trim();
  });

  // 2. Fetch current DB state
  const { data: qData } = await s.from('exam_questions')
    .select('id, question_number, question_type, published_answer_key, correct_option_id, correct_numerical_answer, options, published_options')
    .eq('exam_id', examId)
    .order('question_number');
    
  let out = `## Ground Truth Recovery Report\n\n`;
  out += '| Q | Before: pub_key | Before: opt_id | Before: num | Action | After: pub_key | After: opt_id | After: num |\n';
  out += '|---|---|---|---|---|---|---|---|\n';

  for (const q of qData) {
    const trueKey = csvMap[q.question_number];
    if (!trueKey) continue;

    let newOptId = null;
    let newNumAns = null;
    let newPubKey = trueKey;

    if (q.question_type === 'NUMERICAL') {
      newNumAns = trueKey;
    } else {
      // Find the corresponding option ID
      // If trueKey is "B", we look for an option with label "B" or fallback to "opt_B"
      let foundOptId = `opt_${trueKey}`;
      if (q.options && Array.isArray(q.options)) {
         const match = q.options.find(o => o.label === trueKey);
         if (match) foundOptId = match.id;
      }
      newOptId = foundOptId;
    }

    // 3. Update the DB
    await s.from('exam_questions').update({
      published_answer_key: newPubKey,
      correct_option_id: newOptId,
      correct_numerical_answer: newNumAns
    }).eq('id', q.id);

    // Also update questions table if applicable? No, just exam_questions since it's the published snapshot.

    out += `| ${q.question_number} | ${q.published_answer_key} | ${q.correct_option_id} | ${q.correct_numerical_answer} | RESTORED | ${newPubKey} | ${newOptId} | ${newNumAns} |\n`;
  }

  console.log(out);
  fs.writeFileSync('artifacts/recovery_report.md', out);
}
run();
