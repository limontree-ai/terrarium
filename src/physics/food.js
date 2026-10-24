import seedrandom from "seedrandom";
import { REWARD } from "../config.js";

/**
 * Seeded food sequence: every respawn lands 2 to 3 m from the blob.
 * Candidates in one round share the seed, so they see the same sequence.
 */
export function createFoodSequence(seed) {
  const rng = seedrandom(`${seed}-food`);
  return {
    next(from) {
      const angle = rng() * 2 * Math.PI;
      const dist = REWARD.FOOD_RESPAWN_MIN + rng() * (REWARD.FOOD_RESPAWN_MAX - REWARD.FOOD_RESPAWN_MIN);
      return { x: from.x + Math.cos(angle) * dist, y: 0.5, z: from.z + Math.sin(angle) * dist };
    },
  };
}
