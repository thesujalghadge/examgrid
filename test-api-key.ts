import { getInstituteGeminiKey } from "./src/lib/institute/get-institute-api-key";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
  const instituteId = "e4c7431f-7355-4109-8d39-7a45cab8acba";
  console.log(`[DEBUG] Fetching key for Institute: ${instituteId}`);
  try {
    const key = await getInstituteGeminiKey(instituteId);
    console.log(`[DEBUG] Key retrieved. Prefix: ${key.substring(0, 8)}...`);
    
    console.log(`[DEBUG] Initializing GoogleGenerativeAI...`);
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    console.log(`[DEBUG] Sending prompt 'Reply with OK'...`);
    const result = await model.generateContent("Reply with OK");
    console.log(`[DEBUG] Response: ${result.response.text().trim()}`);
  } catch (err: any) {
    console.error(`[ERROR]`, err.message);
  }
}

main();
