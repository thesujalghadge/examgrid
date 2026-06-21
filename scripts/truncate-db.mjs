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
    DO $$ 
    DECLARE 
      stmt TEXT; 
    BEGIN 
      SELECT 'TRUNCATE TABLE ' || string_agg(quote_ident(table_schema) || '.' || quote_ident(table_name), ', ') || ' CASCADE;'
      INTO stmt
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
      
      IF stmt IS NOT NULL THEN
        EXECUTE stmt;
      END IF;
    END $$;

    -- Re-seed default institute
    insert into public.institutes (id, name, slug, contact_email)
    values (
      '00000000-0000-0000-0000-000000000001',
      'ExamGrid Default Institute',
      'default',
      null
    ),
    (
      'ddcc7407-fbb6-42bd-9751-576ef43e2241',
      'ExamGrid Institute (User)',
      'user-institute',
      null
    )
    on conflict (id) do nothing;
  `;

  console.log("Truncating all public tables...");
  
  try {
    const result = await runManagementQuery(projectRef, accessToken, sql);
    console.log("Database cleared successfully!", result);
  } catch (error) {
    console.error("Failed to clear database:", error.message);
  }
}

main();
