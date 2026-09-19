"use client";

import type { SpeciesRecord } from "@/simulation/types";
import { cn, formatYear } from "@/lib/utils";
import { SpeciesPortrait } from "./SpeciesPortrait";

interface LineageTreeProps {
  species: SpeciesRecord[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function Node({ sp, selected, onSelect }: { sp: SpeciesRecord; selected: boolean; onSelect: () => void }) {
  const extinct = sp.status === "extinct";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-[124px] flex-col items-center gap-1 px-2 py-2 text-center transition-colors",
        selected ? "pixel-frame-amber" : "pixel-frame hover:bg-moss/40",
      )}
    >
      <div className="flex h-12 items-end justify-center">
        <SpeciesPortrait genome={sp.averageGenome} scale={2} animate={!extinct} dim={extinct} />
      </div>
      <div className={cn("font-pixel text-[9px] uppercase leading-tight", extinct ? "text-ash" : "text-bone")}>{sp.name}</div>
      <div className="text-[12px] leading-tight text-ash">
        {extinct ? `† ${formatYear(sp.originYear)}–${formatYear(sp.extinctYear ?? 0)}` : `yr ${formatYear(sp.originYear)} · ${sp.population} alive`}
      </div>
    </button>
  );
}

function Branch({ sp, all, selectedId, onSelect }: { sp: SpeciesRecord; all: SpeciesRecord[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const children = all.filter((s) => s.parentId === sp.id).sort((a, b) => a.originYear - b.originYear);
  return (
    <div className="flex flex-col items-center">
      <Node sp={sp} selected={selectedId === sp.id} onSelect={() => onSelect(sp.id)} />
      {children.length > 0 && (
        <>
          <div className="h-5 w-0.5 bg-moss-2" />
          <div className="flex items-start">
            {children.map((child, i) => (
              <div
                key={child.id}
                className={cn(
                  "relative flex flex-col items-center px-3 pt-5",
                  "before:absolute before:left-0 before:top-0 before:h-0.5 before:w-1/2 before:bg-moss-2",
                  "after:absolute after:right-0 after:top-0 after:h-0.5 after:w-1/2 after:bg-moss-2",
                  i === 0 && "before:bg-transparent",
                  i === children.length - 1 && "after:bg-transparent",
                  children.length === 1 && "before:bg-transparent after:bg-transparent",
                )}
              >
                <div className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-moss-2" />
                <Branch sp={child} all={all} selectedId={selectedId} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function LineageTree({ species, selectedId, onSelect }: LineageTreeProps) {
  const roots = species.filter((s) => s.parentId === null);
  return (
    <div className="flex min-w-max justify-center gap-8 px-4 py-4">
      {roots.map((r) => (
        <Branch key={r.id} sp={r} all={species} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
