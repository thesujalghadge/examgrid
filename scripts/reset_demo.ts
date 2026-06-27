/**
 * reset_demo.ts
 *
 * Clean-room demo data reset script.
 * Calls the reset_demo_data() Supabase RPC (SECURITY DEFINER),
 * which wipes all operational data in a single atomic transaction.
 *
 * PRESERVES: institutes, institute API keys, admin users.
 * WIPES:     exams, students, batches, attempts, solutions,
 *            analytics, queues, and resets the worker lock.
 *
 * Usage:
 *   npm run reset:demo
 *   npx tsx scripts/reset_demo.ts
 */

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
  console.log("║      ExamGrid Clean-Room Demo Reset      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("⚠️  This will WIPE all demo data.");
  console.log("   Institutes and API keys will be PRESERVED.");
  console.log("");

  const startMs = Date.now();

  // ── Invoke the SECURITY DEFINER RPC ────────────────────────────
  console.log("🔄 Calling reset_demo_data()...");
  const { data, error } = await supabase.rpc("reset_demo_data");

  if (error) {
    console.error("❌ Reset failed:", error.message);
    if (error.message.includes("does not exist")) {
      console.error("");
      console.error("   The reset_demo_data() function is missing from the database.");
      console.error("   Run the migration first:");
      console.error("     npx supabase db push");
      console.error("");
      console.error("   Or paste supabase/migrations/20260623040000_reset_demo_fn.sql");
      console.error("   directly into the Supabase SQL Editor.");
    }
    process.exit(1);
  }

  const elapsedMs = Date.now() - startMs;

  console.log("");
  console.log("✅ Reset complete in", elapsedMs + "ms");
  console.log("");
  console.log("   Result:", JSON.stringify(data, null, 2));
  console.log("");
  console.log("Next steps:");
  console.log("  1. Run: npm run verify:demo");
  console.log("  2. Verify all checks pass");
  console.log("  3. Confirm your institute has a Gemini API key configured");
  console.log("  4. Create students, batches, and publish an exam");
  console.log("");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
