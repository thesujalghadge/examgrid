const fs = require('fs');
const file = 'c:/AI/examgrid/src/app/api/cbt/test-session/submit/route.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'export async function POST(request: Request) {',
  'export async function POST(request: Request) {\n  const startMs = performance.now();'
);

code = code.replace(
  '  const resultBreakdown = evaluateTestSession({',
  '  const evalStartMs = performance.now();\n  const resultBreakdown = evaluateTestSession({'
);

code = code.replace(
  '    useCache: false,\n  });',
  '    useCache: false,\n  });\n  const evalEndMs = performance.now();'
);

code = code.replace(
  '  try {\n    await saveCbtSubmission(submission);',
  '  const dbStartMs = performance.now();\n  try {\n    await saveCbtSubmission(submission);'
);

code = code.replace(
  '    return NextResponse.json(\n      { error: "Submission could not be saved. Retrying is safe." },\n      { status: 503 },\n    );\n  }',
  '    return NextResponse.json(\n      { error: "Submission could not be saved. Retrying is safe." },\n      { status: 503 },\n    );\n  }\n  const dbEndMs = performance.now();'
);

code = code.replace(
  '  logCbtGuard("cbt submit accepted", {',
  '  logCbtGuard("cbt submit accepted", {\n    perf_eval_ms: Math.round(evalEndMs - evalStartMs),\n    perf_db_ms: Math.round(dbEndMs - dbStartMs),\n    perf_total_ms: Math.round(performance.now() - startMs),'
);

fs.writeFileSync(file, code);
