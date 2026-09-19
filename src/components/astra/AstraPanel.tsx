"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { AstraTone } from "@/lib/astra";
import { cn, formatYear } from "@/lib/utils";
import { WEATHER_LABEL } from "@/simulation/Ecosystem";
import { MATURITY_AGE } from "@/simulation/constants";
import { lifespanTicks } from "@/simulation/Genetics";
import { useGame, useGameState } from "@/components/ui/game-context";
import { PopulationGraph } from "@/components/ui/PopulationGraph";
import { SpeciesPortrait } from "@/components/museum/SpeciesPortrait";
import { TraitBars } from "@/components/museum/TraitBars";

const TONE_COLOR: Record<AstraTone, string> = {
  neutral: "text-parchment",
  alert: "text-[#ffb3b0]",
  discovery: "text-amber-2",
  grief: "text-[#c9c3d8]",
  wonder: "text-fern-2",
};

const TONE_DOT: Record<AstraTone, string> = {
  neutral: "bg-fern",
  alert: "bg-ember",
  discovery: "bg-amber",
  grief: "bg-[#8e86a6]",
  wonder: "bg-fern-2",
};

function AstraAvatar({ tone }: { tone: AstraTone }) {
  // A tiny pixel "eye" — Astra watches.
  const iris = tone === "alert" ? "#d9534f" : tone === "discovery" ? "#e8b04a" : "#7bc96f";
  return (
    <svg viewBox="0 0 16 12" width={32} height={24} shapeRendering="crispEdges" aria-hidden>
      <rect x="2" y="3" width="12" height="6" fill="#e6e9d8" />
      <rect x="1" y="4" width="1" height="4" fill="#e6e9d8" />
      <rect x="14" y="4" width="1" height="4" fill="#e6e9d8" />
      <rect x="4" y="2" width="8" height="1" fill="#e6e9d8" />
      <rect x="4" y="9" width="8" height="1" fill="#e6e9d8" />
      <rect x="6" y="3" width="4" height="6" fill={iris} />
      <rect x="7" y="4" width="2" height="4" fill="#070a06" />
      <rect x="7" y="4" width="1" height="1" fill="#ffffff" />
    </svg>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h3 className="font-pixel text-[9px] uppercase tracking-widest text-ash">{children}</h3>
      {right}
    </div>
  );
}

export function AstraPanel() {
  const game = useGame();
  const astra = useGameState((s) => s.astra);
  const latest = astra[0];
  const tone = latest?.tone ?? "neutral";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b-2 border-moss px-4 py-3">
        <AstraAvatar tone={tone} />
        <div>
          <div className="font-pixel text-[12px] tracking-widest text-bone">ASTRA</div>
          <div className="text-[13px] text-ash">field naturalist · observing</div>
        </div>
        <span className={cn("ml-auto size-2", TONE_DOT[tone], "animate-blink")} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* Observation */}
        <section>
          <SectionTitle right={latest && <span className="text-[13px] text-ash">yr {formatYear(latest.year)}</span>}>● Observation</SectionTitle>
          <div className="min-h-[92px]">
            <AnimatePresence mode="wait">
              {latest && (
                <motion.div
                  key={latest.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <p className={cn("text-[21px] leading-snug", TONE_COLOR[latest.tone])}>“{latest.observation}”</p>
                  {latest.hypothesis && (
                    <div className="mt-2 border-l-2 border-moss-2 pl-2">
                      <div className="font-pixel text-[8px] uppercase tracking-widest text-ash">hypothesis</div>
                      <p className="mt-0.5 text-[17px] leading-snug text-parchment/90">{latest.hypothesis}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Field notes log */}
        {astra.length > 1 && (
          <section>
            <SectionTitle>Field notes</SectionTitle>
            <ul className="space-y-1">
              {astra.slice(1, 6).map((m) => (
                <li key={m.id} className="flex gap-2 text-[14px] leading-tight text-ash">
                  <span className="shrink-0 tabular-nums text-ash/70">{formatYear(m.year)}</span>
                  <span className={cn("mt-1.5 size-1.5 shrink-0", TONE_DOT[m.tone])} />
                  <span className="truncate">{m.observation}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Hud />

        <section>
          <SectionTitle>Population</SectionTitle>
          <div className="pixel-frame p-1.5">
            <PopulationGraph />
          </div>
          <div className="mt-1 flex gap-3 text-[12px] text-ash">
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-fern" />population</span>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 border-t border-dashed border-amber" />species ×10</span>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-ember" />predators ×10</span>
          </div>
        </section>

        <SpeciesList />
        <Inspector />
      </div>

      <div className="border-t-2 border-moss px-4 py-2 text-[13px] text-ash">
        Click a creature to read its genome ·{" "}
        <button type="button" className="text-amber hover:underline" onClick={() => game.setPanel({ museum: true })}>
          open museum
        </button>
      </div>
    </div>
  );
}

function Hud() {
  const year = useGameState((s) => s.year);
  const population = useGameState((s) => s.population);
  const speciesAlive = useGameState((s) => s.speciesAlive);
  const speciesTotal = useGameState((s) => s.speciesTotal);
  const food = useGameState((s) => s.food);
  const predators = useGameState((s) => s.predators);
  const weather = useGameState((s) => s.weather);
  const weatherYearsLeft = useGameState((s) => s.weatherYearsLeft);

  const cells: { label: string; value: string; sub?: string; accent?: string }[] = [
    { label: "Year", value: formatYear(year) },
    { label: "Population", value: String(population), accent: population < 15 ? "text-ember" : undefined },
    { label: "Species", value: String(speciesAlive), sub: speciesTotal > speciesAlive ? `${speciesTotal - speciesAlive} extinct` : undefined },
    { label: "Food", value: String(food) },
    { label: "Predators", value: String(predators), accent: predators > 0 ? "text-[#ff8f8b]" : undefined },
    { label: "Environment", value: WEATHER_LABEL[weather], sub: weather !== "clear" ? `${weatherYearsLeft} yrs left` : undefined },
  ];

  return (
    <section>
      <SectionTitle>Readings</SectionTitle>
      <dl className="grid grid-cols-3 gap-px bg-moss">
        {cells.map((c) => (
          <div key={c.label} className="bg-soil-2 px-2 py-1.5">
            <dt className="text-[11px] uppercase tracking-wider text-ash">{c.label}</dt>
            <dd className={cn("font-pixel text-[11px] leading-tight text-bone", c.accent)}>{c.value}</dd>
            {c.sub && <dd className="text-[12px] text-ash">{c.sub}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function SpeciesList() {
  const game = useGame();
  const species = useGameState((s) => s.species);
  const sorted = [...species].sort((a, b) => (a.status === b.status ? b.population - a.population : a.status === "alive" ? -1 : 1));
  return (
    <section>
      <SectionTitle right={<span className="text-[13px] text-ash">{species.length} recorded</span>}>Species</SectionTitle>
      <ul className="space-y-1">
        {sorted.slice(0, 6).map((sp) => (
          <li key={sp.id}>
            <button
              type="button"
              onClick={() => game.setPanel({ museum: true, inspectSpeciesId: sp.id })}
              className="flex w-full items-center gap-2 px-1 py-0.5 text-left hover:bg-moss/50"
            >
              <span className="inline-block size-3 border border-soil" style={{ background: `hsl(${Math.round(sp.averageGenome.color * 360)} 58% 46%)` }} />
              <span className={cn("text-[16px]", sp.status === "extinct" ? "text-ash line-through" : "text-parchment")}>{sp.name}</span>
              <span className="ml-auto tabular-nums text-[14px] text-ash">{sp.status === "extinct" ? `† ${formatYear(sp.extinctYear ?? 0)}` : sp.population}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Inspector() {
  const game = useGame();
  const selected = useGameState((s) => s.selected);
  const species = useGameState((s) => s.species);
  if (!selected) return null;
  const sp = species.find((s) => s.id === selected.speciesId);
  const lifespan = lifespanTicks(selected.genome);
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pixel-frame-amber p-2">
      <SectionTitle
        right={
          <button type="button" className="text-[13px] text-ash hover:text-bone" onClick={() => game.clearSelection()}>
            close ✕
          </button>
        }
      >
        Specimen #{selected.id}
      </SectionTitle>
      <div className="flex gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center bg-soil">
          <SpeciesPortrait genome={selected.genome} scale={3} />
        </div>
        <div className="text-[14px] leading-tight text-ash">
          <div className="text-[16px] text-parchment">{sp?.name ?? "Unknown"} · {selected.sex === "F" ? "♀" : "♂"}</div>
          <div>generation {selected.generation}</div>
          <div>
            age {(selected.age / 50).toFixed(1)} / {(lifespan / 50).toFixed(1)} yrs {selected.age < MATURITY_AGE && "· juvenile"}
          </div>
          <div>
            energy <span className="text-parchment">{Math.round(selected.energy)}</span> · {selected.state}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <TraitBars genome={selected.genome} compare={sp?.averageGenome} compact />
      </div>
    </motion.section>
  );
}
