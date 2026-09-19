export type TraitKey = "size" | "speed" | "vision" | "fertility" | "armor" | "color";

export const TRAIT_KEYS: TraitKey[] = ["size", "speed", "vision", "fertility", "armor", "color"];

export type Genome = Record<TraitKey, number>;

export type Sex = "M" | "F";

export type CreatureState = "wander" | "seek" | "flee" | "mate";

export interface Creature {
  id: number;
  speciesId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  sex: Sex;
  genome: Genome;
  generation: number;
  state: CreatureState;
  targetX: number;
  targetY: number;
  hasTarget: boolean;
  reproCooldown: number;
  wanderTimer: number;
  facing: 1 | -1;
  phase: number;
  bornTick: number;
  hurtTimer: number;
  /** While > 0 the creature ignores targets and wanders — it just hit water/rock. */
  blockedTimer: number;
  /** Cached partner while courting; -1 when none. */
  mateId: number;
  mateSearchTimer: number;
}

export type PredatorState = "prowl" | "chase" | "attack" | "rest";

export interface Predator {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  state: PredatorState;
  targetId: number;
  attackTimer: number;
  restTimer: number;
  wanderTimer: number;
  facing: 1 | -1;
  phase: number;
  kills: number;
}

export interface Food {
  id: number;
  x: number;
  y: number;
  energy: number;
  age: number;
}

export type SpeciesStatus = "alive" | "extinct";

export interface SpeciesRecord {
  id: number;
  name: string;
  parentId: number | null;
  originYear: number;
  originGeneration: number;
  extinctYear: number | null;
  status: SpeciesStatus;
  population: number;
  peakPopulation: number;
  averageGenome: Genome;
  originGenome: Genome;
  divergenceStreak: number;
  lastDivergenceYear: number;
  mutationFlags: Partial<Record<TraitKey, boolean>>;
  totalBorn: number;
}

export type Weather = "clear" | "rain" | "drought" | "winter";

export interface Environment {
  weather: Weather;
  weatherTicksLeft: number;
  predatorsIntroduced: boolean;
  meteorCount: number;
  scorch: { x: number; y: number; r: number; ticksLeft: number } | null;
}

export type EnvEventKind = "rain" | "drought" | "winter" | "predator" | "meteor";

export type ChronicleKind =
  | "seed"
  | "milestone"
  | "weather"
  | "predator"
  | "mutation"
  | "divergence"
  | "species"
  | "extinction"
  | "meteor"
  | "collapse";

export interface ChronicleEvent {
  id: number;
  year: number;
  kind: ChronicleKind;
  text: string;
  speciesId?: number;
}

export interface TraitAverages extends Genome {
  count: number;
}

export interface YearRecord {
  year: number;
  population: number;
  speciesCount: number;
  food: number;
  predators: number;
  births: number;
  deaths: number;
  averages: Genome;
}

export interface Snapshot {
  year: number;
  tick: number;
  population: number;
  predators: number;
  food: number;
  births: number;
  deaths: number;
  environment: Environment;
  species: SpeciesRecord[];
  averageTraits: Genome;
  recentEvents: ChronicleEvent[];
  history: YearRecord[];
  /** Share of creatures living on the far (right) bank of the river. */
  rightBankFraction: number;
}

/** Visual FX emitted by the simulation, consumed by the renderer. */
export type FxEvent =
  | { kind: "birth"; x: number; y: number; hue: number }
  | { kind: "death"; x: number; y: number; hue: number }
  | { kind: "eat"; x: number; y: number }
  | { kind: "kill"; x: number; y: number }
  | { kind: "attack"; x: number; y: number }
  | { kind: "foodSpawn"; x: number; y: number }
  | { kind: "meteor"; x: number; y: number; r: number }
  | { kind: "predatorArrive"; x: number; y: number };

/** Semantic events the UI listens to. */
export type SimEvent =
  | { kind: "chronicle"; event: ChronicleEvent }
  | { kind: "speciesDiscovered"; species: SpeciesRecord; parent: SpeciesRecord }
  | { kind: "divergence"; species: SpeciesRecord }
  | { kind: "extinction"; species: SpeciesRecord; lifespanYears: number }
  | { kind: "meteor"; x: number; y: number; killed: number }
  | { kind: "predatorIntroduced"; count: number }
  | { kind: "weather"; weather: Weather }
  | { kind: "year"; record: YearRecord };
