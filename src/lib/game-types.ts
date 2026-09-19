import type { AstraMessage } from "./astra";
import type { ChronicleEvent, Creature, Genome, SpeciesRecord, Weather, YearRecord } from "@/simulation/types";

export type Speed = 1 | 10 | 100 | 1000;
export const SPEEDS: Speed[] = [1, 10, 100, 1000];

export type Overlay =
  | { kind: "species"; species: SpeciesRecord; parent: SpeciesRecord; stage: 0 | 1 }
  | null;

export interface Toast {
  id: number;
  kind: "divergence" | "extinction" | "meteor" | "predator" | "info";
  title: string;
  body?: string;
  until: number;
}

export interface DemoState {
  step: number;
  label: string;
  caption: string;
  total: number;
}

export interface GameState {
  phase: "title" | "running";
  seed: number;
  year: number;
  population: number;
  food: number;
  predators: number;
  speciesAlive: number;
  speciesTotal: number;
  extinctions: number;
  weather: Weather;
  weatherYearsLeft: number;
  speed: Speed;
  paused: boolean;
  yearsPerSecond: number;
  astra: AstraMessage[];
  chronicle: ChronicleEvent[];
  species: SpeciesRecord[];
  history: YearRecord[];
  historyVersion: number;
  averages: Genome;
  selected: Creature | null;
  overlay: Overlay;
  toasts: Toast[];
  demo: DemoState | null;
  panels: { chronicle: boolean; museum: boolean; astraOpen: boolean; inspectSpeciesId: number | null };
  meteorPending: boolean;
}
