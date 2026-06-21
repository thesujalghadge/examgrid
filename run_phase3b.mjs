import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const apiKey = process.env.GEMINI_API_KEY; // Using platform key for this script
const genAI = new GoogleGenerativeAI(apiKey);
const resolvedModelName = "gemini-3.1-flash-lite";

async function verify() {
  const { data: eqs } = await supabase.from('exam_questions').select('*').limit(5);
  
  let markdown = "# Phase 3B Architecture Verification\n\n";
  
  let understandingPass = 0;
  let answerMatch = 0;
  let studentSolutionCount = 0;

  for (let i = 0; i < eqs.length; i++) {
    const q = eqs[i];
    const resolvedCorrectAnswer = q.published_answer_key;
    
    // Step 1: Question Understanding
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

    const formattedOptions = (q.published_options || []).map((o) => `${o.label}: ${o.text || ""}`).join("\n");
    const promptText = `Question:\n${q.published_question_text || "Solve the following problem"}\n\nOptions:\n${formattedOptions}\n\n${understandingInstruction}`;

    const model = genAI.getGenerativeModel({ 
      model: resolvedModelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    let rawJson = "";
    let analysis;
    try {
      const result = await model.generateContent(promptText);
      rawJson = result.response.text();
      analysis = JSON.parse(rawJson);
    } catch (e) {
      console.error(e);
      continue;
    }

    // Question 1 override check as requested: "If the system identifies anything other than: Subject: Mathematics, Chapter: Circles mark it as FAIL."
    let q1Fail = false;
    if (i === 0) {
      if (analysis.subject.toLowerCase() !== "mathematics" || analysis.chapter.toLowerCase() !== "circles") {
         q1Fail = true;
      }
    }

    const isUnderstandingValid = analysis.subject && analysis.chapter && analysis.concepts && analysis.confidence >= 70 && !q1Fail;
    if (isUnderstandingValid) understandingPass++;

    const cleanTeacherAnswer = resolvedCorrectAnswer.toString().trim().toLowerCase();
    const cleanModelAnswer = String(analysis.model_answer || "").trim().toLowerCase();
    const isMatch = cleanTeacherAnswer === cleanModelAnswer;
    if (isMatch) answerMatch++;

    let studentSolution = null;
    if (isMatch && isUnderstandingValid) {
       studentSolutionCount++;
       studentSolution = true;
    } else {
       studentSolution = false;
    }

    markdown += `### Question ${i + 1}\n\n`;
    markdown += `**1. Question image path:** ${q.published_image_url || 'NONE (Text Only)'}\n`;
    markdown += `**2. Question text seen by model:** ${q.published_question_text}\n`;
    markdown += `**3. Subject detected:** ${analysis.subject}\n`;
    markdown += `**4. Chapter detected:** ${analysis.chapter}\n`;
    markdown += `**5. Concepts detected:** ${analysis.concepts.join(', ')}\n`;
    markdown += `**6. Confidence score:** ${analysis.confidence}\n`;
    markdown += `**7. Independent model answer:** ${analysis.model_answer}\n`;
    markdown += `**8. Teacher answer:** ${resolvedCorrectAnswer}\n`;
    markdown += `**9. Match?** ${isMatch ? 'Yes' : 'No'}\n`;
    markdown += `**10. Student solution generated?** ${studentSolution ? 'Yes' : 'No'}\n\n`;
    
    markdown += `**Raw JSON returned by Step 1:**\n\`\`\`json\n${rawJson}\n\`\`\`\n\n`;
    
    markdown += `**Exact row stored in question_solutions (Simulated):**\n\`\`\`json\n`;
    markdown += JSON.stringify({
      subject: analysis.subject,
      chapter: analysis.chapter,
      subchapter: analysis.subchapter,
      concepts: analysis.concepts,
      model_answer: analysis.model_answer,
      teacher_answer: resolvedCorrectAnswer,
      confidence: analysis.confidence,
      mismatch_reason: isMatch ? null : `Model derived '${cleanModelAnswer}' but teacher key is '${cleanTeacherAnswer}'`,
      generation_status: (isMatch && isUnderstandingValid) ? 'COMPLETED' : 'FAILED',
      is_active: (isMatch && isUnderstandingValid)
    }, null, 2);
    markdown += `\n\`\`\`\n\n---\n\n`;
  }

  markdown += `### Final Report\n\n`;
  markdown += `- **Question Understanding Accuracy:** ${(understandingPass / 5) * 100}%\n`;
  markdown += `- **Answer Convergence Rate:** ${(answerMatch / 5) * 100}%\n`;
  markdown += `- **Student Solution Generation Rate:** ${(studentSolutionCount / 5) * 100}%\n`;

  fs.writeFileSync('phase3b_verification.md', markdown, 'utf8');
  console.log('Saved to phase3b_verification.md');
}

verify().catch(console.error);
