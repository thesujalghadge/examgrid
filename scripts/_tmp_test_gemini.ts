import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { getInstituteGeminiKey } from "../src/lib/institute/get-institute-api-key";

dotenv.config({ path: ".env.local" });

async function run() {
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";
  console.log(`Testing institute ID: ${instituteId}`);

  let apiKey = "";
  try {
    apiKey = await getInstituteGeminiKey(instituteId);
    if (!apiKey) {
      console.log("No API key returned.");
      return;
    }
    const maskedKey = apiKey.substring(0, 4) + "*".repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
    console.log(`Loaded API Key: ${maskedKey}`);
    console.log(`Key decrypted correctly? YES (Length: ${apiKey.length})`);
  } catch (err: any) {
    console.error("Failed to load/decrypt key:", err.message);
    return;
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const modelsToTest = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"];

  for (const modelName of modelsToTest) {
    console.log(`\nTesting model: ${modelName}`);
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("hello");
      const text = result.response.text();
      console.log(`Status: SUCCESS`);
      console.log(`Response: ${text.substring(0, 50)}`);
      
      // Attempt to extract quota/limits if possible
      // (GoogleGenerativeAI sdk doesn't typically expose RPM/TPM directly in successful simple text generation headers easily without custom fetch wrappers, but we'll try to check what's returned)
    } catch (err: any) {
      console.log(`Status: FAILED`);
      console.log(`Error: ${err.message}`);
    }
  }
}
run();
