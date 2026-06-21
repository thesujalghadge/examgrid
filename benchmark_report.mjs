import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function generateReport() {
  const { data: solutions, error } = await supabase.from('question_solutions').select(`
    question_id,
    teacher_answer,
    model_answer,
    confidence,
    mismatch_reason,
    content_markdown,
    prompt_snapshot,
    subject,
    chapter,
    concepts
  `);

  if (error) {
    console.error("Failed to fetch solutions", error);
    return;
  }

  let totalMatches = 0;
  let totalMismatches = 0;
  let unknownSubjectChapter = 0;
  let visionFailures = 0;

  const results = [];
  const matchedSamples = [];
  const mismatchedSamples = [];

  for (const sol of solutions) {
    const isMatch = sol.mismatch_reason === null;
    if (isMatch) totalMatches++; else totalMismatches++;

    const subject = sol.subject || "Unknown";
    const chapter = sol.chapter || "Unknown";
    const concept = (sol.concepts && sol.concepts.length > 0) ? sol.concepts[0] : "Unknown";

    if (subject === 'Unknown' || chapter === 'Unknown') unknownSubjectChapter++;

    let reasoning = "";
    if (!isMatch && sol.content_markdown) {
        reasoning = sol.content_markdown;
    } else {
        reasoning = "Solution generated successfully.";
    }
    
    // Determine Failure Classification if mismatched
    let classification = "N/A";
    if (!isMatch) {
      if (sol.content_markdown?.includes("could not extract text") || sol.confidence < 50) {
        classification = "Vision Failure";
        visionFailures++;
      } else if (sol.content_markdown?.includes("Equation parsing failed") || sol.model_answer === "Unknown") {
        classification = "Parsing Failure";
      } else if (sol.content_markdown?.includes("Teacher Key Error")) {
        classification = "Teacher Key Error";
      } else {
        classification = "Reasoning Failure";
      }
    }

    if (isMatch && matchedSamples.length < 5) {
      matchedSamples.push({
        question_id: sol.question_id,
        model_reasoning: reasoning,
        model_answer: sol.model_answer,
        teacher_answer: sol.teacher_answer,
        subject,
        chapter
      });
    } else if (!isMatch && mismatchedSamples.length < 5) {
      mismatchedSamples.push({
        question_id: sol.question_id,
        model_reasoning: reasoning.substring(0, 500) + '...',
        model_answer: sol.model_answer,
        teacher_answer: sol.teacher_answer,
        classification,
        subject,
        chapter
      });
    }

    results.push(`| ${sol.question_id.split('-').pop()} | ${sol.teacher_answer} | ${sol.model_answer} | ${isMatch ? '✅ Yes' : '❌ No'} | ${subject} | ${chapter} | ${concept} | N/A |`);
  }

  const totalQuestions = solutions.length;
  const convergenceRate = totalQuestions > 0 ? ((totalMatches / totalQuestions) * 100).toFixed(1) : 0;
  const unknownRate = totalQuestions > 0 ? ((unknownSubjectChapter / totalQuestions) * 100).toFixed(1) : 0;
  const visionFailRate = totalQuestions > 0 ? ((visionFailures / totalQuestions) * 100).toFixed(1) : 0;

  let report = `# Phase 3C Reality Benchmark Report

## 1. Metrics Summary
* **Total Questions Processed:** ${totalQuestions}
* **Total Matches:** ${totalMatches}
* **Total Mismatches:** ${totalMismatches}
* **Convergence Rate:** ${convergenceRate}%
* **Unknown Subject/Chapter Rate:** ${unknownRate}%
* **Vision Failure Rate:** ${visionFailRate}%

---

## 2. Full Question Benchmark

| Question ID | Teacher Key | Model Answer | Match | Subject | Chapter | Concept | Difficulty |
|---|---|---|---|---|---|---|---|
${results.join('\n')}

---

## 3. Matched Samples (5 limit)
`;

  for (let i = 0; i < matchedSamples.length; i++) {
    const s = matchedSamples[i];
    report += `\n### Sample ${i+1}: ${s.question_id}\n`;
    report += `- **Subject/Chapter**: ${s.subject} / ${s.chapter}\n`;
    report += `- **Model Answer**: ${s.model_answer}\n`;
    report += `- **Teacher Answer**: ${s.teacher_answer}\n`;
  }

  report += `\n---\n\n## 4. Mismatched Samples (5 limit)\n`;

  for (let i = 0; i < mismatchedSamples.length; i++) {
    const s = mismatchedSamples[i];
    report += `\n### Mismatch ${i+1}: ${s.question_id}\n`;
    report += `- **Subject/Chapter**: ${s.subject} / ${s.chapter}\n`;
    report += `- **Model Answer**: ${s.model_answer}\n`;
    report += `- **Teacher Answer**: ${s.teacher_answer}\n`;
    report += `- **Failure Classification**: ${s.classification}\n`;
    report += `- **Model Reasoning**: \n\`\`\`\n${s.model_reasoning}\n\`\`\`\n`;
  }

  fs.writeFileSync('benchmark_report.md', report, 'utf8');
  console.log("Report generated successfully!");
}

generateReport().catch(console.error);
