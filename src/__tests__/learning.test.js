import { describe, it, expect } from "vitest";
import { EvolutionStrategy } from "../learning/evolution.js";
import { startGenome } from "../blob/genome.js";

describe("Learning", () => {
  it("evolution strategy generates variations", () => {
    const genome = startGenome();
    const es = new EvolutionStrategy(genome);
    const variations = es.generateVariations();

    expect(variations.length).toBe(9); // current + 8
  });

  it("selects best variation correctly", () => {
    const genome = startGenome();
    const es = new EvolutionStrategy(genome);
    const variations = es.generateVariations();

    const results = variations.map((_, i) => ({
      reward: i === 5 ? 100 : 50, // variation 5 is best
      progress: 10,
      foodEaten: 0,
      energy: 1,
      failed: false,
    }));

    const { adopted, bestReward } = es.selectAndAdopt(variations, results);
    expect(bestReward).toBe(100);
  });

  it("sigma adapts", () => {
    const genome = startGenome();
    const es = new EvolutionStrategy(genome);
    const initialSigma = es.sigma;

    // Simulate 10 successful rounds
    for (let i = 0; i < 10; i++) {
      es.successHistory.push(1);
      es.adaptSigma();
    }

    // Sigma should increase (more exploration)
    expect(es.sigma).toBeGreaterThan(initialSigma);
  });
});
