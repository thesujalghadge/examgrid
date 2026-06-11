const fs = require('fs');
const file = 'c:/AI/examgrid/src/components/institute/institute-paper-upload-flow.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '    awaitRepositoryPersist().catch(console.error);\n    logUploadEvent("paper_processing_published"',
  '    await awaitRepositoryPersist();\n    logUploadEvent("paper_processing_published"'
);

fs.writeFileSync(file, code);
