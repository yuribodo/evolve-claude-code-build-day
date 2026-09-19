/** Small deterministic PRNG (mulberry32) so runs are reproducible from a seed. */
export interface Rng {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  gaussian: (mean?: number, sigma?: number) => number;
  pick: <T>(items: readonly T[]) => T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + next() * (max - min);
  const int = (min: number, max: number) => Math.floor(range(min, max + 1));
  const chance = (p: number) => next() < p;
  const gaussian = (mean = 0, sigma = 1) => {
    const u = 1 - next();
    const v = next();
    return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  return { next, range, int, chance, gaussian, pick };
}
