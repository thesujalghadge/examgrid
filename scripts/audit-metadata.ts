import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GENERIC_LABELS = [
  "general physics principles",
  "diagram interpretation",
  "problem solving",
  "visual analysis",
  "application of concepts",
  "use appropriate laws",
  "general mathematics",
  "general chemistry",
  "basic principles",
  "concept application"
];

function isGeneric(label: string): boolean {
  if (!label) return true;
  const lower = label.toLowerCase();
  return GENERIC_LABELS.some(g => lower.includes(g)) || lower.length < 3 || lower === "none" || lower === "n/a";
}

async function run() {
  const { data: eData } = await supabase.from("exams").select("id").eq("title", "JEE PYQ-3").order("created_at", { ascending: false }).limit(1);
  if (!eData || eData.length === 0) throw new Error("Exam not found");
  const eId = eData[0].id;

  const { data: qData } = await supabase.from("exam_questions").select("id, question_number").eq("exam_id", eId);
  const qIds = qData?.map(q => q.id) || [];

  const { data: sols } = await supabase.from("question_solutions").select("question_id, ai_metadata").in("question_id", qIds).not("ai_metadata", "is", null);

  if (!sols) throw new Error("No solutions found");

  let totalQuestions = sols.length;
  let genericCount = 0;
  let accurateSubjectCount = 0;
  let accurateTopicCount = 0;
  let accurateConceptCount = 0;
  
  const problematicOutputs: any[] = [];

  for (const sol of sols) {
    const meta = sol.ai_metadata;
    let hasProblem = false;
    let problems: string[] = [];

    // Subject accuracy (must be Mathematics, Physics, or Chemistry)
    const subject = meta.subject?.trim() || "";
    if (["Mathematics", "Physics", "Chemistry"].includes(subject)) {
      accurateSubjectCount++;
    } else {
      hasProblem = true;
      problems.push(`Invalid subject: ${subject}`);
    }

    // Topic & Subtopic
    const topic = meta.topic?.trim() || "";
    const subtopic = meta.subtopic?.trim() || "";
    if (isGeneric(topic) || isGeneric(subtopic)) {
      hasProblem = true;
      problems.push(`Generic topic/subtopic: ${topic} / ${subtopic}`);
      genericCount++;
    } else {
      accurateTopicCount++;
    }

    // Concepts
    const primary = meta.primary_concept?.trim() || "";
    const secondary = meta.secondary_concept?.trim() || "";
    if (isGeneric(primary) || isGeneric(secondary)) {
      if (!hasProblem) {
        hasProblem = true;
        genericCount++;
      }
      problems.push(`Generic concept: ${primary} / ${secondary}`);
    } else {
      accurateConceptCount++;
    }

    if (hasProblem) {
      const qNum = qData?.find(q => q.id === sol.question_id)?.question_number;
      problematicOutputs.push({
        question_number: qNum,
        subject,
        topic,
        subtopic,
        primary_concept: primary,
        secondary_concept: secondary,
        problems
      });
    }
  }

  const metadataAccuracy = ((accurateTopicCount + accurateConceptCount) / (totalQuestions * 2)) * 100;
  const genericPercentage = (genericCount / totalQuestions) * 100;
  const conceptCoverage = (accurateConceptCount / totalQuestions) * 100;

  let report = `# Intelligence Asset Metadata Audit Report (JEE PYQ-3)\n\n`;
  report += `**Total Analyzed Questions:** ${totalQuestions}\n\n`;
  report += `## Executive Summary\n`;
  report += `- **Metadata Accuracy %:** ${metadataAccuracy.toFixed(2)}%\n`;
  report += `- **Generic Metadata %:** ${genericPercentage.toFixed(2)}%\n`;
  report += `- **Concept Coverage %:** ${conceptCoverage.toFixed(2)}%\n\n`;

  report += `## Top Problematic Outputs\n`;
  if (problematicOutputs.length === 0) {
    report += `No problematic outputs found! All metadata meets granularity requirements.\n`;
  } else {
    for (const p of problematicOutputs.slice(0, 20)) {
      report += `### Question ${p.question_number} (${p.subject})\n`;
      report += `- **Topic / Subtopic:** ${p.topic} / ${p.subtopic}\n`;
      report += `- **Concepts:** ${p.primary_concept} / ${p.secondary_concept}\n`;
      report += `- **Issues:**\n`;
      for (const prob of p.problems) {
        report += `  - ${prob}\n`;
      }
      report += `\n`;
    }
  }

  const artifactsDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);
  fs.writeFileSync(path.join(artifactsDir, 'metadata-audit.md'), report);
  console.log("Audit report generated at artifacts/metadata-audit.md");
}

run().catch(console.error);
