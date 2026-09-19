"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD_H, WORLD_W } from "@/simulation/constants";
import { useGame } from "@/components/ui/game-context";

/**
 * The world is rendered at a fixed low resolution and upscaled by an integer
 * factor when possible, so pixels stay crisp and evenly sized.
 */
export function SimulationCanvas() {
  const game = useGame();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    game.attachCanvas(canvasRef.current);
    return () => game.attachCanvas(null);
  }, [game]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const raw = Math.min(width / WORLD_W, height / WORLD_H);
      const snapped = raw >= 1 ? Math.floor(raw * 4) / 4 : raw; // quarter steps keep pixels tidy
      setScale(Math.max(0.5, snapped));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const wx = ((e.clientX - rect.left) / rect.width) * WORLD_W;
      const wy = ((e.clientY - rect.top) / rect.height) * WORLD_H;
      game.selectAt(wx, wy);
    },
    [game],
  );

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#050704]">
      <div
        className="relative"
        style={{ width: WORLD_W * scale, height: WORLD_H * scale, boxShadow: "0 0 0 2px #1c261a, 0 0 0 4px #070a06, 0 0 40px rgba(0,0,0,0.8)" }}
      >
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          onClick={onClick}
          className="block h-full w-full cursor-crosshair"
          aria-label="Ecosystem simulation"
        />
        <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
      </div>
    </div>
  );
}
