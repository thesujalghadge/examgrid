const fs = require('fs');
const file = 'c:/AI/examgrid/src/components/exam/QuestionPalette.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'item.color',
  'item.className'
);

code = code.replace(
  'key={`legend-${item.status}-${index}`}',
  'key={`legend-${item.status ?? "nat"}-${index}`}'
);

fs.writeFileSync(file, code);
