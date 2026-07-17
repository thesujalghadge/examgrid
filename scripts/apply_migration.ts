import { config } from "dotenv";
config({ path: ".env.local" });

import * as fs from "fs";

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = "nuehkzaogrybhizgnchz";
  
  const sql = fs.readFileSync("supabase/migrations/20260630000000_master_syllabus.sql", "utf-8");

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Migration failed:", response.status, errorText);
    process.exit(1);
  } else {
    console.log("Migration executed successfully!");
    const data = await response.json();
    console.log(data);
  }
}

main().catch(console.error);
