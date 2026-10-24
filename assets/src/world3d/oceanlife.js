import * as THREE from "three";
import { Builder, flatMaterial, scatterInstances } from "./core.js";
import { PALETTE } from "./palette.js";

// Underwater scenery for the ocean biome: coral, brain coral, kelp and shells.
// Visual only; built from the asset library's Builder and instancing helpers.

const CORAL_COLORS = {
  pink: { light: "#FFA9C0", mid: "#F26B8A", shadow: "#C94A6B" },
  orange: { light: "#FFB98A", mid: "#FF8A4C", shadow: "#D96430" },
  purple: { light: "#CDA6F2", mid: "#9E6FD6", shadow: "#7348A8" },
  yellow: { light: "#FFF08A", mid: "#FFD23D", shadow: "#E0A82A" },
};

function branchingCoralGeometry(palette, seed) {
  const b = new Builder();
  const r = (i) => {
    const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const branches = 5 + Math.floor(r(1) * 3);
  b.add(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 6), { palette, pos: [0, 0.25, 0], seed, jitter: 0.02 });
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + r(i + 2);
    const tilt = 0.45 + r(i + 9) * 0.5;
    const len = 0.5 + r(i + 20) * 0.5;
    const x = Math.cos(a) * Math.sin(tilt) * len * 0.5;
    const z = Math.sin(a) * Math.sin(tilt) * len * 0.5;
    b.add(new THREE.CylinderGeometry(0.045, 0.08, len, 5), {
      palette,
      pos: [x, 0.45 + Math.cos(tilt) * len * 0.5, z],
      rot: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt],
      seed: seed + i,
      jitter: 0.015,
    });
    b.add(new THREE.IcosahedronGeometry(0.085, 0), {
      palette,
      pos: [x * 2, 0.45 + Math.cos(tilt) * len, z * 2],
      seed: seed + i + 40,
    });
  }
  return b.build();
}

function brainCoralGeometry(palette, seed) {
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(0.4, 1), { palette, pos: [0, 0.18, 0], scale: [1, 0.6, 1], jitter: 0.05, seed });
  b.add(new THREE.IcosahedronGeometry(0.22, 1), { palette, pos: [0.32, 0.1, 0.1], scale: [1, 0.6, 1], jitter: 0.04, seed: seed + 1 });
  return b.build();
}

function kelpGeometry(seed) {
  const b = new Builder();
  for (let i = 0; i < 3; i++) {
    const h = 1.3 + i * 0.25;
    b.add(new THREE.ConeGeometry(0.07, h, 4), {
      palette: PALETTE.seaweed,
      pos: [(i - 1) * 0.12, h / 2, (i % 2) * 0.1],
      seed: seed + i,
      jitter: 0.01,
    });
  }
  return b.build();
}

function shellGeometry(seed) {
  const b = new Builder();
  b.add(new THREE.SphereGeometry(0.12, 6, 4), { palette: PALETTE.foam, pos: [0, 0.05, 0], scale: [1, 0.45, 0.8], jitter: 0.01, seed });
  return b.build();
}

/**
 * Group of instanced underwater scenery. Shown when the world is flooded.
 */
export function createOceanLife({ area = 110, exclude = null } = {}) {
  const group = new THREE.Group();
  const solid = flatMaterial();
  const fields = [
    scatterInstances(branchingCoralGeometry(CORAL_COLORS.pink, 3), solid, 90, { area, seed: 31, scale: [0.9, 1.7], exclude }),
    scatterInstances(branchingCoralGeometry(CORAL_COLORS.orange, 5), solid, 90, { area, seed: 32, scale: [0.9, 1.7], exclude }),
    scatterInstances(branchingCoralGeometry(CORAL_COLORS.purple, 7), solid, 80, { area, seed: 33, scale: [0.9, 1.6], exclude }),
    scatterInstances(brainCoralGeometry(CORAL_COLORS.yellow, 9), solid, 70, { area, seed: 34, scale: [1, 2], exclude }),
    scatterInstances(brainCoralGeometry(CORAL_COLORS.pink, 11), solid, 60, { area, seed: 35, scale: [1, 2], exclude }),
    scatterInstances(kelpGeometry(13), flatMaterial({ kelp: 1.6, side: THREE.DoubleSide }), 220, { area, seed: 36, scale: [0.9, 1.8], exclude }),
    scatterInstances(shellGeometry(15), solid, 140, { area, seed: 37, scale: [0.8, 1.6], exclude }),
  ];
  fields.forEach((f) => group.add(f));
  group.visible = false;
  return group;
}
