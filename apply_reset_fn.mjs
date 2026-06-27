/**
 * apply_fn_via_api.mjs
 * Applies the reset_demo_data() function directly via Supabase Management API.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.error("❌ SUPABASE_ACCESS_TOKEN missing from .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(
  path.resolve(__dirname, "supabase/migrations/20260623040000_reset_demo_fn.sql"),
  "utf-8"
);

console.log(`Applying SQL to project ${projectRef}...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();

if (!res.ok) {
  console.error(`❌ Failed (${res.status}):`, body);
  process.exit(1);
}

console.log("✅ SQL applied successfully.");
console.log("   Response:", body.slice(0, 500));
