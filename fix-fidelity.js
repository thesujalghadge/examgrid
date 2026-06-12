const fs = require('fs');

// 1. Update types/exam.ts to add images?: string[];
let examTypesPath = 'src/types/exam.ts';
let examTypes = fs.readFileSync(examTypesPath, 'utf8');
examTypes = examTypes.replace(
  'hasImage?: boolean;',
  'hasImage?: boolean;\n  images?: string[];'
);
fs.writeFileSync(examTypesPath, examTypes);

// 2. Update build-test-from-processing.ts to pass images
let buildPath = 'src/lib/cbt/build-test-from-processing.ts';
let build = fs.readFileSync(buildPath, 'utf8');
build = build.replace(
  'hasImage: normalized.hasImage,',
  'hasImage: normalized.hasImage,\n        images: normalized.images,'
);
fs.writeFileSync(buildPath, build);

// 3. Update institute-paper-upload-flow.tsx to use latex versions
let flowPath = 'src/components/institute/institute-paper-upload-flow.tsx';
let flow = fs.readFileSync(flowPath, 'utf8');
flow = flow.replace(
  'const optionLabels = isNumerical ? [] : (q.options ?? []);',
  'const optionLabels = isNumerical ? [] : (q.options ?? []).map((o: any) => o.latex || o.text || o);'
);
flow = flow.replace(
  'questionText: q.stem,',
  'questionText: q.stemLatex || q.stem,'
);
flow = flow.replace(
  'images: [],',
  'images: q.images || [],'
);
fs.writeFileSync(flowPath, flow);

// 4. Update QuestionCard.tsx to render images array
let qcPath = 'src/components/exam/QuestionCard.tsx';
let qc = fs.readFileSync(qcPath, 'utf8');
// replace the hasImage block
let targetImageBlock = `{question.hasImage ? (
            <div className="mx-4 mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
              Diagram detected. Refer to the original PDF for the figure.
            </div>
          ) : null}`;

let newImageBlock = `{question.images && question.images.length > 0 ? (
            <div className="mx-4 mb-4 space-y-3">
              {question.images.map((img, i) => (
                img.trim().startsWith("<svg") ? (
                  <div key={i} className="flex justify-center rounded-md border border-gray-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: img }} />
                ) : (
                  <div key={i} className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm italic text-gray-700">
                    {img}
                  </div>
                )
              ))}
            </div>
          ) : question.hasImage ? (
            <div className="mx-4 mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
              Diagram detected. Refer to the original PDF for the figure.
            </div>
          ) : null}`;

qc = qc.replace(targetImageBlock, newImageBlock);
fs.writeFileSync(qcPath, qc);

console.log('Fidelity update complete');
