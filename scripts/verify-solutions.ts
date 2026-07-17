import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("Starting Solution Verification...");

  const { data: questions, error: qError } = await supabase.from("exam_questions").select("id");
  if (qError) throw qError;

  const { data: solutions, error: sError } = await supabase.from("question_solutions").select("question_id");
  if (sError) throw sError;

  const solutionCounts: Record<string, number> = {};
  solutions.forEach((s) => {
    solutionCounts[s.question_id] = (solutionCounts[s.question_id] || 0) + 1;
  });

  const duplicates = Object.entries(solutionCounts).filter(([_, count]) => count > 1);
  console.log(`1. Duplicate solutions (HAVING COUNT(*) > 1): ${duplicates.length} rows`);
  
  if (duplicates.length > 0) {
    console.warn("   Duplicate Question IDs:", duplicates.map(d => d[0]));
  }

  const solSet = new Set(solutions.map((s) => s.question_id));
  const missing = questions.filter((q) => !solSet.has(q.id));
  console.log(`2. Questions without solutions (LEFT JOIN ... WHERE s.id IS NULL): ${missing.length} rows`);
  
  if (missing.length > 0) {
    console.warn("   Missing Question IDs:", missing.map(m => m.id));
  }

  // Create temporary institute to avoid deleting global data
  console.log("\n[TEST MODE] - Creating temporary institute for isolated testing...");
  const tempInstituteId = randomUUID();
  const tempUserId = randomUUID();

  try {
    // 1. Create User
    await supabase.from("users").insert({
      id: tempUserId,
      email: `temp-verifier-${tempInstituteId}@test.com`,
      role: "admin",
      full_name: "Temp Verifier",
      password_hash: "temp"
    });

    // 2. Create Institute
    await supabase.from("institutes").insert({
      id: tempInstituteId,
      owner_id: tempUserId,
      name: "Temp Verification Institute"
    });
    console.log(`Created temp institute: ${tempInstituteId}`);

    // Here, future tests can insert mock exam_questions mapped to tempInstituteId,
    // run the worker, and then safely delete all data associated with tempInstituteId.
    console.log("Future verifiers should operate ONLY on this isolated tenant space.");

  } catch (error) {
    console.error("Error setting up temporary test space:", error);
  } finally {
    // Cleanup temporary resources
    console.log("Cleaning up temporary test space...");
    await supabase.from("institutes").delete().eq("id", tempInstituteId);
    await supabase.from("users").delete().eq("id", tempUserId);
    console.log("Cleanup complete.");
  }
}

run().catch(console.error);
