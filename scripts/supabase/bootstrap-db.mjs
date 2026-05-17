#!/usr/bin/env node
/**
 * Apply ExamGrid migrations to linked Supabase project.
 *
 * Requires ONE of:
 *   SUPABASE_ACCESS_TOKEN  — Supabase Management API (recommended)
 *   SUPABASE_DB_PASSWORD   — direct CLI link + db push
 *
 * Also requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { loadEnvFiles, getProjectRef, ROOT_DIR } from "./load-env.mjs";

function readCliAccessToken() {
  const candidates = [
    path.join(os.homedir(), ".supabase", "access-token"),
    path.join(os.homedir(), ".config", "supabase", "access-token"),
    path.join(
      process.env.LOCALAPPDATA || "",
      "supabase",
      "access-token",
    ),
    path.join(process.env.APPDATA || "", "supabase", "access-token"),
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const token = fs.readFileSync(file, "utf8").trim();
        if (token) return token;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const MIGRATIONS_DIR = path.join(ROOT_DIR, "supabase", "migrations");

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

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

async function applyViaManagementApi(projectRef, accessToken) {
  const files = listMigrations();
  console.log(`Applying ${files.length} migration(s) via Management API…`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`  → ${file}`);
    await runManagementQuery(projectRef, accessToken, sql);
  }

  console.log("All migrations applied via Management API.");
}

function runCommand(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT_DIR,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function applyViaCli(projectRef, dbPassword) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (token) {
    console.log("Logging in to Supabase CLI…");
    await runCommand(npx, ["supabase", "login", "--token", token], {});
  }

  console.log(`Linking project ${projectRef}…`);
  const linkArgs = ["supabase", "link", "--project-ref", projectRef];
  if (dbPassword) {
    linkArgs.push("-p", dbPassword);
  }
  await runCommand(npx, linkArgs, {});

  console.log("Pushing migrations (supabase db push)…");
  await runCommand(npx, ["supabase", "db", "push"], {});

  console.log("Migrations pushed via Supabase CLI.");
}

async function main() {
  const env = loadEnvFiles();
  const projectRef = getProjectRef(env);

  if (!projectRef) {
    console.error("Missing or invalid NEXT_PUBLIC_SUPABASE_URL in .env.local");
    process.exit(1);
  }

  const accessToken =
    env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    readCliAccessToken();
  const dbPassword =
    env.SUPABASE_DB_PASSWORD?.trim() || process.env.SUPABASE_DB_PASSWORD?.trim();

  console.log(`Project ref: ${projectRef}`);

  try {
    if (accessToken) {
      await applyViaManagementApi(projectRef, accessToken);
    } else if (dbPassword) {
      await applyViaCli(projectRef, dbPassword);
    } else {
      console.error(`
Cannot apply migrations automatically without credentials.

Add ONE of these to .env.local (gitignored):

  SUPABASE_ACCESS_TOKEN=your-personal-access-token
    Create at: https://supabase.com/dashboard/account/tokens

  SUPABASE_DB_PASSWORD=your-database-password
    From: Supabase Dashboard → Project Settings → Database

Then run:  npm run db:bootstrap
`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
