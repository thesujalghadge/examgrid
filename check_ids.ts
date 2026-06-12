import fs from 'fs';
import path from 'path';

(async () => {
    const semanticPath = path.join(process.cwd(), "public", "uploads", "cbt_assets", "benchmark_inst", "job_benchmark_002", "semantic.json");
    const semanticStr = fs.readFileSync(semanticPath, "utf-8");
    const semanticJson = JSON.parse(semanticStr);

    console.log("DUMPING IDS FROM SEMANTIC.JSON");
    const questions = semanticJson.questions || [];
    
    let duplicatesFound = false;
    const seenIds = new Set<string>();

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const display = `Q${i + 1} -> id=${q.id}`;
        console.log(display);

        if (seenIds.has(q.id)) {
            console.log(`  [!] DUPLICATE DETECTED: ${q.id}`);
            duplicatesFound = true;
        }
        seenIds.add(q.id);
    }

    if (!duplicatesFound) {
        console.log("\nAll IDs are UNIQUE in semantic.json.");
    }
})();
