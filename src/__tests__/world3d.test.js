import { describe, it, expect } from "vitest";
import { createScene } from "../world3d/scene.js";
import { createCreatureMesh } from "../world3d/creature.js";
import { startGenome } from "../blob/genome.js";

describe("World3D", () => {
  it("creates scene without errors", () => {
    const state = createScene(1024, 768);
    expect(state.scene).toBeDefined();
    expect(state.camera).toBeDefined();
    expect(state.renderer).toBeDefined();
  });

  it("creates creature mesh", () => {
    const genome = startGenome();
    const mesh = createCreatureMesh(genome);
    expect(mesh.children.length).toBeGreaterThan(0);
  });
});
