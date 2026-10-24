// Catalog of every asset for the preview page. Each entry: id, cat, label, size (footprint radius in meters),
// spin (turntable), make(ctx) -> Object3D, apply(obj, ctx) for slider driven values,
// update(obj, dt, t, ctx) per frame, actions [{label, run(obj, ctx)}].
import * as THREE from 'three';
import {
  createSun, createMoon, createCloud, createCloudLayer, createHorizonPlanet,
} from './sky.js';
import { createTerrain, createSnowLayer, createMudPuddles, GROUND_NAMES } from './ground.js';
import { createLake, createUnderwaterFx } from './water.js';
import {
  createRoundTree, createPineTree, createPalmTree, createBush, createTreeField, createFlowerField, createGrassTufts, createReeds,
} from './plants.js';
import {
  createSmallRock, createBoulder, createCliffChunk, createLog, createSnowMound, createIcePlate, createIceCrystal, createIceberg,
  createMoonBoulder, createRockField,
} from './rocks.js';
import { createBlob } from './blob.js';
import { createFruit, createFruitAtTrees } from './food.js';
import { createWeather } from './weather.js';
import { setSnowCaps } from './core.js';

export const CATEGORIES = ['Sky', 'Terrain', 'Ground tiles', 'Water', 'Plants', 'Rocks and ice', 'Blob', 'Food', 'Weather', 'Effects', 'Demo world'];

const E = [];
const add = (e) => E.push({ spin: true, size: 2, ...e });

const lift = (obj, y) => { obj.position.y = y; const g = new THREE.Group(); g.add(obj); return g; };

/* ---------------- Sky ---------------- */
add({ id: 'sun', cat: 'Sky', label: 'Low poly sun', size: 3, make: () => { const s = createSun({ radius: 6 }); s.scale.setScalar(0.3); return lift(s, 2); } });
add({ id: 'moon', cat: 'Sky', label: 'Low poly moon', size: 3, make: () => { const s = createMoon({ radius: 5 }); s.scale.setScalar(0.34); return lift(s, 2); } });
[1, 2, 3].forEach((seed) => add({ id: 'cloud' + seed, cat: 'Sky', label: 'Cloud ' + seed, size: 4, make: () => lift(createCloud({ seed, scale: 1 }), 0.6) }));
add({ id: 'horizonPlanet', cat: 'Sky', label: 'Moon biome planet', size: 4, make: () => { const p = createHorizonPlanet({ radius: 70 }); p.scale.setScalar(0.04); return lift(p, 2.8); } });
add({ id: 'cloudLayer', cat: 'Sky', label: 'Drifting cloud layer', size: 20, spin: false,
  make: () => createCloudLayer({ count: 8, radius: 20, minHeight: 4, maxHeight: 8, scaleMul: 0.35 }),
  update: (o, dt) => o.userData.update(dt) });

/* ---------------- Terrain ---------------- */
add({
  id: 'terrain', cat: 'Terrain', label: 'Terrain + snow + mud + grass', size: 26, spin: false,
  make: () => {
    const g = new THREE.Group();
    const t = createTerrain({ size: 48 });
    const snow = createSnowLayer(t);
    const mud = createMudPuddles({ area: 16, heightAt: t.userData.heightAt });
    const grass = createGrassTufts({ count: 220, area: 21, heightAt: t.userData.heightAt });
    g.add(t, snow, mud, grass);
    g.userData = { t, snow, mud, grass };
    return g;
  },
  apply: (g, ctx) => {
    const { t, snow, mud, grass } = g.userData;
    const before = JSON.stringify(t.userData.getState());
    t.userData.setShape(ctx.terrainShape);
    t.userData.setGround(ctx.ground);
    if (JSON.stringify(t.userData.getState()) !== before) {
      snow.userData.invalidate();
      mud.userData.reseat(t.userData.heightAt);
      grass.userData.reseat(t.userData.heightAt);
    }
    snow.userData.setDepth(ctx.snowDepth);
    mud.userData.setAmount(ctx.mudAmount);
    grass.userData.setSnowDepth(ctx.snowDepth);
    grass.visible = ctx.ground === 'grass' && ctx.snowDepth < 0.19;
  },
});

/* ---------------- Ground tiles ---------------- */
GROUND_NAMES.forEach((name) => add({
  id: 'ground_' + name, cat: 'Ground tiles', label: 'Ground: ' + name, size: 6,
  make: () => createTerrain({ size: 9, ground: name, shape: 'flat' }),
  apply: (o, ctx) => o.userData.setShape(ctx.terrainShape === 'steps' || ctx.terrainShape === 'gap' ? 'flat' : ctx.terrainShape),
}));
add({
  id: 'snowTile', cat: 'Ground tiles', label: 'Snow layer on grass', size: 6,
  make: () => { const g = new THREE.Group(); const t = createTerrain({ size: 9 }); const s = createSnowLayer(t); g.add(t, s); g.userData = { s }; return g; },
  apply: (g, ctx) => g.userData.s.userData.setDepth(Math.max(ctx.snowDepth, 0.12)),
});
add({
  id: 'mudTile', cat: 'Ground tiles', label: 'Mud puddles', size: 6,
  make: () => { const g = new THREE.Group(); g.add(createTerrain({ size: 9, ground: 'grass' })); const m = createMudPuddles({ count: 8, area: 3 }); g.add(m); g.userData = { m }; return g; },
  apply: (g, ctx) => g.userData.m.userData.setAmount(Math.max(ctx.mudAmount, 0.6)),
});

/* ---------------- Water ---------------- */
add({
  id: 'lake', cat: 'Water', label: 'Lake: water, shore, foam, seaweed, pebbles, bubbles', size: 13, spin: false,
  make: () => createLake({ radius: 8, level: 0.8 }),
  apply: (o, ctx) => o.userData.setLevel(ctx.waterLevel),
  update: (o, dt, t) => o.userData.update(t),
  actions: [
    { label: 'Dive camera under water', run: (o, ctx) => ctx.orbit.set({ target: [0, o.userData.getWaterY() - 0.7, 0], dist: 2.4, pitch: -0.05 }) },
    { label: 'Water splash', run: (o, ctx) => ctx.effects.waterSplash(new THREE.Vector3(0, o.userData.getWaterY(), 0)) },
  ],
  underwater: true,
});

/* ---------------- Plants ---------------- */
['small', 'medium', 'large'].forEach((s) => {
  add({ id: 'round_' + s, cat: 'Plants', label: 'Round tree ' + s, size: 2.2, make: () => createRoundTree({ size: s }) });
  add({ id: 'pine_' + s, cat: 'Plants', label: 'Pine tree ' + s, size: 2.2, make: () => createPineTree({ size: s }) });
});
add({ id: 'palm', cat: 'Plants', label: 'Palm tree', size: 2.4, make: () => createPalmTree({ size: 'medium' }) });
add({ id: 'bush', cat: 'Plants', label: 'Bush', size: 2, make: () => createBush({ size: 'medium' }) });
add({ id: 'flowers', cat: 'Plants', label: 'Flowers', size: 2.2, make: () => createFlowerField({ count: 60, area: 3.2, seed: 2 }) });
add({ id: 'grass', cat: 'Plants', label: 'Grass tufts', size: 2.2, make: () => createGrassTufts({ count: 40, area: 2.8 }), apply: (o, ctx) => o.userData.setSnowDepth(ctx.snowDepth) });
add({ id: 'reeds', cat: 'Plants', label: 'Reeds', size: 1.8, make: () => createReeds({ count: 10, area: 2 }) });

/* ---------------- Rocks and ice ---------------- */
add({ id: 'smallRock', cat: 'Rocks and ice', label: 'Small rock', size: 2, make: () => createSmallRock({ seed: 3 }) });
add({ id: 'boulder', cat: 'Rocks and ice', label: 'Boulder', size: 3, make: () => createBoulder({ seed: 2 }) });
add({ id: 'cliffRock', cat: 'Rocks and ice', label: 'Cliff chunk, gray', size: 4, make: () => createCliffChunk({ seed: 2 }) });
add({ id: 'cliffDirt', cat: 'Rocks and ice', label: 'Cliff chunk, brown', size: 4, make: () => createCliffChunk({ seed: 5, variant: 'dirt' }) });
add({ id: 'log', cat: 'Rocks and ice', label: 'Log', size: 2.4, make: () => createLog() });
add({ id: 'snowMound', cat: 'Rocks and ice', label: 'Snow mound', size: 2.4, make: () => createSnowMound() });
add({ id: 'icePlate', cat: 'Rocks and ice', label: 'Cracked ice plate', size: 2.4, make: () => createIcePlate() });
add({ id: 'iceCrystal', cat: 'Rocks and ice', label: 'Ice crystals', size: 2.4, make: () => createIceCrystal({ seed: 2 }) });
add({ id: 'iceberg', cat: 'Rocks and ice', label: 'Iceberg', size: 4, make: () => createIceberg({ seed: 2 }) });
add({ id: 'moonBoulder', cat: 'Rocks and ice', label: 'Moon boulder', size: 3, make: () => createMoonBoulder({ seed: 4 }) });
add({ id: 'rockField', cat: 'Rocks and ice', label: 'Instanced rock field', size: 6, make: () => createRockField({ kind: 'smallRock', count: 40, area: 5 }) });

/* ---------------- Blob ---------------- */
const blobEntry = (id, label, limbs) => add({
  id, cat: 'Blob', label, size: 2.2,
  make: () => createBlob({ limbCount: limbs }),
});
blobEntry('blob0', 'Blob, starting body', 0);
blobEntry('blob2', 'Blob, 2 limbs', 2);
blobEntry('blob4', 'Blob, 4 limbs', 4);
add({
  id: 'blobEvolve', cat: 'Blob', label: 'Blob, limb morph test (sliders)', size: 2.6,
  make: (ctx) => createBlob({ limbCount: ctx.limbCount }),
  apply: (o, ctx) => { o.userData.blob.setLimbCount(ctx.limbCount); if (!ctx.morphing) o.userData.blob.setLimbParams({ length: ctx.limbLength, width: ctx.limbWidth, thickness: ctx.limbThickness }); },
  update: (o, dt, t, ctx) => {
    const b = o.userData.blob;
    b.limbs.forEach((l, i) => { b.setJointActivity(i, 0, 0.5 + 0.5 * Math.sin(t * 2 + i)); b.setJointActivity(i, 1, 0.5 + 0.5 * Math.sin(t * 2.7 + i * 1.7)); });
    b.update(dt, { velocity: new THREE.Vector3(Math.sin(t) * 0.8, 0, 0), grounded: true });
  },
  actions: [
    { label: 'Evolve over 90 seconds', run: (o, ctx) => { ctx.morphing = true; o.userData.blob.evolve({ length: ctx.limbLength, width: ctx.limbWidth, thickness: ctx.limbThickness }, 90); } },
    { label: 'Evolve over 6 seconds (fast check)', run: (o, ctx) => { ctx.morphing = true; o.userData.blob.evolve({ length: ctx.limbLength, width: ctx.limbWidth, thickness: ctx.limbThickness }, 6); } },
    { label: 'Jump (stretch and land squash)', run: (o) => { o.userData.blob.push(1); o.userData.jumpT = 0; } },
    { label: 'Bump (ripple)', run: (o) => o.userData.blob.impact(new THREE.Vector3(1, 0.2, 0.3), 1.6) },
  ],
});

/* ---------------- Food ---------------- */
add({ id: 'fruitRed', cat: 'Food', label: 'Fruit, red', size: 1.2, make: () => createFruit({ kind: 'red', spawnNow: true }), update: (o, dt) => o.userData.api.update(dt),
  actions: [{ label: 'Respawn (grow in)', run: (o) => o.userData.api.spawn() }, { label: 'Eat (pop)', run: (o, ctx) => { o.userData.api.eat(ctx.effects); setTimeout(() => o.userData.api.spawn(), 900); } }] });
add({ id: 'fruitOrange', cat: 'Food', label: 'Fruit, orange', size: 1.2, make: () => createFruit({ kind: 'orange', spawnNow: true }), update: (o, dt) => o.userData.api.update(dt),
  actions: [{ label: 'Respawn (grow in)', run: (o) => o.userData.api.spawn() }, { label: 'Eat (pop)', run: (o, ctx) => { o.userData.api.eat(ctx.effects); setTimeout(() => o.userData.api.spawn(), 900); } }] });
add({
  id: 'treeFruit', cat: 'Food', label: 'Tree with fruit at its base', size: 4,
  make: () => {
    const g = new THREE.Group();
    const trees = createTreeField({ kind: 'round', size: 'medium', count: 1, area: 0.001, seed: 3 });
    const fruit = createFruitAtTrees(trees, { perTree: 5, ring: 1.1 });
    g.add(trees, fruit);
    g.userData = { fruit };
    return g;
  },
  update: (g, dt) => g.userData.fruit.userData.update(dt),
  actions: [{ label: 'Respawn fruit', run: (g) => g.userData.fruit.userData.spawnAll(0.8) }],
});

/* ---------------- Weather ---------------- */
add({
  id: 'weather', cat: 'Weather', label: 'Rain, snowfall, wind (use sliders and buttons)', size: 12, spin: false,
  make: () => {
    const g = new THREE.Group();
    const t = createTerrain({ size: 24 });
    const trees = createTreeField({ kind: 'pine', size: 'medium', count: 6, area: 8, seed: 5 });
    const round = createTreeField({ kind: 'round', size: 'small', count: 5, area: 8, seed: 9 });
    const grass = createGrassTufts({ count: 60, area: 9 });
    const w = createWeather({ radius: 12, height: 11 });
    g.add(t, trees, round, grass, w);
    g.userData = { w };
    return g;
  },
  apply: (g, ctx) => {
    const api = g.userData.w.userData.api;
    api.setRain(ctx.rain); api.setSnow(ctx.snowfall);
    api.setWind(ctx.windStrength, ctx.windDir);
    setSnowCaps(ctx.snowfall > 0 ? 1 : 0);
  },
  update: (g, dt) => g.userData.w.userData.api.update(dt, new THREE.Vector3(0, 0, 0)),
  actions: [],
});

/* ---------------- Effects ---------------- */
add({
  id: 'effects', cat: 'Effects', label: 'Dust, water splash, mud splash, fruit pop', size: 5, spin: false,
  make: () => createTerrain({ size: 12, ground: 'grass' }),
  actions: [
    { label: 'Dust puff', run: (o, ctx) => ctx.effects.dustPuff(new THREE.Vector3(0, 0, 0)) },
    { label: 'Water splash', run: (o, ctx) => ctx.effects.waterSplash(new THREE.Vector3(0, 0.1, 0)) },
    { label: 'Mud splash', run: (o, ctx) => ctx.effects.mudSplash(new THREE.Vector3(0, 0.05, 0)) },
    { label: 'Fruit pop', run: (o, ctx) => ctx.effects.fruitPop(new THREE.Vector3(0, 0.2, 0), 'red') },
  ],
});

/* ---------------- Demo world ---------------- */
add({
  id: 'demo', cat: 'Demo world', label: 'Everything together on a curved planet', size: 40, spin: false,
  make: (ctx) => {
    const g = new THREE.Group();
    const LAKE = { x: 20, z: -8, R: 7 };
    const t = createTerrain({ size: 96, shape: 'flat', holes: [{ x: LAKE.x, z: LAKE.z, r: LAKE.R * 1.35 }] });
    const lake = createLake({ radius: LAKE.R, level: 0.85, seed: 3 });
    lake.position.set(LAKE.x, -0.03, LAKE.z);
    const far = (x, z) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.R * 1.7 || Math.hypot(x, z) < 3.5;
    const pines = createTreeField({ kind: 'pine', size: 'medium', count: 24, area: 44, seed: 2, exclude: far, minDist: 3 });
    const pinesL = createTreeField({ kind: 'pine', size: 'large', count: 8, area: 44, seed: 7, exclude: far, minDist: 4 });
    const round = createTreeField({ kind: 'round', size: 'medium', count: 22, area: 44, seed: 4, exclude: far, minDist: 3 });
    const palms = createTreeField({ kind: 'palm', size: 'medium', count: 6, center: [LAKE.x, LAKE.z], ring: [LAKE.R * 1.35, LAKE.R * 1.9], seed: 6 });
    const bushes = createTreeField({ kind: 'bush', size: 'medium', count: 18, area: 40, seed: 8, exclude: far });
    const rocks = createRockField({ kind: 'smallRock', count: 40, area: 42, seed: 3, exclude: far });
    const boulders = createRockField({ kind: 'boulder', count: 8, area: 42, seed: 5, exclude: far });
    const cliffs = createRockField({ kind: 'cliff', count: 3, ring: [34, 42], seed: 9 });
    const logs = createRockField({ kind: 'log', count: 5, area: 30, seed: 11, exclude: far });
    const grass = createGrassTufts({ count: 700, area: 44, seed: 3, exclude: far });
    const flowers = createFlowerField({ count: 160, area: 40, seed: 5, exclude: far });
    const reeds = createReeds({ count: 14, center: [LAKE.x, LAKE.z], ring: [LAKE.R * 1.2, LAKE.R * 1.45], seed: 4 });
    const fruit = createFruitAtTrees(round, { perTree: 2 });
    const clouds = createCloudLayer({ count: 9, radius: 60, minHeight: 18, maxHeight: 30, scaleMul: 0.8 });
    const blob = createBlob({ limbCount: 2 });
    blob.position.set(0, 0, 0);
    g.add(t, lake, pines, pinesL, round, palms, bushes, rocks, boulders, cliffs, logs, grass, flowers, reeds, fruit, clouds, blob);
    g.userData = { t, lake, blob, clouds, fruit };
    return g;
  },
  apply: (g, ctx) => g.userData.lake.userData.setLevel(ctx.waterLevel),
  update: (g, dt, t) => {
    const { lake, blob, clouds, fruit } = g.userData;
    lake.userData.update(t);
    clouds.userData.update(dt);
    fruit.userData.update(dt);
    const b = blob.userData.blob;
    const a = t * 0.35;
    const prev = blob.position.clone();
    blob.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6);
    blob.rotation.y = -a;
    const vel = blob.position.clone().sub(prev).divideScalar(Math.max(dt, 1e-4));
    b.limbs.forEach((l, i) => { b.setJointActivity(i, 0, 0.5 + 0.5 * Math.sin(t * 4 + i)); b.setJointActivity(i, 1, 0.5 + 0.5 * Math.sin(t * 4 + i + 1.5)); });
    b.update(dt, { velocity: vel, grounded: true });
  },
  camera: { target: [0, 0.6, 0], dist: 10, pitch: 0.28 },
});

export const CATALOG = E;
export { createUnderwaterFx };
