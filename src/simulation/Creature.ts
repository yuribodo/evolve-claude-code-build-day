import {
  CHILD_START_ENERGY,
  CREATURE_START_ENERGY,
  MATE_MAX_DISTANCE,
  MATE_RADIUS,
  MATURITY_AGE,
  MAX_POPULATION,
  REPRO_COST_FATHER,
  REPRO_COST_MOTHER,
  REPRO_MIN_ENERGY,
  WORLD_H,
  WORLD_W,
} from "./constants";
import {
  bodyRadius,
  crossover,
  genomeDistance,
  hueOf,
  lifespanTicks,
  maxEnergy,
  metabolism,
  moveSpeed,
  mutate,
  reproCooldownTicks,
  visionRadius,
} from "./Genetics";
import type { Rng } from "./rng";
import type { Creature, Environment, Food, FxEvent, Genome, Predator, Sex } from "./types";
import { isPassable, queryGrid, type SpatialGrid, type World } from "./World";

export interface TickContext {
  world: World;
  rng: Rng;
  tick: number;
  env: Environment;
  speedMul: number;
  metabolismMul: number;
  population: number;
  foodGrid: SpatialGrid<Food>;
  creatureGrid: SpatialGrid<Creature>;
  creaturesById: Map<number, Creature>;
  predatorGrid: SpatialGrid<Predator>;
  hasPredators: boolean;
  consumedFood: Set<number>;
  newborns: Creature[];
  fx: FxEvent[];
  fxEnabled: boolean;
  nextId: () => number;
  onBirth: (child: Creature) => void;
  onEat: (creature: Creature) => void;
}

export function createCreature(
  id: number,
  speciesId: number,
  x: number,
  y: number,
  genome: Genome,
  sex: Sex,
  generation: number,
  tick: number,
  energy = CREATURE_START_ENERGY,
): Creature {
  return {
    id,
    speciesId,
    x,
    y,
    vx: 0,
    vy: 0,
    energy,
    age: 0,
    sex,
    genome,
    generation,
    state: "wander",
    targetX: x,
    targetY: y,
    hasTarget: false,
    reproCooldown: 10,
    wanderTimer: 0,
    facing: 1,
    phase: Math.random() * Math.PI * 2,
    bornTick: tick,
    hurtTimer: 0,
    blockedTimer: 0,
    mateId: -1,
    mateSearchTimer: 0,
  };
}

/** Coarse straight-line check: is there water/rock between here and there? */
export function hasLineOfSight(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isPassable(world, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

export function isAdult(c: Creature): boolean {
  return c.age >= MATURITY_AGE;
}

/** Returns true if the creature is still alive after this tick. */
export function updateCreature(c: Creature, ctx: TickContext): boolean {
  const g = c.genome;
  c.age++;
  if (c.reproCooldown > 0) c.reproCooldown--;
  if (c.hurtTimer > 0) c.hurtTimer--;
  if (c.blockedTimer > 0) c.blockedTimer--;
  c.phase += 0.25;

  const speed = moveSpeed(g) * ctx.speedMul;
  const radius = bodyRadius(g);
  const vision = visionRadius(g);

  // --- Perception: predators first, survival beats lunch.
  let fleeX = 0;
  let fleeY = 0;
  let threat = false;
  if (ctx.hasPredators) {
    const detect = vision * 1.1 + 10;
    queryGrid(ctx.predatorGrid, c.x, c.y, detect, (p, d2) => {
      threat = true;
      const d = Math.sqrt(d2) || 1;
      const w = 1 / d;
      fleeX += ((c.x - p.x) / d) * w;
      fleeY += ((c.y - p.y) / d) * w;
    });
  }

  let dirX = 0;
  let dirY = 0;
  let moving = true;

  if (threat) {
    c.state = "flee";
    c.hasTarget = false;
    const len = Math.hypot(fleeX, fleeY) || 1;
    dirX = fleeX / len;
    dirY = fleeY / len;
  } else {
    // Courtship has hysteresis: start looking when well fed, give up only when getting hungry.
    const courting = c.state === "mate" && c.mateId >= 0;
    const wantsMate =
      isAdult(c) &&
      c.reproCooldown <= 0 &&
      ctx.population < MAX_POPULATION &&
      c.energy > (courting ? REPRO_MIN_ENERGY * 0.7 : REPRO_MIN_ENERGY);

    let mate: Creature | null = null;
    if (wantsMate && c.blockedTimer <= 0) {
      if (courting) {
        const m = ctx.creaturesById.get(c.mateId);
        if (m && isMateCandidate(c, m) && Math.hypot(m.x - c.x, m.y - c.y) < 120 + vision) mate = m;
      }
      if (!mate) {
        c.mateSearchTimer--;
        if (c.mateSearchTimer <= 0) {
          // Mates are sensed further than food (scent), and good eyes help there too.
          mate = findMate(c, ctx, 80 + vision * 1.2);
          c.mateSearchTimer = mate ? 0 : 8;
        }
      }
    }
    c.mateId = mate ? mate.id : -1;

    // Nearest reachable food in sight (skipped while courting or when full).
    let food: Food | null = null;
    let bestD2 = Infinity;
    const hungry = c.energy < maxEnergy(g) * 0.9;
    if (c.blockedTimer <= 0 && !mate && hungry) {
      queryGrid(ctx.foodGrid, c.x, c.y, vision, (f, d2) => {
        if (d2 < bestD2 && !ctx.consumedFood.has(f.id) && hasLineOfSight(ctx.world, c.x, c.y, f.x, f.y)) {
          bestD2 = d2;
          food = f;
        }
      });
    }

    if (mate) {
      const m: Creature = mate;
      const d = Math.hypot(m.x - c.x, m.y - c.y);
      if (d <= MATE_RADIUS) {
        reproduce(c, m, ctx);
        moving = false;
        c.state = "mate";
      } else {
        c.state = "mate";
        dirX = (m.x - c.x) / d;
        dirY = (m.y - c.y) / d;
      }
    } else if (food) {
      const f: Food = food;
      c.state = "seek";
      c.hasTarget = true;
      c.targetX = f.x;
      c.targetY = f.y;
      const d = Math.sqrt(bestD2) || 1;
      if (d <= radius + 2.5) {
        ctx.consumedFood.add(f.id);
        c.energy = Math.min(maxEnergy(g), c.energy + f.energy);
        ctx.onEat(c);
        if (ctx.fxEnabled) ctx.fx.push({ kind: "eat", x: f.x, y: f.y });
        moving = false;
      } else {
        dirX = (f.x - c.x) / d;
        dirY = (f.y - c.y) / d;
      }
    } else {
      c.state = "wander";
      c.hasTarget = false;
      if (c.wanderTimer <= 0 || (c.vx === 0 && c.vy === 0)) {
        const a = ctx.rng.range(0, Math.PI * 2);
        c.vx = Math.cos(a);
        c.vy = Math.sin(a);
        c.wanderTimer = ctx.rng.int(25, 70);
      }
      c.wanderTimer--;
      const len = Math.hypot(c.vx, c.vy) || 1;
      dirX = c.vx / len + ctx.rng.gaussian(0, 0.08);
      dirY = c.vy / len + ctx.rng.gaussian(0, 0.08);
      const l2 = Math.hypot(dirX, dirY) || 1;
      dirX /= l2;
      dirY /= l2;
    }
  }

  // --- Movement with terrain collision (water and rock are impassable).
  let moved = 0;
  if (moving) {
    const wanderScale = c.state === "wander" ? 0.8 : 1;
    const step = speed * wanderScale;
    const nx = c.x + dirX * step;
    const ny = c.y + dirY * step;
    if (isPassable(ctx.world, nx, ny)) {
      c.x = nx;
      c.y = ny;
      moved = step;
    } else if (isPassable(ctx.world, nx, c.y)) {
      c.x = nx;
      moved = Math.abs(dirX * step);
    } else if (isPassable(ctx.world, c.x, ny)) {
      c.y = ny;
      moved = Math.abs(dirY * step);
    } else {
      // Blocked — turn around and forget the target for a while.
      c.vx = -dirX + ctx.rng.gaussian(0, 0.5);
      c.vy = -dirY + ctx.rng.gaussian(0, 0.5);
      c.wanderTimer = ctx.rng.int(15, 35);
      c.blockedTimer = 20;
      c.hasTarget = false;
    }
    if (c.state !== "wander") {
      c.vx = dirX;
      c.vy = dirY;
    }
    if (Math.abs(dirX) > 0.15) c.facing = dirX > 0 ? 1 : -1;
  }
  c.x = Math.min(WORLD_W - 2, Math.max(2, c.x));
  c.y = Math.min(WORLD_H - 2, Math.max(2, c.y));

  // --- Energy. Hungry bodies slow their metabolism (torpor), which spreads
  // starvation out over time instead of letting a whole herd die at once.
  const fill = c.energy / maxEnergy(g);
  const torpor = fill < 0.5 ? 0.55 + 0.9 * fill : 1;
  c.energy -= (metabolism(g) + moved * 0.05) * ctx.metabolismMul * torpor;

  if (c.energy <= 0) return false;
  if (c.age > lifespanTicks(g)) return false;
  return true;
}

function isMateCandidate(c: Creature, o: Creature): boolean {
  if (o === c || o.speciesId !== c.speciesId || o.sex === c.sex) return false;
  if (!isAdult(o) || o.reproCooldown > 0 || o.energy < REPRO_MIN_ENERGY * 0.65) return false;
  return genomeDistance(c.genome, o.genome) <= MATE_MAX_DISTANCE;
}

function findMate(c: Creature, ctx: TickContext, radius: number): Creature | null {
  let best: Creature | null = null;
  let bestScore = Infinity;
  queryGrid(ctx.creatureGrid, c.x, c.y, radius, (o, d2) => {
    if (!isMateCandidate(c, o)) return;
    // Prefer partners already courting us, then the nearest.
    const score = o.mateId === c.id ? d2 * 0.25 : d2;
    if (score < bestScore && hasLineOfSight(ctx.world, c.x, c.y, o.x, o.y)) {
      bestScore = score;
      best = o;
    }
  });
  return best;
}

function reproduce(a: Creature, b: Creature, ctx: TickContext): void {
  const mother = a.sex === "F" ? a : b;
  const father = mother === a ? b : a;
  const g = mother.genome;
  if (mother.energy < REPRO_COST_MOTHER + 12) {
    // Too thin to carry young safely — break off and go eat.
    mother.reproCooldown = 12;
    father.reproCooldown = 12;
    mother.mateId = -1;
    father.mateId = -1;
    return;
  }
  const fert = (mother.genome.fertility + father.genome.fertility) / 2;
  const litter = fert > 0.62 && ctx.rng.chance((fert - 0.62) * 1.4) ? 2 : 1;

  mother.energy -= REPRO_COST_MOTHER;
  father.energy -= REPRO_COST_FATHER;
  mother.reproCooldown = reproCooldownTicks(g);
  father.reproCooldown = reproCooldownTicks(father.genome) * 0.5;
  mother.mateId = -1;
  father.mateId = -1;

  for (let i = 0; i < litter; i++) {
    if (ctx.population + ctx.newborns.length >= MAX_POPULATION) break;
    const genome = mutate(crossover(mother.genome, father.genome, ctx.rng), ctx.rng);
    const child = createCreature(
      ctx.nextId(),
      mother.speciesId,
      mother.x + ctx.rng.range(-4, 4),
      mother.y + ctx.rng.range(-4, 4),
      genome,
      ctx.rng.chance(0.5) ? "M" : "F",
      Math.max(mother.generation, father.generation) + 1,
      ctx.tick,
      CHILD_START_ENERGY,
    );
    if (!isPassable(ctx.world, child.x, child.y)) {
      child.x = mother.x;
      child.y = mother.y;
    }
    ctx.newborns.push(child);
    ctx.onBirth(child);
    if (ctx.fxEnabled) ctx.fx.push({ kind: "birth", x: child.x, y: child.y, hue: hueOf(genome) });
  }
}
