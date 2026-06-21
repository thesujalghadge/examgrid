import { loadEnvFiles, getProjectRef } from "./supabase/load-env.mjs";

async function runManagementQuery(projectRef, accessToken, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null
        ? body.message || body.error || JSON.stringify(body)
        : String(body);
    throw new Error(`Management API ${res.status}: ${msg}`);
  }
  return body;
}

async function main() {
  const env = loadEnvFiles();
  const projectRef = getProjectRef(env);
  const accessToken = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;

  if (!projectRef || !accessToken) {
    console.error("Missing project ref or access token");
    process.exit(1);
  }

  const sql = `
    UPDATE exams
    SET solutions_release_time = now() - interval '1 minute';
  `;

  console.log("Fixing null solutions_release_time...");
  
  try {
    const result = await runManagementQuery(projectRef, accessToken, sql);
    console.log("Database fixed successfully!", result);
  } catch (error) {
    console.error("Failed to fix database:", error.message);
  }
}

main();
