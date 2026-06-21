const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const examId = "e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1";
  
  const { data: qData } = await s.from('exam_questions').select('*').eq('exam_id', examId).order('question_number');
  const { data: solData } = await s.from('question_solutions').select('*').in('question_id', qData.map(q => q.id));

  let out = `## Answer Key Integrity Audit for Exam: ${examId}\n\n`;
  out += '| Question | Subject / Topic | Image Path | Teacher Key | Model Answer | Status |\n';
  out += '|---|---|---|---|---|---|\n';

  for (let i = 0; i < qData.length; i++) {
    const eq = qData[i];
    const qId = eq.id;
    const shortId = qId.split('-').pop().substring(0, 8);
    const sol = solData.find(s => s.question_id === qId);
    
    let imageUrl = eq.published_image_url || "";
    if (!imageUrl && Array.isArray(eq.published_options)) {
      const metaOpt = eq.published_options.find((o) => o.id === "__metadata__");
      if (metaOpt && metaOpt.text) {
        try {
           const parsed = JSON.parse(metaOpt.text);
           if (parsed.stemImage) {
              imageUrl = parsed.stemImage;
           }
        } catch(e) {}
      }
    }
    
    const teacherKey = eq.published_answer_key || "UNKNOWN";
    const modelAnswer = sol ? (sol.ai_metadata?.model_answer || sol.model_answer) : "N/A";
    const subject = sol ? (sol.ai_metadata?.subject || sol.subject) : "N/A";
    const chapter = sol ? (sol.ai_metadata?.chapter || sol.chapter) : "N/A";
    
    // Determine status
    let status = "MATCH";
    if (!sol) {
       status = "NO_SOLUTION";
    } else if (sol.content_markdown && sol.content_markdown.includes('**MISMATCH ERROR**')) {
       status = "MISMATCH";
    } else if (teacherKey.toLowerCase().trim() !== modelAnswer.toLowerCase().trim()) {
       status = "MISMATCH";
    }

    out += `| Q${i+1} (${shortId}) | ${subject} / ${chapter} | \`${imageUrl}\` | **${teacherKey}** | ${modelAnswer} | ${status} |\n`;
  }
  
  fs.writeFileSync('artifacts/answer_key_audit.md', out);
  console.log('Saved to artifacts/answer_key_audit.md');
}

run().catch(console.error);
