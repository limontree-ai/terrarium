// Single entry point. Every asset factory is exported from here.
export { PALETTE, SKY, LIGHTING, FLOWER_COLORS, makeTones } from './palette.js';

export {
  worldUniforms, setCurvedWorld, setWind, setSnowCaps, setHorizonFade, updateWorldTime,
  patchMaterial, flatMaterial, glossyMaterial, basicMaterial, Builder, scatterInstances, writePlacements, rng,
} from './core.js';

export {
  createSkySystem, createSkyDome, createSun, createMoon, createCloud, createCloudLayer, createStars,
  createHorizonPlanet, sampleTimeOfDay, TIME_PRESETS,
} from './sky.js';

export {
  createTerrain, createSnowLayer, createMudPuddles, TERRAIN_SHAPES, GROUND_STYLES, GROUND_NAMES,
} from './ground.js';

export { createLake, createUnderwaterFx } from './water.js';

export {
  createRoundTree, createPineTree, createPalmTree, createBush, createTreeField, createFlower, createFlowerField,
  createGrassTufts, createReeds, TREE_SIZES,
} from './plants.js';

export {
  createSmallRock, createBoulder, createCliffChunk, createLog, createSnowMound, createIcePlate,
  createIceCrystal, createIceberg, createMoonBoulder, createRockField,
} from './rocks.js';

export { createBlob, BLOB_COLOR, MAX_LIMBS } from './blob.js';
export { createFruit, createFruitAtTrees } from './food.js';
export { createEffects } from './effects.js';
export { createWeather } from './weather.js';
