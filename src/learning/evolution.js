import seedrandom from "seedrandom";
import { mutateBrain, mutateBody, traitsOf } from "../blob/mutate.js";
import { clampGenome, validateGenome } from "../blob/genome.js";
import * as config from "../config.js";

/**
 * Run one evolution generation (create variations, evaluate, adopt).
 * Called once per round (~3 seconds).
 */
export class EvolutionStrategy {
  constructor(genome, seed = 42) {
    this.genome = genome; // current best
    this.sigma = genome.sigma || 0.1;
    this.rng = seedrandom(seed);
    this.successHistory = []; // track last 10 rounds
    this.bodyMutated = []; // per variation from the last generateVariations()
  }

  /**
   * Create 8 variations: (1+8) strategy.
   * Returns [current, variation1, variation2, ..., variation8]
   */
  generateVariations() {
    const variations = [this.genome]; // keep current
    this.bodyMutated = [false];

    for (let i = 0; i < config.LEARNING.VARIATIONS_PER_ROUND; i++) {
      let variation = this.genome;

      // Brain noise: always applied
      variation = mutateBrain(variation, this.sigma, this.rng);

      // Body mutation: 30% chance
      const bodyMutated = this.rng() < config.LEARNING.BODY_CHANGE_CHANCE;
      if (bodyMutated) {
        variation = mutateBody(variation, this.rng);
      }

      // Validate and clamp
      if (!validateGenome(variation)) {
        variation = clampGenome(variation);
      }

      variations.push(variation);
      this.bodyMutated.push(bodyMutated);
    }

    return variations;
  }

  /**
   * Adopt best variation if it beats current by margin.
   * Failed trials (physics blowups) never win, even though their reward is 0.
   * @param {TrialResult[]} results - 9 results (current + 8)
   * @returns { adopted, newGenome, bestReward, currentReward, sigma, traits, bodyChanged }
   */
  selectAndAdopt(variations, results) {
    const scoreOf = (r) => (r.failed ? -Infinity : r.reward);
    const currentReward = results[0].reward;
    let bestIdx = 0;
    let bestScore = scoreOf(results[0]);

    for (let i = 1; i < results.length; i++) {
      if (scoreOf(results[i]) > bestScore) {
        bestScore = scoreOf(results[i]);
        bestIdx = i;
      }
    }

    const bestReward = results[bestIdx].reward;
    const margin = config.LEARNING.ADOPTION_MARGIN;
    const adopted = bestIdx > 0 && bestScore > scoreOf(results[0]) + margin;

    if (adopted) {
      this.genome = variations[bestIdx];
      this.successHistory.push(1);
    } else {
      this.successHistory.push(0);
    }

    // Keep only last 10
    if (this.successHistory.length > 10) {
      this.successHistory.shift();
    }

    // Adapt sigma (one-fifth success rule)
    this.adaptSigma();
    this.genome = { ...this.genome, sigma: this.sigma };

    const traits = traitsOf(this.genome);
    const bodyChanged = adopted && Boolean(this.bodyMutated[bestIdx]);

    return {
      adopted,
      newGenome: this.genome,
      bestReward,
      currentReward,
      sigma: this.sigma,
      traits,
      bodyChanged,
    };
  }

  /**
   * Adapt mutation sigma.
   * One-fifth success rule: if >20% success in last 10 rounds, increase; else decrease.
   */
  adaptSigma() {
    if (this.successHistory.length < 5) return; // wait for history

    const successRate =
      this.successHistory.reduce((a, b) => a + b, 0) /
      this.successHistory.length;

    const target = config.LEARNING.SUCCESS_RATE_TARGET; // 0.2

    if (successRate > target) {
      // Increase sigma (explore more)
      this.sigma *= 1.05;
    } else {
      // Decrease sigma (refine)
      this.sigma *= 0.95;
    }

    // Clamp
    this.sigma = Math.max(
      config.LEARNING.SIGMA_MIN,
      Math.min(config.LEARNING.SIGMA_MAX, this.sigma)
    );
  }
}
