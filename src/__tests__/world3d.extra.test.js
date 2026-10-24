import { describe, it, expect } from "vitest";
import * as THREE from "three";
import fs from "node:fs";
import path from "node:path";
import seedrandom from "seedrandom";
import { createScene, updateWorldVisuals, setTrees, setFood, updateWorld } from "../world3d/scene.js";
import { createBlobView, setBlobGenome, updateBlobView, blobVisualParams } from "../world3d/blob-view.js";
import { SmoothCamera } from "../world3d/camera.js";
import { startGenome } from "../blob/genome.js";
import { mutateBody, traitsOf } from "../blob/mutate.js";
import { WORLD_DEFAULTS, DISPLAY } from "../config.js";
import { waterSurfaceY } from "../physics/forces.js";

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

  it("puts the asset lake surface at the physics water height", () => {
    const state = createScene(800, 600);
    updateWorldVisuals(state, { ...WORLD_DEFAULTS });
    expect(state.lake.visible).toBe(false);
    const settings = { ...WORLD_DEFAULTS, waterLevel: 0.5 };
    updateWorldVisuals(state, settings);
    expect(state.lake.visible).toBe(true);
    expect(state.lake.position.y + state.lake.userData.getWaterY()).toBeCloseTo(waterSurfaceY(settings));
  });

  it("switches ground, biome and time of day from settings", () => {
    const state = createScene(800, 600);
    updateWorldVisuals(state, { ...WORLD_DEFAULTS, groundType: "moondust", gravity: 0.16, timeOfDay: "night" });
    expect(state.terrain.userData.getState?.().ground ?? state.ground).toBe("moonDust");
    expect(state.sky.biome).toBe("moon");
    expect(state.sky.time).toBe(0.5);
    expect(state.decor.moonBoulder.visible).toBe(true);
  });

  it("places tree assets on the physics tree positions and moves the fruit to the food", () => {
    const state = createScene(800, 600);
    updateWorldVisuals(state, { ...WORLD_DEFAULTS });
    setTrees(state, [{ x: 3, y: 0, z: 4 }, { x: -5, y: 0, z: 1 }]);
    expect(state.trees.count).toBe(2);
    const m = new THREE.Matrix4();
    state.trees.getMatrixAt(1, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBeCloseTo(-5);
    setFood(state, { x: 2, y: 0.5, z: 1 });
    expect(state.food.position.x).toBe(2);
    expect(() => updateWorld(state, 1 / 60, { x: 0, y: 0.3, z: 0 })).not.toThrow();
  });

  it("builds every visible object from the asset library", () => {
    const dirs = ["src/world3d", "src/ui"].map((d) => path.resolve(__dirname, "..", "..", d));
    for (const dir of dirs) {
      for (const file of fs.readdirSync(dir)) {
        const src = fs.readFileSync(path.join(dir, file), "utf8");
        expect(src, file).not.toMatch(/new THREE\.(\w+Geometry|Mesh\w*Material|Mesh)\(/);
      }
    }
  });
});

describe("World3D blob", () => {
  it("maps genome traits onto the asset blob", () => {
    const genome = limbedGenome();
    const params = blobVisualParams(genome);
    const segs = genome.limbs.flatMap((l) => l.segments);
    expect(params.limbCount).toBe(traitsOf(genome).limbCount);
    expect(params.limbs.length).toBeCloseTo(segs.reduce((s, x) => s + x.length, 0) / segs.length);
  });

  it("follows the physics core and morphs through evolve()", () => {
    const view = createBlobView(startGenome());
    const states = [
      { position: { x: 4, y: 0.3, z: 2 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
      { position: { x: 4, y: 0.3, z: 2.4 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
    ];
    updateBlobView(view, 1 / 60, states, new Float32Array(8), 0);
    expect(view.root.position.x).toBeCloseTo(4);
    expect(view.root.position.z).toBeCloseTo(2.2);

    let seconds = null;
    const evolve = view.api.evolve;
    view.api.evolve = (p, s) => { seconds = s; return evolve(p, s); };
    setBlobGenome(view, limbedGenome(), true);
    expect(seconds).toBe(DISPLAY.MORPH_TIME);
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
