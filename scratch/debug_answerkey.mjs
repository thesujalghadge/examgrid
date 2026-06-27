const key = `
1-A
2. B
3 A
4,C
5->C
6: D
7 - 42
8	9
    `;

function normalizeText(text) {
  return text
    .replace(/[\u0000\uFEFF\u200B]/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/\S+@\S+\.\S+/gi, ' ')
    .replace(/\u00a9.*$/gim, ' ')
    .replace(/©.*$/gim, ' ')
    .replace(/all rights reserved.*/gi, ' ')
    .replace(/[-_]{3,}/g, ' ')
    .replace(/\n{2,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .trim()
    .split('\n')
    .filter((line) => !/^[\s\d.\-|#*]{1,3}$/.test(line))
    .join('\n')
    .trim();
}

function normalizeAnswerKeyText(text) {
  return normalizeText(text)
    .replace(/(\d{1,3})\s*,\s*([A-Da-d])/g, '$1,$2')
    .replace(/(\d{1,3})\s*,\s*(-?\d)/g, '$1,$2')
    .replace(/[|;\/\\]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');
}

const normalized = normalizeAnswerKeyText(key);
console.log('Normalized:');
console.log(JSON.stringify(normalized));
console.log('---lines---');
normalized.split('\n').forEach((line, i) => console.log(i, JSON.stringify(line)));

// Now run pattern 1 on it
const pattern1 = /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s*(?:[-\u2013>]+|[:.,])\s*\(?\s*([A-D])\s*\)?(?![A-Za-z])/gi;
const matches = [...normalized.matchAll(pattern1)];
console.log('Pattern1 matches:', matches.map(m => ({q: m[1], a: m[2]})));
