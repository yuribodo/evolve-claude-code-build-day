import {
  PREDATOR_KILL_ENERGY,
  PREDATOR_MAX,
  PREDATOR_SPEED,
  PREDATOR_SPLIT_ENERGY,
  PREDATOR_START_ENERGY,
  PREDATOR_VISION,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { bodyRadius, camouflage, killChance } from "./Genetics";
import type { Rng } from "./rng";
import type { Creature, FxEvent, Predator } from "./types";
import { isPassable, queryGrid, type SpatialGrid, type World } from "./World";

export interface PredatorContext {
  world: World;
  rng: Rng;
  tick: number;
  speedMul: number;
  creatureGrid: SpatialGrid<Creature>;
  creaturesById: Map<number, Creature>;
  killed: Set<number>;
  predatorCount: number;
  spawned: Predator[];
  fx: FxEvent[];
  fxEnabled: boolean;
  nextId: () => number;
  onKill: (prey: Creature, predator: Predator) => void;
}

export function createPredator(id: number, x: number, y: number): Predator {
  return {
    id,
    x,
    y,
    vx: 1,
    vy: 0,
    energy: PREDATOR_START_ENERGY,
    age: 0,
    state: "prowl",
    targetId: -1,
    attackTimer: 0,
    restTimer: 0,
    wanderTimer: 0,
    facing: 1,
    phase: 0,
    kills: 0,
  };
}

/** Distance at which this predator notices a given creature. Big & bright = obvious. */
function detectionRadius(prey: Creature): number {
  const g = prey.genome;
  const camo = camouflage(g);
  return PREDATOR_VISION * (0.5 + 0.5 * (1 - camo)) * (0.7 + g.size * 0.6);
}

/** Returns true if still alive. */
export function updatePredator(p: Predator, ctx: PredatorContext): boolean {
  p.age++;
  p.phase += 0.2;
  const speed = PREDATOR_SPEED * ctx.speedMul;
  let drain = 0.16;

  if (p.state === "rest") {
    p.restTimer--;
    if (p.restTimer <= 0) p.state = "prowl";
  } else if (p.state === "attack") {
    p.attackTimer--;
    if (p.attackTimer <= 0) p.state = "chase";
  } else if (p.state === "chase") {
    drain = 0.2;
    const prey = ctx.creaturesById.get(p.targetId);
    if (!prey || ctx.killed.has(prey.id)) {
      p.state = "prowl";
      p.targetId = -1;
    } else {
      const dx = prey.x - p.x;
      const dy = prey.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > PREDATOR_VISION * 1.35) {
        p.state = "prowl";
        p.targetId = -1;
      } else if (d <= bodyRadius(prey.genome) + 4) {
        strike(p, prey, ctx);
      } else {
        moveToward(p, dx / d, dy / d, speed * 1.05, ctx);
      }
    }
  } else {
    // prowl
    if (p.wanderTimer <= 0) {
      const a = ctx.rng.range(0, Math.PI * 2);
      p.vx = Math.cos(a);
      p.vy = Math.sin(a);
      p.wanderTimer = ctx.rng.int(30, 90);
    }
    p.wanderTimer--;
    moveToward(p, p.vx, p.vy, speed * 0.55, ctx);

    if (ctx.tick % 3 === 0) {
      let best: Creature | null = null;
      let bestScore = Infinity;
      queryGrid(ctx.creatureGrid, p.x, p.y, PREDATOR_VISION, (c, d2) => {
        if (ctx.killed.has(c.id)) return;
        const d = Math.sqrt(d2);
        if (d > detectionRadius(c)) return;
        const score = d / (0.5 + c.genome.size * 0.9);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      });
      if (best) {
        p.targetId = (best as Creature).id;
        p.state = "chase";
      }
    }
  }

  p.energy -= drain;
  if (p.energy <= 0) return false;
  if (p.age > 2600) return false;

  if (p.energy >= PREDATOR_SPLIT_ENERGY && ctx.predatorCount + ctx.spawned.length < PREDATOR_MAX) {
    p.energy *= 0.5;
    const cub = createPredator(ctx.nextId(), p.x + ctx.rng.range(-6, 6), p.y + ctx.rng.range(-6, 6));
    cub.energy = PREDATOR_START_ENERGY * 0.7;
    ctx.spawned.push(cub);
  }
  return true;
}

function moveToward(p: Predator, dx: number, dy: number, step: number, ctx: PredatorContext): void {
  const nx = p.x + dx * step;
  const ny = p.y + dy * step;
  if (isPassable(ctx.world, nx, ny)) {
    p.x = nx;
    p.y = ny;
  } else if (isPassable(ctx.world, nx, p.y)) {
    p.x = nx;
  } else if (isPassable(ctx.world, p.x, ny)) {
    p.y = ny;
  } else {
    p.vx = -dx;
    p.vy = -dy;
    p.wanderTimer = 20;
    if (p.state === "chase") {
      p.state = "prowl";
      p.targetId = -1;
    }
  }
  if (Math.abs(dx) > 0.1) p.facing = dx > 0 ? 1 : -1;
  p.x = Math.min(WORLD_W - 3, Math.max(3, p.x));
  p.y = Math.min(WORLD_H - 3, Math.max(3, p.y));
}

function strike(p: Predator, prey: Creature, ctx: PredatorContext): void {
  if (ctx.fxEnabled) ctx.fx.push({ kind: "attack", x: p.x, y: p.y });
  if (ctx.rng.chance(killChance(prey.genome))) {
    ctx.killed.add(prey.id);
    p.energy += PREDATOR_KILL_ENERGY + prey.genome.size * 25;
    p.kills++;
    p.state = "rest";
    p.restTimer = 60;
    p.targetId = -1;
    ctx.onKill(prey, p);
    if (ctx.fxEnabled) ctx.fx.push({ kind: "kill", x: prey.x, y: prey.y });
  } else {
    // Glanced off armor: prey is hurt and knocked away, predator recovers.
    prey.energy -= 12;
    prey.hurtTimer = 25;
    const dx = prey.x - p.x;
    const dy = prey.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const kx = prey.x + (dx / d) * 6;
    const ky = prey.y + (dy / d) * 6;
    if (isPassable(ctx.world, kx, ky)) {
      prey.x = kx;
      prey.y = ky;
    }
    p.state = "attack";
    p.attackTimer = 28;
  }
}

export function spawnPredatorAtEdge(id: number, rng: Rng, world: World): Predator {
  for (let i = 0; i < 40; i++) {
    const side = rng.int(0, 3);
    const x = side === 0 ? 6 : side === 1 ? WORLD_W - 6 : rng.range(10, WORLD_W - 10);
    const y = side === 2 ? 6 : side === 3 ? WORLD_H - 6 : rng.range(10, WORLD_H - 10);
    if (isPassable(world, x, y)) return createPredator(id, x, y);
  }
  return createPredator(id, 6, WORLD_H / 2);
}
