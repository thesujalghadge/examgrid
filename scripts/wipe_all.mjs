import fs from "node:fs";
import path from "node:path";
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
  const accessToken = env.SUPABASE_ACCESS_TOKEN?.trim() || process.env.SUPABASE_ACCESS_TOKEN?.trim();

  if (!projectRef || !accessToken) {
    console.error("Missing credentials.");
    process.exit(1);
  }

  console.log(`Wiping all data in project ${projectRef}...`);

  const sql = `
    DO $$ 
    DECLARE 
      r RECORD;
    BEGIN 
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations') 
      LOOP 
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE;'; 
      END LOOP; 
    END $$;
  `;

  try {
    await runManagementQuery(projectRef, accessToken, sql);
    console.log("Database wiped successfully.");
  } catch (error) {
    console.error("Wipe failed:", error);
  }
}

main();
