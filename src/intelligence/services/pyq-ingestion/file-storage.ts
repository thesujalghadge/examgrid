import fs from "node:fs";
import path from "node:path";
import { getIntelligenceEnv } from "@/intelligence/config/env";

export function sourceFilePath(sourceId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(
    getIntelligenceEnv().storagePath,
    "sources",
    sourceId,
    safe,
  );
}

export async function persistSourceFile(
  sourceId: string,
  fileName: string,
  data: Buffer,
): Promise<string> {
  const fullPath = sourceFilePath(sourceId, fileName);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, data);
  return fullPath;
}

export async function readSourceFile(storagePath: string): Promise<Buffer> {
  return fs.promises.readFile(storagePath);
}
