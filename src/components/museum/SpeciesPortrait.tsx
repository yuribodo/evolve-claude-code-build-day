"use client";

import { useEffect, useRef } from "react";
import { drawCreature, drawShadow, getCreatureSprite, quantizeGenome, spriteMetrics } from "@/simulation/render/sprites";
import type { Genome } from "@/simulation/types";
import { cn } from "@/lib/utils";

interface SpeciesPortraitProps {
  genome: Genome;
  /** Upscale factor for the pixel art. */
  scale?: number;
  animate?: boolean;
  className?: string;
  dim?: boolean;
}

/** Renders the same procedural sprite used in the world, enlarged, on a tiny canvas. */
export function SpeciesPortrait({ genome, scale = 5, animate = true, className, dim }: SpeciesPortraitProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = quantizeGenome(genome);
    const m = spriteMetrics(g, 1);
    const w = m.w + 6;
    const h = m.h + 6;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w * scale}px`;
    canvas.style.height = `${h * scale}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    getCreatureSprite(genome, { frame: 0, growth: 1 });

    let raf = 0;
    let frame: 0 | 1 = 0;
    let last = 0;
    const draw = (t: number) => {
      if (animate && t - last > 260) {
        frame = frame === 0 ? 1 : 0;
        last = t;
      }
      ctx.clearRect(0, 0, w, h);
      const fx = Math.floor(w / 2);
      const fy = h - 4;
      drawShadow(ctx, genome, fx, fy, 1);
      drawCreature(ctx, genome, fx, fy, 1, { frame, growth: 1 }, dim ? 0.55 : 1);
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw(0);
    return () => cancelAnimationFrame(raf);
  }, [genome, scale, animate, dim]);

  return <canvas ref={ref} className={cn("block", className)} aria-hidden />;
}
