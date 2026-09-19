"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { seedGenome } from "@/simulation/Genetics";
import { createRng } from "@/simulation/rng";
import { drawCreature, drawShadow } from "@/simulation/render/sprites";
import type { Genome } from "@/simulation/types";
import { useGame } from "./game-context";

/** A small parade of procedurally generated creatures wandering across the title. */
function CreatureParade() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 320;
    const H = 40;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const rng = createRng(7);
    const walkers: { x: number; v: number; g: Genome; phase: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const g = seedGenome(rng);
      // Show where evolution can go: some are already very different.
      const t = i / 8;
      g.size = 0.2 + t * 0.6;
      g.speed = 0.3 + ((i * 37) % 10) / 14;
      g.vision = ((i * 53) % 10) / 10;
      g.armor = i % 3 === 0 ? 0.7 : i % 3 === 1 ? 0.3 : 0.05;
      g.color = (0.2 + i * 0.11) % 1;
      walkers.push({ x: i * 36, v: 6 + g.speed * 10, g, phase: rng.range(0, 10) });
    }
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#1c261a";
      ctx.fillRect(0, H - 4, W, 4);
      for (const w of walkers) {
        w.x += w.v * dt;
        if (w.x > W + 16) w.x = -16;
        w.phase += dt * 6;
        const frame = (Math.floor(w.phase) & 1) as 0 | 1;
        drawShadow(ctx, w.g, w.x, H - 5, 1);
        drawCreature(ctx, w.g, w.x, H - 5, 1, { frame, growth: 1 });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="h-[120px] w-[960px] max-w-full" style={{ imageRendering: "pixelated" }} aria-hidden />;
}

export function TitleScreen() {
  const game = useGame();
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <div className="absolute inset-0 scanlines opacity-40" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative">
        <div className="font-pixel text-[10px] tracking-[0.5em] text-ash">A PIXEL ECOSYSTEM EXPERIMENT</div>
        <h1 className="mt-4 font-pixel text-[44px] leading-none text-fern text-glow-fern sm:text-[72px]">EVOLVE</h1>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="relative mt-6 flex justify-center overflow-hidden">
        <CreatureParade />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="relative mt-6 max-w-md text-[24px] leading-snug text-parchment sm:text-[28px]"
      >
        You don’t create life.
        <br />
        <span className="text-amber-2">You create the conditions for it.</span>
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.6 }} className="relative mt-10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => game.begin()}
          className="pixel-btn group px-8 py-3 font-pixel text-[12px] tracking-widest text-bone hover:bg-moss hover:text-fern-2 active:pixel-btn-pressed sm:text-[14px]"
        >
          [ BEGIN EXPERIMENT ]
        </button>
        <button type="button" onClick={() => game.startDemo()} className="text-[16px] text-ash underline-offset-4 hover:text-[#c3adf5] hover:underline">
          or run the scripted demo experiment (≈3 min)
        </button>
      </motion.div>

      <div className="relative mt-12 grid max-w-2xl grid-cols-3 gap-6 text-[14px] text-ash sm:text-[15px]">
        <div>
          <div className="font-pixel text-[8px] text-fern">01 · SEED</div>
          <p className="mt-1 leading-tight">Twenty-six small foragers. One river. Genes for size, speed, vision, fertility, armor and colour.</p>
        </div>
        <div>
          <div className="font-pixel text-[8px] text-amber">02 · PRESSURE</div>
          <p className="mt-1 leading-tight">Rain, drought, winter, predators, meteors. Every trait has a cost; the environment decides which pay off.</p>
        </div>
        <div>
          <div className="font-pixel text-[8px] text-violet">03 · WATCH</div>
          <p className="mt-1 leading-tight">Populations split. Species emerge. Astra, the field naturalist, records what you never designed.</p>
        </div>
      </div>
    </motion.div>
  );
}
