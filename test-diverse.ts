import { GeminiProvider } from "./src/lib/ai/providers/gemini-provider";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const questions = [
  {
    subject: "Physics",
    chapter: "Mechanics",
    questionType: "Calculation",
    rawText: "A car starts from rest and accelerates uniformly at 2 m/s² for 10 seconds. Find the distance traveled.",
    structuredOptions: [{ id: "A", text: "100 m" }, { id: "B", text: "200 m" }, { id: "C", text: "50 m" }, { id: "D", text: "400 m" }],
    correctAnswer: "Option A"
  },
  {
    subject: "Physics",
    chapter: "Thermodynamics",
    questionType: "Conceptual",
    rawText: "Why is the specific heat of a gas at constant pressure (Cp) greater than its specific heat at constant volume (Cv)?",
    structuredOptions: [{ id: "A", text: "Work is done by the gas at constant pressure" }, { id: "B", text: "Internal energy increases more at constant volume" }, { id: "C", text: "Gas expands faster at constant volume" }, { id: "D", text: "Molecules move slower at constant pressure" }],
    correctAnswer: "Option A"
  },
  {
    subject: "Chemistry",
    chapter: "Chemical Kinetics",
    questionType: "Calculation",
    rawText: "A first-order reaction has a half-life of 10 minutes. How long will it take for the concentration to reduce to 12.5% of its initial value?",
    structuredOptions: [{ id: "A", text: "10 min" }, { id: "B", text: "20 min" }, { id: "C", text: "30 min" }, { id: "D", text: "40 min" }],
    correctAnswer: "Option C"
  },
  {
    subject: "Mathematics",
    chapter: "Calculus",
    questionType: "Calculation",
    rawText: "Evaluate the integral of x*sin(x) dx.",
    structuredOptions: [{ id: "A", text: "-x*cos(x) + sin(x) + C" }, { id: "B", text: "x*cos(x) - sin(x) + C" }, { id: "C", text: "-x*sin(x) + cos(x) + C" }, { id: "D", text: "x*sin(x) - cos(x) + C" }],
    correctAnswer: "Option A"
  }
];

async function run() {
  const provider = new GeminiProvider();
  let markdown = "# Diverse Questions V3 Output\n\n";

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log("Generating for " + q.subject + " - " + q.chapter + "...");
    
    try {
      const result = await provider.generateSolution({
        questionId: "mock-" + i,
        instituteId: "da368ae6-633e-4665-9fb1-44bf37ded332",
        rawText: q.rawText,
        structuredOptions: q.structuredOptions,
        correctAnswer: q.correctAnswer,
        extractedSubject: q.subject,
        extractedChapter: q.chapter,
        questionType: q.questionType
      });

      markdown += "## Question " + (i + 1) + ": " + q.subject + " - " + q.chapter + "\n";
      markdown += "**Text:** " + q.rawText + "\n\n";
      markdown += "### Raw AI Metadata\n```json\n" + JSON.stringify(result.aiMetadata, null, 2) + "\n```\n\n---\n\n";
    } catch (e: any) {
      console.error("Failed for " + q.subject + ": " + e.message);
    }
  }

  fs.writeFileSync("diverse_solutions.md", markdown);
  console.log("Done. Saved to artifacts.");
}

run();
