"use client";

import { useMemo } from "react";
import { ModalFrame } from "@/components/ui/ModalFrame";
import { useGame, useGameState } from "@/components/ui/game-context";
import { cn } from "@/lib/utils";
import { CardSpecies } from "./CardSpecies";
import { LineageTree } from "./LineageTree";

export function MuseumPanel() {
  const game = useGame();
  const open = useGameState((s) => s.panels.museum);
  const inspectId = useGameState((s) => s.panels.inspectSpeciesId);
  const species = useGameState((s) => s.species);
  const year = useGameState((s) => s.year);

  const ordered = useMemo(() => {
    const alive = species.filter((s) => s.status === "alive").sort((a, b) => b.population - a.population);
    const extinct = species.filter((s) => s.status === "extinct").sort((a, b) => (b.extinctYear ?? 0) - (a.extinctYear ?? 0));
    const list = [...alive, ...extinct];
    if (inspectId !== null) {
      const i = list.findIndex((s) => s.id === inspectId);
      if (i > 0) list.unshift(...list.splice(i, 1));
    }
    return list;
  }, [species, inspectId]);

  const aliveCount = species.filter((s) => s.status === "alive").length;

  return (
    <ModalFrame
      open={open}
      title="SPECIES MUSEUM"
      subtitle={`${species.length} lineages catalogued · ${aliveCount} living · ${species.length - aliveCount} extinct`}
      onClose={() => game.setPanel({ museum: false, inspectSpeciesId: null })}
      wide
    >
      <div className="space-y-5 p-4 sm:p-5">
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-pixel text-[10px] uppercase tracking-widest text-ash">Lineage</h3>
            <span className="text-[13px] text-ash">click a node to inspect</span>
          </div>
          <div className="pixel-frame overflow-x-auto bg-soil">
            <LineageTree species={species} selectedId={inspectId} onSelect={(id) => game.setPanel({ inspectSpeciesId: id })} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-ash">Catalogue</h3>
          <div className={cn("grid gap-3", ordered.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "max-w-sm")}>
            {ordered.map((sp) => (
              <CardSpecies
                key={sp.id}
                species={sp}
                ancestor={species.find((s) => s.id === sp.parentId) ?? null}
                currentYear={year}
                selected={inspectId === sp.id}
                onSelect={() => game.setPanel({ inspectSpeciesId: sp.id })}
                detailed={inspectId === sp.id}
              />
            ))}
          </div>
        </section>
      </div>
    </ModalFrame>
  );
}
