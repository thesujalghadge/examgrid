export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local-hash";
  readonly model = "examgrid-local-hash-v1";
  readonly dimensions = 128;

  async embed(text: string): Promise<number[]> {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .forEach((token) => {
        const hash = hashToken(token);
        const index = hash % this.dimensions;
        vector[index] += hash % 2 === 0 ? 1 : -1;
      });
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(6)));
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return new LocalHashEmbeddingProvider();
}

