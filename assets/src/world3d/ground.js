// Ground: terrain shapes, ground materials, snow layer, mud puddles.
import * as THREE from 'three';
import { PALETTE, colorsOf } from './palette.js';
import {
  Builder, flatMaterial, glossyMaterial, patchMaterial, toneColor, hash3, rng,
} from './core.js';

export const TERRAIN_SHAPES = ['flat', 'hills', 'steps', 'gap'];

export const GROUND_STYLES = {
  grass: { palette: PALETTE.grass, steep: PALETTE.dirt, vary: 0.07 },
  sand: { palette: PALETTE.sand, steep: { light: '#DDBB62', mid: '#CFA653', shadow: '#B08A3E' }, vary: 0.04 },
  ice: { palette: PALETTE.ice, steep: PALETTE.ice, vary: 0.04, glossy: true, cracks: true },
  mud: { palette: PALETTE.mud, steep: { light: '#7A5638', mid: '#5E412B', shadow: '#40291B' }, vary: 0.04, wet: true },
  moonDust: { palette: PALETTE.moonDust, steep: { light: '#C5B2B4', mid: '#A58E92', shadow: '#7C676C' }, vary: 0.04, craters: true },
};

export const GROUND_NAMES = Object.keys(GROUND_STYLES);

/* ------------------------------------------------------------------ */
/* Height functions                                                    */
/* ------------------------------------------------------------------ */
function baseHeight(shape, x, z) {
  switch (shape) {
    case 'hills':
      return 1.3 * Math.sin(x * 0.16) * Math.cos(z * 0.13) + 0.7 * Math.sin(x * 0.07 + z * 0.1 + 1.0) + 0.25 * Math.sin(x * 0.4 + z * 0.33);
    case 'steps': {
      const k = Math.floor((x + 40) / 5);
      return Math.max(-0.2, Math.min(3, (k - 4) * 0.45));
    }
    case 'gap':
      return Math.abs(x) < 1.6 ? -3.2 : Math.abs(x) < 2.6 ? -1.0 : 0;
    default:
      return 0;
  }
}

function makeCraters(size, seed) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < 9; i++) {
    list.push({ x: (r() - 0.5) * size * 0.8, z: (r() - 0.5) * size * 0.8, r: 2.5 + r() * 3.5, d: 0.4 + r() * 0.6 });
  }
  return list;
}

function craterOffset(list, x, z) {
  let h = 0;
  for (const c of list) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r) h -= c.d * (1 - (d / c.r) ** 2);
    else if (d < c.r * 1.4) h += 0.12 * (1 - (d - c.r) / (c.r * 0.4));
  }
  return h;
}

/* ------------------------------------------------------------------ */
/* Grid mesh builder (flat facets)                                     */
/* ------------------------------------------------------------------ */
// H is a (n+1)*(n+1) array of heights, index i * (n+1) + j with x from i and z from j.
export function buildGridGeometry({ n, cell, H, palette, steep = palette, vary = 0.05, seed = 1, holes = null }) {
  const half = (n * cell) / 2;
  const pos = [], nor = [], col = [], up = [];
  const colors = colorsOf(palette), steepColors = colorsOf(steep);
  const V = (i, j) => [-half + i * cell, H[i * (n + 1) + j], -half + j * cell];
  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const tri = (p, q, r) => {
    a.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    b.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
    tmp.crossVectors(a, b).normalize();
    const j = hash3(p[0] + q[0] + r[0], p[1] + q[1] + r[1], p[2] + q[2] + r[2], seed);
    const c = toneColor(tmp.y < 0.72 ? steepColors : colors, tmp.x, tmp.y, tmp.z, j, vary);
    for (const v of [p, q, r]) {
      pos.push(v[0], v[1], v[2]);
      nor.push(tmp.x, tmp.y, tmp.z);
      col.push(c.r, c.g, c.b);
      up.push(Math.max(0, tmp.y));
    }
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (holes) {
        const cx = -half + (i + 0.5) * cell, cz = -half + (j + 0.5) * cell;
        if (holes.some((h) => (cx - h.x) ** 2 + (cz - h.z) ** 2 < h.r * h.r)) continue;
      }
      const p00 = V(i, j), p10 = V(i + 1, j), p01 = V(i, j + 1), p11 = V(i + 1, j + 1);
      if ((i + j) % 2 === 0) {
        tri(p00, p01, p11);
        tri(p00, p11, p10);
      } else {
        tri(p00, p01, p10);
        tri(p10, p01, p11);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aUp', new THREE.Float32BufferAttribute(up, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// Exact height of the faceted surface at x, z (matches the triangulation above).
export function gridHeightAt({ n, cell, H }, x, z) {
  const half = (n * cell) / 2;
  const fx = (x + half) / cell, fz = (z + half) / cell;
  if (fx < 0 || fz < 0 || fx > n || fz > n) return 0;
  const i = Math.min(n - 1, Math.floor(fx)), j = Math.min(n - 1, Math.floor(fz));
  const u = fx - i, v = fz - j;
  const h = (a, b) => H[a * (n + 1) + b];
  const h00 = h(i, j), h10 = h(i + 1, j), h01 = h(i, j + 1), h11 = h(i + 1, j + 1);
  if ((i + j) % 2 === 0) {
    if (v >= u) return (1 - v) * h00 + (v - u) * h01 + u * h11;
    return (1 - u) * h00 + v * h11 + (u - v) * h10;
  }
  if (u + v <= 1) return (1 - u - v) * h00 + v * h01 + u * h10;
  return (u + v - 1) * h11 + (1 - v) * h10 + (1 - u) * h01;
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */
function crackMaterial() {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  return patchMaterial(m, {});
}

function groundMaterial(style) {
  if (style.glossy) return glossyMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
  if (style.wet) return glossyMaterial({ roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35 });
  return flatMaterial({ roughness: 0.95 });
}

// createTerrain({ shape, ground, size }) returns a Mesh.
// mesh.userData: heightAt(x, z), setShape(name), setGround(name), grid, size
// holes: [{ x, z, r }] leaves openings, useful where a lake basin sits in the ground.
export function createTerrain({ shape = 'flat', ground = 'grass', size = 48, seed = 3, holes = null } = {}) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), flatMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  const crackMesh = new THREE.Mesh(new THREE.BufferGeometry(), crackMaterial());
  crackMesh.receiveShadow = true;
  mesh.add(crackMesh);

  const state = { shape, ground, grid: null };

  function rebuild() {
    const style = GROUND_STYLES[state.ground];
    let cell = 3;
    if (state.shape === 'hills') cell = 2.5;
    else if (state.shape === 'steps' || state.shape === 'gap') cell = 1;
    else if (style.craters) cell = 1.5;
    if (style.craters && state.shape !== 'flat') cell = Math.min(cell, 1.25);
    const n = Math.round(size / cell);
    const craters = style.craters ? makeCraters(size, seed) : null;
    const H = new Float32Array((n + 1) * (n + 1));
    const half = (n * cell) / 2;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = -half + i * cell, z = -half + j * cell;
        let h = baseHeight(state.shape, x, z);
        if (craters) h += craterOffset(craters, x, z);
        H[i * (n + 1) + j] = h;
      }
    }
    state.grid = { n, cell, H };
    mesh.geometry.dispose();
    mesh.geometry = buildGridGeometry({ n, cell, H, palette: style.palette, steep: style.steep, vary: style.vary, seed, holes });
    mesh.material = groundMaterial(style);

    // ice cracks: thin white strips following random walks over the surface
    crackMesh.geometry.dispose();
    crackMesh.visible = !!style.cracks;
    if (style.cracks) {
      const r = rng(seed + 5);
      const b = new Builder();
      for (let k = 0; k < 9; k++) {
        let x = (r() - 0.5) * size * 0.8, z = (r() - 0.5) * size * 0.8, ang = r() * Math.PI * 2;
        const L = [], R = [];
        const w = 0.05 + r() * 0.04;
        for (let s = 0; s < 14; s++) {
          const nx = -Math.sin(ang), nz = Math.cos(ang);
          const y = gridHeightAt(state.grid, x, z) + 0.04;
          L.push([x + nx * w, y, z + nz * w]);
          R.push([x - nx * w, y, z - nz * w]);
          ang += (r() - 0.5) * 0.9;
          x += Math.cos(ang) * 0.9;
          z += Math.sin(ang) * 0.9;
        }
        b.addStrip(L, R, { palette: PALETTE.snow, vary: 0 });
      }
      crackMesh.geometry = b.build();
    }
    mesh.userData.grid = state.grid;
  }

  mesh.userData.size = size;
  mesh.userData.heightAt = (x, z) => gridHeightAt(state.grid, x, z);
  mesh.userData.setShape = (s) => { if (s !== state.shape) { state.shape = s; rebuild(); } };
  mesh.userData.setGround = (g) => { if (g !== state.ground) { state.ground = g; rebuild(); } };
  mesh.userData.getState = () => ({ shape: state.shape, ground: state.ground });
  rebuild();
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Snow layer                                                          */
/* ------------------------------------------------------------------ */
// Thick faceted white layer on top of a terrain. layer.userData.setDepth(0..0.3)
export function createSnowLayer(terrain) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), flatMaterial({ roughness: 0.75 }));
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  let lastKey = '';
  mesh.userData.setDepth = (d) => {
    d = THREE.MathUtils.clamp(d, 0, 0.3);
    mesh.visible = d > 0.004;
    const grid = terrain.userData.grid;
    const key = `${d.toFixed(3)}|${grid.n}|${grid.cell}|${grid.H[3]}|${grid.H[grid.H.length >> 1]}`;
    if (!mesh.visible || key === lastKey) return;
    lastKey = key;
    const { n, cell, H } = grid;
    const H2 = new Float32Array(H.length);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const k = i * (n + 1) + j;
        H2[k] = H[k] + d * (0.62 + 0.38 * hash3(i, 0, j, 4)) + 0.002;
      }
    }
    mesh.geometry.dispose();
    mesh.geometry = buildGridGeometry({ n, cell, H: H2, palette: PALETTE.snow, steep: PALETTE.snow, vary: 0.02, seed: 7 });
  };
  mesh.userData.invalidate = () => { lastKey = ''; };
  mesh.userData.setDepth(0);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Mud puddles                                                         */
/* ------------------------------------------------------------------ */
const PUDDLE = { light: '#5A3D2A', mid: '#46301F', shadow: '#33220F' };

// Flat dark brown patches. group.userData.setAmount(0..1) spreads them.
export function createMudPuddles({ count = 14, area = 18, seed = 11, heightAt = null } = {}) {
  const group = new THREE.Group();
  const r = rng(seed);
  const geo = new Builder().add(new THREE.CylinderGeometry(1, 1.05, 0.05, 8, 1), { palette: PUDDLE, jitter: 0.16, seed, vary: 0.02 }).build();
  const mat = glossyMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.2 });
  const items = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * area;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    m.position.set(x, (heightAt ? heightAt(x, z) : 0) + 0.03, z);
    m.rotation.y = r() * Math.PI;
    m.userData.base = 0.7 + r() * 1.1;
    m.userData.threshold = i / count;
    m.receiveShadow = true;
    group.add(m);
    items.push(m);
  }
  group.userData.setAmount = (amount) => {
    const a = THREE.MathUtils.clamp(amount, 0, 1);
    items.forEach((m) => {
      const k = THREE.MathUtils.clamp((a - m.userData.threshold * 0.8) / 0.35, 0, 1);
      m.visible = k > 0.001;
      const s = m.userData.base * k * (0.6 + a * 0.9);
      m.scale.set(s, 1, s);
    });
  };
  group.userData.reseat = (fn) => items.forEach((m) => { m.position.y = fn(m.position.x, m.position.z) + 0.03; });
  group.userData.setAmount(0);
  return group;
}
