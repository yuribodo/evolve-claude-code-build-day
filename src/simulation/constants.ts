/** World is rendered at a low internal resolution and upscaled for a pixel-art look. */
export const WORLD_W = 480;
export const WORLD_H = 304;
export const TILE = 8;
export const TILES_X = WORLD_W / TILE;
export const TILES_Y = WORLD_H / TILE;

export const TICKS_PER_YEAR = 50;

export const INITIAL_POPULATION = 26;
export const MAX_POPULATION = 260;

export const FOOD_ENERGY = 45;
export const FOOD_MAX = 260;
export const FOOD_BASE_RATE = 1.5; // items per tick when population is low
export const FOOD_MAX_AGE = 900;

export const CREATURE_START_ENERGY = 70;
export const REPRO_MIN_ENERGY = 62;
export const REPRO_COST_MOTHER = 38;
export const REPRO_COST_FATHER = 10;
export const CHILD_START_ENERGY = 50;
export const MATURITY_AGE = 45;
export const MATE_RADIUS = 18;
export const MATE_MAX_DISTANCE = 0.42;

export const MUTATION_RATE = 0.28;
export const MUTATION_SIGMA = 0.055;
export const BIG_MUTATION_RATE = 0.035;
export const BIG_MUTATION_SIGMA = 0.18;

export const PREDATOR_MAX = 4;
export const PREDATOR_START_ENERGY = 140;
export const PREDATOR_VISION = 78;
export const PREDATOR_SPEED = 1.0;
export const PREDATOR_KILL_ENERGY = 50;
export const PREDATOR_SPLIT_ENERGY = 420;

export const SPECIES_CHECK_INTERVAL = 100; // ticks
export const SPECIES_MIN_POP = 14;
export const SPECIES_MIN_CLUSTER = 10;
export const SPECIES_DIVERGENCE_THRESHOLD = 0.38;
export const SPECIES_STREAK_REQUIRED = 3;

export const WEATHER_DURATION_YEARS: Record<"rain" | "drought" | "winter", number> = {
  rain: 30,
  drought: 35,
  winter: 30,
};

/** The color gene value that best matches the grass. Used for camouflage. */
export const CAMO_TARGET = 0.36;
