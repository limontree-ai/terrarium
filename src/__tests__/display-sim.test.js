// @vitest-environment node
import { describe, it, expect } from "vitest";
import seedrandom from "seedrandom";
import { DisplaySim } from "../ui/display-sim.js";
import { randomGenome } from "../blob/genome.js";
import { WORLD_DEFAULTS } from "../config.js";

describe("DisplaySim", () => {
  it("runs the genome in its own world and reports body states", async () => {
    const genome = randomGenome(seedrandom("display"));
    const sim = await DisplaySim.create(genome, { ...WORLD_DEFAULTS, treeCount: 5 }, 3);
    expect(sim.trees).toHaveLength(5);

    for (let i = 0; i < 60; i++) sim.step(1 / 60);

    const states = sim.bodyStates();
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(sim.position.x)).toBe(true);
    expect(Number.isFinite(sim.heading)).toBe(true);
    expect(sim.outputs).toHaveLength(8);
    expect(sim.failed).toBe(false);
    sim.free();
  });
});
