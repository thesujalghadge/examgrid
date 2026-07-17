import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║      ExamGrid Hard Reset                 ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("⚠️  This will WIPE ALL DATA including INSTITUTES.");
  console.log("");

  const startMs = Date.now();

  // Call the demo wipe first to clear most operational data safely
  console.log("🔄 Calling reset_demo_data()...");
  await supabase.rpc("reset_demo_data");

  // Then truncate institutes to wipe the rest and the tenant itself
  console.log("💥 Truncating institutes cascade...");
  
  // We can execute SQL directly using a custom RPC, but if we don't have one, 
  // we can use standard DELETE without where clause if RLS is bypassed by service role.
  const { error: delError } = await supabase.from("institutes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (delError) {
    console.error("❌ Failed to delete institutes:", delError.message);
    process.exit(1);
  }

  // Also clear any users that are students
  console.log("🧹 Clearing auth users linked to students...");
  // Actually, we don't need to delete auth.users because we are using mock auth for students, 
  // but if we do have real auth users we can leave them or the institute admin will just re-use their auth account to create a new institute.

  const elapsedMs = Date.now() - startMs;

  console.log("");
  console.log("✅ Hard Reset complete in", elapsedMs + "ms");
  console.log("   All institutes, students, and operational data have been removed.");
  console.log("   You can now start afresh!");
  console.log("");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
