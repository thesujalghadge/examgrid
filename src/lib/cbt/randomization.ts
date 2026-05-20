/** Fisher–Yates shuffle (deterministic seed optional for tests). */
export function shuffleArray<T>(items: T[], random = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildOptionOrderMap(
  questionIds: string[],
  getOptionCount: (questionId: string) => number,
): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const qid of questionIds) {
    const n = getOptionCount(qid);
    if (n <= 1) {
      map[qid] = n === 1 ? [0] : [];
      continue;
    }
    map[qid] = shuffleArray(Array.from({ length: n }, (_, i) => i));
  }
  return map;
}
