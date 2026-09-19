import {
  INITIAL_POPULATION,
  PREDATOR_MAX,
  SPECIES_CHECK_INTERVAL,
  SPECIES_STREAK_REQUIRED,
  TICKS_PER_YEAR,
  TILE,
  WEATHER_DURATION_YEARS,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { createCreature, updateCreature, type TickContext } from "./Creature";
import { ageFood, createEnvironment, spawnFood, weatherModifiers } from "./Ecosystem";
import { detectTraitShifts, groupBySpecies, MUTATION_LABELS, populationAverages } from "./Evolution";
import { averageGenome, hueOf, seedGenome } from "./Genetics";
import { spawnPredatorAtEdge, updatePredator, type PredatorContext } from "./Predator";
import { createRng, type Rng } from "./rng";
import { createSpecies, findDivergence, nameForSpecies } from "./Species";
import type {
  ChronicleEvent,
  ChronicleKind,
  Creature,
  EnvEventKind,
  Environment,
  Food,
  FxEvent,
  Predator,
  SimEvent,
  Snapshot,
  SpeciesRecord,
  Weather,
  YearRecord,
} from "./types";
import { buildGrid, createGrid, generateWorld, isPassable, randomPassablePoint, type SpatialGrid, type World } from "./World";

export interface Simulation {
  seed: number;
  rng: Rng;
  world: World;
  tick: number;
  creatures: Creature[];
  predators: Predator[];
  food: Food[];
  species: SpeciesRecord[];
  chronicle: ChronicleEvent[];
  env: Environment;
  history: YearRecord[];
  fx: FxEvent[];
  fxEnabled: boolean;
  counters: {
    ids: number;
    yearBirths: number;
    yearDeaths: number;
    totalBirths: number;
    totalDeaths: number;
    foodAcc: { acc: number };
    milestones: Set<number>;
    lastCollapseYear: number;
    hadPredators: boolean;
    predatorKills: number;
    totalEats: number;
  };
  listeners: Set<(e: SimEvent) => void>;
  grids: { food: SpatialGrid<Food>; creatures: SpatialGrid<Creature>; predators: SpatialGrid<Predator> };
}

export const yearOf = (sim: Simulation) => Math.floor(sim.tick / TICKS_PER_YEAR);

export function createSimulation(seed = Date.now() % 1_000_000): Simulation {
  const rng = createRng(seed);
  const world = generateWorld(rng);
  const sim: Simulation = {
    seed,
    rng,
    world,
    tick: 0,
    creatures: [],
    predators: [],
    food: [],
    species: [],
    chronicle: [],
    env: createEnvironment(),
    history: [],
    fx: [],
    fxEnabled: true,
    counters: {
      ids: 1,
      yearBirths: 0,
      yearDeaths: 0,
      totalBirths: 0,
      totalDeaths: 0,
      foodAcc: { acc: 0 },
      milestones: new Set(),
      lastCollapseYear: -100,
      hadPredators: false,
      predatorKills: 0,
      totalEats: 0,
    },
    listeners: new Set(),
    grids: { food: createGrid<Food>(), creatures: createGrid<Creature>(), predators: createGrid<Predator>() },
  };

  const nextId = () => sim.counters.ids++;

  // Seed life on one side of the river so the far bank must be colonised.
  const genomes = [];
  for (let i = 0; i < INITIAL_POPULATION; i++) {
    const p = randomPassablePoint(world, rng, i % 5 === 0 ? "right" : "left");
    const g = seedGenome(rng);
    genomes.push(g);
    sim.creatures.push(createCreature(nextId(), 1, p.x, p.y, g, i % 2 === 0 ? "M" : "F", 0, 0));
  }
  sim.species.push(createSpecies(1, "Original", null, 0, 0, averageGenome(genomes), INITIAL_POPULATION));

  // Initial food so nobody starves in the first seconds.
  for (let i = 0; i < 90; i++) {
    spawnFood({ world, rng, env: sim.env, food: sim.food, fx: [], fxEnabled: false, nextId, carry: { acc: 1 } });
  }

  addChronicle(sim, "seed", "Life seeded — 26 creatures, one species");
  return sim;
}

export function subscribe(sim: Simulation, fn: (e: SimEvent) => void): () => void {
  sim.listeners.add(fn);
  return () => sim.listeners.delete(fn);
}

function emit(sim: Simulation, e: SimEvent): void {
  for (const fn of sim.listeners) fn(e);
}

function addChronicle(sim: Simulation, kind: ChronicleKind, text: string, speciesId?: number): void {
  const event: ChronicleEvent = { id: sim.chronicle.length + 1, year: yearOf(sim), kind, text, speciesId };
  sim.chronicle.push(event);
  emit(sim, { kind: "chronicle", event });
}

/* ------------------------------------------------------------------ */

export function stepSimulation(sim: Simulation): void {
  sim.tick++;
  const { env, rng, world } = sim;
  const nextId = () => sim.counters.ids++;

  if (env.weatherTicksLeft > 0) {
    env.weatherTicksLeft--;
    if (env.weatherTicksLeft === 0) {
      env.weather = "clear";
      emit(sim, { kind: "weather", weather: "clear" });
      addChronicle(sim, "weather", "Skies cleared — conditions returned to normal");
    }
  }
  if (env.scorch) {
    env.scorch.ticksLeft--;
    if (env.scorch.ticksLeft <= 0) env.scorch = null;
  }

  const mods = weatherModifiers(env.weather);

  spawnFood({ world, rng, env, food: sim.food, fx: sim.fx, fxEnabled: sim.fxEnabled, nextId, carry: sim.counters.foodAcc });
  if (sim.tick % 25 === 0) sim.food = ageFood(sim.food);

  const foodGrid = buildGrid(sim.food, sim.grids.food);
  const creatureGrid = buildGrid(sim.creatures, sim.grids.creatures);
  const predatorGrid = sim.predators.length > 0 ? buildGrid(sim.predators, sim.grids.predators) : sim.grids.predators;

  const creaturesById = new Map<number, Creature>();
  for (const c of sim.creatures) creaturesById.set(c.id, c);

  // --- Predators hunt.
  const killed = new Set<number>();
  if (sim.predators.length > 0) {
    const spawned: Predator[] = [];
    const pctx: PredatorContext = {
      world,
      rng,
      tick: sim.tick,
      speedMul: mods.speedMul,
      creatureGrid,
      creaturesById,
      killed,
      predatorCount: sim.predators.length,
      spawned,
      fx: sim.fx,
      fxEnabled: sim.fxEnabled,
      nextId,
      onKill: () => {
        sim.counters.predatorKills++;
      },
    };
    const alivePredators: Predator[] = [];
    for (const p of sim.predators) if (updatePredator(p, pctx)) alivePredators.push(p);
    sim.predators = alivePredators.concat(spawned);
    if (sim.predators.length === 0 && sim.counters.hadPredators) {
      sim.counters.hadPredators = false;
      addChronicle(sim, "predator", "The predators starved — none remain");
    }
  }

  // --- Creatures live.
  const consumedFood = new Set<number>();
  const newborns: Creature[] = [];
  const ctx: TickContext = {
    world,
    rng,
    tick: sim.tick,
    env,
    speedMul: mods.speedMul,
    metabolismMul: mods.metabolismMul,
    population: sim.creatures.length,
    foodGrid,
    creatureGrid,
    creaturesById,
    predatorGrid,
    hasPredators: sim.predators.length > 0,
    consumedFood,
    newborns,
    fx: sim.fx,
    fxEnabled: sim.fxEnabled,
    nextId,
    onBirth: () => {
      sim.counters.yearBirths++;
      sim.counters.totalBirths++;
    },
    onEat: () => {
      sim.counters.totalEats++;
    },
  };

  const survivors: Creature[] = [];
  for (const c of sim.creatures) {
    if (killed.has(c.id)) {
      sim.counters.yearDeaths++;
      sim.counters.totalDeaths++;
      continue;
    }
    if (updateCreature(c, ctx)) {
      survivors.push(c);
    } else {
      sim.counters.yearDeaths++;
      sim.counters.totalDeaths++;
      if (sim.fxEnabled) sim.fx.push({ kind: "death", x: c.x, y: c.y, hue: hueOf(c.genome) });
    }
  }
  for (const nb of newborns) {
    const sp = sim.species.find((s) => s.id === nb.speciesId);
    if (sp) sp.totalBorn++;
  }
  sim.creatures = survivors.concat(newborns);
  if (consumedFood.size > 0) sim.food = sim.food.filter((f) => !consumedFood.has(f.id));

  if (sim.tick % 10 === 0) updateSpeciesPopulations(sim);
  if (sim.tick % TICKS_PER_YEAR === 0) endOfYear(sim);
  if (sim.tick % SPECIES_CHECK_INTERVAL === 0) checkDivergence(sim);
}

/* ------------------------------------------------------------------ */

function updateSpeciesPopulations(sim: Simulation): void {
  const groups = groupBySpecies(sim.creatures);
  for (const sp of sim.species) {
    if (sp.status === "extinct") continue;
    const members = groups.get(sp.id) ?? [];
    sp.population = members.length;
    if (members.length > sp.peakPopulation) sp.peakPopulation = members.length;
    if (members.length > 0) {
      sp.averageGenome = averageGenome(members.map((m) => m.genome));
    } else {
      sp.status = "extinct";
      sp.extinctYear = yearOf(sim);
      const lifespan = sp.extinctYear - sp.originYear;
      addChronicle(sim, "extinction", `${sp.name} went extinct after ${lifespan} years`, sp.id);
      emit(sim, { kind: "extinction", species: sp, lifespanYears: lifespan });
    }
  }
}

function endOfYear(sim: Simulation): void {
  const year = yearOf(sim);
  const population = sim.creatures.length;
  const record: YearRecord = {
    year,
    population,
    speciesCount: sim.species.filter((s) => s.status === "alive").length,
    food: sim.food.length,
    predators: sim.predators.length,
    births: sim.counters.yearBirths,
    deaths: sim.counters.yearDeaths,
    averages: populationAverages(sim.creatures),
  };
  sim.history.push(record);
  sim.counters.yearBirths = 0;
  sim.counters.yearDeaths = 0;

  for (const m of [50, 100, 150, 200]) {
    if (population >= m && !sim.counters.milestones.has(m)) {
      sim.counters.milestones.add(m);
      addChronicle(sim, "milestone", `Population reached ${m}`);
    }
  }

  const past = sim.history[sim.history.length - 11];
  if (past && past.population >= 20 && population < past.population * 0.55 && year - sim.counters.lastCollapseYear > 60) {
    sim.counters.lastCollapseYear = year;
    addChronicle(sim, "collapse", `Population collapse — ${past.population} → ${population}`);
  }

  if (year % 3 === 0) {
    for (const sp of sim.species) {
      if (sp.status !== "alive" || sp.population < 8) continue;
      for (const shift of detectTraitShifts(sp)) {
        const label = shift.delta > 0 ? MUTATION_LABELS[shift.trait].up : MUTATION_LABELS[shift.trait].down;
        const suffix = sim.species.filter((s) => s.status === "alive").length > 1 ? ` in ${sp.name}` : "";
        addChronicle(sim, "mutation", `${label}${suffix}`, sp.id);
      }
    }
  }

  emit(sim, { kind: "year", record });
}

function checkDivergence(sim: Simulation): void {
  const groups = groupBySpecies(sim.creatures);
  for (const sp of sim.species) {
    if (sp.status !== "alive") continue;
    const members = groups.get(sp.id) ?? [];
    const result = findDivergence(members);
    if (!result) {
      sp.divergenceStreak = Math.max(0, sp.divergenceStreak - 1);
      continue;
    }
    sp.divergenceStreak++;
    if (sp.divergenceStreak === 1 && yearOf(sim) - sp.lastDivergenceYear > 30) {
      sp.lastDivergenceYear = yearOf(sim);
      addChronicle(sim, "divergence", `Genetic divergence detected within ${sp.name}`, sp.id);
      emit(sim, { kind: "divergence", species: sp });
    }
    if (sp.divergenceStreak >= SPECIES_STREAK_REQUIRED) {
      const smaller = result.a.length <= result.b.length ? result.a : result.b;
      const centroid = result.a.length <= result.b.length ? result.centroidA : result.centroidB;
      const id = sim.species.length + 1;
      const name = nameForSpecies(centroid, sim.species, sim.seed + sim.tick + id * 7919);
      const generation = Math.round(smaller.reduce((s, c) => s + c.generation, 0) / smaller.length);
      const record = createSpecies(id, name, sp.id, yearOf(sim), generation, centroid, smaller.length);
      for (const c of smaller) c.speciesId = id;
      sim.species.push(record);
      sp.divergenceStreak = 0;
      sp.population -= smaller.length;
      addChronicle(sim, "species", `New species discovered: ${name} (from ${sp.name})`, id);
      emit(sim, { kind: "speciesDiscovered", species: record, parent: sp });
    }
  }
}

/* ------------------------------------------------------------------ */

/** Where the next meteor will land: near a random creature, so it always matters. */
export function pickMeteorTarget(sim: Simulation): { x: number; y: number; r: number } {
  const rng = sim.rng;
  const target = sim.creatures.length > 0 ? rng.pick(sim.creatures) : { x: WORLD_W / 2, y: WORLD_H / 2 };
  return {
    x: Math.min(WORLD_W - 30, Math.max(30, target.x + rng.range(-20, 20))),
    y: Math.min(WORLD_H - 30, Math.max(30, target.y + rng.range(-20, 20))),
    r: 72,
  };
}

export function triggerEvent(sim: Simulation, kind: EnvEventKind, meteorAt?: { x: number; y: number; r: number }): void {
  const { env, rng, world } = sim;
  const nextId = () => sim.counters.ids++;
  switch (kind) {
    case "rain":
    case "drought":
    case "winter": {
      if (env.weather === kind) {
        env.weather = "clear";
        env.weatherTicksLeft = 0;
        emit(sim, { kind: "weather", weather: "clear" });
        addChronicle(sim, "weather", "Skies cleared — conditions returned to normal");
        return;
      }
      env.weather = kind;
      env.weatherTicksLeft = WEATHER_DURATION_YEARS[kind] * TICKS_PER_YEAR;
      emit(sim, { kind: "weather", weather: kind });
      const text: Record<Weather, string> = {
        clear: "",
        rain: "Rainy season began — food is abundant",
        drought: "Drought began — food is scarce",
        winter: "Winter set in — cold, slow and hungry",
      };
      addChronicle(sim, "weather", text[kind]);
      return;
    }
    case "predator": {
      const count = Math.min(2, PREDATOR_MAX - sim.predators.length);
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        const p = spawnPredatorAtEdge(nextId(), rng, world);
        sim.predators.push(p);
        if (sim.fxEnabled) sim.fx.push({ kind: "predatorArrive", x: p.x, y: p.y });
      }
      const first = !env.predatorsIntroduced;
      env.predatorsIntroduced = true;
      sim.counters.hadPredators = true;
      addChronicle(sim, "predator", first ? "Predator introduced" : "More predators released");
      emit(sim, { kind: "predatorIntroduced", count });
      return;
    }
    case "meteor": {
      const { x, y, r } = meteorAt ?? pickMeteorTarget(sim);
      let killed = 0;
      sim.creatures = sim.creatures.filter((c) => {
        const d = Math.hypot(c.x - x, c.y - y);
        const doomed = d < r ? rng.chance(0.92) : d < r * 1.5 ? rng.chance(0.45) : false;
        if (doomed) killed++;
        return !doomed;
      });
      sim.predators = sim.predators.filter((p) => Math.hypot(p.x - x, p.y - y) > r);
      sim.food = sim.food.filter((f) => Math.hypot(f.x - x, f.y - y) > r * 1.4 && rng.chance(0.55));
      sim.counters.yearDeaths += killed;
      sim.counters.totalDeaths += killed;
      env.meteorCount++;
      env.scorch = { x, y, r: r * 0.9, ticksLeft: TICKS_PER_YEAR * 18 };
      sim.fx.push({ kind: "meteor", x, y, r });
      addChronicle(sim, "meteor", `Meteor impact — ${killed} creatures perished`);
      emit(sim, { kind: "meteor", x, y, killed });
      updateSpeciesPopulations(sim);
      return;
    }
  }
}

export function getSnapshot(sim: Simulation): Snapshot {
  const last = sim.history[sim.history.length - 1];
  let right = 0;
  for (const c of sim.creatures) {
    const row = Math.min(sim.world.riverX.length - 1, Math.floor(c.y / TILE));
    if (c.x > sim.world.riverX[row] * TILE) right++;
  }
  return {
    rightBankFraction: sim.creatures.length ? right / sim.creatures.length : 0,
    year: yearOf(sim),
    tick: sim.tick,
    population: sim.creatures.length,
    predators: sim.predators.length,
    food: sim.food.length,
    births: last?.births ?? 0,
    deaths: last?.deaths ?? 0,
    environment: { ...sim.env },
    species: sim.species,
    averageTraits: populationAverages(sim.creatures),
    recentEvents: sim.chronicle.slice(-8),
    history: sim.history,
  };
}

export function findCreatureAt(sim: Simulation, x: number, y: number, radius = 9): Creature | null {
  let best: Creature | null = null;
  let bestD = radius * radius;
  for (const c of sim.creatures) {
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export { isPassable, WORLD_W, WORLD_H };
