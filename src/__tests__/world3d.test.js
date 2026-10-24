import { describe, it, expect } from "vitest";
import { createScene } from "../world3d/scene.js";
import { createBlobView } from "../world3d/blob-view.js";
import { startGenome } from "../blob/genome.js";

describe("World3D", () => {
  it("creates scene without errors", () => {
    const state = createScene(1024, 768);
    expect(state.scene).toBeDefined();
    expect(state.camera).toBeDefined();
    expect(state.renderer).toBeDefined();
  });

  it("creates the asset blob", () => {
    const view = createBlobView(startGenome());
    expect(view.root.children.length).toBeGreaterThan(0);
    expect(view.api.update).toBeTypeOf("function");
  });
});
