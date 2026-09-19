import { MATURITY_AGE, TILE, WORLD_H, WORLD_W } from "../constants";
import { hueOf } from "../Genetics";
import type { Simulation } from "../Simulation";
import type { FxEvent, Weather } from "../types";
import { drawCreature, drawPredator, drawShadow, growthLevel } from "./sprites";
import { collectWaterTiles, drawTerrain } from "./terrain";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

interface Drop {
  x: number;
  y: number;
  v: number;
}

interface MeteorAnim {
  targetX: number;
  targetY: number;
  r: number;
  t: number; // 0..1 approach
  impacted: boolean;
  impactT: number;
}

export interface RendererState {
  terrain: HTMLCanvasElement | null;
  terrainWeather: Weather | null;
  water: { x: number; y: number; shallow: boolean }[];
  particles: Particle[];
  drops: Drop[];
  meteor: MeteorAnim | null;
  flash: number;
  shake: number;
  time: number;
  highlightSpeciesId: number | null;
  highlightUntil: number;
}

export interface RenderOptions {
  selectedId: number | null;
  speed: number;
  paused: boolean;
}

const MAX_PARTICLES = 420;

export function createRenderer(): RendererState {
  return {
    terrain: null,
    terrainWeather: null,
    water: [],
    particles: [],
    drops: [],
    meteor: null,
    flash: 0,
    shake: 0,
    time: 0,
    highlightSpeciesId: null,
    highlightUntil: 0,
  };
}

export function startMeteor(rs: RendererState, x: number, y: number, r: number): void {
  rs.meteor = { targetX: x, targetY: y, r, t: 0, impacted: false, impactT: 0 };
}

export function highlightSpecies(rs: RendererState, speciesId: number, seconds: number): void {
  rs.highlightSpeciesId = speciesId;
  rs.highlightUntil = rs.time + seconds;
}

function spawn(rs: RendererState, p: Omit<Particle, "maxLife">): void {
  if (rs.particles.length >= MAX_PARTICLES) return;
  rs.particles.push({ ...p, maxLife: p.life });
}

function consumeFx(rs: RendererState, fx: FxEvent[], speed: number): void {
  const budget = speed <= 1 ? fx.length : speed <= 10 ? 40 : 0;
  for (let i = 0; i < Math.min(budget, fx.length); i++) {
    const e = fx[i];
    switch (e.kind) {
      case "birth":
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          spawn(rs, { x: e.x, y: e.y - 2, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14 - 10, life: 0.6, color: `hsl(${e.hue} 70% 75%)`, size: 1, gravity: 20 });
        }
        break;
      case "death":
        for (let k = 0; k < 5; k++) {
          spawn(rs, { x: e.x + (Math.random() - 0.5) * 4, y: e.y - 2, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 8, life: 1.1, color: "rgba(200,200,190,0.8)", size: 1, gravity: -4 });
        }
        break;
      case "eat":
        for (let k = 0; k < 3; k++) {
          spawn(rs, { x: e.x, y: e.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 10, life: 0.4, color: "#b8e986", size: 1, gravity: 40 });
        }
        break;
      case "kill":
        for (let k = 0; k < 12; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 10 + Math.random() * 25;
          spawn(rs, { x: e.x, y: e.y - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.7, color: k % 3 === 0 ? "#f2d4d4" : "#c8262e", size: 1, gravity: 50 });
        }
        break;
      case "attack":
        spawn(rs, { x: e.x, y: e.y - 14, vx: 0, vy: -6, life: 0.5, color: "#ffd34a", size: 2, gravity: 0 });
        break;
      case "foodSpawn":
        spawn(rs, { x: e.x, y: e.y - 1, vx: 0, vy: -5, life: 0.5, color: "rgba(255,255,255,0.7)", size: 1, gravity: 0 });
        break;
      case "predatorArrive":
        for (let k = 0; k < 10; k++) {
          spawn(rs, { x: e.x + (Math.random() - 0.5) * 12, y: e.y, vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 6, life: 1.2, color: "rgba(120,40,50,0.7)", size: 2, gravity: -2 });
        }
        break;
      case "meteor":
        impactBurst(rs, e.x, e.y, e.r);
        break;
    }
  }
  fx.length = 0;
}

function impactBurst(rs: RendererState, x: number, y: number, r: number): void {
  rs.flash = 1;
  rs.shake = 1;
  if (rs.meteor) {
    rs.meteor.impacted = true;
    rs.meteor.impactT = 0;
  }
  for (let k = 0; k < 90; k++) {
    const a = Math.random() * Math.PI * 2;
    const v = 30 + Math.random() * 90;
    const hot = Math.random() < 0.5;
    spawn(rs, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.6 - 30,
      life: 0.8 + Math.random() * 1.2,
      color: hot ? (Math.random() < 0.5 ? "#ffb347" : "#ff6b35") : "#3a2f28",
      size: hot ? 1 : 2,
      gravity: 60,
    });
  }
  for (let k = 0; k < 30; k++) {
    spawn(rs, { x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r * 0.6, vx: (Math.random() - 0.5) * 6, vy: -6 - Math.random() * 10, life: 2 + Math.random() * 2, color: "rgba(60,60,60,0.5)", size: 2, gravity: -3 });
  }
}

function drawFood(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, weather: Weather) {
  const px = Math.round(x);
  const py = Math.round(y);
  const grown = age > 12;
  const berry = weather === "winter" ? "#c85a6a" : weather === "drought" ? "#d19a3c" : "#d94f5c";
  const leaf = weather === "winter" ? "#7f9a7a" : "#3f8a3a";
  const leafLight = weather === "winter" ? "#a9c1a4" : "#8fd67a";
  if (!grown) {
    ctx.fillStyle = leafLight;
    ctx.fillRect(px, py, 1, 1);
    return;
  }
  ctx.fillStyle = leaf;
  ctx.fillRect(px - 1, py - 1, 3, 2);
  ctx.fillStyle = leafLight;
  ctx.fillRect(px - 1, py - 1, 1, 1);
  ctx.fillStyle = berry;
  ctx.fillRect(px, py - 2, 1, 1);
  ctx.fillRect(px + 1, py - 1, 1, 1);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  sim: Simulation,
  rs: RendererState,
  dt: number,
  opts: RenderOptions,
): void {
  rs.time += dt;
  const weather = sim.env.weather;
  ctx.imageSmoothingEnabled = false;

  consumeFx(rs, sim.fx, opts.speed);

  // --- Terrain (cached per weather).
  if (!rs.terrain || rs.terrainWeather !== weather) {
    const c = rs.terrain ?? document.createElement("canvas");
    c.width = WORLD_W;
    c.height = WORLD_H;
    const tctx = c.getContext("2d")!;
    tctx.imageSmoothingEnabled = false;
    drawTerrain(tctx, sim.world, weather);
    rs.terrain = c;
    rs.terrainWeather = weather;
    rs.water = collectWaterTiles(sim.world);
  }

  // --- Camera shake.
  ctx.save();
  if (rs.shake > 0) {
    const s = rs.shake * 4;
    ctx.translate(Math.round((Math.random() - 0.5) * s), Math.round((Math.random() - 0.5) * s));
    rs.shake = Math.max(0, rs.shake - dt * 1.8);
  }

  ctx.drawImage(rs.terrain, 0, 0);

  // --- Water shimmer.
  const shimmer = weather === "winter" ? "rgba(255,255,255,0.28)" : "rgba(190,225,255,0.45)";
  ctx.fillStyle = shimmer;
  const wt = Math.floor(rs.time * 3);
  for (let i = 0; i < rs.water.length; i++) {
    const w = rs.water[i];
    if (((i * 7 + wt) & 7) !== 0) continue;
    const ox = (i * 3 + wt) % TILE;
    ctx.fillRect(w.x + ox, w.y + ((i * 5 + wt) % TILE), 2, 1);
  }

  // --- Scorched earth after a meteor.
  if (sim.env.scorch) {
    const s = sim.env.scorch;
    const a = Math.min(0.55, s.ticksLeft / 400);
    ctx.fillStyle = `rgba(20,14,10,${a})`;
    fillEllipse(ctx, s.x, s.y, s.r, s.r * 0.7);
    ctx.fillStyle = `rgba(60,40,30,${a * 0.6})`;
    fillEllipse(ctx, s.x, s.y, s.r * 0.6, s.r * 0.42);
  }

  // --- Food.
  for (const f of sim.food) drawFood(ctx, f.x, f.y, f.age, weather);

  // --- Creatures, depth-sorted.
  const frameBit = opts.paused ? 0 : (Math.floor(rs.time * 8) & 1) as 0 | 1;
  const creatures = sim.creatures.slice().sort((a, b) => a.y - b.y);
  const highlightOn = rs.highlightSpeciesId !== null && rs.time < rs.highlightUntil;
  for (const c of creatures) {
    const growth = growthLevel(c.age, MATURITY_AGE);
    drawShadow(ctx, c.genome, c.x, c.y, growth);
  }
  for (const c of creatures) {
    const growth = growthLevel(c.age, MATURITY_AGE);
    const moving = c.state !== "mate" || true;
    const frame = moving ? ((frameBit + (c.id & 1)) & 1) as 0 | 1 : 0;
    const alpha = c.hurtTimer > 0 && c.hurtTimer % 4 < 2 ? 0.45 : 1;
    drawCreature(ctx, c.genome, c.x, c.y, c.facing, { frame, growth }, alpha);

    if (highlightOn && c.speciesId === rs.highlightSpeciesId) {
      const pulse = 5 + Math.sin(rs.time * 6) * 2;
      strokePixelCircle(ctx, c.x, c.y - 3, pulse, "#f5cf7a");
    }
    if (c.id === opts.selectedId) {
      strokePixelCircle(ctx, c.x, c.y - 3, 7, "#ffffff");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(c.x), Math.round(c.y) - 14, 1, 3);
    }
    if (c.state === "flee" && opts.speed <= 10) {
      ctx.fillStyle = "#ffd34a";
      ctx.fillRect(Math.round(c.x) + 3, Math.round(c.y) - 12, 1, 3);
      ctx.fillRect(Math.round(c.x) + 3, Math.round(c.y) - 8, 1, 1);
    }
  }

  // --- Predators.
  for (const p of sim.predators) {
    const frame = p.state === "rest" ? 0 : (((Math.floor(rs.time * 10) & 1) as 0 | 1));
    drawPredator(ctx, p.x, p.y, p.facing, frame, p.state === "attack" || p.state === "chase");
  }

  // --- Particles.
  updateParticles(rs, dt);
  for (const p of rs.particles) {
    const a = Math.min(1, p.life / p.maxLife + 0.15);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // --- Meteor approach.
  if (rs.meteor && !rs.meteor.impacted) {
    const m = rs.meteor;
    m.t = Math.min(1, m.t + dt / 1.25);
    const startX = m.targetX + 260;
    const startY = m.targetY - 420;
    const mx = startX + (m.targetX - startX) * m.t;
    const my = startY + (m.targetY - startY) * m.t;
    for (let k = 0; k < 3; k++) {
      spawn(rs, { x: mx + (Math.random() - 0.5) * 6, y: my + (Math.random() - 0.5) * 6, vx: 40 + Math.random() * 30, vy: -60 - Math.random() * 40, life: 0.5, color: k === 0 ? "#fff1b0" : "#ff8a3d", size: 2, gravity: 0 });
    }
    ctx.fillStyle = "#3a2a22";
    fillEllipse(ctx, mx, my, 6, 6);
    ctx.fillStyle = "#ff8a3d";
    fillEllipse(ctx, mx - 1, my - 1, 4, 4);
    ctx.fillStyle = "#fff1b0";
    fillEllipse(ctx, mx - 2, my - 2, 2, 2);
    // Target marker on the ground.
    ctx.strokeStyle = "rgba(255,120,60,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(m.targetX, m.targetY, m.r * (0.3 + m.t * 0.7), m.r * 0.7 * (0.3 + m.t * 0.7), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (rs.meteor && rs.meteor.impacted) {
    const m = rs.meteor;
    m.impactT += dt;
    const k = m.impactT / 0.9;
    if (k < 1) {
      ctx.strokeStyle = `rgba(255,200,120,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(m.targetX, m.targetY, m.r * 1.6 * k + 4, m.r * 1.1 * k + 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      rs.meteor = null;
    }
  }

  ctx.restore();

  // --- Weather overlays.
  drawWeather(ctx, rs, weather, dt);

  // --- Impact flash.
  if (rs.flash > 0) {
    ctx.fillStyle = `rgba(255,240,210,${rs.flash * 0.85})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    rs.flash = Math.max(0, rs.flash - dt * 2.2);
  }

  // --- Vignette.
  const grad = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.55, WORLD_W / 2, WORLD_H / 2, WORLD_H * 1.05);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

function updateParticles(rs: RendererState, dt: number) {
  const next: Particle[] = [];
  for (const p of rs.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    next.push(p);
  }
  rs.particles = next;
}

function drawWeather(ctx: CanvasRenderingContext2D, rs: RendererState, weather: Weather, dt: number) {
  if (weather === "rain") {
    if (rs.drops.length < 110) {
      for (let i = rs.drops.length; i < 110; i++) rs.drops.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, v: 160 + Math.random() * 120 });
    }
    ctx.fillStyle = "rgba(40,70,120,0.16)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "rgba(190,220,255,0.55)";
    for (const d of rs.drops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.25 * dt;
      if (d.y > WORLD_H) {
        d.y = -4;
        d.x = Math.random() * (WORLD_W + 40);
      }
      if (d.x < -2) d.x = WORLD_W;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
    }
  } else if (weather === "winter") {
    if (rs.drops.length < 70) {
      for (let i = rs.drops.length; i < 70; i++) rs.drops.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, v: 14 + Math.random() * 18 });
    }
    ctx.fillStyle = "rgba(200,220,255,0.12)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const d of rs.drops) {
      d.y += d.v * dt;
      d.x += Math.sin(rs.time * 1.5 + d.v) * 8 * dt;
      if (d.y > WORLD_H) {
        d.y = -2;
        d.x = Math.random() * WORLD_W;
      }
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }
  } else if (weather === "drought") {
    rs.drops.length = 0;
    ctx.fillStyle = "rgba(220,150,50,0.13)";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Heat haze: a few drifting bright motes.
    ctx.fillStyle = "rgba(255,230,160,0.35)";
    for (let i = 0; i < 12; i++) {
      const x = (i * 97 + rs.time * 9) % WORLD_W;
      const y = (i * 53 + Math.sin(rs.time + i) * 6 + WORLD_H) % WORLD_H;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  } else {
    rs.drops.length = 0;
    // Gentle pollen / fireflies.
    ctx.fillStyle = "rgba(255,255,200,0.35)";
    for (let i = 0; i < 8; i++) {
      const x = (i * 131 + rs.time * 6) % WORLD_W;
      const y = (i * 71 + Math.sin(rs.time * 0.7 + i) * 8 + WORLD_H) % WORLD_H;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

function fillEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function strokePixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const steps = Math.max(12, Math.round(r * 5));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 1, 1);
  }
}

export function hueForSpecies(sim: Simulation, speciesId: number): number {
  const sp = sim.species.find((s) => s.id === speciesId);
  return sp ? hueOf(sp.averageGenome) : 120;
}
