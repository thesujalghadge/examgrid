import { GeminiProvider } from "../src/lib/ai/providers/gemini-provider";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const questions = JSON.parse(fs.readFileSync("scripts/benchmark-data.json", "utf-8"));

function validateAsset(result: any, expectedAnswer: string) {
  const meta = result.aiMetadata;
  const normalize = (s: string) => s.toLowerCase().trim();
  
  if (!result.finalAnswer) return { passed: false, reason: "Final Answer missing." };
  if (expectedAnswer && normalize(result.finalAnswer) !== normalize(expectedAnswer)) {
    return { passed: false, reason: `Final Answer contradicts teacher key. Expected: ${expectedAnswer}, Got: ${result.finalAnswer}` };
  }
  
  if (!meta.subject) return { passed: false, reason: "Subject missing." };
  if (!meta.topic) return { passed: false, reason: "Topic missing." };
  if (!meta.difficulty) return { passed: false, reason: "Difficulty missing." };
  if (!meta.question_type) return { passed: false, reason: "Question Type missing." };
  if (!meta.primary_concept) return { passed: false, reason: "Primary Concept missing." };
  if (!meta.essential_steps || meta.essential_steps.length === 0) return { passed: false, reason: "Essential Steps missing." };

  const allText = JSON.stringify(meta);
  if (/as an ai|here is|certainly|let me|this means|so,/i.test(allText)) {
    return { passed: false, reason: "Conversational filler detected." };
  }
  if (/in the image|this image shows|the provided image/i.test(allText)) {
    return { passed: false, reason: "Image-description filler detected." };
  }

  const wordCount = allText.split(/\s+/).length;
  if (wordCount > 150) {
    return { passed: false, reason: `Total output exceeds 150 words (${wordCount} words).` };
  }

  return { passed: true, reason: null, wordCount };
}

async function runBenchmark() {
  const provider = new GeminiProvider();
  console.log(`Starting intelligence asset benchmark for ${questions.length} questions...`);
  
  const results = [];
  let passedCount = 0;
  let totalRetries = 0;
  let wordCounts = { Physics: [] as number[], Chemistry: [] as number[], Mathematics: [] as number[] };
  let reps: Record<string, any> = { Physics: null, Chemistry: null, Mathematics: null };

  for (const q of questions) {
    const providerInput = {
      questionId: q.id,
      instituteId: process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID || "ddcc7407-fbb6-42bd-9751-576ef43e2241",
      rawText: q.question_text,
      structuredOptions: q.options,
      correctAnswer: q.answer_key,
      extractedSubject: q.subject || "Unknown",
      extractedChapter: q.topic || "Unknown"
    };

    console.log(`\nProcessing ${q.id} - ${q.topic}...`);
    let passed = false;
    let retries = 0;
    let lastReason = "";
    let lastResult = null;
    let wordCount = 0;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const promptVersion = attempt === 1 ? "solution-v1" : "solution-v2-strict";
        let result = null;
        let rateLimitRetries = 0;
        
        while (rateLimitRetries < 5) {
           try {
              result = await provider.generateSolution(providerInput, promptVersion);
              break;
           } catch(apiErr: any) {
              if (apiErr.message.includes("429")) {
                 console.log(`  Rate limit hit, waiting 35s...`);
                 await new Promise(r => setTimeout(r, 35000));
                 rateLimitRetries++;
              } else {
                 throw apiErr;
              }
           }
        }
        
        if (!result) throw new Error("Rate limit exceeded max retries");

        const validation = validateAsset(result, q.answer_key);
        if (validation.passed) {
          passed = true;
          wordCount = validation.wordCount || 0;
          lastResult = result;
          console.log(`Attempt ${attempt}: PASSED (${wordCount} words)`);
          
          const subj = result.aiMetadata.subject;
          if (subj && wordCounts[subj as keyof typeof wordCounts]) {
             wordCounts[subj as keyof typeof wordCounts].push(wordCount);
             if (!reps[subj as keyof typeof reps]) reps[subj as keyof typeof reps] = result.aiMetadata;
          } else {
             // fallback mapping if subject is fuzzy
             const strSubj = (subj || q.subject || "").toLowerCase();
             if (strSubj.includes("phys")) { wordCounts.Physics.push(wordCount); if(!reps.Physics) reps.Physics = result.aiMetadata; }
             if (strSubj.includes("chem")) { wordCounts.Chemistry.push(wordCount); if(!reps.Chemistry) reps.Chemistry = result.aiMetadata; }
             if (strSubj.includes("math")) { wordCounts.Mathematics.push(wordCount); if(!reps.Mathematics) reps.Mathematics = result.aiMetadata; }
          }
          break;
        } else {
          lastReason = validation.reason || "Unknown";
          console.log(`Attempt ${attempt}: FAILED - ${lastReason}`);
          retries++;
        }
      } catch (e: any) {
         lastReason = e.message;
         console.log(`Attempt ${attempt}: ERROR - ${e.message}`);
         retries++;
      }
      await new Promise(r => setTimeout(r, 4500)); // rate limit delay
    }

    totalRetries += retries;
    if (passed) passedCount++;

    results.push({
      id: q.id,
      passed,
      retries,
      wordCount,
      reason: passed ? null : lastReason,
      output: lastResult ? lastResult.aiMetadata : null
    });
  }

  console.log(`\n=== BENCHMARK SUMMARY ===`);
  console.log(`Total Questions: ${questions.length}`);
  console.log(`Passed (Metadata completeness & Validation): ${passedCount}`);
  console.log(`Failed: ${questions.length - passedCount}`);
  console.log(`Success Rate: ${((passedCount / questions.length) * 100).toFixed(1)}%`);
  console.log(`Total Retries: ${totalRetries}`);
  
  const avg = (arr: number[]) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : "0";
  console.log(`Average Word Count:`);
  console.log(`  Physics: ${avg(wordCounts.Physics)} words`);
  console.log(`  Chemistry: ${avg(wordCounts.Chemistry)} words`);
  console.log(`  Mathematics: ${avg(wordCounts.Mathematics)} words`);

  console.log(`\n=== REPRESENTATIVE OUTPUTS ===`);
  if (reps.Physics) console.log(`[Physics]\n`, JSON.stringify(reps.Physics, null, 2));
  if (reps.Chemistry) console.log(`[Chemistry]\n`, JSON.stringify(reps.Chemistry, null, 2));
  if (reps.Mathematics) console.log(`[Mathematics]\n`, JSON.stringify(reps.Mathematics, null, 2));

  fs.writeFileSync("scripts/benchmark-results.json", JSON.stringify(results, null, 2));
}

runBenchmark();
