import { generateSpeciesName } from "@/lib/names";
import { SPECIES_DIVERGENCE_THRESHOLD, SPECIES_MIN_CLUSTER, SPECIES_MIN_POP } from "./constants";
import { averageGenome, genomeDistance } from "./Genetics";
import type { Creature, Genome, SpeciesRecord } from "./types";

export function createSpecies(
  id: number,
  name: string,
  parentId: number | null,
  originYear: number,
  originGeneration: number,
  genome: Genome,
  population: number,
): SpeciesRecord {
  return {
    id,
    name,
    parentId,
    originYear,
    originGeneration,
    extinctYear: null,
    status: "alive",
    population,
    peakPopulation: population,
    averageGenome: { ...genome },
    originGenome: { ...genome },
    divergenceStreak: 0,
    lastDivergenceYear: -100,
    mutationFlags: {},
    totalBorn: population,
  };
}

export function nameForSpecies(genome: Genome, existing: SpeciesRecord[], seed: number): string {
  return generateSpeciesName(genome, new Set(existing.map((s) => s.name)), seed);
}

export interface ClusterResult {
  distance: number;
  within: number;
  a: Creature[];
  b: Creature[];
  centroidA: Genome;
  centroidB: Genome;
}

/** Two-means clustering in trait space. Always returns the best split it can find (or null if degenerate). */
export function clusterTwo(members: Creature[]): ClusterResult | null {
  if (members.length < 4) return null;

  // Seed centroids with two far-apart members.
  const mean = averageGenome(members.map((m) => m.genome));
  let far1 = members[0];
  let best = -1;
  for (const m of members) {
    const d = genomeDistance(m.genome, mean);
    if (d > best) {
      best = d;
      far1 = m;
    }
  }
  let far2 = members[0];
  best = -1;
  for (const m of members) {
    const d = genomeDistance(m.genome, far1.genome);
    if (d > best) {
      best = d;
      far2 = m;
    }
  }

  let ca = { ...far1.genome };
  let cb = { ...far2.genome };
  let a: Creature[] = [];
  let b: Creature[] = [];
  for (let iter = 0; iter < 10; iter++) {
    a = [];
    b = [];
    for (const m of members) {
      if (genomeDistance(m.genome, ca) <= genomeDistance(m.genome, cb)) a.push(m);
      else b.push(m);
    }
    if (a.length === 0 || b.length === 0) return null;
    const na = averageGenome(a.map((m) => m.genome));
    const nb = averageGenome(b.map((m) => m.genome));
    const moved = genomeDistance(na, ca) + genomeDistance(nb, cb);
    ca = na;
    cb = nb;
    if (moved < 0.001) break;
  }

  const spread = (group: Creature[], c: Genome) =>
    group.reduce((s, m) => s + genomeDistance(m.genome, c), 0) / group.length;
  const within = (spread(a, ca) + spread(b, cb)) / 2;
  return { distance: genomeDistance(ca, cb), within, a, b, centroidA: ca, centroidB: cb };
}

/**
 * Returns a split only when the two groups are far apart, both viable, and
 * each tight relative to their separation (a real gap, not a smear).
 */
export function findDivergence(members: Creature[]): ClusterResult | null {
  if (members.length < SPECIES_MIN_POP) return null;
  const result = clusterTwo(members);
  if (!result) return null;
  const small = result.a.length <= result.b.length ? result.a : result.b;
  if (small.length < SPECIES_MIN_CLUSTER || small.length < members.length * 0.15) return null;
  if (result.distance < SPECIES_DIVERGENCE_THRESHOLD) return null;
  if (result.within * 1.6 > result.distance) return null;
  // Must be a self-sustaining breeding population, not a handful of odd adults.
  const juveniles = small.filter((c) => c.age < 100).length;
  if (juveniles < 3) return null;
  return result;
}
