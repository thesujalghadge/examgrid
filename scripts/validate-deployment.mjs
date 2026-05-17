#!/usr/bin/env node
import { loadEnvFiles } from "./supabase/load-env.mjs";

const env = loadEnvFiles();
const mode = env.NEXT_PUBLIC_REPOSITORY_MODE ?? "local";
const issues = [];

if (!["local", "supabase"].includes(mode)) {
  issues.push("NEXT_PUBLIC_REPOSITORY_MODE must be local or supabase.");
}

if (mode === "supabase") {
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://")) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL must be set to an https Supabase URL.");
  }
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required in supabase mode.");
  }
  if (!env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID) {
    issues.push("NEXT_PUBLIC_DEFAULT_INSTITUTE_ID is required in supabase mode.");
  }
}

console.log("=== ExamGrid deployment validation ===");
console.log(`Repository mode: ${mode}`);

if (issues.length > 0) {
  for (const issue of issues) console.log(`✗ ${issue}`);
  process.exit(1);
}

console.log("✓ Environment shape is deployment-ready.");
