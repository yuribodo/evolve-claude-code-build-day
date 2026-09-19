import { TILE, TILES_X, TILES_Y, WORLD_H, WORLD_W } from "../constants";
import type { Weather } from "../types";
import { Tile, type World } from "../World";

interface Palette {
  grass: string;
  grassDark: string;
  grassLight: string;
  detail: string;
  detail2: string;
  water: string;
  waterDeep: string;
  shallow: string;
  sand: string;
  sandDark: string;
  rock: string;
  rockLight: string;
  rockDark: string;
  flower: string[];
  trunk: string;
  canopy: string;
  canopyLight: string;
  canopyDark: string;
}

const PALETTES: Record<Weather, Palette> = {
  clear: {
    grass: "#4f8a3b",
    grassDark: "#3f7330",
    grassLight: "#60a047",
    detail: "#376a2b",
    detail2: "#78b45c",
    water: "#3a78b4",
    waterDeep: "#2c619a",
    shallow: "#5b9bd0",
    sand: "#c9b784",
    sandDark: "#b7a36f",
    rock: "#6f7478",
    rockLight: "#9298a0",
    rockDark: "#4b5054",
    flower: ["#f2e46a", "#f0a0b8", "#f4f4f4", "#e8b04a"],
    trunk: "#5a3d24",
    canopy: "#2f6b2b",
    canopyLight: "#4a9440",
    canopyDark: "#22501f",
  },
  rain: {
    grass: "#3f7d3a",
    grassDark: "#316530",
    grassLight: "#4d9446",
    detail: "#2a5828",
    detail2: "#63a85a",
    water: "#3d7fbd",
    waterDeep: "#2f68a3",
    shallow: "#5fa0d8",
    sand: "#a9a07a",
    sandDark: "#948b66",
    rock: "#646a70",
    rockLight: "#868d96",
    rockDark: "#44494f",
    flower: ["#e6dd6a", "#e5a0b8", "#f4f4f4", "#d9a848"],
    trunk: "#4d3320",
    canopy: "#296128",
    canopyLight: "#3f8a3a",
    canopyDark: "#1c451b",
  },
  drought: {
    grass: "#9c8a3e",
    grassDark: "#86752f",
    grassLight: "#b39d4c",
    detail: "#75652a",
    detail2: "#c9b45f",
    water: "#4d80a8",
    waterDeep: "#3d6a90",
    shallow: "#6f9fc4",
    sand: "#d6c08a",
    sandDark: "#c2ab74",
    rock: "#7a7570",
    rockLight: "#9d978f",
    rockDark: "#54504b",
    flower: ["#c9a04a", "#b98a70", "#e6dcc0", "#c98b3a"],
    trunk: "#5a3d24",
    canopy: "#6e7a2c",
    canopyLight: "#93a03e",
    canopyDark: "#4f5a1f",
  },
  winter: {
    grass: "#d9e2ea",
    grassDark: "#c6d2dd",
    grassLight: "#eef3f7",
    detail: "#b2c0cd",
    detail2: "#ffffff",
    water: "#6f9cc4",
    waterDeep: "#5a86ad",
    shallow: "#9dc0dc",
    sand: "#cfd3d4",
    sandDark: "#bcc2c5",
    rock: "#7a8088",
    rockLight: "#a2a8b0",
    rockDark: "#525860",
    flower: ["#ffffff", "#e7edf3", "#cfd9e3", "#ffffff"],
    trunk: "#4a3320",
    canopy: "#5f7c72",
    canopyLight: "#d9e6ea",
    canopyDark: "#3e5651",
  },
};

/** Tiny deterministic hash so tile detail is stable between redraws. */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawTerrain(ctx: CanvasRenderingContext2D, world: World, weather: Weather): void {
  const p = PALETTES[weather];
  ctx.fillStyle = p.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const t = world.tiles[ty * TILES_X + tx] as Tile;
      const x = tx * TILE;
      const y = ty * TILE;
      const r = hash(tx, ty);
      switch (t) {
        case Tile.Grass:
        case Tile.GrassDark:
        case Tile.GrassLight:
        case Tile.Flower: {
          ctx.fillStyle = t === Tile.GrassDark ? p.grassDark : t === Tile.GrassLight ? p.grassLight : p.grass;
          ctx.fillRect(x, y, TILE, TILE);
          // Blades of grass / snow sparkle.
          const n = 1 + Math.floor(r * 3);
          for (let i = 0; i < n; i++) {
            const dx = Math.floor(hash(tx, ty, i + 1) * TILE);
            const dy = Math.floor(hash(tx, ty, i + 11) * TILE);
            ctx.fillStyle = hash(tx, ty, i + 21) > 0.5 ? p.detail : p.detail2;
            ctx.fillRect(x + dx, y + dy, 1, hash(tx, ty, i + 31) > 0.6 ? 2 : 1);
          }
          if (t === Tile.Flower) {
            const fc = p.flower[Math.floor(r * p.flower.length)];
            const fx = x + 2 + Math.floor(hash(tx, ty, 7) * 4);
            const fy = y + 2 + Math.floor(hash(tx, ty, 8) * 4);
            ctx.fillStyle = p.detail;
            ctx.fillRect(fx, fy + 1, 1, 2);
            ctx.fillStyle = fc;
            ctx.fillRect(fx - 1, fy, 3, 1);
            ctx.fillRect(fx, fy - 1, 1, 3);
          }
          break;
        }
        case Tile.Water: {
          ctx.fillStyle = r > 0.6 ? p.waterDeep : p.water;
          ctx.fillRect(x, y, TILE, TILE);
          // Bank highlight on edges bordering land.
          const left = tx > 0 ? world.tiles[ty * TILES_X + tx - 1] : Tile.Water;
          const up = ty > 0 ? world.tiles[(ty - 1) * TILES_X + tx] : Tile.Water;
          ctx.fillStyle = p.shallow;
          if (left !== Tile.Water && left !== Tile.Shallow) ctx.fillRect(x, y, 1, TILE);
          if (up !== Tile.Water && up !== Tile.Shallow) ctx.fillRect(x, y, TILE, 1);
          break;
        }
        case Tile.Shallow: {
          ctx.fillStyle = p.shallow;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = p.sand;
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + Math.floor(hash(tx, ty, i + 40) * TILE), y + Math.floor(hash(tx, ty, i + 50) * TILE), 1, 1);
          }
          break;
        }
        case Tile.Sand: {
          ctx.fillStyle = p.sand;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = p.sandDark;
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(x + Math.floor(hash(tx, ty, i + 60) * TILE), y + Math.floor(hash(tx, ty, i + 70) * TILE), 1, 1);
          }
          break;
        }
        case Tile.Rock: {
          ctx.fillStyle = p.grassDark;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = p.rockDark;
          ctx.fillRect(x + 1, y + 2, 7, 6);
          ctx.fillStyle = p.rock;
          ctx.fillRect(x + 1, y + 1, 6, 6);
          ctx.fillStyle = p.rockLight;
          ctx.fillRect(x + 2, y + 1, 3, 1);
          ctx.fillRect(x + 1, y + 2, 1, 2);
          break;
        }
      }
    }
  }

  // Trees: trunk + rounded canopy with a shadow.
  for (const tree of world.trees) {
    const s = tree.size;
    const x = tree.x;
    const y = tree.y;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x - Math.round(5 * s), y, Math.round(10 * s), 2);
    ctx.fillStyle = p.trunk;
    ctx.fillRect(x - 1, y - Math.round(6 * s), 2, Math.round(6 * s) + 1);
    const cy = y - Math.round(8 * s);
    const rx = Math.round(5 * s) + tree.variant;
    const ry = Math.round(4 * s);
    fillPixelEllipse(ctx, x, cy, rx + 1, ry + 1, p.canopyDark);
    fillPixelEllipse(ctx, x, cy, rx, ry, p.canopy);
    fillPixelEllipse(ctx, x - 1, cy - 1, Math.max(1, rx - 2), Math.max(1, ry - 2), p.canopyLight);
    ctx.fillStyle = p.canopyDark;
    ctx.fillRect(x + 1, cy + 1, 2, 1);
    ctx.fillRect(x - 2, cy + ry - 1, 3, 1);
  }
}

function fillPixelEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    ctx.fillRect(Math.round(cx - half), y, Math.max(1, Math.round(half * 2)), 1);
  }
}

export function collectWaterTiles(world: World): { x: number; y: number; shallow: boolean }[] {
  const out: { x: number; y: number; shallow: boolean }[] = [];
  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const t = world.tiles[ty * TILES_X + tx];
      if (t === Tile.Water || t === Tile.Shallow) out.push({ x: tx * TILE, y: ty * TILE, shallow: t === Tile.Shallow });
    }
  }
  return out;
}
