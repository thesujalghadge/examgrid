import fs from 'fs';
import path from 'path';

(async () => {
    console.log("Loading benchmark semantic.json...");
    const semanticPath = path.join(process.cwd(), "public", "uploads", "cbt_assets", "benchmark_inst", "job_benchmark_002", "semantic.json");
    const semanticStr = fs.readFileSync(semanticPath, "utf-8");
    const semanticJson = JSON.parse(semanticStr);
    
    console.log(`Parsed JSON. Found ${semanticJson.questions?.length} questions.`);
    if (semanticJson.questions?.length !== 75) {
        throw new Error("Expected 75 questions!");
    }

    console.log("Validating question mapping logic (similar to CBT runtime)...");
    const mappedQuestions = (semanticJson.questions || []).map((q: any) => {
        return {
            id: q.id,
            type: q.type,
            subject: q.subject,
            stem: q.stem,
            options: (Array.isArray(q.options) ? q.options : []).map((opt: any, idx: number) => {
                const optRecord = typeof opt === "object" && opt !== null ? opt : null;
                const optText = typeof opt === "string" ? opt : typeof optRecord?.text === "string" ? optRecord.text : "";
                const optImg = typeof optRecord?.assetPath === "string" ? optRecord.assetPath : undefined;
                return {
                    id: (idx + 1).toString(),
                    text: optText,
                    image: optImg
                };
            }),
            answer: q.answer,
            images: q.stemAssetPaths || [],
            hasImage: (Array.isArray(q.stemAssetPaths) && q.stemAssetPaths.length > 0)
        };
    });

    console.log("Checking question fidelity...");
    const indicesToVerify = [0, 14, 29, 44, 59, 74]; // Q1, Q15, Q30, Q45, Q60, Q75
    for (let idx of indicesToVerify) {
        const q = mappedQuestions[idx];
        if (!q.stem) throw new Error(`Question ${idx + 1} has no stem!`);
        if (q.options.length === 0 && q.type === "mcq") throw new Error(`Question ${idx + 1} has no options!`);
        console.log(`Verified Q${idx + 1}: Stem Length: ${q.stem.length}, Options: ${q.options.length}, Images: ${q.images.length}, Answer: ${q.answer}`);
    }

    console.log("\n[SUCCESS] CBT Runtime Logic Validation Passed!");
})();
