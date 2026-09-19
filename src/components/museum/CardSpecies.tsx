"use client";

import type { SpeciesRecord } from "@/simulation/types";
import { cn, formatYear } from "@/lib/utils";
import { SpeciesPortrait } from "./SpeciesPortrait";
import { TraitBars } from "./TraitBars";

interface CardSpeciesProps {
  species: SpeciesRecord;
  ancestor: SpeciesRecord | null;
  currentYear: number;
  selected: boolean;
  onSelect: () => void;
  detailed?: boolean;
}

export function CardSpecies({ species: sp, ancestor, currentYear, selected, onSelect, detailed }: CardSpeciesProps) {
  const extinct = sp.status === "extinct";
  const hue = Math.round(sp.averageGenome.color * 360);
  return (
    <article
      onClick={onSelect}
      className={cn(
        "relative flex cursor-pointer flex-col gap-2 p-3 transition-colors",
        selected ? "pixel-frame-amber" : "pixel-frame hover:bg-moss/30",
        extinct && "saturate-50",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className={cn("font-pixel text-[11px] uppercase leading-tight", extinct ? "text-ash" : "text-bone")}>{sp.name}</h3>
          <div className="mt-0.5 text-[13px] text-ash">{sp.parentId === null ? "founding lineage" : `descended from ${ancestor?.name ?? "?"}`}</div>
        </div>
        <span
          className={cn(
            "shrink-0 border px-1.5 py-0.5 font-pixel text-[8px] uppercase",
            extinct ? "border-[#8e86a6] text-[#c9c3d8]" : "border-fern text-fern",
          )}
        >
          {extinct ? "extinct" : "alive"}
        </span>
      </header>

      <div className="relative flex h-24 items-end justify-center overflow-hidden bg-soil" style={{ backgroundImage: `radial-gradient(ellipse at 50% 100%, hsl(${hue} 30% 18%), transparent 70%)` }}>
        <div className="absolute inset-x-0 bottom-0 h-3 bg-[#2b3a26]" />
        <div className="relative mb-2">
          <SpeciesPortrait genome={sp.averageGenome} scale={detailed ? 5 : 4} animate={!extinct} dim={extinct} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-[13px] leading-tight">
        <div>
          <dt className="uppercase tracking-wider text-ash">Origin</dt>
          <dd className="text-parchment">yr {formatYear(sp.originYear)}</dd>
          <dd className="text-ash">gen {sp.originGeneration}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-ash">Population</dt>
          <dd className={cn(extinct ? "text-ash" : "text-parchment")}>{sp.population}</dd>
          <dd className="text-ash">peak {sp.peakPopulation}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-ash">{extinct ? "Extinct" : "Age"}</dt>
          <dd className="text-parchment">{extinct ? `yr ${formatYear(sp.extinctYear ?? 0)}` : `${currentYear - sp.originYear} yrs`}</dd>
          <dd className="text-ash">{extinct ? `lived ${(sp.extinctYear ?? 0) - sp.originYear} yrs` : `${sp.totalBorn} born`}</dd>
        </div>
      </dl>

      <div className="border-t border-moss pt-2">
        <TraitBars genome={sp.averageGenome} compare={ancestor?.averageGenome} cells={8} compact />
      </div>
      {ancestor && <p className="text-[12px] text-ash">amber marks = ancestor’s value</p>}
    </article>
  );
}
