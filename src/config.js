/**
 * Terrarium configuration: all tunable numbers.
 * This is the source of truth for all constants.
 */

// Physics
export const PHYSICS = {
  DT: 1 / 30,                          // 30 Hz timestep
  TRIAL_STEPS: 180,                    // 6 seconds per trial
  WATER_DENSITY: 1000,                 // kg/m³
  DRAG_COEFFICIENT: 1.0,               // tune in Prompt 8
  GRAVITY: 9.81,                       // m/s²
  MAX_SPEED_CAP: 50,                   // m/s, prevent blowups
  ARENA_HALF: 100,                     // meters; leaving |x| or |z| > this fails the rollout
  FLOOR_Y: -10,                        // meters; falling below this fails the rollout
  WATER_SURFACE_MAX: 2.4,              // meters; water surface height at waterLevel 1
  ANGULAR_DRAG: 0.05,                  // rotational water drag, N·m per (rad/s)² per m⁵
};

// Ground friction by type
export const GROUND_FRICTION = {
  grass: 0.9,
  sand: 0.7,
  ice: 0.05,
  mud: 0.6,
  moondust: 0.8,
};

// Ground layer drag (bodies inside these layers)
export const GROUND_LAYER = {
  GRASS_DEPTH: 0.08,                   // meters
  SNOW_MAX_DEPTH: 0.3,                 // meters
  MUD_MAX_DEPTH: 1.0,                  // normalized 0-1
};

// World settings (configurable by voice)
export const WORLD_DEFAULTS = {
  waterLevel: 0,        // 0-1 (0=empty, 1=full)
  snowDepth: 0,         // 0-0.3 meters
  mud: 0,               // 0-1 normalized
  rain: 0,              // 0-1 (affects progression)
  wind: {
    strength: 0,        // 0-1
    direction: 0,       // 0-360 degrees
  },
  gravity: 1.0,         // 0.16-2.0 (moon to heavy planet)
  groundType: "grass",  // grass, sand, ice, mud, moondust
  treeCount: 12,        // 0 to many
  treeKind: "round",    // round, pine, palm
  food: 4,              // setting for sparseness
  timeOfDay: "day",     // day, sunset, night (visual only)
};

// Weather progression
export const WEATHER = {
  RAIN_MUD_INCREMENT: 0.02,
  RAIN_WATER_INCREMENT: 0.005,
  RAIN_MUD_MAX: 1.0,
  RAIN_WATER_MAX: 0.5,
  SNOW_DEPTH_INCREMENT: 0.01,
  SNOW_DEPTH_MAX: 0.3,
  SNOW_FRICTION_MULTIPLIER: 0.5,
  CLEAR_MUD_DECREMENT: 0.05,
  CLEAR_SNOW_DECREMENT: 0.05,
};

// Creature body
export const CREATURE = {
  CORE_SIZE_MIN: 0.2,
  CORE_SIZE_MAX: 0.6,
  MAX_LIMBS: 4,
  MAX_SEGMENTS_PER_LIMB: 3,
  MAX_TOTAL_JOINTS: 8,  // including core hinge
  SEGMENT_LENGTH: { min: 0.1, max: 0.8 },
  SEGMENT_WIDTH: { min: 0.05, max: 0.5 },
  SEGMENT_THICKNESS: { min: 0.03, max: 0.3 },
  DENSITY: { min: 400, max: 1200 },    // kg/m³
  RHYTHM_HZ: { min: 0.5, max: 3.0 },
  MOTOR_FACTOR: 100,    // velocity motor gain; tuned against acceptance gate 1
  MAX_JOINT_SPEED: 10,  // rad/s
  CORE_HINGE_LIMIT: Math.PI / 3, // radians either way
};

// Brain
export const BRAIN = {
  INPUTS: 29,
  HIDDEN: 16,
  OUTPUTS: 8,
  WEIGHTS: 616,  // 29*16 + 16*8 + 16 + 8
};

// Reward
export const REWARD = {
  PROGRESS_PER_METER: 1,
  FOOD_BONUS: 5,
  ENERGY_COST: 0.0001, // keeps in-place vibration at or below zero (gate 3); per joule of motor work (force × |joint speed| × dt)
  EAT_RADIUS: 0.6,     // meters from core to food
  FOOD_RESPAWN_MIN: 2, // meters from the blob
  FOOD_RESPAWN_MAX: 3,
};

// Learning (1+λ Evolution Strategy)
export const LEARNING = {
  VARIATIONS_PER_ROUND: 8,
  BRAIN_NOISE_SIGMA: 0.1,        // tune in Prompt 8
  BODY_CHANGE_CHANCE: 0.3,       // tune in Prompt 8
  ADOPTION_MARGIN: 0.05,         // floor of the adoption margin
  ADOPTION_MARGIN_FRACTION: 0.02, // margin is 2% of the current score
  SIGMA_MIN: 0.01,
  SIGMA_MAX: 0.5,
  SUCCESS_RATE_TARGET: 0.2,      // one-fifth rule: 20%
};

// Display
export const DISPLAY = {
  TARGET_FPS: 60,
  BLOB_COLOR: "#C8A8F0",  // light purple
  MORPH_TIME: 90,         // seconds (body lerp duration)
};

// Voice
// Valid ranges for every world setting; the server clamps voice changes to these.
export const WORLD_RANGES = {
  waterLevel: [0, 1],
  snowDepth: [0, 0.3],
  mud: [0, 1],
  rain: [0, 1],
  windStrength: [0, 1],
  gravity: [0.16, 2.0],
  treeCount: [0, 100],
  food: [1, 10],
};

export const WORLD_CHOICES = {
  groundType: ["grass", "sand", "ice", "mud", "moondust"],
  timeOfDay: ["day", "sunset", "night"],
  treeKind: ["round", "pine", "palm"],
};

// Voice biomes: one phrase sets a bundle of world settings.
export const BIOMES = {
  meadow: { groundType: "grass", treeCount: 12, treeKind: "round", waterLevel: 0, snowDepth: 0, mud: 0, rain: 0, timeOfDay: "day" },
  forest: { groundType: "grass", treeCount: 70, treeKind: "pine", waterLevel: 0, snowDepth: 0, mud: 0, rain: 0.2 },
  jungle: { groundType: "grass", treeCount: 90, treeKind: "palm", waterLevel: 0, snowDepth: 0, mud: 0.3, rain: 0.7 },
  ocean: { groundType: "sand", treeCount: 0, waterLevel: 1, snowDepth: 0, mud: 0, rain: 0 },
  desert: { groundType: "sand", treeCount: 6, treeKind: "palm", waterLevel: 0, snowDepth: 0, mud: 0, rain: 0, timeOfDay: "day" },
  arctic: { groundType: "ice", treeCount: 30, treeKind: "pine", waterLevel: 0, snowDepth: 0.25, mud: 0, rain: 0 },
  swamp: { groundType: "mud", treeCount: 30, treeKind: "round", waterLevel: 0.4, snowDepth: 0, mud: 1, rain: 0.4 },
};

export const VOICE = {
  TIMEOUT_MS: 3000,
  FALLBACK_TIMEOUT_MS: 2000,
};
