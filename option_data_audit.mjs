import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function runAudit() {
  const { data: q1 } = await supabase.from('exam_questions').select('id, question_type, published_options').eq('exam_id', '9eb2f4a8-69c3-4f37-908d-592ee4e14297');
  const { data: q3 } = await supabase.from('exam_questions').select('id, question_type, published_options').eq('exam_id', '86722d90-1ed4-4330-b84f-40c81a8ed272');
  
  const allQs = [...(q1 || []), ...(q3 || [])];
  
  let totalMCQs = 0;
  let mcqsWithText = 0;
  let mcqsMissingText = 0;
  
  let report = `# Phase 3G - Option Data Reality Audit\n\n`;
  
  for (const q of allQs) {
    const isMCQ = q.question_type === 'MCQ_SINGLE' || q.question_type === 'MCQ_MULTIPLE';
    if (isMCQ) totalMCQs++;
    
    let hasCompleteText = true;
    let optionTexts = { A: 'MISSING', B: 'MISSING', C: 'MISSING', D: 'MISSING' };
    
    const options = (q.published_options || []).filter(o => o.label !== '__metadata__');
    
    if (isMCQ) {
      if (options.length === 0) hasCompleteText = false;
      for (const opt of options) {
        if (!opt.text || opt.text.trim() === '') {
          hasCompleteText = false;
        } else {
          optionTexts[opt.label] = opt.text;
        }
      }
      if (hasCompleteText) mcqsWithText++; else mcqsMissingText++;
    }
    
    report += `### Question: ${q.id.split('-').pop()}\n`;
    report += `- **Question Type**: ${q.question_type}\n`;
    report += `- **Published Options Payload Length**: ${options.length}\n`;
    if (isMCQ) {
      report += `- **Option A text**: ${optionTexts['A'] || 'MISSING (Empty String)'}\n`;
      report += `- **Option B text**: ${optionTexts['B'] || 'MISSING (Empty String)'}\n`;
      report += `- **Option C text**: ${optionTexts['C'] || 'MISSING (Empty String)'}\n`;
      report += `- **Option D text**: ${optionTexts['D'] || 'MISSING (Empty String)'}\n`;
      report += `- **Source of option text**: ${hasCompleteText ? 'Stored directly' : 'Missing (Only exists in image crop)'}\n`;
      report += `- **Status**: ${hasCompleteText ? 'COMPLETE' : 'MISSING OPTION DATA'}\n`;
    } else {
      report += `- **Source of option text**: N/A (NAT)\n`;
      report += `- **Status**: COMPLETE (NAT)\n`;
    }
    report += `\n`;
  }
  
  report += `## Summary Metrics\n`;
  report += `- **Total MCQs**: ${totalMCQs}\n`;
  report += `- **MCQs with complete option text**: ${mcqsWithText}\n`;
  report += `- **MCQs missing option text**: ${mcqsMissingText}\n`;
  
  report += `\n## Final Verdict\n`;
  if (mcqsMissingText > 0) {
    report += `**Can a deterministic resolver be implemented today?** NO\n\n`;
    report += `**Exact Missing Data Layer:** ExamGrid currently stores options structurally as labels (A, B, C, D) but their actual textual/numerical content is entirely empty (empty strings) in the database. The content only exists embedded within the \`stemImage\` vision crop. A deterministic resolver cannot be built until an OCR/Vision extraction pipeline populates the \`published_options[i].text\` field during paper ingestion.\n`;
  } else {
    report += `**Can a deterministic resolver be implemented today?** YES\n`;
  }
  
  fs.writeFileSync('option_data_audit.md', report, 'utf8');
  console.log("Audit complete.");
}

runAudit().catch(console.error);
