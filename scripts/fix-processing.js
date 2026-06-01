const fs = require('fs');
let c = fs.readFileSync('src/lib/cbt/paper-processing.ts', 'utf8');

c = c.replace(
  '      questionType: "NUMERICAL",\n      questionText: normalized.stem,\n      options: [],',
  '      questionType: "NUMERICAL",\n      questionText: normalized.stem,\n      stemImage: meta.stemImage,\n      options: [],'
);

// handle potential CRLF
c = c.replace(
  '      questionType: "NUMERICAL",\r\n      questionText: normalized.stem,\r\n      options: [],',
  '      questionType: "NUMERICAL",\r\n      questionText: normalized.stem,\r\n      stemImage: meta.stemImage,\r\n      options: [],'
);

const oldLoop = `  for (const [index, label] of ["A", "B", "C", "D"].entries()) {
    const text = normalized.options[index]?.trim();
    if (text) options.push({ label, text });
  }`;

const oldLoopCRLF = oldLoop.replace(/\n/g, '\r\n');

const newLoop = `  for (const [index, label] of ["A", "B", "C", "D"].entries()) {
    const text = normalized.options[index]?.trim();
    const image = (meta as any).optionImages?.[index];
    if (text || image) options.push({ label, text: text || "", image });
  }`;

c = c.replace(oldLoop, newLoop);
c = c.replace(oldLoopCRLF, newLoop);


const oldMCQ = `    questionType: "MCQ_SINGLE",
    questionText: normalized.stem,
    options,`;

const oldMCQCRLF = oldMCQ.replace(/\n/g, '\r\n');

const newMCQ = `    questionType: "MCQ_SINGLE",
    questionText: normalized.stem,
    stemImage: meta.stemImage,
    options,`;

c = c.replace(oldMCQ, newMCQ);
c = c.replace(oldMCQCRLF, newMCQ);

fs.writeFileSync('src/lib/cbt/paper-processing.ts', c);
console.log('Fixed paper processing');
