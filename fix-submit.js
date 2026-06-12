const fs = require('fs');
let code = fs.readFileSync('c:/AI/examgrid/src/hooks/use-test-session-engine.ts', 'utf8');
code = code.replace(
  'if (!session.signedAnswerKey || !session.answerKey) return null;',
  'if (!session.signedAnswerKey || !session.answerKey) {\n        throw new Error("Cannot submit to server: missing answer key or signature.");\n      }'
);
fs.writeFileSync('c:/AI/examgrid/src/hooks/use-test-session-engine.ts', code);
