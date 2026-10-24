// Trees, bushes, flowers, grass tufts and reeds.
import * as THREE from 'three';
import { PALETTE, FLOWER_COLORS, makeTones } from './palette.js';
import { Builder, flatMaterial, meshFrom, scatterInstances, writePlacements, rng } from './core.js';

export const TREE_SIZES = ['small', 'medium', 'large'];
const SCALE = { small: 0.8, medium: 1.1, large: 1.5 };

const swayKey = (h) => Math.round(h * 2) / 2;

/* ------------------------------------------------------------------ */
/* Geometry builders (return { geometry, height })                     */
/* ------------------------------------------------------------------ */
function roundTreeData(size = 'medium', seed = 1, palette = PALETTE.foliage) {
  const sc = SCALE[size];
  const blobs = {
    small: [{ p: [0, 1.35, 0], r: 0.9 }, { p: [0.5, 1.0, 0.2], r: 0.6 }],
    medium: [{ p: [0, 1.5, 0], r: 0.95 }, { p: [0.6, 1.15, 0.25], r: 0.7 }, { p: [-0.55, 1.3, -0.3], r: 0.75 }],
    large: [{ p: [0, 1.5, 0], r: 0.95 }, { p: [0.6, 1.15, 0.25], r: 0.7 }, { p: [-0.55, 1.3, -0.3], r: 0.75 }, { p: [0.05, 2.2, 0.05], r: 0.75 }],
  }[size];
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.17 * sc, 0.25 * sc, 1.0 * sc, 6, 1), { palette: PALETTE.trunk, pos: [0, 0.5 * sc, 0], jitter: 0.02, seed });
  let top = 0;
  blobs.forEach((o, i) => {
    b.add(new THREE.IcosahedronGeometry(o.r * sc, 1), {
      palette, pos: [o.p[0] * sc, o.p[1] * sc, o.p[2] * sc], jitter: o.r * sc * 0.12, seed: seed * 10 + i, vary: 0.05,
    });
    top = Math.max(top, (o.p[1] + o.r) * sc);
  });
  return { geometry: b.build(), height: top };
}

function pineTreeData(size = 'medium', seed = 1) {
  const sc = SCALE[size];
  const cones = {
    small: [[1.0, 1.3, 0.55], [0.7, 1.1, 1.35]],
    medium: [[1.1, 1.3, 0.6], [0.85, 1.2, 1.4], [0.6, 1.1, 2.2]],
    large: [[1.5, 1.4, 0.55], [1.2, 1.3, 1.35], [0.9, 1.2, 2.15], [0.6, 1.1, 2.95]],
  }[size];
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.13 * sc, 0.19 * sc, 0.8 * sc, 6, 1), { palette: PALETTE.trunk, pos: [0, 0.4 * sc, 0], jitter: 0.015, seed });
  let top = 0;
  cones.forEach(([r, h, y], i) => {
    b.add(new THREE.ConeGeometry(r * sc, h * sc, 7, 1), {
      palette: PALETTE.foliage, pos: [0, (y + h / 2) * sc, 0], rot: [0, i * 0.5, 0], jitter: 0.05 * sc, seed: seed * 7 + i, vary: 0.05,
    });
    top = Math.max(top, (y + h) * sc);
  });
  return { geometry: b.build(), height: top };
}

function palmTreeData(size = 'medium', seed = 1) {
  const sc = SCALE[size];
  const H = 3.2 * sc;
  const lean = 0.9 * sc;
  const r = rng(seed);
  const b = new Builder();
  const pts = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    pts.push(new THREE.Vector3(lean * t * t, H * t, 0));
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1];
    const dir = c.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    const ra = (0.2 - i * 0.012) * sc, rb = (0.2 - (i + 1) * 0.012) * sc;
    b.add(new THREE.CylinderGeometry(rb, ra, len * 1.02, 6, 1), {
      palette: i % 2 ? PALETTE.trunk : { light: '#9A6A44', mid: '#7D4F33', shadow: '#5E3A26' },
      pos: [(a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2], rot: [e.x, e.y, e.z], jitter: 0.01, seed: seed + i,
    });
  }
  const crown = pts[pts.length - 1];
  const fronds = 7;
  for (let f = 0; f < fronds; f++) {
    const th = (f / fronds) * Math.PI * 2 + r() * 0.3;
    const dx = Math.cos(th), dz = Math.sin(th);
    const px = -dz, pz = dx;
    const L = [], R = [];
    const len = (1.5 + r() * 0.35) * sc;
    for (let s = 0; s <= 5; s++) {
      const k = s / 5;
      const out = k * len;
      const y = Math.sin(k * 2.0) * 0.55 * sc - k * k * 0.5 * sc;
      const w = (0.3 * Math.pow(1 - k, 0.7) + 0.03) * sc;
      const cx = crown.x + dx * out, cy = crown.y + 0.12 * sc + y, cz = crown.z + dz * out;
      L.push([cx + px * w, cy - w * 0.25, cz + pz * w]);
      R.push([cx - px * w, cy - w * 0.25, cz - pz * w]);
    }
    b.addStrip(L, R, { palette: PALETTE.foliage, seed: seed * 3 + f, vary: 0.06 });
  }
  for (let i = 0; i < 3; i++) {
    const th = (i / 3) * Math.PI * 2;
    b.add(new THREE.IcosahedronGeometry(0.13 * sc, 0), { palette: PALETTE.cattail, pos: [crown.x + Math.cos(th) * 0.18 * sc, crown.y - 0.05 * sc, crown.z + Math.sin(th) * 0.18 * sc], vary: 0.02 });
  }
  return { geometry: b.build(), height: crown.y + 0.8 * sc };
}

function bushData(size = 'medium', seed = 1) {
  const sc = SCALE[size] * 0.75;
  const b = new Builder();
  const r = rng(seed);
  const n = size === 'small' ? 3 : size === 'medium' ? 4 : 5;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + r();
    const d = i === 0 ? 0 : 0.35 * sc;
    const rad = (0.38 + r() * 0.15) * sc * (i === 0 ? 1.15 : 1);
    b.add(new THREE.IcosahedronGeometry(rad, 1), {
      palette: PALETTE.foliage, pos: [Math.cos(th) * d, rad * 0.8, Math.sin(th) * d], scale: [1, 0.85, 1], jitter: rad * 0.12, seed: seed * 5 + i, vary: 0.05,
    });
  }
  return { geometry: b.build(), height: 1.0 * sc };
}

const DATA = { round: roundTreeData, pine: pineTreeData, palm: palmTreeData, bush: bushData };

export function treeData(kind = 'round', size = 'medium', seed = 1) {
  return DATA[kind](size, seed);
}

function makeTree(kind, { size = 'medium', seed = 1, snowCaps = true } = {}) {
  const d = treeData(kind, size, seed);
  const mesh = new THREE.Mesh(d.geometry, flatMaterial({ sway: swayKey(d.height), snowCap: snowCaps }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.height = d.height;
  mesh.userData.kind = kind;
  return mesh;
}

// Public single tree factories. size is 'small' | 'medium' | 'large'
export const createRoundTree = (o = {}) => makeTree('round', o);
export const createPineTree = (o = {}) => makeTree('pine', o);
export const createPalmTree = (o = {}) => makeTree('palm', o);
export const createBush = (o = {}) => makeTree('bush', o);

// Instanced forest. kind: 'round' | 'pine' | 'palm' | 'bush'. Returns InstancedMesh with userData.placements.
export function createTreeField({ kind = 'round', size = 'medium', count = 20, seed = 1, scale = [0.85, 1.25], ...scatter } = {}) {
  const d = treeData(kind, size, seed);
  const mat = flatMaterial({ sway: swayKey(d.height), snowCap: true });
  const mesh = scatterInstances(d.geometry, mat, count, { seed: seed + 100, scale, ...scatter });
  mesh.userData.height = d.height;
  mesh.userData.kind = kind;
  mesh.userData.size = size;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Flowers                                                             */
/* ------------------------------------------------------------------ */
export function flowerGeometry(hex = '#FF6B8B', seed = 1) {
  const tones = makeTones(hex);
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.012, 0.016, 0.3, 4, 1), { palette: PALETTE.seaweed, pos: [0, 0.15, 0], vary: 0.02 });
  b.add(new THREE.OctahedronGeometry(0.05, 0), { palette: PALETTE.foliage, pos: [0.045, 0.1, 0], scale: [1, 0.25, 0.5], rot: [0, 0, 0.5], vary: 0.02 });
  for (let i = 0; i < 5; i++) {
    const th = (i / 5) * Math.PI * 2;
    b.add(new THREE.OctahedronGeometry(1, 0), {
      palette: tones, pos: [Math.cos(th) * 0.065, 0.315, Math.sin(th) * 0.065], scale: [0.06, 0.018, 0.04], rot: [0, -th, 0.25], seed: seed + i, vary: 0.03,
    });
  }
  b.add(new THREE.IcosahedronGeometry(0.035, 0), { palette: { light: '#FFE066', mid: '#FFC83D', shadow: '#E0A020' }, pos: [0, 0.325, 0], vary: 0.02 });
  return b.build();
}

export function createFlower({ color = '#FF6B8B', seed = 1 } = {}) {
  const mesh = new THREE.Mesh(flowerGeometry(color, seed), flatMaterial({ sway: 0.5, snowCap: true }));
  mesh.castShadow = true;
  return mesh;
}

// Tiny flowers in a few bright colors scattered over an area. Returns a Group of 4 InstancedMeshes.
export function createFlowerField({ count = 80, area = 18, seed = 4, heightAt = null, colors = FLOWER_COLORS, ...rest } = {}) {
  const group = new THREE.Group();
  const per = Math.ceil(count / colors.length);
  const placements = [];
  colors.forEach((hex, i) => {
    const m = scatterInstances(flowerGeometry(hex, i), flatMaterial({ sway: 0.5, snowCap: true }), per, {
      area, seed: seed * 31 + i, scale: [0.8, 1.4], heightAt, ...rest,
    });
    m.castShadow = false;
    group.add(m);
    placements.push(...m.userData.placements);
  });
  group.userData.placements = placements;
  return group;
}

/* ------------------------------------------------------------------ */
/* Grass tufts                                                         */
/* ------------------------------------------------------------------ */
export function grassTuftGeometry(seed = 1) {
  const r = rng(seed);
  const b = new Builder();
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + r();
    const h = 0.35 + r() * 0.25;
    const tilt = 0.18 + r() * 0.22;
    b.add(new THREE.ConeGeometry(0.045, h, 3, 1), {
      palette: PALETTE.grass,
      pos: [Math.cos(th) * 0.05, h / 2, Math.sin(th) * 0.05],
      rot: [Math.sin(th) * tilt, 0, -Math.cos(th) * tilt],
      seed: seed + i, vary: 0.06,
    });
  }
  return b.build();
}

// Swaying grass. group.userData.setSnowDepth(d) hides them under deep snow (about 0.2 m).
export function createGrassTufts({ count = 120, area = 20, seed = 2, heightAt = null, ...rest } = {}) {
  const mesh = scatterInstances(grassTuftGeometry(seed), flatMaterial({ sway: 0.5, snowCap: true }), count, {
    area, seed: seed + 50, scale: [0.8, 1.5], heightAt, ...rest,
  });
  mesh.castShadow = false;
  const base = mesh.userData.placements.map((p) => ({ ...p }));
  let lastK = 1;
  mesh.userData.setSnowDepth = (d) => {
    lastK = THREE.MathUtils.clamp(1 - d / 0.2, 0, 1);
    mesh.visible = lastK > 0.03;
    writePlacements(mesh, base, (p) => new THREE.Vector3(p.s, p.s * lastK, p.s));
  };
  // move tufts onto a new surface (after the terrain shape changes)
  mesh.userData.reseat = (fn) => {
    base.forEach((p) => { p.y = fn(p.x, p.z); });
    writePlacements(mesh, base, (p) => new THREE.Vector3(p.s, p.s * lastK, p.s));
  };
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Reeds                                                               */
/* ------------------------------------------------------------------ */
export function reedGeometry(seed = 1) {
  const r = rng(seed);
  const b = new Builder();
  for (let i = 0; i < 3; i++) {
    const h = 1.0 + r() * 0.6;
    const ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25;
    const tx = (r() - 0.5) * 0.12, tz = (r() - 0.5) * 0.12;
    b.add(new THREE.CylinderGeometry(0.014, 0.024, h, 4, 1), { palette: PALETTE.reed, pos: [ox, h / 2, oz], rot: [tz, 0, -tx], vary: 0.04, seed: seed + i });
    b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 5, 1), { palette: PALETTE.cattail, pos: [ox + tx * h * 0.9, h - 0.05, oz + tz * h * 0.9], rot: [tz, 0, -tx], vary: 0.03 });
    b.add(new THREE.ConeGeometry(0.03, 0.12, 4, 1), { palette: PALETTE.cattail, pos: [ox + tx * h, h + 0.13, oz + tz * h], vary: 0.02 });
  }
  return b.build();
}

// Reeds in clusters. Use ring: [rMin, rMax] and center to place them around a pond or mud patch.
export function createReeds({ count = 24, area = 8, seed = 6, heightAt = null, ...rest } = {}) {
  const mesh = scatterInstances(reedGeometry(seed), flatMaterial({ sway: 1.4 }), count, {
    area, seed: seed + 9, scale: [0.8, 1.4], heightAt, ...rest,
  });
  mesh.castShadow = true;
  return mesh;
}
