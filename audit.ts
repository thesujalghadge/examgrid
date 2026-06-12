import fs from 'fs';
import path from 'path';

(async () => {
  const dbPath = path.join(process.cwd(), ".codex", "db", "question_bank.json");
  if (!fs.existsSync(dbPath)) {
    console.log("No question bank found.");
    return;
  }
  const data = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  let semanticCount = 0;
  let legacyCount = 0;

  console.log("AUDITING RENDERED QUESTIONS (From DB)");
  for (const q of data) {
    const source = q._debug_source || "legacy_visual_extractor";
    console.log(`Question ID: ${q.id} | Source Adapter: ${source}`);
    if (source === "semantic_pipeline_v1") semanticCount++;
    else legacyCount++;
  }

  console.log(`\nREPORT:`);
  console.log(`semantic_pipeline_v1 count: ${semanticCount}`);
  console.log(`legacy_visual_extractor count: ${legacyCount}`);
  
  if (legacyCount > 0) {
    console.log(`\n[!] Legacy questions exist in the database.`);
  }

  // Audit diagrams
  console.log("\n==================================================");
  console.log("DIAGRAM VALIDATION");
  let missingDiagrams = 0;
  for (const q of data) {
    if (q.images && q.images.length > 0) {
      for (const img of q.images) {
        // img is a relative path like `/uploads/cbt_assets/...`
        // map to local filesystem
        const localPath = path.join(process.cwd(), "public", img.replace(/^\//, "").replace(/\//g, path.sep));
        if (!fs.existsSync(localPath)) {
          console.log(`[MISSING DIAGRAM] Q ID: ${q.id} -> ${img}`);
          missingDiagrams++;
        } else {
          console.log(`[VALID DIAGRAM] Q ID: ${q.id} -> ${img}`);
        }
      }
    }
  }
  if (missingDiagrams === 0) {
    console.log("All referenced diagrams exist.");
  } else {
    console.log(`Total missing diagrams: ${missingDiagrams}`);
  }
})();
