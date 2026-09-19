import { bodyRadius } from "../Genetics";
import type { Genome } from "../types";

/**
 * Procedural pixel-art creatures. Every visible feature is derived from the
 * genome, so evolution is literally visible:
 *   size → body        speed → legs & tail       vision → eyes
 *   armor → spikes/shell                          color → hue
 * Sprites are rasterised once per (quantised genome, frame, growth) and cached.
 */

export interface SpriteOptions {
  frame: 0 | 1;
  growth: number; // 0.6..1 (juvenile → adult)
}

type Canvas2D = HTMLCanvasElement;

const cache = new Map<string, Canvas2D>();
const MAX_CACHE = 900;

function q(v: number, steps: number): number {
  return Math.round(Math.min(1, Math.max(0, v)) * steps) / steps;
}

export function quantizeGenome(g: Genome): Genome {
  return {
    size: q(g.size, 8),
    speed: q(g.speed, 4),
    vision: q(g.vision, 4),
    fertility: q(g.fertility, 2),
    armor: q(g.armor, 5),
    color: q(g.color, 36),
  };
}

function key(g: Genome, opts: SpriteOptions): string {
  return `${g.size}|${g.speed}|${g.vision}|${g.armor}|${g.color}|${opts.frame}|${opts.growth}`;
}

export function growthLevel(age: number, maturity: number): number {
  if (age >= maturity) return 1;
  return age < maturity * 0.5 ? 0.6 : 0.8;
}

function makeCanvas(w: number, h: number): Canvas2D {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function creaturePalette(g: Genome) {
  const h = g.color * 360;
  return {
    base: `hsl(${h} 58% 46%)`,
    dark: `hsl(${h} 55% 26%)`,
    light: `hsl(${h} 55% 66%)`,
    accent: `hsl(${(h + 40) % 360} 60% 60%)`,
    shell: `hsl(${(h + 200) % 360} 25% 35%)`,
    shellLight: `hsl(${(h + 200) % 360} 25% 52%)`,
  };
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Fill an ellipse pixel-by-pixel (crisp edges, no antialiasing). */
function pixelEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const xs = Math.round(cx - half);
    const xe = Math.round(cx + half);
    if (xe > xs) ctx.fillRect(xs, y, xe - xs, 1);
  }
}

/** Sprite bounding box for a genome at a growth level. Anchor = (feetX, feetY) bottom-centre. */
export function spriteMetrics(g: Genome, growth: number) {
  const s = bodyRadius(g) * growth;
  const rx = s * 1.25;
  const ry = s * 0.85;
  const legLen = 1 + Math.round(g.speed * 2);
  const spikeH = g.armor > 0.25 ? 1 + Math.round(g.armor * 2) : 0;
  const w = Math.ceil(rx * 2 + 6);
  const h = Math.ceil(ry * 2 + legLen + spikeH + 5);
  return { s, rx, ry, legLen, spikeH, w, h, cx: Math.floor(w / 2), cy: h - legLen - 1 - ry };
}

function rasterize(g: Genome, opts: SpriteOptions): Canvas2D {
  const m = spriteMetrics(g, opts.growth);
  const canvas = makeCanvas(m.w, m.h);
  const ctx = canvas.getContext("2d")!;
  const pal = creaturePalette(g);
  const { cx, rx, ry, legLen } = m;
  const cy = m.cy + (opts.frame === 1 ? -0.5 : 0);
  const bob = opts.frame === 1 ? 1 : 0;

  // Legs: more & longer with speed. Alternate frames swing them.
  const pairs = g.speed < 0.35 ? 2 : g.speed < 0.7 ? 3 : 4;
  const footY = Math.round(cy + ry);
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    const lx = Math.round(cx - rx * 0.8 + t * rx * 1.6);
    const swing = (i + opts.frame) % 2 === 0 ? 0 : 1;
    px(ctx, lx + swing - 1, footY, pal.dark, 1, legLen);
    if (legLen > 1) px(ctx, lx + swing - 1 + (swing ? 1 : -1), footY + legLen - 1, pal.dark);
  }

  // Tail for fast bodies.
  if (g.speed > 0.5) {
    const tl = 1 + Math.round(g.speed * 2);
    for (let i = 0; i < tl; i++) px(ctx, cx - rx - i, cy - i * 0.5 + bob, i === tl - 1 ? pal.light : pal.base);
  }

  // Body with 1px outline.
  pixelEllipse(ctx, cx, cy - bob, rx + 1, ry + 1, pal.dark);
  pixelEllipse(ctx, cx, cy - bob, rx, ry, pal.base);
  // Highlight along the top.
  pixelEllipse(ctx, cx - rx * 0.15, cy - bob - ry * 0.35, rx * 0.55, Math.max(0.6, ry * 0.3), pal.light);
  // Belly shading.
  pixelEllipse(ctx, cx, cy - bob + ry * 0.55, rx * 0.7, Math.max(0.6, ry * 0.25), pal.dark);

  // Head: bulges at the front for larger bodies.
  const headR = Math.max(1.2, m.s * 0.62);
  const hx = cx + rx * 0.72;
  const hy = cy - bob - ry * 0.28;
  pixelEllipse(ctx, hx, hy, headR + 1, headR + 1, pal.dark);
  pixelEllipse(ctx, hx, hy, headR, headR, pal.base);

  // Eyes: bigger with vision.
  const eye = g.vision < 0.3 ? 1 : g.vision < 0.6 ? 2 : 3;
  const ex = Math.round(hx + headR * 0.25);
  const ey = Math.round(hy - headR * 0.25) - (eye > 1 ? 1 : 0);
  if (eye === 1) {
    px(ctx, ex, ey, "#0b0b0b");
  } else {
    px(ctx, ex - 1, ey - 1, "#f4f4f4", eye, eye);
    px(ctx, ex + (eye === 3 ? 0 : 0), ey + (eye === 3 ? 0 : -1) + 1, "#0b0b0b", 1, 1);
    if (eye === 3) px(ctx, ex - 1, ey - 1, "#ffffff");
  }
  // Antennae for keen-eyed lineages.
  if (g.vision > 0.75) {
    px(ctx, Math.round(hx), Math.round(hy - headR - 1), pal.dark, 1, 1);
    px(ctx, Math.round(hx) + 1, Math.round(hy - headR - 2), pal.accent, 1, 1);
  }

  // Armor: spikes along the back, then a shell plate when heavily armoured.
  if (g.armor > 0.55) {
    pixelEllipse(ctx, cx - rx * 0.1, cy - bob - ry * 0.15, rx * 0.72, ry * 0.62, pal.shell);
    pixelEllipse(ctx, cx - rx * 0.2, cy - bob - ry * 0.35, rx * 0.4, Math.max(0.6, ry * 0.25), pal.shellLight);
  }
  if (g.armor > 0.25) {
    const n = Math.max(2, Math.round(g.armor * 6));
    const h = 1 + Math.round(g.armor * 2);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const sx = Math.round(cx - rx * 0.75 + t * rx * 1.4);
      const dy = (t - 0.5) * (t - 0.5) * 4 * ry * 0.5; // follow the curve of the back
      const top = Math.round(cy - bob - ry - h + dy);
      for (let k = 0; k < h; k++) px(ctx, sx, top + k, k === 0 ? "#e9e2c9" : pal.shell, 1, 1);
    }
  }

  return canvas;
}

export function getCreatureSprite(genome: Genome, opts: SpriteOptions): Canvas2D {
  const g = quantizeGenome(genome);
  const k = key(g, opts);
  let sprite = cache.get(k);
  if (!sprite) {
    if (cache.size > MAX_CACHE) cache.clear();
    sprite = rasterize(g, opts);
    cache.set(k, sprite);
  }
  return sprite;
}

/** Draw a creature with its feet at (x, y). */
export function drawCreature(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  x: number,
  y: number,
  facing: 1 | -1,
  opts: SpriteOptions,
  alpha = 1,
) {
  const sprite = getCreatureSprite(genome, opts);
  const g = quantizeGenome(genome);
  const m = spriteMetrics(g, opts.growth);
  const dx = Math.round(x) - m.cx;
  const dy = Math.round(y) - m.h + 1;
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (facing === 1) {
    ctx.drawImage(sprite, dx, dy);
  } else {
    ctx.save();
    ctx.translate(Math.round(x) * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, dx, dy);
    ctx.restore();
  }
  if (alpha < 1) ctx.globalAlpha = 1;
}

/** Ground shadow, drawn before the body. */
export function drawShadow(ctx: CanvasRenderingContext2D, genome: Genome, x: number, y: number, growth: number) {
  const s = bodyRadius(genome) * growth;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  const rx = Math.max(2, Math.round(s * 1.3));
  ctx.fillRect(Math.round(x) - rx, Math.round(y), rx * 2, 1);
  if (s > 3) ctx.fillRect(Math.round(x) - rx + 1, Math.round(y) + 1, rx * 2 - 2, 1);
}

/* ------------------------------- Predator ------------------------------- */

const predatorCache = new Map<string, Canvas2D>();

function rasterizePredator(frame: 0 | 1, lunge: boolean): Canvas2D {
  const w = 26;
  const h = 18;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  const body = "#7a1f2b";
  const dark = "#3d0f16";
  const light = "#a8404a";
  const cx = 12;
  const cy = 9 + (frame ? -1 : 0);

  // Legs (4), long stride.
  const legY = 13;
  for (let i = 0; i < 4; i++) {
    const lx = 5 + i * 5 + ((i + frame) % 2 ? 1 : -1);
    px(ctx, lx, legY, dark, 1, 4);
    px(ctx, lx + ((i + frame) % 2 ? 1 : -1), legY + 3, dark);
  }
  // Tail.
  for (let i = 0; i < 6; i++) px(ctx, cx - 9 - i, cy + 1 - Math.floor(i / 2), i > 3 ? light : body);
  // Body.
  pixelEllipse(ctx, cx, cy, 9, 4.5, dark);
  pixelEllipse(ctx, cx, cy, 8, 3.6, body);
  pixelEllipse(ctx, cx - 1, cy - 1.6, 5, 1.2, light);
  // Ridge spikes.
  for (let i = 0; i < 5; i++) px(ctx, cx - 6 + i * 3, cy - 5 - (i % 2), "#d9c9a0", 1, 2);
  // Head + jaw.
  const hx = cx + 8 + (lunge ? 2 : 0);
  pixelEllipse(ctx, hx, cy - 1, 4.5, 3.5, dark);
  pixelEllipse(ctx, hx, cy - 1, 3.6, 2.7, body);
  // Jaw (open when lunging).
  px(ctx, hx, cy + 1 + (lunge ? 1 : 0), dark, 5, lunge ? 2 : 1);
  px(ctx, hx + 1, cy + (lunge ? 1 : 0), "#f2ead6"); // teeth
  px(ctx, hx + 3, cy + (lunge ? 1 : 0), "#f2ead6");
  // Eye.
  px(ctx, hx + 1, cy - 3, "#ffd34a", 2, 2);
  px(ctx, hx + 2, cy - 2, "#1a0a0a");
  return canvas;
}

export function drawPredator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  frame: 0 | 1,
  lunge: boolean,
) {
  const k = `${frame}|${lunge ? 1 : 0}`;
  let sprite = predatorCache.get(k);
  if (!sprite) {
    sprite = rasterizePredator(frame, lunge);
    predatorCache.set(k, sprite);
  }
  const dx = Math.round(x) - 13;
  const dy = Math.round(y) - 17;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(Math.round(x) - 9, Math.round(y), 18, 2);
  if (facing === 1) {
    ctx.drawImage(sprite, dx, dy);
  } else {
    ctx.save();
    ctx.translate(Math.round(x) * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, dx, dy);
    ctx.restore();
  }
}
