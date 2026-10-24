import { describe, it, expect } from "vitest";
import seedrandom from "seedrandom";
import { createLocalWorld } from "../physics/world.js";
import { applyCustomForces } from "../physics/forces.js";
import { runTrial } from "../physics/trial.js";
import { buildBlob } from "../blob/build.js";
import { startGenome, randomGenome } from "../blob/genome.js";
import { LearningLoop } from "../learning/learning.js";
import { LocalEvaluator } from "../learning/headless.js";
import { BRAIN, WORLD_DEFAULTS } from "../config.js";

// Acceptance gates from the spec. Brains are hand written so the gates test physics and reward.
const GRASS = { ...WORLD_DEFAULTS, treeCount: 0 };
const WATER = { ...GRASS, waterLevel: 1 };
const HIDDEN = BRAIN.INPUTS * BRAIN.HIDDEN;
const OUT_W = HIDDEN;
const HID_B = HIDDEN + BRAIN.HIDDEN * BRAIN.OUTPUTS;
const OUT_B = HID_B + BRAIN.HIDDEN;
const SINE_INPUT = 27;

// Hidden unit 0 follows the rhythm sine; listed outputs copy it scaled by `amp`.
function sineBrain(genome, amp, outputs = [0]) {
  const brain = new Float32Array(BRAIN.WEIGHTS);
  brain[SINE_INPUT * BRAIN.HIDDEN] = 1;
  for (const o of outputs) brain[OUT_W + o] = amp;
  return { ...genome, brain };
}

// Fast power stroke, slow recovery: hidden 0 is high for a short part of each cycle.
function strokeBrain(genome, amp, outputs, k = 6, s = 0.6) {
  const brain = new Float32Array(BRAIN.WEIGHTS);
  brain[SINE_INPUT * BRAIN.HIDDEN] = k;
  brain[HID_B] = -k * s;
  const offset = 1 - (2 * Math.acos(s)) / Math.PI;
  for (const o of outputs) {
    brain[OUT_W + o] = amp;
    brain[OUT_B + o] = amp * offset;
  }
  return { ...genome, brain };
}

describe("Acceptance gates", () => {
  it("1. a sine on the core hinge moves the start blob at least 0.5 m in 180 steps on grass", async () => {
    const world = await createLocalWorld(GRASS, 1);
    const blob = buildBlob(world, startGenome(), { x: 0, y: 0, z: 0 });
    const start = { ...blob.bodies[0].translation() };
    for (let step = 0; step < 180; step++) {
      const outputs = new Float32Array(BRAIN.OUTPUTS);
      outputs[0] = Math.sin((2 * Math.PI * 3 * step) / 30);
      blob.act(outputs);
      applyCustomForces(world, blob.bodies);
      world.step();
    }
    const end = blob.bodies[0].translation();
    world.free();
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThanOrEqual(0.5);
  });

  it("2. in water, two wide flat limbs outscore two narrow limbs on the same seed", async () => {
    const limbs = (width) => ({
      ...startGenome(),
      rhythmHz: 1,
      limbs: [0, 1].map(() => ({
        half: 0,
        face: 3,
        u: 0.5,
        v: 0.5,
        segments: [{ length: 0.4, width, thickness: 0.03, axis: 1, minAngle: -60, maxAngle: 60, strength: 1 }],
      })),
    });
    const food = { x: 0, y: 0.5, z: 2.5 };
    const start = { x: 0, y: 2, z: 0 };
    const wide = await runTrial(strokeBrain(limbs(0.4), 1, [1, 2]), WATER, start, 7, food);
    const narrow = await runTrial(strokeBrain(limbs(0.05), 1, [1, 2]), WATER, start, 7, food);
    expect(wide.failed || narrow.failed).toBe(false);
    expect(wide.reward).toBeGreaterThan(narrow.reward);
  });

  it("3. a blob vibrating in place scores at or below zero", async () => {
    for (const amp of [0.1, 0.2, 0.3]) {
      const genome = { ...sineBrain(startGenome(), amp), rhythmHz: 3 };
      const result = await runTrial(genome, GRASS, { x: 0, y: 0, z: 0 }, 3);
      expect(result.failed).toBe(false);
      expect(result.reward).toBeLessThanOrEqual(0);
    }
  });

  it("4. two runs with the same seed give identical rewards for 60 rounds", async () => {
    const run = async () => {
      const loop = new LearningLoop({ evaluator: new LocalEvaluator(), seed: 1234 });
      const rewards = [];
      for (let i = 0; i < 60; i++) {
        const r = await loop.runRound();
        rewards.push(r.currentReward, r.bestReward);
      }
      return rewards;
    };
    expect(await run()).toEqual(await run());
  }, 300_000);

  it("5. 500 random genomes run 180 steps in grass, water, snow and moon with no NaN or blowups", async () => {
    const worlds = {
      grass: GRASS,
      water: { ...GRASS, waterLevel: 0.6 },
      snow: { ...GRASS, snowDepth: 0.2 },
      moon: { ...GRASS, gravity: 0.16, groundType: "moondust" },
    };
    const rng = seedrandom("gate5");
    const bad = [];
    for (let i = 0; i < 500; i++) {
      const genome = randomGenome(rng);
      for (let w = 0; w < genome.brain.length; w++) genome.brain[w] = (rng() - 0.5) * 4;
      for (const [name, settings] of Object.entries(worlds)) {
        const r = await runTrial(genome, settings, { x: 0, y: 0.5, z: 0 }, i);
        if (r.failed || !Number.isFinite(r.reward)) bad.push(`${name}#${i}`);
      }
    }
    expect(bad).toEqual([]);
  }, 600_000);
});
