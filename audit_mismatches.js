const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const examId = 'e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1';
  
  // 1. Get original truth
  const csvText = fs.readFileSync('C:\\\\AI\\\\SGIS\\\\testing data\\\\Jee PYQ-1\\\\answer-key.csv', 'utf8');
  const csvLines = csvText.split('\n').filter(l => l.trim() && !l.startsWith('question'));
  const csvMap = {};
  csvLines.forEach(l => {
    const parts = l.split(',');
    if (parts.length >= 2) csvMap[parts[0].trim()] = parts[1].trim();
  });

  const { data: qData } = await s.from('exam_questions')
    .select('id, question_number, published_image_url, published_answer_key, published_options, question_type')
    .eq('exam_id', examId)
    .order('question_number');
    
  const { data: solData } = await s.from('question_solutions').select('*').in('question_id', qData.map(q => q.id));

  let out = `## Mismatch Audit Report\n\n`;

  for (let i = 1; i <= 15; i++) {
    const q = qData.find(q => q.question_number === i);
    const sol = solData.find(s => s.question_id === q.id);
    
    if (!sol || sol.validation_passed) continue;

    const teacherKey = q.published_answer_key;
    const modelAns = sol.ai_metadata?.model_answer || sol.model_answer;
    
    let imgPath = q.published_image_url;
    if (!imgPath && q.published_options) {
      const meta = q.published_options.find(o => o.id === '__metadata__' || o.label === '__metadata__');
      if (meta && meta.text) {
         try {
            const m = JSON.parse(meta.text);
            imgPath = m.stemImage;
         } catch(e) {}
      }
    }
    const imgPathMatch = imgPath ? imgPath.match(/Q(\\d+)_crop\\.jpg/) : null;
    const imgNum = imgPathMatch ? imgPathMatch[1] : (imgPath || 'NONE');

    out += `### Q${i} Mismatch\n`;
    out += `**1. Question Image:** ${imgNum}\n`;
    out += `**2. Teacher Key:** ${teacherKey}\n`;
    out += `**3. Model Answer:** ${modelAns}\n`;
    out += `**4. Full Reasoning:**\n${sol.ai_metadata?.reasoning || sol.content_markdown}\n\n`;
    
    // We don't have explicit option values extracted from PDF because OCR didn't extract them perfectly, but maybe we can glean them from reasoning.
    out += `**5. Final derived mathematical value:** (See reasoning end)\n`;
    out += `**6. Option values extracted from PDF:** (See image)\n`;
    out += `---\n\n`;
  }

  console.log('Done mapping mismatches');
  fs.writeFileSync('artifacts/mismatch_audit.md', out);
}
run();
