// Low poly fruit: single pickups and fruit lying at the base of trees.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { Builder, flatMaterial, writePlacements, rng } from './core.js';

export function fruitGeometry(kind = 'red', seed = 1) {
  const palette = kind === 'orange' ? PALETTE.orangeFruit : PALETTE.fruit;
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(0.13, 1), { palette, pos: [0, 0.12, 0], scale: [1, 0.92, 1], jitter: 0.012, seed, vary: 0.03 });
  b.add(new THREE.ConeGeometry(0.014, 0.07, 4, 1), { palette: PALETTE.trunk, pos: [0, 0.255, 0], rot: [0.15, 0, 0.1], vary: 0.01 });
  b.add(new THREE.OctahedronGeometry(1, 0), { palette: PALETTE.foliage, pos: [0.04, 0.26, 0], scale: [0.045, 0.008, 0.022], rot: [0, 0, 0.35], vary: 0.02 });
  return b.build();
}

const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// One pickup. mesh.userData.api: spawn(seconds), eat(effects), update(dt)
export function createFruit({ kind = 'red', seed = 1, spawnNow = false } = {}) {
  const mesh = new THREE.Mesh(fruitGeometry(kind, seed), flatMaterial());
  mesh.castShadow = true;
  const st = { t: 1, dur: 0.6, eaten: false, time: 0 };
  const api = {
    spawn(seconds = 0.6) { st.t = 0; st.dur = seconds; st.eaten = false; mesh.visible = true; mesh.scale.setScalar(0.0001); },
    eat(effects) {
      if (st.eaten) return;
      st.eaten = true;
      const p = mesh.getWorldPosition(new THREE.Vector3());
      p.y += 0.12;
      if (effects) effects.fruitPop(p, kind);
      mesh.visible = false;
    },
    update(dt) {
      if (st.eaten) return;
      st.time += dt;
      if (st.t < 1) {
        st.t = Math.min(1, st.t + dt / st.dur);
        mesh.scale.setScalar(Math.max(0.0001, easeOutBack(st.t)));
      }
      mesh.rotation.y += dt * 0.8;
    },
  };
  mesh.userData.api = api;
  mesh.userData.kind = 'fruit';
  if (spawnNow) api.spawn();
  return mesh;
}

// Red and orange fruit lying at the foot of each tree in a tree field (InstancedMesh with placements).
// group.userData: spawnAll(seconds), eat(index, effects), update(dt)
export function createFruitAtTrees(treeField, { perTree = 2, ring = 1.15, seed = 5 } = {}) {
  const r = rng(seed);
  const group = new THREE.Group();
  const kinds = ['red', 'orange'];
  const meshes = kinds.map((k, i) => {
    const m = new THREE.InstancedMesh(fruitGeometry(k, i), flatMaterial(), treeField.userData.placements.length * perTree);
    m.castShadow = true;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  const items = [[], []];
  treeField.userData.placements.forEach((p) => {
    for (let i = 0; i < perTree; i++) {
      const a = r() * Math.PI * 2, d = (ring + r() * 0.5) * p.s;
      const which = r() < 0.6 ? 0 : 1;
      items[which].push({ x: p.x + Math.cos(a) * d, y: p.y, z: p.z + Math.sin(a) * d, s: 0.9 + r() * 0.3, yaw: r() * 6.28, grow: 1, eaten: false });
    }
  });
  meshes.forEach((m, k) => { m.count = items[k].length; });
  const rewrite = () => meshes.forEach((m, k) => writePlacements(m, items[k], (p) => (p.eaten ? 0 : p.s * Math.max(0.0001, easeOutBack(p.grow)))));
  rewrite();
  let growing = false, dur = 0.7;
  group.userData.spawnAll = (seconds = 0.7) => { items.forEach((l) => l.forEach((p) => { p.grow = 0; p.eaten = false; })); growing = true; dur = seconds; };
  group.userData.eat = (kind, index, effects) => {
    const p = items[kind][index];
    if (!p || p.eaten) return;
    p.eaten = true;
    if (effects) effects.fruitPop(new THREE.Vector3(p.x, p.y + 0.12, p.z), kinds[kind]);
    rewrite();
  };
  group.userData.items = items;
  group.userData.update = (dt) => {
    if (!growing) return;
    let any = false;
    items.forEach((l) => l.forEach((p, i) => {
      if (p.grow < 1) { p.grow = Math.min(1, p.grow + dt / dur); any = true; }
    }));
    rewrite();
    growing = any;
  };
  return group;
}
