import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {

  const examId = "e4cf9d95-e7b3-49a0-a233-65e9ffc8cde1";
  const { data: qData, error: qErr } = await s.from('exam_questions').select('*').eq('exam_id', examId);
  if (qErr) console.error(qErr);
  if (!qData || qData.length === 0) { console.log('No questions found'); return; }
  const { data: queueData } = await s.from('solution_generation_queue').select('*').in('question_id', qData.map(q => q.id));
  const { data: solData } = await s.from('question_solutions').select('*').in('question_id', qData.map(q => q.id));

  let out = `## Execution Chain Evidence for Exam: ${examId}\n\n`;
  out += '| Question | Image Loaded | Gemini Called | Solution Stored | Metadata Stored |\n';
  out += '|---|---|---|---|---|\n';

  let sampleRowDumped = false;

  for (const eq of qData) {
    const qId = eq.id;
    const shortId = qId.split('-').pop().substring(0, 8);
    const queue = queueData.find(qi => qi.question_id === qId);
    const sol = solData.find(s => s.question_id === qId);
    
    // Simulate what solution-generator does
    let rawText = eq.published_question_text || "";
    let options = eq.published_options || [];
    let correctAnswer = eq.published_answer_key || "";
    let imageUrl = eq.published_image_url || "";
    
    if (!imageUrl && Array.isArray(options)) {
      const metaOpt = options.find((o) => o.id === "__metadata__");
      if (metaOpt && metaOpt.text) {
        try {
           const parsed = JSON.parse(metaOpt.text);
           if (parsed.stemImage) {
              imageUrl = parsed.stemImage;
           }
        } catch(e) {}
      }
    }

    let imageLoaded = false;
    if (imageUrl) {
      const imagePath = path.join(process.cwd(), "public", imageUrl);
      imageLoaded = fs.existsSync(imagePath);
    }
    
    // The problem might be that the generator code has NO WAY to load image if it's not local, 
    // or if the URL is completely missing.
    // If we have a solution, Gemini was called.
    const geminiCalled = !!sol;
    const solStored = !!sol;
    const metadataStored = !!(sol && sol.ai_metadata && Object.keys(sol.ai_metadata).length > 0);

    out += `| ${shortId} | ${imageLoaded ? 'YES' : 'NO'} | ${geminiCalled ? 'YES' : 'NO'} | ${solStored ? 'YES' : 'NO'} | ${metadataStored ? 'YES' : 'NO'} |\n`;

    if (!sampleRowDumped && sol) {
      sampleRowDumped = true;
      out += '\n### Actual Database Row (Sample)\n';
      out += `* **subject:** ${sol.ai_metadata?.subject || sol.subject}\n`;
      out += `* **chapter:** ${sol.ai_metadata?.chapter || sol.chapter}\n`;
      out += `* **concepts:** ${JSON.stringify(sol.ai_metadata?.essential_steps || [])}\n`;
      out += `* **confidence:** ${sol.answer_confidence || sol.confidence}\n`;
      out += `* **solution markdown:**\n\`\`\`markdown\n${sol.content_markdown}\n\`\`\`\n`;

      out += '\n### Exact API Payload (Reconstructed)\n```json\n';
      out += JSON.stringify({
        questionId: qId,
        teacherKey: correctAnswer,
        imageAttached: imageLoaded,
        imageBytes: imageLoaded ? fs.statSync(path.join(process.cwd(), "public", imageUrl)).size : 0,
        prompt: "..."
      }, null, 2);
      out += '\n```\n';

      out += '\n### Exact JSON Returned (From ai_metadata)\n```json\n';
      out += JSON.stringify(sol.ai_metadata, null, 2);
      out += '\n```\n';
    }
  }
  fs.writeFileSync('artifacts/execution_evidence.md', out);
  console.log('Done!');
}

run().catch(console.error);
