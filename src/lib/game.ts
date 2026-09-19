import { TICKS_PER_YEAR, WORLD_H, WORLD_W } from "@/simulation/constants";
import { populationAverages } from "@/simulation/Evolution";
import { createRenderer, highlightSpecies, renderFrame, startMeteor, type RendererState } from "@/simulation/render/Renderer";
import {
  createSimulation,
  findCreatureAt,
  getSnapshot,
  pickMeteorTarget,
  stepSimulation,
  subscribe,
  triggerEvent,
  yearOf,
  type Simulation,
} from "@/simulation/Simulation";
import type { EnvEventKind, SimEvent } from "@/simulation/types";
import { analyzeSimulation, createAstraMemory, getAstraProvider, reactToEvent, type AstraMemory, type AstraMessage } from "./astra";
import { DEMO_STEPS, type DemoActions, type DemoContext } from "./demo";
import type { GameState, Speed, Toast } from "./game-types";
import { createStore, type Store } from "./store";

const TICK_BUDGET_MS: Record<Speed, number> = { 1: 4, 10: 8, 100: 18, 1000: 26 };
const MAX_ASTRA = 14;

export interface Game {
  store: Store<GameState>;
  begin: (seed?: number) => void;
  reset: () => void;
  attachCanvas: (canvas: HTMLCanvasElement | null) => void;
  setSpeed: (s: Speed) => void;
  togglePause: () => void;
  trigger: (kind: EnvEventKind) => void;
  selectAt: (wx: number, wy: number) => void;
  clearSelection: () => void;
  setPanel: (patch: Partial<GameState["panels"]>) => void;
  dismissOverlay: () => void;
  startDemo: () => void;
  stopDemo: () => void;
  getSimulation: () => Simulation | null;
  dispose: () => void;
}

function initialState(): GameState {
  return {
    phase: "title",
    seed: 0,
    year: 0,
    population: 0,
    food: 0,
    predators: 0,
    speciesAlive: 1,
    speciesTotal: 1,
    extinctions: 0,
    weather: "clear",
    weatherYearsLeft: 0,
    speed: 1,
    paused: false,
    yearsPerSecond: 0,
    astra: [],
    chronicle: [],
    species: [],
    history: [],
    historyVersion: 0,
    averages: { size: 0, speed: 0, vision: 0, fertility: 0, armor: 0, color: 0 },
    selected: null,
    overlay: null,
    toasts: [],
    demo: null,
    panels: { chronicle: false, museum: false, astraOpen: false, inspectSpeciesId: null },
    meteorPending: false,
  };
}

export function createGame(): Game {
  const store = createStore<GameState>(initialState());
  let sim: Simulation | null = null;
  let renderer: RendererState = createRenderer();
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let lastFrame = 0;
  let acc = 0;
  let lastUiPush = 0;
  let unsubscribe: (() => void) | null = null;
  let astraMem: AstraMemory = createAstraMemory();
  const astraProvider = getAstraProvider();
  let lastAstraRealTime = 0;
  let overlayPause = false;
  let toastId = 1;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let yearsWindow: { t: number; year: number }[] = [];

  // Demo
  let demoStep = -1;
  let demoStepStart = 0;
  let discoveryYear: number | null = null;

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  };

  const pushAstra = (msg: AstraMessage | null, force = false) => {
    if (!msg) return;
    const now = performance.now();
    if (!msg.priority && !force && now - lastAstraRealTime < 2600) return;
    lastAstraRealTime = now;
    store.set((s) => ({ astra: [msg, ...s.astra].slice(0, MAX_ASTRA) }));
  };

  const toast = (t: Omit<Toast, "id" | "until">, seconds = 4.5) => {
    const id = toastId++;
    store.set((s) => ({ toasts: [...s.toasts, { ...t, id, until: performance.now() + seconds * 1000 }] }));
    later(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), seconds * 1000);
  };

  const pushStats = () => {
    if (!sim) return;
    const alive = sim.species.filter((s) => s.status === "alive").length;
    const now = performance.now();
    const year = yearOf(sim);
    yearsWindow.push({ t: now, year });
    yearsWindow = yearsWindow.filter((w) => now - w.t < 1500);
    const first = yearsWindow[0];
    const yps = first && now - first.t > 200 ? ((year - first.year) / (now - first.t)) * 1000 : store.get().yearsPerSecond;
    const sel = store.get().selected;
    const selected = sel ? (sim.creatures.find((c) => c.id === sel.id) ?? null) : null;
    store.set({
      year,
      population: sim.creatures.length,
      food: sim.food.length,
      predators: sim.predators.length,
      speciesAlive: alive,
      speciesTotal: sim.species.length,
      extinctions: sim.species.length - alive,
      weather: sim.env.weather,
      weatherYearsLeft: Math.ceil(sim.env.weatherTicksLeft / TICKS_PER_YEAR),
      species: sim.species.map((s) => ({ ...s, averageGenome: { ...s.averageGenome } })),
      history: sim.history,
      historyVersion: sim.history.length,
      averages: populationAverages(sim.creatures),
      selected: selected ? { ...selected, genome: { ...selected.genome } } : null,
      yearsPerSecond: yps,
    });
  };

  const onSimEvent = (e: SimEvent) => {
    if (!sim) return;
    const snap = getSnapshot(sim);
    switch (e.kind) {
      case "chronicle":
        store.set((s) => ({ chronicle: [...s.chronicle, e.event] }));
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
      case "year": {
        const res = astraProvider.analyze(snap, astraMem);
        if (res instanceof Promise) res.then((m) => pushAstra(m)).catch(() => {});
        else pushAstra(res);
        break;
      }
      case "divergence":
        toast({ kind: "divergence", title: "GENETIC DIVERGENCE DETECTED", body: `${e.species.name} is splitting into two groups` }, 5);
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
      case "speciesDiscovered": {
        discoveryYear = snap.year;
        overlayPause = true;
        highlightSpecies(renderer, e.species.id, 14);
        store.set({ overlay: { kind: "species", species: e.species, parent: e.parent, stage: 0 } });
        later(() => {
          const o = store.get().overlay;
          if (o && o.kind === "species" && o.species.id === e.species.id) store.set({ overlay: { ...o, stage: 1 } });
        }, 1500);
        later(() => {
          const o = store.get().overlay;
          if (o && o.kind === "species" && o.species.id === e.species.id) dismissOverlay();
        }, 9000);
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
      }
      case "extinction":
        toast({ kind: "extinction", title: "SPECIES EXTINCT", body: `${e.species.name} survived for ${e.lifespanYears} years.` }, 6);
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
      case "meteor":
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
      case "predatorIntroduced":
        toast({ kind: "predator", title: "PREDATOR RELEASED", body: "Selection pressure has entered the meadow." }, 3.5);
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
      case "weather":
        pushAstra(reactToEvent(e, snap, astraMem));
        break;
    }
  };

  const dismissOverlay = () => {
    overlayPause = false;
    store.set({ overlay: null });
  };

  const demoActions: DemoActions = {
    setSpeed: (s) => setSpeed(s),
    trigger: (k) => trigger(k),
    openMuseum: () => setPanel({ museum: true, chronicle: false }),
    closeMuseum: () => setPanel({ museum: false }),
    openChronicle: () => setPanel({ chronicle: true, museum: false }),
    closeChronicle: () => setPanel({ chronicle: false }),
  };

  const demoContext = (): DemoContext => {
    const s = store.get();
    return {
      year: s.year,
      secondsInStep: (performance.now() - demoStepStart) / 1000,
      speciesTotal: s.speciesTotal,
      speciesAlive: s.speciesAlive,
      extinctions: s.extinctions,
      overlayOpen: s.overlay !== null,
      discoveryYear,
    };
  };

  const enterDemoStep = (i: number) => {
    demoStep = i;
    demoStepStart = performance.now();
    const step = DEMO_STEPS[i];
    step.onEnter?.(demoActions, demoContext());
    store.set({ demo: { step: i, label: step.label, caption: step.caption, total: DEMO_STEPS.length } });
  };

  const tickDemo = () => {
    if (demoStep < 0) return;
    const step = DEMO_STEPS[demoStep];
    const ctxd = demoContext();
    if (ctxd.overlayOpen) return; // let the discovery moment breathe
    if (!step.done(ctxd)) return;
    step.onExit?.(demoActions, ctxd);
    if (demoStep + 1 >= DEMO_STEPS.length) {
      demoStep = -1;
      store.set({ demo: null });
      toast({ kind: "info", title: "DEMO COMPLETE", body: "Keep experimenting — the ecosystem is yours." }, 5);
      return;
    }
    enterDemoStep(demoStep + 1);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!sim || !ctx) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    const state = store.get();
    const running = !state.paused && !overlayPause;

    if (running) {
      acc += dt * TICKS_PER_YEAR * state.speed;
      let n = Math.floor(acc);
      acc -= n;
      const budget = TICK_BUDGET_MS[state.speed];
      const start = performance.now();
      sim.fxEnabled = state.speed <= 10;
      while (n > 0) {
        stepSimulation(sim);
        n--;
        if ((n & 7) === 0 && performance.now() - start > budget) {
          acc = 0; // drop backlog rather than snowball
          break;
        }
      }
    } else {
      sim.fx.length = 0;
    }

    renderFrame(ctx, sim, renderer, dt, { selectedId: state.selected?.id ?? null, speed: state.speed, paused: !running });

    if (now - lastUiPush > 130) {
      lastUiPush = now;
      pushStats();
      tickDemo();
    }
  };

  const attachCanvas = (c: HTMLCanvasElement | null) => {
    ctx = c ? c.getContext("2d") : null;
    if (c) {
      c.width = WORLD_W;
      c.height = WORLD_H;
    }
  };

  const begin = (seed = Math.floor(Math.random() * 1_000_000)) => {
    stopLoop();
    sim = createSimulation(seed);
    renderer = createRenderer();
    astraMem = createAstraMemory();
    lastAstraRealTime = 0;
    overlayPause = false;
    demoStep = -1;
    discoveryYear = null;
    acc = 0;
    unsubscribe?.();
    unsubscribe = subscribe(sim, onSimEvent);
    store.set({
      ...initialState(),
      phase: "running",
      seed,
      chronicle: [...sim.chronicle],
      species: sim.species.map((s) => ({ ...s })),
      speed: 1,
    });
    pushAstra(analyzeSimulation(getSnapshot(sim), astraMem), true);
    pushStats();
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const stopLoop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const t of timers) clearTimeout(t);
    timers = [];
  };

  const reset = () => {
    stopLoop();
    unsubscribe?.();
    unsubscribe = null;
    sim = null;
    store.set(initialState());
  };

  const setSpeed = (s: Speed) => {
    acc = 0;
    store.set({ speed: s, paused: false });
  };

  const togglePause = () => store.set((s) => ({ paused: !s.paused }));

  const trigger = (kind: EnvEventKind) => {
    if (!sim) return;
    if (kind === "meteor") {
      if (store.get().meteorPending) return;
      const target = pickMeteorTarget(sim);
      startMeteor(renderer, target.x, target.y, target.r);
      store.set({ meteorPending: true });
      later(() => {
        if (!sim) return;
        triggerEvent(sim, "meteor", target);
        store.set({ meteorPending: false });
        pushStats();
      }, 1250);
      return;
    }
    triggerEvent(sim, kind);
    pushStats();
  };

  const selectAt = (wx: number, wy: number) => {
    if (!sim) return;
    const c = findCreatureAt(sim, wx, wy, 10);
    store.set({ selected: c ? { ...c, genome: { ...c.genome } } : null });
  };

  const clearSelection = () => store.set({ selected: null });

  const setPanel = (patch: Partial<GameState["panels"]>) => store.set((s) => ({ panels: { ...s.panels, ...patch } }));

  const startDemo = () => {
    if (!sim || yearOf(sim) > 5) begin();
    later(() => enterDemoStep(0), 50);
  };

  const stopDemo = () => {
    demoStep = -1;
    store.set({ demo: null, panels: { ...store.get().panels, museum: false, chronicle: false } });
  };

  return {
    store,
    begin,
    reset,
    attachCanvas,
    setSpeed,
    togglePause,
    trigger,
    selectAt,
    clearSelection,
    setPanel,
    dismissOverlay,
    startDemo,
    stopDemo,
    getSimulation: () => sim,
    dispose: () => {
      stopLoop();
      unsubscribe?.();
      ctx = null;
    },
  };
}
