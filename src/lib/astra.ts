import { camouflage } from "@/simulation/Genetics";
import type { Genome, SimEvent, Snapshot } from "@/simulation/types";

/**
 * Astra — the in-world naturalist. Deterministic heuristics produce short
 * observations + hypotheses when something meaningful happens. The provider
 * abstraction lets an LLM take over later, but nothing here needs a key.
 */

export type AstraTone = "neutral" | "alert" | "discovery" | "grief" | "wonder";

export interface AstraMessage {
  id: number;
  year: number;
  observation: string;
  hypothesis?: string;
  tone: AstraTone;
  /** Priority messages bypass rate limiting. */
  priority: boolean;
}

export interface AstraMemory {
  nextId: number;
  lastMessageYear: number;
  flags: Set<string>;
  predatorIntroYear: number | null;
  traitsAtPredator: Genome | null;
  traitTrendCooldown: Record<string, number>;
  lastCollapseYear: number;
  lastStagnationYear: number;
}

export function createAstraMemory(): AstraMemory {
  return {
    nextId: 1,
    lastMessageYear: -100,
    flags: new Set(),
    predatorIntroYear: null,
    traitsAtPredator: null,
    traitTrendCooldown: {},
    lastCollapseYear: -100,
    lastStagnationYear: 0,
  };
}

function say(
  mem: AstraMemory,
  year: number,
  observation: string,
  hypothesis: string | undefined,
  tone: AstraTone,
  priority = false,
): AstraMessage {
  mem.lastMessageYear = year;
  return { id: mem.nextId++, year, observation, hypothesis, tone, priority };
}

function once(mem: AstraMemory, flag: string): boolean {
  if (mem.flags.has(flag)) return false;
  mem.flags.add(flag);
  return true;
}

/* ------------------------------------------------------------------ */
/* Immediate reactions to simulation events                            */
/* ------------------------------------------------------------------ */

export function reactToEvent(event: SimEvent, snap: Snapshot, mem: AstraMemory): AstraMessage | null {
  const y = snap.year;
  switch (event.kind) {
    case "predatorIntroduced": {
      if (mem.predatorIntroYear === null) {
        mem.predatorIntroYear = y;
        mem.traitsAtPredator = { ...snap.averageTraits };
        return say(mem, y, "A predator has entered the ecosystem.", "Watch for changes in size, speed and colour. Something will have to give.", "alert", true);
      }
      return say(mem, y, "More predators. The pressure just doubled.", undefined, "alert", true);
    }
    case "weather": {
      switch (event.weather) {
        case "rain":
          return say(mem, y, "Rain. The meadow is greening fast.", "Abundance relaxes selection — expect variety to bloom.", "neutral", true);
        case "drought":
          return say(mem, y, "Food is disappearing.", "This will test them. Thrift and energy storage should win.", "alert", true);
        case "winter":
          return say(mem, y, "Winter has come.", "Every trait now has a cost. The frugal will survive.", "alert", true);
        case "clear":
          return say(mem, y, "Conditions have returned to normal.", "Whatever survived the hard season will define what comes next.", "neutral", true);
      }
      return null;
    }
    case "divergence":
      return say(
        mem,
        y,
        `I'm detecting persistent genetic divergence within ${event.species.name}.`,
        "This population may be splitting into two distinct groups.",
        "wonder",
        true,
      );
    case "speciesDiscovered":
      return say(mem, y, `A new species has emerged: ${event.species.name}.`, "You didn't design this creature. The environment did.", "discovery", true);
    case "extinction": {
      const alive = snap.species.filter((s) => s.status === "alive").length;
      const hyp =
        alive === 0
          ? "The meadow is silent. Nothing here was fit enough for these conditions."
          : `It survived ${event.lifespanYears} years. Its lineage ends here; its cousins carry on.`;
      return say(mem, y, `${event.species.name} is gone.`, hyp, "grief", true);
    }
    case "meteor":
      return say(mem, y, `Impact. ${event.killed} creatures perished in an instant.`, "Whoever survives will found the next lineage — by luck, not fitness.", "alert", true);
    case "chronicle": {
      if (event.event.kind === "predator" && event.event.text.startsWith("The predators starved")) {
        return say(mem, y, "The predators have starved.", "Their prey became too fast, too wary, or too well hidden to catch.", "neutral", true);
      }
      return null;
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Periodic analysis (call once per simulated year)                    */
/* ------------------------------------------------------------------ */

export function analyzeSimulation(snap: Snapshot, mem: AstraMemory): AstraMessage | null {
  const y = snap.year;
  const h = snap.history;
  const pop = snap.population;
  const avg = snap.averageTraits;

  if (y <= 1 && once(mem, "seeded")) {
    return say(mem, y, "Life has been seeded. Twenty-six small foragers, one river.", "With food this abundant, I expect the colony to grow quickly.", "neutral", true);
  }

  // Priority-ish structural observations.
  if (pop >= 50 && once(mem, "pop50")) {
    return say(mem, y, "The colony is thriving.", "Growth will slow once they eat faster than the meadow regrows.", "neutral");
  }
  if (pop >= 100 && once(mem, "pop100")) {
    return say(mem, y, "One hundred individuals. The meadow is near capacity.", "From here on, competition for food will do the selecting.", "neutral");
  }
  if (snap.rightBankFraction > 0.25 && once(mem, "crossed")) {
    return say(mem, y, "They've crossed the river.", "Two banks, two populations. Isolation is how species begin.", "wonder", true);
  }

  // Collapse.
  const past = h[h.length - 11];
  if (past && past.population >= 20 && pop < past.population * 0.55 && y - mem.lastCollapseYear > 60) {
    mem.lastCollapseYear = y;
    let hyp = "They outgrew the meadow. Overgrazing, then famine — a cycle as old as life.";
    if (snap.predators > 0) hyp = "The predators are taking more than the meadow can replace.";
    else if (snap.environment.weather === "drought") hyp = "Food scarcity is driving this. Only the thrifty will make it through.";
    else if (snap.environment.weather === "winter") hyp = "The cold is expensive. Large, fast bodies burn out first.";
    return say(mem, y, `Population collapse detected — ${past.population} → ${pop}.`, hyp, "alert", true);
  }

  if (y - mem.lastMessageYear < 6) return null;

  // Post-predator selection signatures.
  if (mem.predatorIntroYear !== null && mem.traitsAtPredator && y - mem.predatorIntroYear >= 8) {
    const t0 = mem.traitsAtPredator;
    if (avg.size < t0.size - 0.05 && once(mem, "pred-size")) {
      return say(mem, y, "Smaller creatures are surviving longer since the predator appeared.", "The predator appears to be selecting against larger, more visible bodies.", "wonder");
    }
    if (avg.speed > t0.speed + 0.07 && once(mem, "pred-speed")) {
      return say(mem, y, "The population is getting faster.", "Only those that outrun the predator live long enough to breed.", "wonder");
    }
    if (avg.armor > t0.armor + 0.07 && once(mem, "pred-armor")) {
      return say(mem, y, "Defensive traits are spreading through the population.", "Armor is expensive — but being eaten is more so.", "wonder");
    }
    if (camouflage(avg) > camouflage(t0) + 0.12 && once(mem, "pred-camo")) {
      return say(mem, y, "Their colour is shifting toward the grass.", "Camouflage. The predator can't chase what it can't see.", "wonder");
    }
  }

  // Generic trait trends vs. 40 years ago.
  const old = h[h.length - 41];
  if (old) {
    const trend = (key: keyof Genome, delta: number, obs: string, hyp: string) => {
      const d = avg[key] - old.averages[key];
      const flag = `${key}-${delta > 0 ? "up" : "down"}`;
      const cool = mem.traitTrendCooldown[flag] ?? -1000;
      if ((delta > 0 ? d > delta : d < delta) && y - cool > 80) {
        mem.traitTrendCooldown[flag] = y;
        return say(mem, y, obs, hyp, "wonder");
      }
      return null;
    };
    const m =
      trend("vision", 0.08, "Eyes are getting larger.", "Finding food first matters more than ever.") ??
      trend("size", 0.09, "Bodies are growing larger.", "Bigger bodies store more energy — insurance against lean years.") ??
      trend("size", -0.09, "Bodies are shrinking.", "Small is cheap. When food is thin, cheap wins.") ??
      trend("fertility", -0.08, "Fertility is declining.", "Breeding is costly when food is scarce. Thrift is winning.") ??
      trend("fertility", 0.08, "Fertility is rising.", "Abundance rewards whoever breeds fastest.") ??
      (mem.predatorIntroYear === null
        ? trend("speed", 0.08, "They're getting faster.", "Whoever reaches food first eats. Speed is an arms race.")
        : null) ??
      trend("armor", 0.08, "Armor is thickening.", "Something is making defence worth its cost.") ??
      trend("armor", -0.08, "Armor is being shed.", "With no predators around, heavy plating is just dead weight.");
    if (m) return m;
  }

  // Stagnation.
  if (old && y - mem.lastMessageYear > 60 && y - mem.lastStagnationYear > 120) {
    let drift = 0;
    for (const k of ["size", "speed", "vision", "fertility", "armor"] as const) drift += Math.abs(avg[k] - old.averages[k]);
    if (drift < 0.1) {
      mem.lastStagnationYear = y;
      return say(mem, y, "Little has changed in sixty years.", "They seem well adapted. Change the conditions, and they will change.", "neutral");
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Provider abstraction                                                */
/* ------------------------------------------------------------------ */

export interface AstraProvider {
  name: string;
  analyze: (snap: Snapshot, mem: AstraMemory) => Promise<AstraMessage | null> | AstraMessage | null;
}

export const heuristicProvider: AstraProvider = {
  name: "heuristic",
  analyze: analyzeSimulation,
};

/**
 * Optional LLM provider. If NEXT_PUBLIC_ASTRA_ENDPOINT is set, the periodic
 * analysis is POSTed there and the reply used as Astra's voice. It falls back
 * to heuristics on any error, so the app never depends on a network call.
 */
export function createLlmProvider(endpoint: string): AstraProvider {
  return {
    name: "llm",
    analyze: async (snap, mem) => {
      const fallback = analyzeSimulation(snap, mem);
      if (!fallback) return null;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshot: { ...snap, history: snap.history.slice(-40) }, draft: fallback }),
        });
        if (!res.ok) return fallback;
        const data = (await res.json()) as { observation?: string; hypothesis?: string };
        if (!data.observation) return fallback;
        return { ...fallback, observation: data.observation, hypothesis: data.hypothesis ?? fallback.hypothesis };
      } catch {
        return fallback;
      }
    },
  };
}

export function getAstraProvider(): AstraProvider {
  const endpoint = process.env.NEXT_PUBLIC_ASTRA_ENDPOINT;
  return endpoint ? createLlmProvider(endpoint) : heuristicProvider;
}
