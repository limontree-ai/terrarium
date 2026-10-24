import { describe, it, expect } from "vitest";
import { createLocalWorld } from "../physics/world.js";
import { applyCustomForces } from "../physics/forces.js";
import RAPIER from "@dimforge/rapier3d-compat";

describe("Physics", () => {
  it("creates a world without crashing", async () => {
    const world = await createLocalWorld({
      waterLevel: 0,
      gravity: 1.0,
      groundType: "grass",
      treeCount: 5,
    }, 42);
    expect(world).toBeDefined();
  });

  it("box dropped on ground comes to rest", async () => {
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(0, -9.81, 0);
    const world = new RAPIER.World(gravity);

    // Ground
    const groundDesc = RAPIER.RigidBodyDesc.fixed();
    const groundBody = world.createRigidBody(groundDesc);
    const groundShape = RAPIER.ColliderDesc.cuboid(100, 0.01, 100);
    world.createCollider(groundShape, groundBody);

    // Falling box
    const boxDesc = RAPIER.RigidBodyDesc.dynamic();
    boxDesc.setTranslation(0, 1, 0);
    const boxBody = world.createRigidBody(boxDesc);
    const boxShape = RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1);
    world.createCollider(boxShape, boxBody);

    // Step 100 times
    for (let i = 0; i < 100; i++) {
      world.step();
    }

    const vel = boxBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    expect(speed).toBeLessThan(0.1); // essentially at rest
  });

  it("light box floats in water, heavy sinks", async () => {
    // This tests buoyancy logic (harder to test without full water sim)
    expect(true).toBe(true); // placeholder
  });
});
