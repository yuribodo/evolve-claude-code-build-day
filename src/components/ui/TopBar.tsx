"use client";

import { SPEEDS } from "@/lib/game-types";
import { cn, formatYear } from "@/lib/utils";
import { ButtonPixel } from "./ButtonPixel";
import { useGame, useGameState } from "./game-context";

export function TopBar() {
  const game = useGame();
  const year = useGameState((s) => s.year);
  const speed = useGameState((s) => s.speed);
  const paused = useGameState((s) => s.paused);
  const yps = useGameState((s) => s.yearsPerSecond);
  const overlay = useGameState((s) => s.overlay);
  const demo = useGameState((s) => s.demo);
  const panels = useGameState((s) => s.panels);
  const seed = useGameState((s) => s.seed);

  const running = !paused && !overlay;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b-2 border-moss bg-soil px-3 sm:gap-5 sm:px-4">
      <div className="flex items-baseline gap-2">
        <h1 className="font-pixel text-[13px] text-fern text-glow-fern sm:text-[15px]">EVOLVE</h1>
        <span className="hidden text-[13px] text-ash md:inline">seed {seed}</span>
      </div>

      <div className="font-pixel text-[11px] text-amber text-glow-amber sm:text-[13px]">
        YEAR <span className="tabular-nums">{formatYear(year)}</span>
      </div>

      <div className="hidden items-center gap-2 text-[15px] sm:flex">
        <span className={cn("inline-block size-2", running ? "animate-blink bg-fern" : "bg-ember")} />
        <span className="uppercase tracking-wider text-parchment">{paused ? "paused" : overlay ? "observing" : "running"}</span>
        <span className="text-ash">×{speed}</span>
        {running && yps > 0 && <span className="hidden text-ash lg:inline">· {yps < 10 ? yps.toFixed(1) : Math.round(yps)} yr/s</span>}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ButtonPixel size="sm" onClick={() => game.togglePause()} active={paused} aria-label={paused ? "Resume" : "Pause"} title="Space">
          {paused ? "▶" : "❚❚"}
        </ButtonPixel>
        <div className="flex">
          {SPEEDS.map((s) => (
            <ButtonPixel key={s} size="sm" active={speed === s && !paused} onClick={() => game.setSpeed(s)} className="-ml-0.5 first:ml-0">
              {s}×
            </ButtonPixel>
          ))}
        </div>
        <span className="mx-1 hidden h-6 w-0.5 bg-moss sm:block" />
        <ButtonPixel size="sm" tone="amber" active={panels.chronicle} onClick={() => game.setPanel({ chronicle: !panels.chronicle, museum: false })} className="hidden sm:inline-flex">
          Chronicle
        </ButtonPixel>
        <ButtonPixel size="sm" tone="amber" active={panels.museum} onClick={() => game.setPanel({ museum: !panels.museum, chronicle: false })} className="hidden sm:inline-flex">
          Museum
        </ButtonPixel>
        <ButtonPixel
          size="sm"
          tone="violet"
          active={!!demo}
          onClick={() => (demo ? game.stopDemo() : game.startDemo())}
          title="Run the scripted 2–3 minute experiment"
          className="hidden md:inline-flex"
        >
          {demo ? "Stop demo" : "Demo"}
        </ButtonPixel>
        <ButtonPixel size="sm" onClick={() => game.setPanel({ astraOpen: !panels.astraOpen })} className="lg:hidden" aria-label="Toggle Astra panel">
          Astra
        </ButtonPixel>
      </div>
    </header>
  );
}
