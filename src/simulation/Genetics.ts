import {
  BIG_MUTATION_RATE,
  BIG_MUTATION_SIGMA,
  CAMO_TARGET,
  MUTATION_RATE,
  MUTATION_SIGMA,
} from "./constants";
import type { Rng } from "./rng";
import { TRAIT_KEYS, type Genome, type TraitKey } from "./types";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The founding population: small, slow, green worms with modest eyes. */
export function seedGenome(rng: Rng): Genome {
  return {
    size: clamp01(rng.gaussian(0.32, 0.05)),
    speed: clamp01(rng.gaussian(0.4, 0.06)),
    vision: clamp01(rng.gaussian(0.3, 0.05)),
    fertility: clamp01(rng.gaussian(0.5, 0.06)),
    armor: clamp01(rng.gaussian(0.1, 0.04)),
    color: clamp01(rng.gaussian(0.2, 0.03)),
  };
}

/** Blend crossover: each gene lands between the parents, biased randomly toward one. */
export function crossover(a: Genome, b: Genome, rng: Rng): Genome {
  const child = {} as Genome;
  for (const key of TRAIT_KEYS) {
    const t = rng.range(0.25, 0.75);
    child[key] = a[key] + (b[key] - a[key]) * t;
  }
  return child;
}

export function mutate(genome: Genome, rng: Rng, rateScale = 1): Genome {
  const out = { ...genome };
  for (const key of TRAIT_KEYS) {
    if (rng.chance(MUTATION_RATE * rateScale)) {
      out[key] = clamp01(out[key] + rng.gaussian(0, MUTATION_SIGMA));
    }
    if (rng.chance(BIG_MUTATION_RATE * rateScale)) {
      out[key] = clamp01(out[key] + rng.gaussian(0, BIG_MUTATION_SIGMA));
    }
  }
  return out;
}

/** Color is circular (hue), so 0 and 1 are neighbours. */
function colorDelta(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d) * 2;
}

/** Euclidean distance in trait space (0 = identical). */
export function genomeDistance(a: Genome, b: Genome): number {
  let sum = 0;
  for (const key of TRAIT_KEYS) {
    const d = key === "color" ? colorDelta(a[key], b[key]) : a[key] - b[key];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function averageGenome(genomes: Genome[]): Genome {
  const avg: Genome = { size: 0, speed: 0, vision: 0, fertility: 0, armor: 0, color: 0 };
  if (genomes.length === 0) return avg;
  let cx = 0;
  let cy = 0;
  for (const g of genomes) {
    for (const key of TRAIT_KEYS) if (key !== "color") avg[key] += g[key];
    cx += Math.cos(g.color * Math.PI * 2);
    cy += Math.sin(g.color * Math.PI * 2);
  }
  for (const key of TRAIT_KEYS) if (key !== "color") avg[key] /= genomes.length;
  let hue = Math.atan2(cy, cx) / (Math.PI * 2);
  if (hue < 0) hue += 1;
  avg.color = hue;
  return avg;
}

/* ---------- Phenotype: how genes become physical costs & abilities ---------- */

export function maxEnergy(g: Genome): number {
  return 80 + g.size * 70;
}

/** Energy burned per tick simply by being alive. Every trait has a price. */
export function metabolism(g: Genome): number {
  return (
    0.1 +
    g.size * 0.3 +
    g.speed * g.speed * 0.24 +
    g.vision * 0.06 +
    g.armor * 0.11 +
    g.fertility * 0.05
  );
}

/** Pixels per tick. Armor is heavy. */
export function moveSpeed(g: Genome): number {
  return (0.34 + g.speed * 0.66) * (1 - g.armor * 0.28);
}

export function visionRadius(g: Genome): number {
  return 18 + g.vision * 70;
}

export function bodyRadius(g: Genome): number {
  return 2.2 + g.size * 4.5;
}

export function lifespanTicks(g: Genome): number {
  return 370 + g.size * 40;
}

/** 0..1, how well the body colour hides in grass. */
export function camouflage(g: Genome): number {
  return Math.max(0, 1 - colorDelta(g.color, CAMO_TARGET) * 1.6);
}

/** Probability a predator strike kills. Armor and bulk both help. */
export function killChance(g: Genome): number {
  return Math.max(0.08, 1 - g.armor * 0.8 - g.size * 0.2);
}

export function reproCooldownTicks(g: Genome): number {
  return 70 - g.fertility * 42;
}

export function hueOf(g: Genome): number {
  return g.color * 360;
}

export const TRAIT_LABELS: Record<TraitKey, string> = {
  size: "Size",
  speed: "Speed",
  vision: "Vision",
  fertility: "Fertility",
  armor: "Armor",
  color: "Color",
};
