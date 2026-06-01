const fs = require('fs');

// Fix api-key/route.ts unused var
let routePath = 'src/app/api/institute/[instituteId]/api-key/route.ts';
let route = fs.readFileSync(routePath, 'utf8');
route = route.replace('createServiceRoleClient, ', '');
fs.writeFileSync(routePath, route);

// Fix students/page.tsx
let pagePath = 'src/app/institute/students/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(
  'try { await awaitRepositoryPersist(); } catch (err: any) { alert(`Failed to save student: ${err?.message || err?.code}`); return; }',
  'try { await awaitRepositoryPersist(); } catch (err: unknown) { const error = err as Error & { code?: string }; alert(`Failed to save student: ${error?.message || error?.code}`); return; }'
);
fs.writeFileSync(pagePath, page);

// Fix get-institute-api-key.ts
let keyPath = 'src/lib/institute/get-institute-api-key.ts';
let key = fs.readFileSync(keyPath, 'utf8');
key = key.replace(
  'catch (err: any) {',
  'catch (err: unknown) {'
).replace(
  'console.warn("[ExamGrid] Could not write fallback mock API keys file", err.message);',
  'const error = err as Error; console.warn("[ExamGrid] Could not write fallback mock API keys file", error.message);'
).replace(
  'catch (e: any) {',
  'catch (e: unknown) {'
);
fs.writeFileSync(keyPath, key);

console.log('Fixed lint issues');
