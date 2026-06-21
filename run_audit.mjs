import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const { data: sols } = await supabase.from('question_solutions').select('*').limit(10);
  
  if (!sols || sols.length === 0) {
    console.log("No solutions found.");
    return;
  }

  let markdown = "# System Reality Audit\n\n";

  for (let i = 0; i < sols.length; i++) {
    const sol = sols[i];
    const { data: q } = await supabase.from('exam_questions').select('*').eq('id', sol.question_id).single();
    
    markdown += `## Question ${i + 1}\n\n`;
    markdown += `- **Question Image:** ${q?.published_image_url ? `[Image](${q.published_image_url})` : 'N/A (Text Only)'}\n`;
    markdown += `- **Teacher Key:** ${q?.published_answer_key}\n`;
    markdown += `- **Subject Detected:** N/A (Not implemented in current system)\n`;
    markdown += `- **Chapter Detected:** N/A (Not implemented in current system)\n`;
    markdown += `- **Concept Detected:** N/A (Not implemented in current system)\n`;
    markdown += `- **Stored Solution / Raw Gemini Response:**\n\n`;
    markdown += `> ${sol.content_markdown.replace(/\n/g, '\n> ')}\n\n`;
    
    // Scoring based on current implementation
    markdown += `### Scores:\n`;
    markdown += `- **Question Understanding:** Fail (No explicit chapter/concept mapping before solving)\n`;
    markdown += `- **Concept Alignment:** Fail (No verification of concepts against syllabus)\n`;
    markdown += `- **Answer Correctness:** Pass (Prompts force the AI to align with the teacher key)\n`;
    markdown += `- **Student Value:** Fail (Student might see an arbitrary mathematical path that arrives at the answer without being related to the syllabus)\n\n`;
    
    markdown += `### Trust Assessment: Fail\n`;
    markdown += `**Exact Stage Failed:** C) Vision Understanding & D) Prompt\n\n`;
    markdown += `---\n\n`;
  }
  
  fs.writeFileSync('audit_report.md', markdown, 'utf8');
  console.log("Written to audit_report.md");
}

runAudit().catch(console.error);
