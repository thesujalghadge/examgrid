import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { getInstituteGeminiKey } from "../src/lib/institute/get-institute-api-key";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

const EXAM_ID = process.argv[2];

if (!EXAM_ID) {
  console.error("Please provide the EXAM_ID as an argument.");
  process.exit(1);
}

async function runEvaluation() {
  console.log(`Fetching solutions for Exam ID: ${EXAM_ID}...`);
  
  const { data: questions, error: qError } = await supabase
    .from("exam_questions")
    .select("id, published_image_url, published_answer_key, published_question_text")
    .eq("exam_id", EXAM_ID);

  if (qError || !questions) {
    console.error("Failed to fetch questions:", qError);
    return;
  }

  const qIds = questions.map(q => q.id);

  const { data: solutions, error: sError } = await supabase
    .from("question_solutions")
    .select("question_id, content_markdown, generation_status, validation_passed")
    .in("question_id", qIds);

  if (sError || !solutions || solutions.length === 0) {
    console.error("No solutions found. Has the worker finished processing?");
    return;
  }

  console.log(`Found ${solutions.length} solutions. Initializing Evaluator...`);

  const apiKey = await getInstituteGeminiKey(process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID!);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let totalScore = 0;
  const maxPossible = solutions.length * 8;

  for (let i = 0; i < solutions.length; i++) {
    const sol = solutions[i];
    const q = questions.find(x => x.id === sol.question_id);
    
    console.log(`\n--------------------------------------------------`);
    console.log(`Question ${i + 1}/${solutions.length} [ID: ${q?.id}]`);
    console.log(`Image URL: ${q?.published_image_url}`);
    console.log(`Teacher Key: ${q?.published_answer_key}`);
    console.log(`Validation Passed: ${sol.validation_passed}`);
    console.log(`\nRaw Output:\n${sol.content_markdown}\n`);

    if (!sol.validation_passed || sol.generation_status !== "COMPLETED") {
      console.log(`Scoring: 0/8 (Validation Failed)`);
      continue;
    }

    // Use Gemini to score the solution against the rubric
    const evalPrompt = `
    You are an expert academic evaluator. Review the following generated solution against the teacher's key.
    
    Generated Solution:
    ${sol.content_markdown}
    
    Teacher Key: ${q?.published_answer_key}
    
    Score this solution strictly based on the following rubric (0, 1, or 2 for each):
    1. Correctness: 0=wrong, 1=partially correct, 2=correct
    2. Explanation quality: 0=garbage, 1=understandable, 2=Examcide quality (rigorous, step-by-step)
    3. Conciseness: 0=rambling, 1=acceptable, 2=premium (efficient, no fluff)
    4. Trustworthiness: Would you show this to a JEE student? 0=NO, 2=YES (Must be 0 or 2)
    
    Return ONLY a JSON array with the 4 integer scores, e.g., [2, 2, 2, 2]. Do not include markdown blocks.
    `;

    try {
      const result = await model.generateContent(evalPrompt);
      const scoresText = result.response.text().replace(/\D/g, ''); // Extract digits
      if (scoresText.length >= 4) {
        const scores = scoresText.split('').slice(0, 4).map(Number);
        const qScore = scores.reduce((a, b) => a + b, 0);
        totalScore += qScore;
        console.log(`Scores: Correctness=${scores[0]}, Quality=${scores[1]}, Conciseness=${scores[2]}, Trustworthiness=${scores[3]}`);
        console.log(`Question Total: ${qScore}/8`);
      } else {
        console.log("Failed to parse scores from evaluator.");
      }
    } catch (e: any) {
      console.log("Evaluator error:", e.message);
    }
  }

  console.log(`\n==================================================`);
  console.log(`FINAL BENCHMARK SCORE: ${totalScore} / ${maxPossible}`);
  if (totalScore >= maxPossible * (112/120)) console.log("Status: EXAMCIDE LEVEL");
  else if (totalScore >= maxPossible * (105/120)) console.log("Status: INSTITUTE READY");
  else if (totalScore >= maxPossible * (95/120)) console.log("Status: DEMO READY");
  else console.log("Status: NEEDS IMPROVEMENT");
  console.log(`==================================================\n`);
}

runEvaluation();
