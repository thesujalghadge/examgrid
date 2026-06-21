import { deleteInstituteGeminiKey } from "../src/lib/institute/get-institute-api-key";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const targetId = process.argv[2];
  if (!targetId) {
    console.error("Usage: npx tsx scripts/reset_institute_gemini_key.ts <institute_id>");
    process.exit(1);
  }

  console.log(`Resetting Gemini Key for Institute: ${targetId}`);
  try {
     const success = await deleteInstituteGeminiKey(targetId);
     if (success) {
        console.log("✅ Successfully cleared old encrypted key.");
        console.log("✅ You may now re-enter a new Gemini API key from the UI.");
     } else {
        console.log("❌ Failed to clear key. Please check the institute ID or database connection.");
     }
  } catch (e: any) {
     console.log("❌ Error:", e.message);
  }
}

main().catch(console.error);
