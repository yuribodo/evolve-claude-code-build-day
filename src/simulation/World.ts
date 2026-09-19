import { TILE, TILES_X, TILES_Y, WORLD_H, WORLD_W } from "./constants";
import type { Rng } from "./rng";

export enum Tile {
  Grass = 0,
  GrassDark = 1,
  GrassLight = 2,
  Water = 3,
  Shallow = 4,
  Sand = 5,
  Rock = 6,
  Flower = 7,
}

export interface Tree {
  x: number;
  y: number;
  size: number;
  variant: number;
}

export interface World {
  tiles: Uint8Array;
  trees: Tree[];
  riverX: number[];
}

export function tileAt(world: World, x: number, y: number): Tile {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= TILES_X || ty >= TILES_Y) return Tile.Water;
  return world.tiles[ty * TILES_X + tx] as Tile;
}

export function isPassable(world: World, x: number, y: number): boolean {
  if (x < 3 || y < 3 || x > WORLD_W - 3 || y > WORLD_H - 3) return false;
  const t = tileAt(world, x, y);
  return t !== Tile.Water && t !== Tile.Rock;
}

export function isFertile(world: World, x: number, y: number): boolean {
  const t = tileAt(world, x, y);
  return t === Tile.Grass || t === Tile.GrassDark || t === Tile.GrassLight || t === Tile.Flower;
}

/** Cheap value noise for grass variation. */
function noise2(rng: Rng): (x: number, y: number) => number {
  const size = 32;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  const at = (x: number, y: number) => grid[((y % size) + size) % size * size + (((x % size) + size) % size)];
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export function generateWorld(rng: Rng): World {
  const tiles = new Uint8Array(TILES_X * TILES_Y);
  const n = noise2(rng);

  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const v = n(tx / 5, ty / 5) * 0.7 + n(tx / 1.7, ty / 1.7) * 0.3;
      let t = Tile.Grass;
      if (v < 0.38) t = Tile.GrassDark;
      else if (v > 0.66) t = Tile.GrassLight;
      if (rng.chance(0.035) && t !== Tile.GrassDark) t = Tile.Flower;
      tiles[ty * TILES_X + tx] = t;
    }
  }

  // A meandering river splits the world; two fords let brave creatures cross.
  const riverX: number[] = [];
  const phase = rng.range(0, Math.PI * 2);
  const center = TILES_X * rng.range(0.44, 0.56);
  for (let ty = 0; ty < TILES_Y; ty++) {
    const rx = center + Math.sin(ty / 6 + phase) * 4.5 + Math.sin(ty / 2.3 + phase * 1.7) * 1.2;
    riverX.push(rx);
    const width = 1.4 + Math.sin(ty / 4 + phase) * 0.4;
    for (let tx = 0; tx < TILES_X; tx++) {
      const d = Math.abs(tx + 0.5 - rx);
      if (d < width) tiles[ty * TILES_X + tx] = Tile.Water;
      else if (d < width + 1 && rng.chance(0.7)) tiles[ty * TILES_X + tx] = Tile.Sand;
    }
  }
  const fordRows = [Math.floor(TILES_Y * rng.range(0.18, 0.3)), Math.floor(TILES_Y * rng.range(0.66, 0.82))];
  for (const row of fordRows) {
    for (let ty = row - 1; ty <= row + 1; ty++) {
      if (ty < 0 || ty >= TILES_Y) continue;
      for (let tx = 0; tx < TILES_X; tx++) {
        if (tiles[ty * TILES_X + tx] === Tile.Water) tiles[ty * TILES_X + tx] = Tile.Shallow;
      }
    }
  }

  // Rock clusters.
  const rockClusters = 5;
  for (let i = 0; i < rockClusters; i++) {
    const cx = rng.int(2, TILES_X - 3);
    const cy = rng.int(2, TILES_Y - 3);
    if (tiles[cy * TILES_X + cx] === Tile.Water) continue;
    const count = rng.int(2, 5);
    for (let k = 0; k < count; k++) {
      const tx = cx + rng.int(-1, 1);
      const ty = cy + rng.int(-1, 1);
      if (tx < 0 || ty < 0 || tx >= TILES_X || ty >= TILES_Y) continue;
      const t = tiles[ty * TILES_X + tx];
      if (t === Tile.Water || t === Tile.Shallow) continue;
      tiles[ty * TILES_X + tx] = Tile.Rock;
    }
  }

  // Trees — decorative, creatures walk beneath.
  const trees: Tree[] = [];
  let attempts = 0;
  while (trees.length < 22 && attempts < 400) {
    attempts++;
    const x = rng.range(10, WORLD_W - 10);
    const y = rng.range(14, WORLD_H - 6);
    const t = tiles[Math.floor(y / TILE) * TILES_X + Math.floor(x / TILE)];
    if (t === Tile.Water || t === Tile.Shallow || t === Tile.Rock || t === Tile.Sand) continue;
    if (trees.some((tr) => Math.hypot(tr.x - x, tr.y - y) < 22)) continue;
    trees.push({ x: Math.round(x), y: Math.round(y), size: rng.range(0.8, 1.3), variant: rng.int(0, 2) });
  }

  return { tiles, trees, riverX };
}

export function randomFertilePoint(world: World, rng: Rng): { x: number; y: number } {
  for (let i = 0; i < 40; i++) {
    const x = rng.range(4, WORLD_W - 4);
    const y = rng.range(4, WORLD_H - 4);
    if (isFertile(world, x, y)) return { x, y };
  }
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
}

export function randomPassablePoint(world: World, rng: Rng, side?: "left" | "right"): { x: number; y: number } {
  for (let i = 0; i < 60; i++) {
    const minX = side === "right" ? WORLD_W * 0.55 : 6;
    const maxX = side === "left" ? WORLD_W * 0.45 : WORLD_W - 6;
    const x = rng.range(minX, maxX);
    const y = rng.range(6, WORLD_H - 6);
    if (isPassable(world, x, y)) return { x, y };
  }
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
}

/* ---------------- Spatial grid for fast neighbour queries ---------------- */

const CELL = 24;
const GRID_W = Math.ceil(WORLD_W / CELL);
const GRID_H = Math.ceil(WORLD_H / CELL);

export interface SpatialGrid<T extends { x: number; y: number }> {
  cells: T[][];
}

export function createGrid<T extends { x: number; y: number }>(): SpatialGrid<T> {
  const cells: T[][] = new Array(GRID_W * GRID_H);
  for (let i = 0; i < cells.length; i++) cells[i] = [];
  return { cells };
}

/** Refill a grid in place (no per-tick allocation). */
export function buildGrid<T extends { x: number; y: number }>(items: T[], grid: SpatialGrid<T> = createGrid<T>()): SpatialGrid<T> {
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) cells[i].length = 0;
  for (const item of items) {
    const cx = Math.min(GRID_W - 1, Math.max(0, Math.floor(item.x / CELL)));
    const cy = Math.min(GRID_H - 1, Math.max(0, Math.floor(item.y / CELL)));
    cells[cy * GRID_W + cx].push(item);
  }
  return grid;
}

export function queryGrid<T extends { x: number; y: number }>(
  grid: SpatialGrid<T>,
  x: number,
  y: number,
  radius: number,
  visit: (item: T, distSq: number) => void,
): void {
  const minCx = Math.max(0, Math.floor((x - radius) / CELL));
  const maxCx = Math.min(GRID_W - 1, Math.floor((x + radius) / CELL));
  const minCy = Math.max(0, Math.floor((y - radius) / CELL));
  const maxCy = Math.min(GRID_H - 1, Math.floor((y + radius) / CELL));
  const r2 = radius * radius;
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const cell = grid.cells[cy * GRID_W + cx];
      for (let i = 0; i < cell.length; i++) {
        const item = cell[i];
        const dx = item.x - x;
        const dy = item.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) visit(item, d2);
      }
    }
  }
}
