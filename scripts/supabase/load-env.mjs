import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

export function loadEnvFiles() {
  const merged = { ...process.env };
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      merged[key] = value;
    }
  }
  return merged;
}

export function getProjectRef(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

export const ROOT_DIR = ROOT;
