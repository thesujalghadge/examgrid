const fs = require('fs');
const file = 'c:/AI/examgrid/src/lib/palette-styles.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '"bg-violet-600 border-2 border-green-500 text-white ring-2 ring-green-400 ring-inset"',
  '"bg-violet-600 border-2 border-violet-700 text-white relative after:absolute after:-bottom-1 after:-right-1 after:h-2.5 after:w-2.5 after:rounded-full after:bg-green-500 after:border after:border-white"'
);

fs.writeFileSync(file, code);
