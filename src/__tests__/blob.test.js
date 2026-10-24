import { describe, it, expect } from "vitest";
import {
  startGenome,
  randomGenome,
  validateGenome,
  clampGenome,
} from "../blob/genome.js";
import { mutateBrain, mutateBody } from "../blob/mutate.js";
import seedrandom from "seedrandom";

describe("Blob", () => {
  it("start genome is valid", () => {
    const g = startGenome();
    expect(validateGenome(g)).toBe(true);
  });

  it("1000 random genomes are valid", () => {
    const rng = seedrandom("test");
    for (let i = 0; i < 1000; i++) {
      const g = randomGenome(rng);
      expect(validateGenome(g)).toBe(true);
    }
  });

  it("1000 mutations are valid", () => {
    let g = startGenome();
    const rng = seedrandom("test");
    for (let i = 0; i < 1000; i++) {
      g = mutateBrain(g, 0.1, rng);
      if (rng() < 0.3) g = mutateBody(g, rng);
      expect(validateGenome(g)).toBe(true);
    }
  });

  it("clamp keeps valid genomes unchanged", () => {
    const g = startGenome();
    const clamped = clampGenome(g);
    expect(validateGenome(clamped)).toBe(true);
  });
});
