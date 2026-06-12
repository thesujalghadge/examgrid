const fs = require('fs');

// 1. Update route.ts
let routePath = 'src/app/api/institute/[instituteId]/parse-paper/route.ts';
let route = fs.readFileSync(routePath, 'utf8');

const importVisual = `import { runVisualExtractor } from "@/lib/server/visual-extractor";\n`;
route = route.replace('import { getInstituteGeminiKey', importVisual + 'import { getInstituteGeminiKey');

route = route.replace('text: z.string()', 'text: z.string().optional()');
route = route.replace('latex: z.string().nullable().optional(),', 'latex: z.string().nullable().optional(),\n  image: z.string().optional(),');

route = route.replace('stem: z.string().min(1),', 'stem: z.string().optional(),\n  stem_image: z.string().optional(),');

const oldGeminiCall = `    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      { inlineData: { mimeType: detectedMimeType, data: buffer.toString("base64") } },
      PARSE_PROMPT,
    ]);

    let text = result.response.text().trim();
    text = text.replace(/^\\\`\\\`\\\`json?\\s*/i, "").replace(/\\s*\\\`\\\`\\\`$/, "").trim();

    let parsed: ParsedPaper;
    try {
      parsed = parsedPaperSchema.parse(JSON.parse(text));`;

const newGeminiCall = `    let parsed: ParsedPaper;
    try {
      if (detectedMimeType === "application/pdf") {
        const rawJson = await runVisualExtractor(buffer, geminiKey);
        parsed = parsedPaperSchema.parse(rawJson);
      } else {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
          { inlineData: { mimeType: detectedMimeType, data: buffer.toString("base64") } },
          PARSE_PROMPT,
        ]);
        let text = result.response.text().trim();
        text = text.replace(/^\\\`\\\`\\\`json?\\s*/i, "").replace(/\\s*\\\`\\\`\\\`$/, "").trim();
        parsed = parsedPaperSchema.parse(JSON.parse(text));
      }`;

route = route.replace(oldGeminiCall, newGeminiCall);
fs.writeFileSync(routePath, route);


// 2. Update types
let typesPath = 'src/types/cbt-paper-processing.ts';
let types = fs.readFileSync(typesPath, 'utf8');
types = types.replace('hasImage?: boolean;', 'hasImage?: boolean;\n  stemImage?: string;\n  optionImages?: string[];');
fs.writeFileSync(typesPath, types);

let examTypesPath = 'src/types/exam.ts';
let examTypes = fs.readFileSync(examTypesPath, 'utf8');
examTypes = examTypes.replace('label: string;', 'label: string;\n  image?: string;');
examTypes = examTypes.replace('hasImage?: boolean;', 'hasImage?: boolean;\n  stemImage?: string;');
fs.writeFileSync(examTypesPath, examTypes);


// 3. Update institute flow
let flowPath = 'src/components/institute/institute-paper-upload-flow.tsx';
let flow = fs.readFileSync(flowPath, 'utf8');
flow = flow.replace('latex?: string | null;', 'latex?: string | null;\n  image?: string;');
flow = flow.replace('stemLatex?: string | null;', 'stemLatex?: string | null;\n  stem_image?: string;');

flow = flow.replace(
  'const optionLabels = isNumerical ? [] : (q.options ?? []).map((o: any) => o.latex || o.text || o);',
  'const optionLabels = isNumerical ? [] : (q.options ?? []).map((o: any) => o.latex || o.text || o.id || "");\n    const optionImages = isNumerical ? [] : (q.options ?? []).map((o: any) => o.image || "");'
);

flow = flow.replace('questionText: q.stemLatex || q.stem,', 'questionText: q.stemLatex || q.stem || "",\n      stemImage: q.stem_image,');
flow = flow.replace('optionLabels,', 'optionLabels,\n      optionImages,');
fs.writeFileSync(flowPath, flow);

let buildTestPath = 'src/lib/cbt/build-test-from-processing.ts';
let buildTest = fs.readFileSync(buildTestPath, 'utf8');
buildTest = buildTest.replace(
  'text: normalized.options[index]?.trim() || label,',
  'text: normalized.options[index]?.trim() || label,\n              image: normalized.metadata[`optionImage_${index}`] as string | undefined,'
);
buildTest = buildTest.replace(
  'hasImage: normalized.hasImage,',
  'hasImage: normalized.hasImage,\n        stemImage: normalized.stemImage,'
);
// In buildTest, we must ensure optionImages are passed via metadata if we don't have optionImages natively in the Normalized object?
// Actually, build-test-from-processing uses NormalizedQuestionMeta. Let's see if we can just update it.
// We'll update paper-processing.ts normalizeProcessedPaper to pass them.

let procPath = 'src/lib/cbt/paper-processing.ts';
let proc = fs.readFileSync(procPath, 'utf8');
proc = proc.replace('metadata: { ...q.metadata },', 'metadata: { ...q.metadata, ...(q as any).optionImages?.reduce((acc: any, img: any, i: number) => ({...acc, [\\`optionImage_\\${i}\\`]: img}), {}) },');
fs.writeFileSync(procPath, proc);


// 4. Update QuestionCard.tsx
let qcPath = 'src/components/exam/QuestionCard.tsx';
let qc = fs.readFileSync(qcPath, 'utf8');
qc = qc.replace(
  '<MathRenderer text={question.text} className="text-base leading-relaxed text-gray-800" />',
  `{question.stemImage ? <img src={question.stemImage} alt="Question" className="max-w-full max-h-[500px] object-contain" /> : <MathRenderer text={question.text} className="text-base leading-relaxed text-gray-800" />}`
);

qc = qc.replace(
  '<MathRenderer text={displayOptionText} className="text-sm leading-6" />',
  `{opt.image ? <img src={opt.image} alt={opt.label} className="max-w-full max-h-[200px] object-contain" /> : <MathRenderer text={displayOptionText} className="text-sm leading-6" />}`
);
fs.writeFileSync(qcPath, qc);

console.log("Patched pipeline");
