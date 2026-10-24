import * as THREE from "three";
import {
  LIGHTING,
  PALETTE,
  createSkySystem,
  TIME_PRESETS,
  createTerrain,
  createSnowLayer,
  createMudPuddles,
  createLake,
  createUnderwaterFx,
  createTreeField,
  createFlowerField,
  createGrassTufts,
  createReeds,
  createRockField,
  createIceCrystal,
  createIceberg,
  createMoonBoulder,
  createFruit,
  createWeather,
  createEffects,
  setCurvedWorld,
  setWind,
  setSnowCaps,
  setHorizonFade,
  updateWorldTime,
  writePlacements,
} from "../../assets/src/world3d/assets.js";
import { PHYSICS } from "../config.js";
import { waterSurfaceY } from "../physics/forces.js";

// Every visible object comes from the asset library in assets/src/world3d.
const WORLD_SIZE = 2 * PHYSICS.ARENA_HALF + 20;
const DECOR_AREA = 2 * PHYSICS.ARENA_HALF;
const PLANET_RADIUS = 150;
const SPAWN_CLEAR = 3; // meters kept free of decor around the spawn point
const GROUND_NAMES = { grass: "grass", sand: "sand", ice: "ice", mud: "mud", moondust: "moonDust" };

/**
 * Create the scene from the asset library: sky, terrain, snow, mud, water,
 * plants, rocks, food, weather and effects.
 */
export function createScene(width, height) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1200);
  camera.position.set(0, 3, 5);
  camera.lookAt(0, 1, 0);
  const renderer = createRenderer(width, height);

  setCurvedWorld(true, PLANET_RADIUS);
  setHorizonFade(PLANET_RADIUS * 0.45, PLANET_RADIUS * 0.8);

  const sky = createSkySystem();
  scene.add(sky.group);

  const clear = (x, z) => Math.hypot(x, z) < SPAWN_CLEAR;
  const terrain = createTerrain({ shape: "flat", ground: "grass", size: WORLD_SIZE });
  const snow = createSnowLayer(terrain);
  const mud = createMudPuddles({ count: 40, area: DECOR_AREA * 0.4, seed: 11 });
  const lake = createLake({ radius: WORLD_SIZE / 2, depth: PHYSICS.WATER_SURFACE_MAX, level: 0, decor: false });
  const underwater = createUnderwaterFx(scene);

  const decor = {
    grass: createGrassTufts({ count: 1600, area: DECOR_AREA, seed: 3, exclude: clear }),
    flowers: createFlowerField({ count: 320, area: DECOR_AREA, seed: 5, exclude: clear }),
    reeds: createReeds({ count: 60, area: DECOR_AREA * 0.5, seed: 4, exclude: clear }),
    rocks: createRockField({ kind: "smallRock", count: 120, area: DECOR_AREA, seed: 3, exclude: clear }),
    iceCrystals: createIceCrystal({ seed: 2 }),
    iceberg: createIceberg({ seed: 3 }),
    moonBoulder: createMoonBoulder({ seed: 4 }),
  };
  decor.iceCrystals.position.set(-14, 0, 9);
  decor.iceberg.position.set(18, 0, -16);
  decor.moonBoulder.position.set(12, 0, 14);

  const food = createFruit({ kind: "red", seed: 1, spawnNow: true });
  const weather = createWeather({ radius: 16, height: 14 });
  const effects = createEffects(scene);

  scene.add(terrain, snow, mud, lake, food, weather, ...Object.values(decor));

  return {
    scene,
    camera,
    renderer,
    sky,
    terrain,
    snow,
    mud,
    lake,
    underwater,
    decor,
    food,
    foodKey: null,
    weather,
    effects,
    trees: null,
    treeKey: null,
    settingsKey: null,
    time: 0,
    focus: new THREE.Vector3(),
    wasUnderwater: false,
    waterY: 0,
    biome: "earth",
    ground: "grass",
  };
}

/**
 * Apply world settings to the assets. Cheap to call every frame: only changed
 * settings touch geometry.
 */
export function updateWorldVisuals(state, settings) {
  const key = JSON.stringify(settings);
  if (key === state.settingsKey) return;
  state.settingsKey = key;

  const ground = GROUND_NAMES[settings.groundType] ?? "grass";
  const moon = ground === "moonDust" || (settings.gravity ?? 1) < 0.5;
  const icy = ground === "ice" || (settings.snowDepth ?? 0) > 0;
  if (ground !== state.ground) {
    state.terrain.userData.setGround(ground);
    state.snow.userData.invalidate?.();
    state.ground = ground;
  }
  state.biome = moon ? "moon" : "earth";
  state.sky.setBiome(state.biome);
  state.sky.setTime(TIME_PRESETS[settings.timeOfDay] ?? TIME_PRESETS.day);

  const snowDepth = settings.snowDepth ?? 0;
  state.snow.userData.setDepth(snowDepth);
  state.mud.userData.setAmount(settings.mud ?? 0);
  state.mud.visible = !moon;
  setSnowCaps(Math.min(1, snowDepth / 0.1));
  state.decor.grass.userData.setSnowDepth?.(snowDepth);

  state.waterY = waterSurfaceY(settings);
  state.lake.userData.setLevel(state.waterY > 0 ? 1 : 0);
  state.lake.position.y = state.waterY;
  state.lake.visible = state.waterY > 0;

  const wind = settings.wind ?? { strength: 0, direction: 0 };
  const windAngle = ((wind.direction ?? 0) * Math.PI) / 180;
  setWind(wind.strength ?? 0, windAngle);
  const weather = state.weather.userData.api;
  weather.setRain(settings.rain ?? 0);
  weather.setSnow(snowDepth > 0 ? Math.min(1, 0.3 + snowDepth / 0.3) : 0);
  weather.setWind(wind.strength ?? 0, windAngle);
  weather.setSurfaceY(state.waterY);

  const earthGround = !moon && ground !== "ice";
  state.decor.grass.visible = earthGround && ground !== "sand";
  state.decor.flowers.visible = earthGround && ground === "grass" && snowDepth === 0;
  state.decor.reeds.visible = earthGround && state.waterY > 0;
  state.decor.rocks.visible = !moon;
  state.decor.iceCrystals.visible = icy && !moon;
  state.decor.iceberg.visible = icy && !moon && state.waterY > 0.5;
  state.decor.moonBoulder.visible = moon;

  state.treeKind = moon ? "moonBoulder" : settings.treeKind ?? (icy ? "pine" : "round");
  if (state.treePositions) setTrees(state, state.treePositions);
}

/**
 * Place tree assets on the physics tree colliders (moon boulders on the moon).
 */
export function setTrees(state, positions) {
  state.treePositions = positions;
  const kind = state.treeKind ?? "round";
  const key = `${kind}:${JSON.stringify(positions)}`;
  if (key === state.treeKey) return;
  state.treeKey = key;
  if (state.trees) state.scene.remove(state.trees);
  state.trees = null;
  if (!positions.length) return;

  const field =
    kind === "moonBoulder"
      ? createRockField({ kind: "moonBoulder", count: positions.length, area: 1, seed: 7 })
      : createTreeField({ kind, size: "medium", count: positions.length, area: 1, seed: 2 });
  const placements = positions.map((p, i) => ({ x: p.x, y: 0, z: p.z, s: 1, yaw: i * 2.39996 }));
  field.userData.placements = placements;
  writePlacements(field, placements);
  field.count = placements.length;
  state.trees = field;
  state.scene.add(field);
}

/**
 * Move the food asset to the physics food position; pop the old fruit when eaten.
 */
export function setFood(state, food) {
  const key = `${food.x.toFixed(3)},${food.z.toFixed(3)}`;
  if (key === state.foodKey) return;
  const api = state.food.userData.api;
  if (state.foodKey !== null) api.eat(state.effects);
  state.foodKey = key;
  state.food.position.set(food.x, 0, food.z);
  api.spawn(0.6);
}

/**
 * Advance animated assets one frame. `focus` is the blob position.
 */
export function updateWorld(state, dt, focus) {
  state.time += dt;
  updateWorldTime(state.time);
  if (focus) state.focus.set(focus.x, focus.y, focus.z);
  state.sky.focus.copy(state.focus);
  state.sky.update(dt, state.camera);
  state.lake.userData.update(state.time);
  state.food.userData.api.update(dt);
  state.weather.userData.api.update(dt, state.focus);
  state.effects.update(dt);
  state.underwater.update(state.camera, state.lake, [state.sky.dome, state.sky.clouds]);

  if (focus) {
    const under = state.lake.visible && focus.y < state.waterY;
    if (under !== state.wasUnderwater) {
      state.effects.waterSplash(new THREE.Vector3(focus.x, state.waterY, focus.z));
      state.wasUnderwater = under;
    }
  }
}

/** Kick up dust or mud where the blob lands. */
export function landingEffect(state, position, settings) {
  const at = new THREE.Vector3(position.x, 0.02, position.z);
  if ((settings.mud ?? 0) > 0.3) state.effects.mudSplash(at);
  else state.effects.dustPuff(at);
}

/**
 * Render one frame.
 */
export function render(state) {
  state.renderer.render(state.scene, state.camera);
}

/**
 * Handle window resize.
 */
export function onWindowResize(state) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

export { LIGHTING, PALETTE };

function createRenderer(width, height) {
  if (typeof WebGLRenderingContext === "undefined") return createNullRenderer();
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
  } catch (err) {
    console.warn("WebGL unavailable, rendering disabled:", err.message);
    return createNullRenderer();
  }
}

// Stand-in with the same calls as WebGLRenderer, for tests and machines without WebGL.
function createNullRenderer() {
  return {
    isNullRenderer: true,
    domElement: typeof document !== "undefined" ? document.createElement("canvas") : null,
    shadowMap: { enabled: false },
    setSize() {},
    setPixelRatio() {},
    render() {},
    dispose() {},
  };
}
