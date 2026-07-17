import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { ApexAcademyConfig } from "./configs/apex-academy";
import { DemoGenerator } from "./generator";
import { DemoValidator } from "./validator";

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

const args = process.argv.slice(2);
const command = args[0]; // generate or validate

async function main() {
  const config = ApexAcademyConfig; // Easily extended to load dynamically based on args

  if (command === "generate") {
    const generator = new DemoGenerator(supabase, config);
    await generator.generate();

    console.log("⚙️ Triggering Production Analytics Worker...");
    try {
      const { runAnalyticsWorker } = await import("@/lib/analytics/worker");
      await runAnalyticsWorker();
      console.log("✅ Production Analytics Worker completed successfully.");
    } catch (e: any) {
      console.error("❌ Analytics Worker failed:", e.message);
      // Wait, we need to bypass module resolution issues for ts-node / tsx if paths aren't perfectly mapped.
      // We will try dynamic import with relative path if @/ fails.
    }
  } else if (command === "validate") {
    const validator = new DemoValidator(supabase, config);
    await validator.validate();
  } else {
    console.error("Usage: npx tsx scripts/demo-factory/cli.ts [generate|validate]");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
