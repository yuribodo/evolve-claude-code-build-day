import type { Genome, TraitKey } from "@/simulation/types";
import { cn } from "@/lib/utils";

const ROWS: { key: TraitKey; label: string }[] = [
  { key: "size", label: "SIZE" },
  { key: "speed", label: "SPEED" },
  { key: "vision", label: "VISION" },
  { key: "fertility", label: "FERTIL." },
  { key: "armor", label: "ARMOR" },
];

interface TraitBarsProps {
  genome: Genome;
  compare?: Genome;
  cells?: number;
  compact?: boolean;
}

/** Pixel block bars: ██████░░ — optionally with a ghost marker for a comparison genome. */
export function TraitBars({ genome, compare, cells = 10, compact }: TraitBarsProps) {
  const hue = Math.round(genome.color * 360);
  return (
    <div className={cn("grid gap-y-0.5", compact ? "text-[13px]" : "text-[15px]")} style={{ gridTemplateColumns: "auto 1fr auto" }}>
      {ROWS.map((r) => {
        const v = genome[r.key];
        const filled = Math.round(v * cells);
        const cmp = compare ? Math.round(compare[r.key] * cells) : null;
        return (
          <div key={r.key} className="contents">
            <span className="pr-2 tracking-wider text-ash">{r.label}</span>
            <span className="flex items-center gap-px" aria-label={`${r.label} ${Math.round(v * 100)}%`}>
              {Array.from({ length: cells }).map((_, i) => (
                <span
                  key={i}
                  className={cn("inline-block", compact ? "h-2 w-1.5" : "h-2.5 w-2")}
                  style={{
                    background: i < filled ? `hsl(${hue} 55% ${52 - i * 1.5}%)` : "#1c261a",
                    boxShadow: cmp !== null && i === cmp - 1 && i >= filled ? "inset 0 0 0 1px #e8b04a" : undefined,
                  }}
                />
              ))}
            </span>
            <span className="pl-2 tabular-nums text-parchment">{v.toFixed(2)}</span>
          </div>
        );
      })}
      <div className="contents">
        <span className="pr-2 tracking-wider text-ash">COLOR</span>
        <span className="flex items-center gap-1">
          <span className={cn("inline-block border border-soil", compact ? "h-2 w-6" : "h-2.5 w-8")} style={{ background: `hsl(${hue} 58% 46%)` }} />
          <span className="text-ash">hue {hue}°</span>
        </span>
        <span className="pl-2 tabular-nums text-parchment">{genome.color.toFixed(2)}</span>
      </div>
    </div>
  );
}
