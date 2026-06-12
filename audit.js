const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return `Error running command: ${cmd}\n${e.stderr || e.message}`;
  }
}

function readFileSafe(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    return `File not found: ${filePath}`;
  }
}

function walkDir(dir, pattern, extFilter) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walkDir(fullPath, pattern, extFilter));
      } else {
        if (extFilter && !extFilter.includes(path.extname(fullPath))) return;
        if (pattern && !fullPath.match(pattern)) return;
        results.push(fullPath);
      }
    });
  } catch (e) {}
  return results;
}

function searchInFiles(files, regex) {
  return files.filter(f => {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      return regex.test(content);
    } catch(e) { return false; }
  });
}

let report = "";

report += "### 1. Database Schema\n";
report += "Query 1:\n";
report += execSafe('npx supabase db query "SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = \'public\' ORDER BY table_name, ordinal_position;"') + "\n\n";

report += "Query 2:\n";
report += execSafe('npx supabase db query "SELECT conname, contype, conrelid::regclass AS table_name, confrelid::regclass AS foreign_table FROM pg_constraint WHERE contype = \'f\' ORDER BY conrelid::regclass::text;"') + "\n\n";

report += "---\n### 2. Repository Layer\n";
const repoFiles = [
  'src/repositories/supabase/supabase-batch-repository.ts',
  'src/repositories/supabase/supabase-student-repository.ts',
  'src/repositories/supabase/supabase-repo-utils.ts'
];
repoFiles.push(...walkDir('src/lib/repositories', null, ['.ts', '.tsx']));

const domainModels = [
  'src/types/institute.ts',
  'src/types/batch.ts',
  'src/types/student.ts',
  'src/types/exam.ts',
  'src/types/models.ts',
  'src/types/domain.ts'
];
repoFiles.push(...domainModels);

for (const f of new Set(repoFiles)) {
  report += `\n==== FILE: ${f.replace(/\\/g, '/')} ====\n`;
  report += readFileSafe(f) + "\n";
}

report += "---\n### 3. Institute & Batch Flow\n";
const batchFlowFiles = [
  'src/app/institute/batches/page.tsx',
  'src/app/institute/students/page.tsx',
  'src/app/admin/institutes/page.tsx',
  'src/app/platform/institutes/page.tsx',
  'src/contexts/InstituteContext.tsx',
  'src/hooks/useInstitute.ts'
];
for (const f of batchFlowFiles) {
  report += `\n==== FILE: ${f} ====\n`;
  report += readFileSafe(f) + "\n";
}

report += "---\n### 4. Test Creation & Paper Upload Flow\n";
const testFiles = [
  'src/app/institute/tests/page.tsx',
  'src/components/institute/institute-paper-upload-flow.tsx'
];
const allSrcFiles = walkDir('src', null, ['.ts', '.tsx']);
const parseUploadFiles = searchInFiles(allSrcFiles, /parse-paper|upload|FileUpload/i);
testFiles.push(...parseUploadFiles);

for (const f of new Set(testFiles)) {
  report += `\n==== FILE: ${f.replace(/\\/g, '/')} ====\n`;
  report += readFileSafe(f) + "\n";
}

report += "---\n### 5. Exam / CBT Interface\n";
const examFiles = [
  'src/components/exam/ExamInterface.tsx',
  'src/components/exam/QuestionPalette.tsx',
  'src/components/exam/QuestionCard.tsx',
  'src/components/exam/QuestionDisplay.tsx',
  'src/components/exam/MathRenderer.tsx'
];
for (const f of examFiles) {
  report += `\n==== FILE: ${f} ====\n`;
  report += readFileSafe(f) + "\n";
}

report += "---\n### 6. API Routes\n";
const apiFiles = walkDir('src/app/api', null, ['.ts', '.tsx']);
report += "List of API routes:\n" + apiFiles.map(f => f.replace(/\\/g, '/')).join('\n') + "\n";

for (const f of apiFiles) {
  const norm = f.replace(/\\/g, '/');
  if (norm.includes('institute') || norm.includes('parse-paper')) {
    report += `\n==== FILE: ${norm} ====\n`;
    report += readFileSafe(f) + "\n";
  }
}

report += "---\n### 7. Auth & Session\n";
report += "Checking how instituteId is obtained...\n";
report += "getServerSession usage:\n";
const serverSessionFiles = searchInFiles(allSrcFiles, /getServerSession/);
serverSessionFiles.forEach(f => {
  report += `\n==== FILE MATCH (getServerSession): ${f.replace(/\\/g, '/')} ====\n`;
  report += readFileSafe(f) + "\n";
});

report += "---\n### 8. Current Broken Behavior\n";
report += "Note: Batch creation error needs to be extracted from logs or manually reproduced.\n";

report += "---\n### 9. Package.json\n";
report += readFileSafe('package.json') + "\n";

report += "---\n### 10. Folder Structure\n";
const allSrc = walkDir('src', null, ['.ts', '.tsx']).map(f => f.replace(/\\/g, '/')).sort();
report += allSrc.join('\n') + "\n";

fs.writeFileSync('audit_output.txt', report);
console.log('Audit completed and written to audit_output.txt');
