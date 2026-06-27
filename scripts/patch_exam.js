const fs = require('fs');

// Patch types/exam.ts
let typesStr = fs.readFileSync('src/types/exam.ts', 'utf8');
typesStr = typesStr.replace('solutionsReleaseTime?: string;\r\n}', 'solutionsReleaseTime?: string;\n  instituteId?: string;\n}');
typesStr = typesStr.replace('solutionsReleaseTime?: string;\n}', 'solutionsReleaseTime?: string;\n  instituteId?: string;\n}');
fs.writeFileSync('src/types/exam.ts', typesStr);

// Patch exam-mapper.ts
let mapperStr = fs.readFileSync('src/repositories/supabase/mappers/exam-mapper.ts', 'utf8');
mapperStr = mapperStr.replace('scheduledAt: examRow.scheduled_at,', 'scheduledAt: examRow.scheduled_at,\n    instituteId: examRow.institute_id,');
fs.writeFileSync('src/repositories/supabase/mappers/exam-mapper.ts', mapperStr);
console.log('Patched types and mapper');
