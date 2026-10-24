import { EvolutionStrategy } from "./evolution.js";
import { WorkerPool } from "./worker-pool.js";
import { startGenome } from "../blob/genome.js";
import * as config from "../config.js";

/**
 * Learning loop: runs on main thread, coordinates with workers.
 * `evaluator` is anything with evaluateBatch(genomes, settings, position, seed, food)
 * and terminate(); defaults to a Web Worker pool (browser only).
 */
export class LearningLoop {
  constructor({ evaluator, genome = startGenome(), seed } = {}) {
    this.genome = genome;
    this.seed = seed ?? Math.floor(Math.random() * 1000000);
    this.es = new EvolutionStrategy(this.genome, this.seed);
    this.workerPool = evaluator ?? new WorkerPool(config.LEARNING.VARIATIONS_PER_ROUND + 1);
    this.roundNumber = 0;
    this.settings = { ...config.WORLD_DEFAULTS };
    this.position = { x: 0, y: 1, z: 0 };
    this.foodTarget = { x: 2, y: 0.5, z: 1.5 };
  }

  /**
   * Run one generation (block until results).
   */
  async runRound() {
    // Settings are snapshotted here, so voice changes apply at the next round.
    const settings = this.settings;
    const variations = this.es.generateVariations();

    // Evaluate in parallel
    const results = await this.workerPool.evaluateBatch(
      variations,
      settings,
      this.position,
      this.seed + this.roundNumber,
      this.foodTarget
    );

    // Select and adopt
    const { adopted, newGenome, bestReward, currentReward, sigma, traits, bodyChanged } =
      this.es.selectAndAdopt(variations, results);

    this.genome = newGenome;
    this.roundNumber++;

    return {
      type: "round",
      round: this.roundNumber,
      adopted,
      genome: newGenome,
      currentReward,
      bestReward,
      sigma,
      traits,
      bodyChanged,
    };
  }

  /**
   * Update world settings (voice command).
   * Applied at next round boundary.
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Update creature position (from display sim).
   */
  updatePosition(position, heading, foodTarget) {
    this.position = position;
    this.foodTarget = foodTarget;
  }

  terminate() {
    this.workerPool.terminate();
  }
}
