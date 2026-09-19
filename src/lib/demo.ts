import type { EnvEventKind } from "@/simulation/types";
import type { Speed } from "./game-types";

/**
 * The scripted "Demo Experiment": a ~2–3 minute story arc. Steps advance on
 * simulated years and/or real seconds; the simulation itself supplies the
 * drama (divergence, discovery, extinction) — the script only sets the stage.
 * Speeds: 1× ≈ 1 year/second.
 */

export interface DemoContext {
  year: number;
  secondsInStep: number;
  speciesTotal: number;
  speciesAlive: number;
  extinctions: number;
  overlayOpen: boolean;
  discoveryYear: number | null;
}

export interface DemoActions {
  setSpeed: (s: Speed) => void;
  trigger: (kind: EnvEventKind) => void;
  openMuseum: () => void;
  closeMuseum: () => void;
  openChronicle: () => void;
  closeChronicle: () => void;
}

export interface DemoStep {
  label: string;
  caption: string;
  onEnter?: (a: DemoActions, ctx: DemoContext) => void;
  /** Return true to advance to the next step. */
  done: (ctx: DemoContext) => boolean;
  onExit?: (a: DemoActions, ctx: DemoContext) => void;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    label: "Seed",
    caption: "Life is seeded. Watch them forage.",
    onEnter: (a) => a.setSpeed(1),
    done: (c) => c.secondsInStep > 8,
  },
  {
    label: "Breed",
    caption: "Reproduction, inheritance, mutation.",
    onEnter: (a) => a.setSpeed(10),
    done: (c) => c.year >= 45,
  },
  {
    label: "Predator",
    caption: "A predator enters. Selection pressure begins.",
    onEnter: (a) => {
      a.trigger("predator");
      a.setSpeed(10);
    },
    done: (c) => c.secondsInStep > 10,
  },
  {
    label: "Adapt",
    caption: "Generations pass. Traits shift.",
    onEnter: (a) => a.setSpeed(100),
    done: (c) => c.year >= 300,
  },
  {
    label: "Drought",
    caption: "Food vanishes. A bottleneck.",
    onEnter: (a) => {
      a.trigger("drought");
      a.setSpeed(10);
    },
    done: (c) => c.secondsInStep > 6,
  },
  {
    label: "Deep time",
    caption: "1000×. Waiting for divergence…",
    onEnter: (a) => a.setSpeed(1000),
    done: (c) => (c.speciesTotal >= 2 && !c.overlayOpen) || c.year >= 1800,
  },
  {
    label: "Lineage",
    caption: "A new species. Open the museum.",
    onEnter: (a) => {
      a.setSpeed(10);
      a.openMuseum();
    },
    done: (c) => c.secondsInStep > 9,
    onExit: (a) => a.closeMuseum(),
  },
  {
    label: "Meteor",
    caption: "Catastrophe rewrites the rules.",
    onEnter: (a) => {
      a.setSpeed(1);
      a.trigger("meteor");
    },
    done: (c) => c.secondsInStep > 5,
  },
  {
    label: "Aftermath",
    caption: "Who survives? Waiting for extinction…",
    onEnter: (a) => a.setSpeed(1000),
    done: (c) => (c.extinctions >= 1 && c.secondsInStep > 3) || c.secondsInStep > 30,
  },
  {
    label: "Chronicle",
    caption: "The story, as it happened.",
    onEnter: (a) => {
      a.setSpeed(10);
      a.openChronicle();
    },
    done: (c) => c.secondsInStep > 8,
    onExit: (a) => {
      a.closeChronicle();
      a.setSpeed(100);
    },
  },
];
