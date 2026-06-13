import { loadEnvFiles, getProjectRef } from "./scripts/supabase/load-env.mjs";

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
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

async function run() {
  const env = loadEnvFiles();
  const projectRef = getProjectRef(env);
  const accessToken = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;

  const sql = `SELECT * FROM institutes;`;
  const result = await runManagementQuery(projectRef, accessToken, sql);
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
