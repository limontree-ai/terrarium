import { describe, it, expect } from "vitest";
import * as THREE from "three";
import seedrandom from "seedrandom";
import { createScene, updateWorldVisuals, setCurveCenter } from "../world3d/scene.js";
import {
  createCreatureMesh,
  updateCreatureMesh,
  morphCreature,
  updateMorphAnimation,
} from "../world3d/creature.js";
import { SmoothCamera } from "../world3d/camera.js";
import { startGenome } from "../blob/genome.js";
import { mutateBody } from "../blob/mutate.js";

function limbedGenome() {
  const rng = seedrandom("world3d");
  let genome = startGenome();
  while (genome.limbs.length < 2) genome = mutateBody(genome, rng);
  return genome;
}

describe("World3D scene", () => {
  it("falls back to a no-op renderer without WebGL", () => {
    const state = createScene(800, 600);
    expect(state.renderer.isNullRenderer).toBe(true);
    expect(() => state.renderer.render(state.scene, state.camera)).not.toThrow();
  });

  it("puts the water surface at the physics water height", () => {
    const state = createScene(800, 600);
    expect(state.water.visible).toBe(false);
    updateWorldVisuals(state, { waterLevel: 0.3 });
    expect(state.water.visible).toBe(true);
    expect(state.water.position.y).toBeCloseTo(3);
    expect(state.groundMat.uniforms.waterLevel.value).toBeCloseTo(3);
  });

  it("whitens the ground with snow and dims the sun at night", () => {
    const state = createScene(800, 600);
    const grass = state.groundMat.uniforms.baseColor.value.clone();
    updateWorldVisuals(state, { snowDepth: 0.3, timeOfDay: "night" });
    const snowy = state.groundMat.uniforms.baseColor.value;
    expect(snowy.r).toBeGreaterThan(grass.r);
    expect(state.scene.getObjectByName("sun").color.getHex()).toBe(0x445588);
  });

  it("centers the planet curve on the creature", () => {
    const state = createScene(800, 600);
    setCurveCenter(state, { x: 4, y: 1, z: -2 });
    expect(state.curveUniforms.curveCenter.value.toArray()).toEqual([4, 0, -2]);
    expect(state.groundMat.uniforms.curveCenter).toBe(state.curveUniforms.curveCenter);
  });
});

describe("World3D creature", () => {
  it("has one jelly part per physics body and a glow per joint", () => {
    const genome = limbedGenome();
    const segments = genome.limbs.reduce((n, l) => n + l.segments.length, 0);
    const mesh = createCreatureMesh(genome);
    expect(mesh.parts).toHaveLength(2 + segments);
    expect(mesh.joints).toHaveLength(Math.min(8, 1 + segments));
    expect(mesh.eyes).toHaveLength(2);
  });

  it("follows physics body states and lights joints by motor output", () => {
    const mesh = createCreatureMesh(limbedGenome());
    const states = mesh.parts.map((_, i) => ({
      position: { x: i, y: 1, z: 2 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    }));
    const outputs = mesh.joints.map((_, i) => (i === 0 ? 1 : 0));
    updateCreatureMesh(mesh, states, outputs, 0);
    expect(mesh.parts[1].position.x).toBe(1);
    expect(mesh.joints[0].visible).toBe(true);
    expect(mesh.joints[1].visible).toBe(false);
  });

  it("morphs part sizes from the old genome to the new one", () => {
    const oldGenome = startGenome();
    const newGenome = { ...oldGenome, core: { sizeA: 0.6, sizeB: 0.4 } };
    const mesh = createCreatureMesh(newGenome);
    morphCreature(mesh, oldGenome, newGenome, 10);
    const start = mesh.morphStartTime;
    expect(mesh.parts[0].jelly.scale.x).toBeCloseTo(0.2 * 1.15);
    updateMorphAnimation(mesh, start + 5000);
    expect(mesh.parts[0].jelly.scale.x).toBeCloseTo(0.25 * 1.15);
    updateMorphAnimation(mesh, start + 10000);
    expect(mesh.parts[0].jelly.scale.x).toBeCloseTo(0.3 * 1.15);
    expect(mesh.morphStartTime).toBeNull();
  });
});

describe("World3D camera", () => {
  it("settles behind and above the creature", () => {
    const camera = new THREE.PerspectiveCamera();
    const smooth = new SmoothCamera(camera);
    for (let i = 0; i < 200; i++) {
      smooth.updateTarget(new THREE.Vector3(10, 0, 0), 0);
      smooth.update();
    }
    expect(camera.position.x).toBeCloseTo(8);
    expect(camera.position.y).toBeCloseTo(2);
    expect(camera.position.z).toBeCloseTo(0);
  });
});
