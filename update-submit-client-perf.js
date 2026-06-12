const fs = require('fs');
const file = 'c:/AI/examgrid/src/hooks/use-test-session-engine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const responsePayload = await postServerSubmit(fresh, mode);',
  'const submitStartMs = performance.now();\n      console.log(`[CBT] Starting server submission...`);\n      const responsePayload = await postServerSubmit(fresh, mode);\n      console.log(`[CBT] Server submission complete in ${Math.round(performance.now() - submitStartMs)}ms`);'
);

fs.writeFileSync(file, code);
