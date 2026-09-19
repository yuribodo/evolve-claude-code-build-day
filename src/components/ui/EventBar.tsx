"use client";

import type { EnvEventKind } from "@/simulation/types";
import { cn } from "@/lib/utils";
import { useGame, useGameState } from "./game-context";

interface EventDef {
  kind: EnvEventKind;
  icon: string;
  label: string;
  hint: string;
  color: string;
  activeColor: string;
}

const EVENTS: EventDef[] = [
  { kind: "rain", icon: "🌧", label: "Rain", hint: "Food grows fast · 30 yrs", color: "text-[#8ec2ee]", activeColor: "bg-[#173a5c] border-[#5b9bd0]" },
  { kind: "drought", icon: "☀", label: "Drought", hint: "Food scarce · 40 yrs", color: "text-[#f2c86a]", activeColor: "bg-[#5a4212] border-[#e8b04a]" },
  { kind: "winter", icon: "❄", label: "Winter", hint: "Slow, cold, hungry · 30 yrs", color: "text-[#d7e6f5]", activeColor: "bg-[#2e4658] border-[#cfd8e2]" },
  { kind: "predator", icon: "🦖", label: "Predator", hint: "Release two hunters", color: "text-[#ff8f8b]", activeColor: "bg-[#4a1a20] border-[#d9534f]" },
  { kind: "meteor", icon: "☄", label: "Meteor", hint: "Mass extinction event", color: "text-[#ffb17a]", activeColor: "bg-[#4a2a10] border-[#ff8a3d]" },
];

export function EventBar() {
  const game = useGame();
  const weather = useGameState((s) => s.weather);
  const weatherYearsLeft = useGameState((s) => s.weatherYearsLeft);
  const predators = useGameState((s) => s.predators);
  const meteorPending = useGameState((s) => s.meteorPending);

  return (
    <footer className="shrink-0 border-t-2 border-moss bg-soil">
      <div className="flex items-stretch gap-2 overflow-x-auto px-3 py-2 sm:justify-center sm:gap-3 sm:px-4">
        {EVENTS.map((ev) => {
          const isWeather = ev.kind === "rain" || ev.kind === "drought" || ev.kind === "winter";
          const active = isWeather ? weather === ev.kind : ev.kind === "predator" ? predators > 0 : meteorPending;
          return (
            <button
              key={ev.kind}
              type="button"
              onClick={() => game.trigger(ev.kind)}
              disabled={ev.kind === "meteor" && meteorPending}
              title={ev.hint}
              className={cn(
                "pixel-btn group relative flex min-w-[112px] shrink-0 flex-col items-center gap-0.5 px-4 py-1.5 sm:min-w-[136px]",
                "hover:bg-moss/60 active:pixel-btn-pressed disabled:opacity-50",
                active && cn("pixel-btn-pressed", ev.activeColor),
              )}
            >
              <span className="text-[20px] leading-none">{ev.icon}</span>
              <span className={cn("font-pixel text-[10px] uppercase", ev.color)}>{ev.label}</span>
              <span className="text-[13px] leading-none text-ash">
                {isWeather && active ? `${weatherYearsLeft} yrs left · click to end` : ev.kind === "predator" && predators > 0 ? `${predators} hunting` : ev.hint}
              </span>
              {active && <span className="absolute right-1 top-1 size-1.5 animate-blink bg-bone" />}
            </button>
          );
        })}
      </div>
    </footer>
  );
}
