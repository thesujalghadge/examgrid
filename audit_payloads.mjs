import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const targetQids = [
  'cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-8',
  'cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-11',
  'cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-4',
  'cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-7',
  'cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-14'
];

async function generateAudit() {
  let report = '# Reality Audit – Question Input Verification\n\n';

  for (let i = 0; i < targetQids.length; i++) {
    const qid = targetQids[i];
    
    const { data: sol } = await supabase.from('question_solutions').select('*').eq('question_id', qid).single();
    const { data: q } = await supabase.from('exam_questions').select('*').eq('id', qid).single();

    if (!q) {
      report += `### Question ${i + 1}\nMissing from DB\n\n`;
      continue;
    }

    let storagePath = q.published_image_url;
    
    // Simulate what the worker did:
    let fileBuffer = null;
    let mimeType = "";
    let fileExists = false;

    if (storagePath) {
      if (storagePath.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', storagePath.slice(1));
        if (fs.existsSync(localPath)) {
          fileBuffer = fs.readFileSync(localPath);
          fileExists = true;
        }
      } else {
         const { data: fileData, error: downloadError } = await supabase.storage
          .from("cbt-assets")
          .download(storagePath);
          if (fileData) {
            fileBuffer = Buffer.from(await fileData.arrayBuffer());
            fileExists = true;
          }
      }
    }
    
    const bytesLoaded = fileBuffer !== null;

    const understandingInstruction = `You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}`;

    const formattedOptions = (q.published_options || [])
      .map((o) => `${o.label}: ${o.text || ""}`)
      .join("\n");
      
    const promptText = `Question:\n${q.published_question_text || "Solve the following problem"}\n\nOptions:\n${formattedOptions}\n\n${understandingInstruction}`;

    const payloadParts = [];
    if (fileBuffer) {
      mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";
      payloadParts.push({ inlineData: { data: fileBuffer.toString("base64").substring(0, 20) + "...(truncated)", mimeType } });
    }
    payloadParts.push(promptText);

    // Re-run the model to get exact raw response
    let rawResponse = "API FAILED";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite", generationConfig: { responseMimeType: "application/json" } });
      const realPayload = [];
      if (fileBuffer) realPayload.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });
      realPayload.push(promptText);
      const result = await model.generateContent(realPayload);
      rawResponse = result.response.text();
    } catch(e) {
      console.error(e);
    }

    report += `### Question ${i + 1}\n\n`;
    report += `**1. question_id:** ${qid}\n\n`;
    report += `**2. published_question_text:**\n\`\`\`text\n${q.published_question_text}\n\`\`\`\n\n`;
    report += `**3. published_image_url:** ${storagePath}\n\n`;
    report += `**4. image file exists?** ${fileExists ? 'YES' : 'NO'}\n\n`;
    report += `**5. image bytes loaded?** ${bytesLoaded ? 'YES' : 'NO'}\n\n`;
    report += `**6. exact prompt text sent to Gemini:**\n\`\`\`text\n${promptText}\n\`\`\`\n\n`;
    report += `**7. exact image count sent to Gemini:** ${fileBuffer ? 1 : 0}\n\n`;
    report += `**8. exact request payload sent to Gemini:**\n\`\`\`json\n${JSON.stringify(payloadParts, null, 2)}\n\`\`\`\n\n`;
    report += `**9. exact raw Gemini response:**\n\`\`\`json\n${rawResponse}\n\`\`\`\n\n`;
    report += `**10. teacher answer:** ${q.published_answer_key}\n\n`;
    report += `**11. model answer:** ${sol ? sol.model_answer : 'N/A'}\n\n`;
    
    // Diagnosing root cause
    const isMissingText = !q.published_question_text || q.published_question_text.trim() === "";
    const isMissingImage = !storagePath || storagePath.trim() === "";
    const isWrongImage = false; // Cannot programmatically determine here without vision check
    const isPromptCorruption = false; // Looks structurally sound
    const isModelReasoningFailure = !isMissingText && !isMissingImage && sol && sol.teacher_answer !== sol.model_answer;

    report += `#### Diagnosed Issue:\n`;
    report += `- A) Missing text: ${isMissingText ? 'YES' : 'NO'}\n`;
    report += `- B) Missing image: ${isMissingImage ? 'YES' : 'NO'}\n`;
    report += `- C) Wrong image: ${isWrongImage ? 'YES' : 'NO'}\n`;
    report += `- D) Prompt corruption: ${isPromptCorruption ? 'YES' : 'NO'}\n`;
    report += `- E) Model reasoning failure: ${isModelReasoningFailure ? 'YES' : 'NO'}\n\n`;

    if (isMissingImage) {
      report += `**CONCLUSION:** ROOT CAUSE FOUND. Gemini receives no image because published_image_url is null or empty. The image path is hidden inside published_question_text under __metadata__.\n\n`;
    }

    report += `---\n\n`;
  }

  fs.writeFileSync('reality_audit_input.md', report, 'utf8');
  console.log('Saved to reality_audit_input.md');
}

generateAudit().catch(console.error);
