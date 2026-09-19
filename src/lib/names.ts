import type { Genome } from "@/simulation/types";

const NEUTRAL_PREFIX = ["Moss", "Fern", "Reed", "Bramble", "Marsh", "Pebble", "Willow", "Bog", "Lichen", "Heath", "Sedge", "Loam"];
const ARMOR_PREFIX = ["Stone", "Thorn", "Shale", "Flint", "Bark", "Ridge"];
const SPEED_PREFIX = ["Swift", "Gale", "Dart", "Fleet", "Rill"];
const SMALL_PREFIX = ["Mite", "Dew", "Wisp", "Pip", "Gnat"];
const BIG_PREFIX = ["Boulder", "Oak", "Bison", "Hulk", "Grave"];
const EYE_PREFIX = ["Owl", "Glim", "Star", "Moon", "Lantern"];

function huePrefixes(color: number): string[] {
  const h = color * 360;
  if (h < 25 || h >= 335) return ["Ember", "Rust", "Cinder", "Brick"];
  if (h < 60) return ["Amber", "Ochre", "Honey", "Copper"];
  if (h < 160) return ["Moss", "Fern", "Verdant", "Sage"];
  if (h < 210) return ["Teal", "Marsh", "Reed", "Lagoon"];
  if (h < 275) return ["Dusk", "Slate", "Shade", "Cobalt"];
  return ["Plum", "Violet", "Thistle", "Mauve"];
}

const SUFFIX = ["back", "fin", "crawler", "leaf", "ling", "root", "tail", "shell", "hopper", "runner", "wing", "claw", "mite", "darter", "spine", "foot", "kin", "gill"];

/** Deterministic-ish, phenotype-flavoured species name. Avoids names already taken. */
export function generateSpeciesName(genome: Genome, taken: Set<string>, seed: number): string {
  const rand = (n: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % n;
  };

  const prefixPool: string[] = [...NEUTRAL_PREFIX, ...huePrefixes(genome.color), ...huePrefixes(genome.color)];
  if (genome.armor > 0.45) prefixPool.push(...ARMOR_PREFIX, ...ARMOR_PREFIX);
  if (genome.speed > 0.65) prefixPool.push(...SPEED_PREFIX, ...SPEED_PREFIX);
  if (genome.size < 0.28) prefixPool.push(...SMALL_PREFIX);
  if (genome.size > 0.65) prefixPool.push(...BIG_PREFIX);
  if (genome.vision > 0.6) prefixPool.push(...EYE_PREFIX);

  const suffixPool = [...SUFFIX];
  if (genome.armor > 0.45) suffixPool.push("shell", "spine", "back");
  if (genome.speed > 0.65) suffixPool.push("runner", "darter", "hopper");
  if (genome.size < 0.3) suffixPool.push("ling", "mite");

  for (let i = 0; i < 60; i++) {
    const prefix = prefixPool[rand(prefixPool.length)];
    const suffix = suffixPool[rand(suffixPool.length)];
    if (prefix.toLowerCase().endsWith(suffix[0]) ) continue;
    const name = prefix + suffix;
    if (!taken.has(name)) return name;
  }
  return `Lineage ${taken.size + 1}`;
}
