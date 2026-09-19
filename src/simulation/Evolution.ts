import { averageGenome } from "./Genetics";
import { TRAIT_KEYS, type Creature, type Genome, type SpeciesRecord, type TraitKey } from "./types";

export const EMPTY_GENOME: Genome = { size: 0, speed: 0, vision: 0, fertility: 0, armor: 0, color: 0 };

export function populationAverages(creatures: Creature[]): Genome {
  if (creatures.length === 0) return { ...EMPTY_GENOME };
  return averageGenome(creatures.map((c) => c.genome));
}

export function groupBySpecies(creatures: Creature[]): Map<number, Creature[]> {
  const map = new Map<number, Creature[]>();
  for (const c of creatures) {
    const list = map.get(c.speciesId);
    if (list) list.push(c);
    else map.set(c.speciesId, [c]);
  }
  return map;
}

export const MUTATION_LABELS: Record<TraitKey, { up: string; down: string }> = {
  size: { up: "Body size increasing", down: "Body size shrinking" },
  speed: { up: "Speed adaptation detected", down: "Slower, thriftier bodies spreading" },
  vision: { up: "Enlarged eyes detected", down: "Eyes shrinking" },
  fertility: { up: "Fertility rising", down: "Fertility declining" },
  armor: { up: "Defensive mutation detected", down: "Armor being shed" },
  color: { up: "Coloration shift detected", down: "Coloration shift detected" },
};

/**
 * Compare a species' current average against its origin; returns trait shifts
 * that crossed the threshold for the first time.
 */
export function detectTraitShifts(species: SpeciesRecord, threshold = 0.13): { trait: TraitKey; delta: number }[] {
  const out: { trait: TraitKey; delta: number }[] = [];
  for (const key of TRAIT_KEYS) {
    if (species.mutationFlags[key]) continue;
    let delta = species.averageGenome[key] - species.originGenome[key];
    if (key === "color") {
      const d = Math.abs(delta);
      delta = Math.min(d, 1 - d);
    }
    if (Math.abs(delta) >= threshold) {
      species.mutationFlags[key] = true;
      out.push({ trait: key, delta });
    }
  }
  return out;
}
