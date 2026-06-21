import { createClient } from "@supabase/supabase-js";
import { getInstituteGeminiKey } from "../src/lib/institute/get-institute-api-key";
import { encryptApiKey, decryptApiKey } from "../src/lib/crypto/api-key-encryption";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=========================================");
  console.log("  ExamGrid Gemini Key Verification Tool");
  console.log("=========================================\n");

  console.log("[1] Verifying Crypto Utilities...");
  try {
    const testKey = "test-key-123";
    const { encrypted, iv } = await encryptApiKey(testKey);
    const decrypted = await decryptApiKey(encrypted, iv);
    if (decrypted === testKey) {
      console.log("  ✅ Encryption/Decryption works flawlessly.\n");
    } else {
      console.log("  ❌ Encryption/Decryption mismatch.\n");
    }
  } catch (e: any) {
    console.log("  ❌ Encryption/Decryption error:", e.message, "\n");
  }

  console.log("[2] Verifying Target Institute (ddcc7407-fbb6-42bd-9751-576ef43e2241)...");
  const targetId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";
  
  const { data, error } = await supabase.from("institutes").select("*").eq("id", targetId).single();
  if (error) {
    console.log("  ❌ Failed to fetch institute from DB:", error.message);
  } else {
    console.log(`  🔍 DB Record present. Encrypted key exists: ${!!data.gemini_api_key_encrypted}, IV exists: ${!!data.gemini_api_key_iv}`);
  }

  try {
    const key = await getInstituteGeminiKey(targetId);
    console.log(`  ✅ Key retrieval successful. Key length: ${key.length}\n`);
  } catch (e: any) {
    console.log(`  ❌ Key retrieval failed.`);
    console.log(`     Reason: ${e.message}`);
    console.log(`     Conclusion: The decryption failed because the 'API_KEY_ENCRYPTION_SECRET' used to encrypt this record has likely changed or the record is corrupted.\n`);
  }

  console.log("[3] Verifying All Institutes...");
  const { data: institutes, error: listError } = await supabase.from("institutes").select("id, name");
  if (listError) {
    console.log("  ❌ Failed to list institutes:", listError.message);
  } else if (institutes) {
    for (const inst of institutes) {
      try {
         const key = await getInstituteGeminiKey(inst.id);
         console.log(`  ✅ [${inst.id}] ${inst.name} - Valid Key`);
      } catch (e: any) {
         console.log(`  ❌ [${inst.id}] ${inst.name} - Invalid/Missing Key (${e.message})`);
      }
    }
  }
}

main().catch(console.error);
