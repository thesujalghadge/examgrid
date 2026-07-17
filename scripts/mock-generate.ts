import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { SOLUTION_PROMPT_V3 } from "../src/lib/ai/prompts/solution-v3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const responseSchemaV3: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    examMode: {
      type: SchemaType.OBJECT,
      properties: {
        concepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        keyEquations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        fastSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        examTricks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        estimatedSolveTime: { type: SchemaType.STRING },
        finalAnswerSummary: { type: SchemaType.STRING },
        confidenceScore: { type: SchemaType.NUMBER }
      },
      required: ["concepts", "keyEquations", "fastSteps", "estimatedSolveTime"]
    },
    learnMode: {
      type: SchemaType.OBJECT,
      properties: {
        keyIdea: { type: SchemaType.STRING },
        conceptChips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        notations: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              symbol: { type: SchemaType.STRING },
              meaning: { type: SchemaType.STRING }
            },
            required: ["symbol", "meaning"]
          }
        },
        steps: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              reasoning: { type: SchemaType.STRING },
              equation: { type: SchemaType.STRING },
              result: { type: SchemaType.STRING }
            },
            required: ["title", "reasoning"]
          }
        },
        importantObservation: { type: SchemaType.STRING },
        commonMistakes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        takeaway: { type: SchemaType.STRING },
        assumptions: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              assumption: { type: SchemaType.STRING },
              validity: { type: SchemaType.STRING },
              failure: { type: SchemaType.STRING }
            },
            required: ["assumption", "validity", "failure"]
          }
        }
      },
      required: ["keyIdea", "conceptChips", "steps", "takeaway"]
    },
    finalAnswer: {
      type: SchemaType.OBJECT,
      properties: {
        value: { type: SchemaType.STRING },
        option: { type: SchemaType.STRING }
      },
      required: ["value"]
    },
    availableModes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    subject: { type: SchemaType.STRING },
    topic: { type: SchemaType.STRING },
    subtopic: { type: SchemaType.STRING },
    difficulty: { type: SchemaType.STRING },
    questionType: { type: SchemaType.STRING },
    primaryConcept: { type: SchemaType.STRING }
  },
  required: [
    "examMode", "learnMode", "finalAnswer", "availableModes",
    "subject", "topic", "subtopic", "difficulty", "questionType", "primaryConcept"
  ]
};

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchemaV3,
    }
  });

  const promptLogic = SOLUTION_PROMPT_V3
    .replace("{{questionId}}", "q-logic")
    .replace("{{extractedSubject}}", "Physics")
    .replace("{{extractedChapter}}", "Semiconductors")
    .replace("{{questionType}}", "MCQ")
    .replace("{{rawText}}", "Which of the following logic gates represents the boolean expression Y = (A+B)'?")
    .replace("{{structuredOptions}}", JSON.stringify({ A: "NAND", B: "AND", C: "OR", D: "NOR" }))
    .replace("{{correctAnswer}}", "D");

  console.log("Generating Logic Gate Solution...");
  const logicRes = await model.generateContent([{ text: promptLogic }]);
  const logicJson = JSON.parse(logicRes.response.text());

  const promptInterference = SOLUTION_PROMPT_V3
    .replace("{{questionId}}", "q-interference")
    .replace("{{extractedSubject}}", "Physics")
    .replace("{{extractedChapter}}", "Wave Optics")
    .replace("{{questionType}}", "MCQ")
    .replace("{{rawText}}", "In a Young's double slit experiment, the slit separation is 0.5mm and screen distance is 1m. If the wavelength of light is 500nm, what is the fringe width?")
    .replace("{{structuredOptions}}", JSON.stringify({ A: "0.5 mm", B: "1.0 mm", C: "1.5 mm", D: "2.0 mm" }))
    .replace("{{correctAnswer}}", "B");

  console.log("Generating Interference Solution...");
  const intRes = await model.generateContent([{ text: promptInterference }]);
  const intJson = JSON.parse(intRes.response.text());

  const fs = require("fs");
  fs.writeFileSync("logic-gate.json", JSON.stringify(logicJson, null, 2));
  fs.writeFileSync("interference.json", JSON.stringify(intJson, null, 2));

  console.log("Done.");
}
run();
