const fs = require('fs');

const baseDir = 'public/uploads/cbt_assets/benchmark_inst/job_benchmark_002';
const ocr = JSON.parse(fs.readFileSync(`${baseDir}/ocr.json`));
const math = JSON.parse(fs.readFileSync(`${baseDir}/math.json`));
const semantic = JSON.parse(fs.readFileSync(`${baseDir}/semantic.json`));

const targets = [1, 2, 10, 20, 30, 40, 50, 60, 75];

function findSemantic(num) {
  return semantic.questions.find(q => q.id === `Q${num}`);
}

function findOcrAndMath(regionIds) {
  let ocrTexts = [];
  let mathTexts = [];
  
  if (!regionIds) return { ocrTexts, mathTexts };

  for (const rid of regionIds) {
    // Strip "p1_" prefix if it exists
    const cleanRid = rid.replace(/^p\d+_/, '');
    
    for (const page of ocr.pages) {
      const reg = page.regions.find(r => r.id === cleanRid);
      if (reg) {
        ocrTexts.push(`[${reg.type}] ` + (reg.text || '').replace(/\n/g, ' '));
        break;
      }
    }
    
    for (const page of math.pages) {
      const reg = page.math_regions.find(r => r.id === cleanRid);
      if (reg) {
        mathTexts.push(`[${reg.type}] ` + (reg.math_text || '').replace(/\n/g, ' '));
        break;
      }
    }
  }
  return { ocrTexts, mathTexts };
}

let report = "";

for (const num of targets) {
  const sem = findSemantic(num);
  if (!sem) {
    report += `\n\n--- Q${num} ---\nNOT FOUND IN SEMANTIC.JSON`;
    continue;
  }
  
  const { ocrTexts, mathTexts } = findOcrAndMath(sem.metadata?.regionIds || []);
  
  report += `\n\n=== Q${num} ===\n`;
  report += `[SEMANTIC OUTPUT]\nStem: ${sem.stem.replace(/\n/g, ' ')}\n`;
  sem.options?.forEach((o, i) => {
    report += `Opt ${i+1}: ${o.text.replace(/\n/g, ' ')}\n`;
  });
  
  report += `\n[OCR OUTPUT]\n`;
  ocrTexts.forEach(t => report += `${t}\n`);
  
  report += `\n[MATH OUTPUT]\n`;
  mathTexts.forEach(t => report += `${t}\n`);
}

fs.writeFileSync('fidelity_trace.txt', report);
console.log("Done.");
