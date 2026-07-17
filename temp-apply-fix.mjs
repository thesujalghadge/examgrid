import fs from "node:fs";
import { loadEnvFiles, getProjectRef } from "./scripts/supabase/load-env.mjs";

async function run() {
  const env = loadEnvFiles();
  const projectRef = getProjectRef(env);
  const token = env.SUPABASE_ACCESS_TOKEN?.trim() || process.env.SUPABASE_ACCESS_TOKEN?.trim();

  const sql = fs.readFileSync("supabase/migrations/20260716102756_fix_rpc_legacy_key.sql", "utf8");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

run().catch(console.error);
