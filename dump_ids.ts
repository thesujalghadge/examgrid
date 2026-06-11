import fs from 'fs';
import path from 'path';

(async () => {
    const semanticPath = path.join(process.cwd(), "public", "uploads", "cbt_assets", "benchmark_inst", "job_benchmark_002", "semantic.json");
    const semanticStr = fs.readFileSync(semanticPath, "utf-8");
    const semanticJson = JSON.parse(semanticStr);

    console.log("DUMPING IDS FROM GEMINI PARSER CONVERSION STAGE");
    const questions = semanticJson.questions || [];
    
    let duplicatesFound = false;
    const seenIds = new Set<string>();

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionNumber = Number(q.id) || 1; // <--- The bug
        const questionId = `paper-12345-q${questionNumber}`;
        
        const display = `Original ID: ${q.id} -> questionNumber: ${questionNumber} -> questionId: ${questionId}`;
        console.log(display);

        if (seenIds.has(questionId)) {
            duplicatesFound = true;
        }
        seenIds.add(questionId);
    }

    if (duplicatesFound) {
        console.log("\n[!] DUPLICATES FOUND IN CONVERSION STAGE.");
    }
})();
