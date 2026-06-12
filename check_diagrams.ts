import fs from 'fs';
import path from 'path';

(async () => {
  const semanticPath = path.join(process.cwd(), "public", "uploads", "cbt_assets", "benchmark_inst", "job_benchmark_002", "semantic.json");
  if (!fs.existsSync(semanticPath)) {
    console.log("No semantic.json found.");
    return;
  }
  const semanticJson = JSON.parse(fs.readFileSync(semanticPath, "utf-8"));
  
  let missingCount = 0;
  let validCount = 0;
  console.log("DIAGRAM VALIDATION REPORT\n=========================");

  for (const q of semanticJson.questions || []) {
    const assets = q.stemAssetPaths || [];
    for (const asset of assets) {
      // The asset path in JSON is likely absolute to public, e.g. /uploads/...
      const relativePath = asset.replace(/^\/+/, ""); 
      const fullPath = path.join(process.cwd(), "public", relativePath);
      
      if (fs.existsSync(fullPath)) {
        console.log(`[VALID] Q ID: ${q.id} -> ${asset}`);
        validCount++;
      } else {
        console.log(`[MISSING] Q ID: ${q.id} -> ${asset}`);
        missingCount++;
      }
    }
  }

  console.log("\n=========================");
  console.log(`Total Valid Diagrams: ${validCount}`);
  console.log(`Total Missing Diagrams: ${missingCount}`);
})();
