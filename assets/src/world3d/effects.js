// Short lived particle effects: fruit pop, dust puff, water splash, mud splash.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { patchMaterial } from './core.js';

const matCache = new Map();
function particleMaterial(hex, transparent = false) {
  const key = hex + (transparent ? 't' : '');
  if (!transparent && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.8, transparent, opacity: 1 });
  patchMaterial(m, {});
  if (!transparent) matCache.set(key, m);
  return m;
}

const ico0 = new THREE.IcosahedronGeometry(1, 0);
const ico1 = new THREE.IcosahedronGeometry(1, 1);
const tetra = new THREE.TetrahedronGeometry(1, 0);
const ringGeo = new THREE.RingGeometry(0.7, 1, 8);
ringGeo.rotateX(-Math.PI / 2);

// Create the manager once and call effects.update(dt) every frame.
export function createEffects(scene) {
  const items = [];

  function spawn(opts) {
    const m = new THREE.Mesh(opts.geo, opts.material);
    m.position.copy(opts.pos);
    m.scale.setScalar(opts.size);
    m.castShadow = false;
    scene.add(m);
    items.push({ mesh: m, vel: opts.vel || new THREE.Vector3(), life: 0, max: opts.life, grav: opts.grav ?? 0, s0: opts.size, mode: opts.mode || 'shrink', spin: opts.spin || new THREE.Vector3(), own: !!opts.own });
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const tones = (p) => [p.light, p.mid, p.shadow];

  const fx = {
    // A small pop of faceted particles when a fruit is eaten.
    fruitPop(pos, kind = 'red') {
      const pal = tones(kind === 'orange' ? PALETTE.orangeFruit : PALETTE.fruit);
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(1.2, 2.6);
        spawn({ geo: i % 2 ? tetra : ico0, material: particleMaterial(pal[i % 3]), pos, size: rand(0.03, 0.06), life: rand(0.45, 0.7), grav: 7,
          vel: new THREE.Vector3(Math.cos(a) * sp, rand(1.8, 3.4), Math.sin(a) * sp), spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), 0) });
      }
    },
    // Soft faceted clouds when he moves on dry ground.
    dustPuff(pos) {
      for (let i = 0; i < 4; i++) {
        spawn({ geo: ico1, material: particleMaterial('#EADFC8', true), pos: pos.clone().add(new THREE.Vector3(rand(-0.15, 0.15), 0.05, rand(-0.15, 0.15))),
          size: rand(0.08, 0.14), life: rand(0.6, 0.9), vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.25, 0.55), rand(-0.4, 0.4)), mode: 'puff', own: true });
      }
    },
    // Droplets and an expanding ring when he enters water.
    waterSplash(pos) {
      const pal = tones(PALETTE.shallowWater);
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(0.6, 1.8);
        spawn({ geo: ico0, material: particleMaterial(pal[i % 3]), pos, size: rand(0.03, 0.065), life: rand(0.5, 0.8), grav: 9,
          vel: new THREE.Vector3(Math.cos(a) * sp, rand(2.2, 4.2), Math.sin(a) * sp) });
      }
      spawn({ geo: ringGeo, material: particleMaterial('#E6F7FB', true), pos: pos.clone().setY(pos.y + 0.03), size: 0.2, life: 0.8, mode: 'ring', own: true });
    },
    // Dark brown lumps when he steps in mud.
    mudSplash(pos) {
      const pal = tones(PALETTE.mud);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(0.6, 1.6);
        spawn({ geo: i % 2 ? ico0 : tetra, material: particleMaterial(pal[i % 3]), pos, size: rand(0.035, 0.075), life: rand(0.45, 0.7), grav: 8,
          vel: new THREE.Vector3(Math.cos(a) * sp, rand(1.6, 3.0), Math.sin(a) * sp), spin: new THREE.Vector3(rand(-6, 6), rand(-6, 6), 0) });
      }
    },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.life += dt;
        const k = it.life / it.max;
        if (k >= 1) {
          scene.remove(it.mesh);
          if (it.own) it.mesh.material.dispose();
          items.splice(i, 1);
          continue;
        }
        it.vel.y -= it.grav * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
        it.mesh.rotation.x += it.spin.x * dt;
        it.mesh.rotation.y += it.spin.y * dt;
        if (it.mode === 'shrink') it.mesh.scale.setScalar(Math.max(0.0001, it.s0 * (1 - k * k)));
        else if (it.mode === 'puff') {
          it.vel.multiplyScalar(0.97);
          it.mesh.scale.setScalar(it.s0 * (0.7 + 2.2 * k));
          it.mesh.material.opacity = 0.65 * (1 - k);
        } else if (it.mode === 'ring') {
          it.mesh.scale.setScalar(it.s0 + k * 1.1);
          it.mesh.material.opacity = 0.9 * (1 - k);
        }
      }
    },
    count: () => items.length,
  };
  return fx;
}
