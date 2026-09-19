"use client";

import { useEffect, useRef } from "react";
import type { ChronicleKind } from "@/simulation/types";
import { cn, formatYear } from "@/lib/utils";
import { ModalFrame } from "@/components/ui/ModalFrame";
import { useGame, useGameState } from "@/components/ui/game-context";

const ICON: Record<ChronicleKind, { glyph: string; color: string }> = {
  seed: { glyph: "●", color: "text-fern" },
  milestone: { glyph: "●", color: "text-fern-2" },
  weather: { glyph: "◆", color: "text-[#8ec2ee]" },
  predator: { glyph: "⚠", color: "text-[#ff8f8b]" },
  mutation: { glyph: "◇", color: "text-amber" },
  divergence: { glyph: "⟡", color: "text-violet" },
  species: { glyph: "🧬", color: "text-amber-2" },
  extinction: { glyph: "💀", color: "text-[#c9c3d8]" },
  meteor: { glyph: "☄", color: "text-[#ffb17a]" },
  collapse: { glyph: "▼", color: "text-ember" },
};

export function ChroniclePanel() {
  const game = useGame();
  const open = useGameState((s) => s.panels.chronicle);
  const chronicle = useGameState((s) => s.chronicle);
  const year = useGameState((s) => s.year);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, chronicle.length]);

  return (
    <ModalFrame open={open} title="CHRONICLE" subtitle={`${chronicle.length} events recorded · year ${formatYear(year)}`} onClose={() => game.setPanel({ chronicle: false })}>
      <ol className="relative px-4 py-4 sm:px-6">
        <div className="absolute bottom-4 left-[88px] top-4 w-0.5 bg-moss sm:left-[104px]" aria-hidden />
        {chronicle.map((e) => {
          const icon = ICON[e.kind];
          const big = e.kind === "species" || e.kind === "extinction" || e.kind === "meteor";
          return (
            <li key={e.id} className={cn("relative flex items-start gap-3 py-1.5", big && "py-2.5")}>
              <span className="w-16 shrink-0 text-right font-pixel text-[10px] tabular-nums text-amber sm:w-20">YEAR {formatYear(e.year)}</span>
              <span className={cn("z-10 flex size-5 shrink-0 items-center justify-center bg-soil-2 text-[13px] leading-none", icon.color)}>{icon.glyph}</span>
              <span className={cn("leading-tight", big ? "text-[20px] text-bone" : "text-[17px] text-parchment", e.kind === "mutation" && "text-amber-2/90")}>{e.text}</span>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>
    </ModalFrame>
  );
}
