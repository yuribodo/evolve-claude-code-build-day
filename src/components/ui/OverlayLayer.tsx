"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Toast } from "@/lib/game-types";
import { cn, formatYear } from "@/lib/utils";
import { SpeciesPortrait } from "@/components/museum/SpeciesPortrait";
import { TraitBars } from "@/components/museum/TraitBars";
import { useGame, useGameState } from "./game-context";

const TOAST_STYLE: Record<Toast["kind"], { frame: string; title: string; glyph: string }> = {
  divergence: { frame: "border-violet", title: "text-[#c3adf5]", glyph: "⟡" },
  extinction: { frame: "border-[#8e86a6]", title: "text-[#e2ddf0]", glyph: "💀" },
  meteor: { frame: "border-[#ff8a3d]", title: "text-[#ffb17a]", glyph: "☄" },
  predator: { frame: "border-ember", title: "text-[#ff8f8b]", glyph: "⚠" },
  info: { frame: "border-fern", title: "text-fern-2", glyph: "●" },
};

export function OverlayLayer() {
  return (
    <>
      <Toasts />
      <SpeciesDiscovery />
      <DemoCaption />
    </>
  );
}

function Toasts() {
  const toasts = useGameState((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {toasts.map((t) => {
          const st = TOAST_STYLE[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className={cn("flex items-center gap-3 border-2 bg-soil/95 px-4 py-2 shadow-[0_0_0_2px_#070a06]", st.frame)}
            >
              <span className="text-[20px] leading-none">{st.glyph}</span>
              <div>
                <div className={cn("font-pixel text-[10px] tracking-widest", st.title)}>{t.title}</div>
                {t.body && <div className="text-[15px] leading-tight text-parchment">{t.body}</div>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SpeciesDiscovery() {
  const game = useGame();
  const overlay = useGameState((s) => s.overlay);
  const astra = useGameState((s) => s.astra);
  const open = overlay?.kind === "species";
  const latestDiscovery = astra.find((m) => m.tone === "discovery");

  return (
    <AnimatePresence>
      {open && overlay && (
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center bg-ink/75 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => game.dismissOverlay()}
        >
          <AnimatePresence mode="wait">
            {overlay.stage === 0 ? (
              <motion.div
                key="stage0"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.35 }}
                className="text-center"
              >
                <div className="font-pixel text-[13px] tracking-[0.3em] text-violet sm:text-[18px]">GENETIC DIVERGENCE</div>
                <div className="mt-2 font-pixel text-[13px] tracking-[0.3em] text-bone sm:text-[18px]">DETECTED</div>
                <div className="mx-auto mt-4 h-0.5 w-32 animate-blink bg-violet" />
              </motion.div>
            ) : (
              <motion.div
                key="stage1"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="pixel-frame-amber relative w-full max-w-xl p-5 sm:p-7"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-soil px-3 font-pixel text-[9px] tracking-widest text-amber">
                  🧬 NEW SPECIES DISCOVERED
                </div>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="relative flex size-36 shrink-0 items-end justify-center bg-soil pb-4">
                    <div className="absolute inset-x-0 bottom-0 h-3 bg-moss" />
                    <div className="absolute inset-0 animate-pulse-ring border-2 border-amber/40" />
                    <div className="relative">
                      <SpeciesPortrait genome={overlay.species.averageGenome} scale={6} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <motion.h2
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="font-pixel text-[20px] uppercase leading-tight text-bone text-glow-amber sm:text-[26px]"
                    >
                      {overlay.species.name}
                    </motion.h2>
                    <p className="mt-1 text-[16px] text-ash">
                      Diverged from <span className="text-parchment">{overlay.parent.name}</span> · year {formatYear(overlay.species.originYear)} · generation {overlay.species.originGeneration} · {overlay.species.population} individuals
                    </p>
                    <div className="mt-3">
                      <TraitBars genome={overlay.species.averageGenome} compare={overlay.parent.averageGenome} cells={10} compact />
                    </div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.5 }} className="mt-4 border-l-2 border-amber pl-3">
                      <div className="font-pixel text-[8px] tracking-widest text-ash">ASTRA</div>
                      <p className="text-[20px] leading-snug text-parchment">“You didn’t design this creature.”</p>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.5 }} className="text-[20px] leading-snug text-amber-2">
                        “The environment did.”
                      </motion.p>
                    </motion.div>
                    {latestDiscovery && <span className="sr-only">{latestDiscovery.observation}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => game.dismissOverlay()}
                  className="pixel-btn mt-5 w-full px-3 py-1.5 text-[16px] uppercase tracking-widest text-parchment hover:bg-moss/70"
                >
                  continue observing ▸
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DemoCaption() {
  const demo = useGameState((s) => s.demo);
  return (
    <AnimatePresence>
      {demo && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="pointer-events-none absolute bottom-3 left-3 z-20 border-2 border-violet/70 bg-soil/90 px-3 py-2 shadow-[0_0_0_2px_#070a06]"
        >
          <div className="flex items-center gap-2 font-pixel text-[8px] tracking-widest text-[#c3adf5]">
            DEMO EXPERIMENT
            <span className="text-ash">
              {demo.step + 1}/{demo.total}
            </span>
          </div>
          <div className="mt-0.5 text-[16px] leading-tight text-bone">
            <span className="text-amber">{demo.label}</span> — {demo.caption}
          </div>
          <div className="mt-1.5 flex gap-0.5">
            {Array.from({ length: demo.total }).map((_, i) => (
              <span key={i} className={cn("h-1 w-4", i <= demo.step ? "bg-violet" : "bg-moss")} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
