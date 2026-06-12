const fs = require('fs');

// Fix students/page.tsx err unknown
let pagePath = 'src/app/institute/students/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(
  'try { await awaitRepositoryPersist(); } catch (err) { alert(`Failed to save student: ${err.message || err.code}`); return; }',
  'try { await awaitRepositoryPersist(); } catch (err: any) { alert(`Failed to save student: ${err?.message || err?.code}`); return; }'
);
fs.writeFileSync(pagePath, page);

// Fix institute-paper-upload-flow.tsx type error
let pufPath = 'src/components/institute/institute-paper-upload-flow.tsx';
let puf = fs.readFileSync(pufPath, 'utf8');

// Find the type ParsedGeminiQuestion
puf = puf.replace(
  'explanation?: string | null;',
  'explanation?: string | null;\n  hasImage?: boolean;'
);

fs.writeFileSync(pufPath, puf);
console.log('Done');
