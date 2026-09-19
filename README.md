# EVOLVE

> You don't create life. You create the conditions for it.

A pixel-art evolutionary ecosystem simulation. You shape the environment — rain, drought, winter, predators, meteors — and watch a population evolve through natural selection over hundreds of generations. Nothing is designed; every creature you see emerged.

**Live demo:** https://evolve-claude-code-build-day.vercel.app

## What happens in the world

- Creatures carry a genome (`size`, `speed`, `vision`, `fertility`, `armor`, `color`) that drives both behaviour and appearance.
- They wander, forage, flee predators, court mates, reproduce with crossover + mutation, age and die.
- Traits have real trade-offs: speed and size cost energy, armor blunts predator attacks, camouflage shrinks detection radius, vision finds food sooner.
- A river splits the map; isolated populations drift apart and are detected as new species via 2-means clustering on trait space.
- **Astra**, an in-world naturalist, posts short observations and hypotheses when something meaningful changes.
- The **Chronicle** logs milestones, mutations, divergences, disasters and extinctions; the **Species Museum** keeps a card and lineage tree for every species, alive or extinct.

## Controls

| Control | Effect |
| --- | --- |
| `1x` `10x` `100x` `1000x` | Time acceleration |
| 🌧 Rain | Food regrows faster |
| ☀ Drought | Food scarcity, population pressure |
| ❄ Winter | Slower creatures, higher metabolism, less food |
| 🦖 Predator | Introduces hunters — selection pressure for speed, armor, camouflage |
| ☄ Meteor | Kills locally, scorches food |
| Click a creature | Inspect its genome in the Astra panel |
| Demo Experiment | Scripted 2–3 minute story: seed → predator → drought → 1000x → divergence → extinction |

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · HTML Canvas · Framer Motion. No backend, no database — everything runs in the browser.

```
src/
  app/          layout, page, global pixel-art styles
  components/   simulation canvas, Astra panel, Chronicle, Museum, UI
  simulation/   Creature, Predator, Genetics, Species, World, Ecosystem, Simulation, render/
  lib/          game controller, Astra heuristics, species naming, demo script, utils
```
