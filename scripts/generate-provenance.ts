import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: eData } = await supabase.from("exams").select("id").eq("title", "JEE PYQ-3").order("created_at", { ascending: false }).limit(1);
  if (!eData || eData.length === 0) throw new Error("Exam not found");
  const eId = eData[0].id;

  const { data: qData } = await supabase.from("exam_questions").select("id, question_number").eq("exam_id", eId).order('question_number', { ascending: true });
  const qIds = qData?.map(q => q.id) || [];

  const { data: sols } = await supabase.from("question_solutions").select("*").in("question_id", qIds);

  if (!sols || sols.length === 0) throw new Error("No solutions found");

  let report = `# Intelligence Asset Model Provenance Report (JEE PYQ-3)\n\n`;
  report += `| Question Number | Question ID | Model Used | Provider | Prompt Version | Validation Status |\n`;
  report += `| --- | --- | --- | --- | --- | --- |\n`;

  let gemini25Count = 0;

  for (const q of qData!) {
    const sol = sols.find(s => s.question_id === q.id);
    if (sol) {
      const modelName = sol.model_name;
      const provider = sol.provider;
      const promptVersion = sol.prompt_version;
      const valStatus = sol.ai_metadata?.validation_status || "UNKNOWN";
      
      if (modelName === "gemini-2.5-flash") gemini25Count++;

      report += `| Q${q.question_number} | \`${q.id}\` | \`${modelName}\` | \`${provider}\` | \`${promptVersion}\` | **${valStatus}** |\n`;
    } else {
      report += `| Q${q.question_number} | \`${q.id}\` | MISSING | MISSING | MISSING | MISSING |\n`;
    }
  }

  report += `\n**Total Analyzed:** ${qData!.length}\n`;
  report += `**Gemini 2.5 Flash Usage:** ${(gemini25Count / qData!.length * 100).toFixed(2)}%\n`;

  const artifactsDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);
  fs.writeFileSync(path.join(artifactsDir, 'provenance-report.md'), report);
  console.log("Provenance report generated at artifacts/provenance-report.md");
}

run().catch(console.error);
