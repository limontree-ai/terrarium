// Rocks, boulders, cliffs, logs, snow mounds, ice plates, ice crystals and icebergs, moon boulders.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { Builder, flatMaterial, glossyMaterial, scatterInstances, rng } from './core.js';

/* ------------------------------------------------------------------ */
/* Stones                                                              */
/* ------------------------------------------------------------------ */
export function smallRockGeometry(seed = 1, palette = PALETTE.rock) {
  const r = rng(seed);
  return new Builder()
    .add(new THREE.IcosahedronGeometry(0.28, 1), {
      palette, pos: [0, 0.14, 0], scale: [1, 0.62 + r() * 0.15, 0.85 + r() * 0.2], jitter: 0.06, seed, vary: 0.04,
    })
    .build();
}

export function boulderGeometry(seed = 1, palette = PALETTE.rock) {
  const r = rng(seed);
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(0.95, 1), { palette, pos: [0, 0.65, 0], scale: [1.05, 0.78, 0.95], jitter: 0.2, seed, vary: 0.04 });
  b.add(new THREE.IcosahedronGeometry(0.5, 1), { palette, pos: [0.85, 0.3, 0.3 * (r() - 0.5) * 2], scale: [1, 0.7, 0.9], jitter: 0.1, seed: seed + 2, vary: 0.04 });
  b.add(new THREE.IcosahedronGeometry(0.35, 0), { palette, pos: [-0.7, 0.2, 0.6], scale: [1, 0.75, 1], jitter: 0.06, seed: seed + 3, vary: 0.04 });
  return b.build();
}

export function cliffGeometry(seed = 1, palette = PALETTE.rock) {
  const r = rng(seed);
  const b = new Builder();
  let y = 0;
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const rad = 1.7 - i * 0.28 + r() * 0.2;
    const h = 1.1 + r() * 0.5;
    b.add(new THREE.CylinderGeometry(rad * 0.88, rad, h, 6, 1), {
      palette, pos: [(r() - 0.5) * 0.4, y + h / 2, (r() - 0.5) * 0.4], rot: [0, r() * 3, 0], jitter: 0.18, seed: seed * 9 + i, vary: 0.05,
    });
    y += h * 0.9;
  }
  // a small second spire
  b.add(new THREE.CylinderGeometry(0.45, 0.8, 2.6, 5, 1), { palette, pos: [1.5, 1.3, 0.4], jitter: 0.12, seed: seed + 40, vary: 0.05 });
  b.add(new THREE.ConeGeometry(0.45, 0.8, 5, 1), { palette, pos: [1.5, 3.0, 0.4], jitter: 0.06, seed: seed + 41, vary: 0.05 });
  return b.build();
}

export const createSmallRock = ({ seed = 1 } = {}) => makeFromGeo(smallRockGeometry(seed));
export const createBoulder = ({ seed = 1 } = {}) => makeFromGeo(boulderGeometry(seed));
// variant 'rock' (gray) or 'dirt' (brown)
export const createCliffChunk = ({ seed = 1, variant = 'rock' } = {}) =>
  makeFromGeo(cliffGeometry(seed, variant === 'dirt' ? PALETTE.dirt : PALETTE.rock));
export const createMoonBoulder = ({ seed = 1 } = {}) => makeFromGeo(boulderGeometry(seed, PALETTE.moonDust));

function makeFromGeo(geo, material = flatMaterial({ snowCap: true })) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* Log                                                                 */
/* ------------------------------------------------------------------ */
export function logGeometry(seed = 1) {
  const L = 1.7, R = 0.26;
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(R, R * 1.04, L, 7, 1, true), {
    palette: PALETTE.trunk, pos: [0, R, 0], rot: [0, 0, Math.PI / 2], jitter: 0.008, seed, vary: 0.05,
  });
  // lighter cut ends with an inner ring
  for (const s of [-1, 1]) {
    const x = (s * L) / 2 + s * 0.002;
    b.add(new THREE.CircleGeometry(R * 1.02, 7), { palette: PALETTE.cutWood, pos: [x, R, 0], rot: [0, s * Math.PI / 2, 0], vary: 0.02 });
    b.add(new THREE.CircleGeometry(R * 0.55, 7), { palette: { light: '#D9AE79', mid: '#C99A63', shadow: '#B8895C' }, pos: [x + s * 0.004, R, 0], rot: [0, s * Math.PI / 2, 0], vary: 0.02 });
    b.add(new THREE.CircleGeometry(R * 0.2, 5), { palette: { light: '#B8895C', mid: '#A87A50', shadow: '#8E6440' }, pos: [x + s * 0.008, R, 0], rot: [0, s * Math.PI / 2, 0], vary: 0.01 });
  }
  return b.build();
}
export const createLog = ({ seed = 1 } = {}) => makeFromGeo(logGeometry(seed));

/* ------------------------------------------------------------------ */
/* Snow and ice                                                        */
/* ------------------------------------------------------------------ */
export function snowMoundGeometry(seed = 1) {
  return new Builder()
    .add(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), {
      palette: PALETTE.snow, scale: [1.25, 0.55, 1.05], jitter: 0.07, seed, vary: 0.02,
    })
    .build();
}
export const createSnowMound = ({ seed = 1 } = {}) => {
  const m = makeFromGeo(snowMoundGeometry(seed), flatMaterial({ roughness: 0.7 }));
  return m;
};

export function icePlateGeometry(seed = 1) {
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(1.35, 1.45, 0.14, 8, 1), { palette: PALETTE.ice, pos: [0, 0.07, 0], jitter: 0.07, seed, vary: 0.03 });
  const r = rng(seed + 3);
  for (let k = 0; k < 5; k++) {
    let x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.6, ang = r() * 6.28;
    const L = [], R = [];
    for (let s = 0; s < 6; s++) {
      const w = 0.025;
      L.push([x - Math.sin(ang) * w, 0.145, z + Math.cos(ang) * w]);
      R.push([x + Math.sin(ang) * w, 0.145, z - Math.cos(ang) * w]);
      ang += (r() - 0.5) * 1.0;
      x += Math.cos(ang) * 0.3; z += Math.sin(ang) * 0.3;
      if (Math.hypot(x, z) > 1.25) break;
    }
    if (L.length > 1) b.addStrip(L, R, { palette: PALETTE.crack, vary: 0 });
  }
  return b.build();
}
export const createIcePlate = ({ seed = 1 } = {}) => makeFromGeo(icePlateGeometry(seed), glossyMaterial({ roughness: 0.12 }));

function crystal(b, { x = 0, z = 0, h = 2, r = 0.3, tiltX = 0, tiltZ = 0, seed = 1 }) {
  const body = h * 0.62, tip = h * 0.38;
  const rot = [tiltX, seed, tiltZ];
  // The prism and the cone tip share one tilt so they stay joined.
  const c = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(tiltX, seed, tiltZ));
  b.add(new THREE.CylinderGeometry(r * 0.92, r, body, 6, 1), { palette: PALETTE.ice, pos: [x + c.x * body / 2, c.y * body / 2, z + c.z * body / 2], rot, jitter: 0.01, seed, vary: 0.03 });
  b.add(new THREE.ConeGeometry(r * 0.92, tip, 6, 1), { palette: PALETTE.ice, pos: [x + c.x * (body + tip / 2), c.y * (body + tip / 2), z + c.z * (body + tip / 2)], rot, jitter: 0.01, seed: seed + 1, vary: 0.03 });
}

export function iceCrystalGeometry(seed = 1) {
  const r = rng(seed);
  const b = new Builder();
  const n = 3 + Math.floor(r() * 4);
  crystal(b, { h: 2.4 + r() * 0.8, r: 0.32, tiltX: (r() - 0.5) * 0.15, tiltZ: (r() - 0.5) * 0.15, seed });
  for (let i = 1; i < n; i++) {
    const a = r() * 6.28, d = 0.35 + r() * 0.35;
    crystal(b, { x: Math.cos(a) * d, z: Math.sin(a) * d, h: 1.0 + r() * 1.3, r: 0.16 + r() * 0.1, tiltX: Math.sin(a) * 0.35, tiltZ: -Math.cos(a) * 0.35, seed: seed + i * 3 });
  }
  return b.build();
}
export const createIceCrystal = ({ seed = 1 } = {}) => makeFromGeo(iceCrystalGeometry(seed), glossyMaterial({ roughness: 0.18, clearcoat: 0.8 }));

export function icebergGeometry(seed = 1) {
  const r = rng(seed);
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(1.7, 1), { palette: PALETTE.ice, pos: [0, 0.2, 0], scale: [1.3, 0.55, 1.1], jitter: 0.2, seed, vary: 0.03 });
  crystal(b, { x: -0.2, z: 0, h: 5.2, r: 0.7, tiltX: 0.04, tiltZ: 0.05, seed });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.28 + r(), d = 0.9 + r() * 0.5;
    crystal(b, { x: Math.cos(a) * d, z: Math.sin(a) * d, h: 2 + r() * 2.2, r: 0.3 + r() * 0.2, tiltX: Math.sin(a) * 0.3, tiltZ: -Math.cos(a) * 0.3, seed: seed + i * 5 });
  }
  return b.build();
}
export const createIceberg = ({ seed = 1 } = {}) => makeFromGeo(icebergGeometry(seed), glossyMaterial({ roughness: 0.2, clearcoat: 0.8 }));

/* ------------------------------------------------------------------ */
/* Instanced fields                                                    */
/* ------------------------------------------------------------------ */
const FIELDS = {
  smallRock: { geo: smallRockGeometry, scale: [0.6, 1.6] },
  boulder: { geo: boulderGeometry, scale: [0.7, 1.3] },
  cliff: { geo: cliffGeometry, scale: [0.9, 1.4] },
  moonBoulder: { geo: (s) => boulderGeometry(s, PALETTE.moonDust), scale: [0.7, 1.3] },
  iceCrystal: { geo: iceCrystalGeometry, scale: [0.6, 1.3], glossy: true },
  snowMound: { geo: snowMoundGeometry, scale: [0.6, 1.4] },
  log: { geo: logGeometry, scale: [0.8, 1.2] },
};

// kind: smallRock | boulder | cliff | moonBoulder | iceCrystal | snowMound | log
export function createRockField({ kind = 'smallRock', count = 20, area = 20, seed = 1, heightAt = null, ...rest } = {}) {
  const f = FIELDS[kind];
  const material = f.glossy ? glossyMaterial({ roughness: 0.18, clearcoat: 0.8 }) : flatMaterial({ snowCap: true });
  return scatterInstances(f.geo(seed), material, count, { area, seed: seed + 77, scale: f.scale, heightAt, ...rest });
}
