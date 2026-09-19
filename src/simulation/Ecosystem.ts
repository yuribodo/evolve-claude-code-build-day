import { FOOD_BASE_RATE, FOOD_ENERGY, FOOD_MAX, FOOD_MAX_AGE, WORLD_H, WORLD_W } from "./constants";
import type { Rng } from "./rng";
import type { Environment, Food, FxEvent, Weather } from "./types";
import { randomFertilePoint, type World } from "./World";

export interface WeatherModifiers {
  foodRate: number;
  foodCap: number;
  speedMul: number;
  metabolismMul: number;
}

export function weatherModifiers(weather: Weather): WeatherModifiers {
  switch (weather) {
    case "rain":
      return { foodRate: 1.9, foodCap: 1.35, speedMul: 1, metabolismMul: 1 };
    case "drought":
      return { foodRate: 0.55, foodCap: 0.7, speedMul: 1, metabolismMul: 1.05 };
    case "winter":
      return { foodRate: 0.5, foodCap: 0.65, speedMul: 0.7, metabolismMul: 1.35 };
    default:
      return { foodRate: 1, foodCap: 1, speedMul: 1, metabolismMul: 1 };
  }
}

export function createEnvironment(): Environment {
  return { weather: "clear", weatherTicksLeft: 0, predatorsIntroduced: false, meteorCount: 0, scorch: null };
}

export interface FoodContext {
  world: World;
  rng: Rng;
  env: Environment;
  food: Food[];
  fx: FxEvent[];
  fxEnabled: boolean;
  nextId: () => number;
  carry: { acc: number };
}

const FIELD_CELL = 40;
const FIELD_W = Math.ceil(WORLD_W / FIELD_CELL);
const FIELD_H = Math.ceil(WORLD_H / FIELD_CELL);
const fieldCounts = new Uint16Array(FIELD_W * FIELD_H);

function fieldIndex(x: number, y: number): number {
  const cx = Math.min(FIELD_W - 1, Math.floor(x / FIELD_CELL));
  const cy = Math.min(FIELD_H - 1, Math.floor(y / FIELD_CELL));
  return cy * FIELD_W + cx;
}

/**
 * Spawns food according to weather. Growth is logistic *per patch*: grazed
 * areas regrow quickly, saturated areas stop — so food never piles up where
 * nobody lives while the herd starves elsewhere.
 */
export function spawnFood(ctx: FoodContext): void {
  const mods = weatherModifiers(ctx.env.weather);
  const cap = FOOD_MAX * mods.foodCap;
  // No global short-circuit: a saturated far bank must never stop regrowth
  // on the grazed bank. Per-patch caps bound the total on their own.
  const cellCap = Math.max(1.5, (cap / (FIELD_W * FIELD_H)) * 1.3);

  ctx.carry.acc += FOOD_BASE_RATE * mods.foodRate;
  if (ctx.carry.acc < 1) return;

  fieldCounts.fill(0);
  for (const f of ctx.food) fieldCounts[fieldIndex(f.x, f.y)]++;

  while (ctx.carry.acc >= 1) {
    ctx.carry.acc -= 1;
    const p = randomFertilePoint(ctx.world, ctx.rng);
    if (ctx.env.scorch && Math.hypot(p.x - ctx.env.scorch.x, p.y - ctx.env.scorch.y) < ctx.env.scorch.r) continue;
    const idx = fieldIndex(p.x, p.y);
    if (!ctx.rng.chance(1 - fieldCounts[idx] / cellCap)) continue;
    fieldCounts[idx]++;
    ctx.food.push({ id: ctx.nextId(), x: p.x, y: p.y, energy: FOOD_ENERGY, age: 0 });
    if (ctx.fxEnabled) ctx.fx.push({ kind: "foodSpawn", x: p.x, y: p.y });
  }
}

export function ageFood(food: Food[]): Food[] {
  let changed = false;
  for (const f of food) {
    f.age++;
    if (f.age > FOOD_MAX_AGE) changed = true;
  }
  return changed ? food.filter((f) => f.age <= FOOD_MAX_AGE) : food;
}

export const WEATHER_LABEL: Record<Weather, string> = {
  clear: "Temperate",
  rain: "Rainy season",
  drought: "Drought",
  winter: "Winter",
};
