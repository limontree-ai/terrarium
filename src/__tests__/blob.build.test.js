import { describe, it, expect } from "vitest";
import seedrandom from "seedrandom";
import { startGenome, randomGenome, validateGenome } from "../blob/genome.js";
import { createBrain } from "../blob/brain.js";
import { buildBlob } from "../blob/build.js";
import { mutateBody, lerpGenome } from "../blob/mutate.js";
import { createLocalWorld } from "../physics/world.js";
import { runTrial } from "../physics/trial.js";
import { WORLD_DEFAULTS, BRAIN } from "../config.js";

describe("Blob brain", () => {
  it("is deterministic", () => {
    const genome = randomGenome(seedrandom("brain"));
    const inputs = Float32Array.from({ length: BRAIN.INPUTS }, (_, i) => Math.sin(i));
    const a = createBrain(genome).forward(inputs);
    const b = createBrain(genome).forward(inputs);
    expect(a).toHaveLength(BRAIN.OUTPUTS);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("Blob mutations", () => {
  it("do not modify the parent genome", () => {
    const parent = randomGenome(seedrandom("parent"));
    const before = JSON.stringify({ ...parent, brain: Array.from(parent.brain) });
    const rng = seedrandom("mutate");
    for (let i = 0; i < 200; i++) mutateBody(parent, rng);
    expect(JSON.stringify({ ...parent, brain: Array.from(parent.brain) })).toBe(before);
  });

  it("lerp blends segment sizes", () => {
    const a = randomGenome(seedrandom("lerp"));
    a.limbs = [{ half: 0, face: 0, u: 0.5, v: 0.5, segments: [{ length: 0.2, width: 0.1, thickness: 0.05, axis: 1, minAngle: -45, maxAngle: 45, strength: 1 }] }];
    const b = structuredClone({ ...a, brain: [] });
    b.limbs[0].segments[0].length = 0.6;
    expect(lerpGenome(a, b, 0.5).limbs[0].segments[0].length).toBeCloseTo(0.4);
  });
});

describe("Blob body", () => {
  it("builds one body per part and one joint per hinge", async () => {
    const world = await createLocalWorld({ ...WORLD_DEFAULTS, treeCount: 0 }, 1);
    const rng = seedrandom("build");
    let genome = startGenome();
    while (genome.limbs.length < 2) genome = mutateBody(genome, rng);
    const segments = genome.limbs.reduce((n, l) => n + l.segments.length, 0);

    const blob = buildBlob(world, genome, { x: 0, y: 1, z: 0 });
    expect(blob.bodies).toHaveLength(2 + segments);
    expect(blob.joints).toHaveLength(1 + segments);

    const inputs = blob.sense({ x: 5, y: 0.5, z: 0 });
    expect(inputs).toHaveLength(BRAIN.INPUTS);
    expect(Array.from(inputs).every(Number.isFinite)).toBe(true);
    world.free();
  });

  it("random creatures with active brains run trials without blowing up", async () => {
    const rng = seedrandom("trials");
    for (let i = 0; i < 20; i++) {
      let genome = randomGenome(rng);
      for (let m = 0; m < 6; m++) genome = mutateBody(genome, rng);
      genome.brain = genome.brain.map((w) => w * 20);
      expect(validateGenome(genome)).toBe(true);

      const result = await runTrial(genome, WORLD_DEFAULTS, { x: 0, y: 1, z: 0 }, i);
      expect(result.failed).toBe(false);
      expect(Number.isFinite(result.reward)).toBe(true);
    }
  });
});
