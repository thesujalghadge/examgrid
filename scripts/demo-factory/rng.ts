// A deterministic PRNG (Mulberry32)
export class DeterministicRNG {
  private state: number;

  constructor(seedString: string) {
    this.state = this.hashString(seedString);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return hash;
  }

  // Returns a float between 0 and 1
  public next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns integer between min and max (inclusive)
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Deterministic UUID v4-like string
  public nextUUID(): string {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) uuid += '-';
      else if (i === 14) uuid += '4';
      else if (i === 19) uuid += hex[Math.floor(this.next() * 4) + 8];
      else uuid += hex[Math.floor(this.next() * 16)];
    }
    return uuid;
  }
}
