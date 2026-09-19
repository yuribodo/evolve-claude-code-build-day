"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { AstraPanel } from "@/components/astra/AstraPanel";
import { ChroniclePanel } from "@/components/chronicle/ChroniclePanel";
import { MuseumPanel } from "@/components/museum/MuseumPanel";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { SPEEDS } from "@/lib/game-types";
import { EventBar } from "./EventBar";
import { GameProvider, useGame, useGameState } from "./game-context";
import { OverlayLayer } from "./OverlayLayer";
import { TitleScreen } from "./TitleScreen";
import { TopBar } from "./TopBar";

export function GameShell() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

function useHotkeys() {
  const game = useGame();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const s = game.store.get();
      if (s.phase !== "running") return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          game.togglePause();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
          game.setSpeed(SPEEDS[Number(e.key) - 1]);
          break;
        case "c":
          game.setPanel({ chronicle: !s.panels.chronicle, museum: false });
          break;
        case "m":
          game.setPanel({ museum: !s.panels.museum, chronicle: false });
          break;
        case "r":
          game.trigger("rain");
          break;
        case "d":
          game.trigger("drought");
          break;
        case "w":
          game.trigger("winter");
          break;
        case "p":
          game.trigger("predator");
          break;
        case "x":
          game.trigger("meteor");
          break;
        case "Escape":
          if (s.overlay) game.dismissOverlay();
          else game.clearSelection();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);
}

function Shell() {
  const game = useGame();
  const phase = useGameState((s) => s.phase);
  const astraOpen = useGameState((s) => s.panels.astraOpen);
  useHotkeys();

  return (
    <div className="relative flex h-full flex-col bg-ink text-parchment">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <SimulationCanvas />
          <OverlayLayer />
          <ChroniclePanel />
          <MuseumPanel />
        </main>

        {/* Desktop Astra column */}
        <aside className="hidden w-[320px] shrink-0 border-l-2 border-moss bg-soil lg:block xl:w-[360px]">
          <AstraPanel />
        </aside>

        {/* Mobile / tablet Astra drawer */}
        <AnimatePresence>
          {astraOpen && (
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-y-0 right-0 z-30 w-[min(92vw,360px)] border-l-2 border-moss bg-soil shadow-[-8px_0_24px_rgba(0,0,0,0.6)] lg:hidden"
            >
              <button
                type="button"
                onClick={() => game.setPanel({ astraOpen: false })}
                className="absolute right-2 top-2 z-10 px-2 py-0.5 text-[15px] text-ash hover:text-bone"
                aria-label="Close Astra panel"
              >
                ✕
              </button>
              <AstraPanel />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      <EventBar />

      <AnimatePresence>{phase === "title" && <TitleScreen key="title" />}</AnimatePresence>
    </div>
  );
}
