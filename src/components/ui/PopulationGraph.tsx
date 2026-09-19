"use client";

import { useMemo } from "react";
import type { YearRecord } from "@/simulation/types";
import { useGameState } from "./game-context";

const W = 300;
const H = 84;
const PAD_L = 26;
const PAD_B = 14;
const PAD_T = 6;

function downsample(h: YearRecord[], max: number): YearRecord[] {
  if (h.length <= max) return h;
  const step = h.length / max;
  const out: YearRecord[] = [];
  for (let i = 0; i < max; i++) out.push(h[Math.floor(i * step)]);
  out.push(h[h.length - 1]);
  return out;
}

export function PopulationGraph() {
  const history = useGameState((s) => s.history);
  const version = useGameState((s) => s.historyVersion);
  const population = useGameState((s) => s.population);
  const year = useGameState((s) => s.year);

  const model = useMemo(() => {
    const pts = downsample(history, 120);
    const maxPop = Math.max(40, ...pts.map((p) => p.population), population);
    const maxYear = Math.max(20, year);
    const niceMax = Math.ceil(maxPop / 20) * 20;
    const x = (yr: number) => PAD_L + (yr / maxYear) * (W - PAD_L - 4);
    const y = (v: number) => PAD_T + (1 - v / niceMax) * (H - PAD_T - PAD_B);
    const popPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.population).toFixed(1)}`).join(" ");
    const predPath = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.predators * 10).toFixed(1)}`)
      .join(" ");
    const speciesPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.speciesCount * 10).toFixed(1)}`).join(" ");
    const gridY = [0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(niceMax * f), y: y(niceMax * f) }));
    const ticksX = [0, 0.5, 1].map((f) => ({ v: Math.round(maxYear * f), x: x(maxYear * f) }));
    const last = pts[pts.length - 1];
    const lastPt = last ? { x: x(last.year), y: y(last.population) } : null;
    return { popPath, predPath, speciesPath, gridY, ticksX, lastPt, hasPred: pts.some((p) => p.predators > 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, population, year]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" shapeRendering="crispEdges" role="img" aria-label="Population over time">
      {model.gridY.map((g) => (
        <g key={g.v}>
          <line x1={PAD_L} x2={W - 4} y1={g.y} y2={g.y} stroke="#1c261a" strokeWidth={1} />
          <text x={PAD_L - 4} y={g.y + 3} textAnchor="end" fontSize={9} fill="#8a937f" fontFamily="var(--font-vt323)">
            {g.v}
          </text>
        </g>
      ))}
      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} stroke="#3d5233" strokeWidth={1} />
      <line x1={PAD_L} x2={W - 4} y1={H - PAD_B} y2={H - PAD_B} stroke="#3d5233" strokeWidth={1} />
      {model.ticksX.map((t) => (
        <text key={t.v} x={t.x} y={H - 3} textAnchor={t.v === 0 ? "start" : "middle"} fontSize={9} fill="#8a937f" fontFamily="var(--font-vt323)">
          {t.v}
        </text>
      ))}
      <path d={model.speciesPath} fill="none" stroke="#e8b04a" strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />
      {model.hasPred && <path d={model.predPath} fill="none" stroke="#d9534f" strokeWidth={1} opacity={0.8} />}
      <path d={model.popPath} fill="none" stroke="#7bc96f" strokeWidth={1.5} />
      {model.lastPt && <rect x={model.lastPt.x - 1.5} y={model.lastPt.y - 1.5} width={3} height={3} fill="#a8e08c" />}
    </svg>
  );
}
