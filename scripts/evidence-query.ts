import { createServiceRoleClient } from "../src/lib/institute/get-institute-api-key";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function gatherEvidence() {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("No supabase client");

  // Get total counts
  const { data: eData } = await supabase.from("exams").select("id").eq("title", "JEE PYQ-3").order("created_at", { ascending: false }).limit(1);
  const eId = eData?.[0]?.id;

  const { count: questionsCount } = await supabase.from("exam_questions").select("*", { count: "exact", head: true }).eq('exam_id', eId);
  const { count: queueCount } = await supabase.from("solution_generation_queue").select("*", { count: "exact", head: true });
  const { count: solutionsCount } = await supabase.from("question_solutions").select("*", { count: "exact", head: true });

  console.log("=== DATABASE COUNTS ===");
  console.log(`Total published questions for exam ${eId}:`, questionsCount);
  console.log("Total solution_generation_queue:", queueCount);
  console.log("Total question_solutions:", solutionsCount);

  // Fetch queue items to show parity
  const { data: qData } = await supabase.from("exam_questions").select("id, published_answer_key, question_number").eq("exam_id", eId).order("question_number");
  const qIds = qData?.map((q: any) => q.id) || [];
  
  const { data: queueData } = await supabase.from("solution_generation_queue").select("question_id, status").in("question_id", qIds);
  const queueStatusMap = new Map(queueData?.map((q: any) => [q.question_id, q.status]) || []);

  const { data: solData } = await supabase.from("question_solutions").select("question_id, generated_model, validation_passed, final_answer, created_at, ai_metadata, content_markdown").in("question_id", qIds);
  const solMap = new Map(solData?.map((s: any) => [s.question_id, s]) || []);

  console.log("\n=== PARITY & EVIDENCE ===");
  for (const q of qData || []) {
    const s = solMap.get(q.id);
    const qStatus = queueStatusMap.get(q.id);
    console.log(`Q${q.question_number} | ID: ${q.id} | Key: ${q.published_answer_key} | Ans: ${s?.final_answer} | Model: ${s?.generated_model} | Valid: ${s?.validation_passed} | Queue: ${qStatus}`);
  }

  // Get samples
  const { data: sols, error } = await supabase
    .from("question_solutions")
    .select(`
      id,
      question_id,
      content_markdown,
      final_answer,
      ai_metadata
    `)
    .in("question_id", qIds)
    .not('ai_metadata', 'is', null);

  if (error) {
    console.error("Query Error:", error);
    return;
  }
  if (!sols) {
    console.log("No solutions found!");
    return;
  }

  const maths = sols.filter(s => {
    const meta = s.ai_metadata;
    return meta?.subject?.toLowerCase().includes("math");
  });
  const phys = sols.filter(s => {
    const meta = s.ai_metadata;
    return meta?.subject?.toLowerCase().includes("phys");
  });
  const chem = sols.filter(s => {
    const meta = s.ai_metadata;
    return meta?.subject?.toLowerCase().includes("chem");
  });

  const shuffle = (array: any[]) => {
    let currentIndex = array.length,  randomIndex;
    while (currentIndex > 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  const selectedMath = shuffle(maths).slice(0, 2);
  const selectedPhys = shuffle(phys).slice(0, 2);
  const selectedChem = shuffle(chem).slice(0, 1);

  const selected = [...selectedMath, ...selectedPhys, ...selectedChem];

  let output = "=== DATABASE COUNTS ===\n";
  output += `Total published questions (questions table acts as snapshot): ${questionsCount}\n`;
  output += `Total solution_generation_queue: ${queueCount}\n`;
  output += `Total question_solutions: ${solutionsCount}\n\n`;

  output += "=== SAMPLED QUESTIONS ===\n";
  for (const s of selected) {
    const { data: qData } = await supabase.from('solution_generation_queue').select('*').eq('question_id', s.question_id).limit(1);
    let snapshotData;
    const { data: eqData } = await supabase.from('exam_questions').select('*').eq('id', s.question_id).limit(1);
    if (eqData && eqData.length > 0) {
      snapshotData = eqData;
    } else {
      const res = await supabase.from('questions').select('*, question_content(*)').eq('id', s.question_id).limit(1);
      snapshotData = res.data;
    }

    output += `\n\n## QUESTION ${s.question_id}\n\n`;
    output += "### 1. PUBLISHED SNAPSHOT RECORD (questions table):\n";
    output += "```json\n" + JSON.stringify(snapshotData, null, 2) + "\n```\n";
    
    output += "### 2. QUEUE RECORD:\n";
    output += "```json\n" + JSON.stringify(qData, null, 2) + "\n```\n";

    if (qData && qData.length > 0) {
      const { data: eventsData } = await supabase.from('solution_generation_events').select('*').eq('queue_id', qData[0].id).order('created_at', { ascending: true });
      output += "### 2.5. WORKER GENERATION EVENTS:\n";
      output += "```json\n" + JSON.stringify(eventsData, null, 2) + "\n```\n";
    }

    output += "### 3. FINAL PERSISTED INTELLIGENCE ASSET JSON (from ai_metadata):\n";
    output += "```json\n" + JSON.stringify(s.ai_metadata, null, 2) + "\n```\n";
    
    output += "### 4. STUDENT-FACING MARKDOWN RECONSTRUCTION (from content_markdown):\n";
    output += "```markdown\n" + s.content_markdown + "\n```\n";
  }

  const fs = require('fs');
  const path = require('path');
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir);
  }
  fs.writeFileSync(path.join(artifactsDir, 'evidence-report.md'), output);
  console.log("Evidence report generated at artifacts/evidence-report.md");

}

gatherEvidence().catch(console.error);
