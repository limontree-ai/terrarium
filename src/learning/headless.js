import { LearningLoop } from "./learning.js";
import { runTrial } from "../physics/trial.js";

/**
 * Evaluates trials in-process, so headless evolution runs in Node (no Web Workers).
 */
export class LocalEvaluator {
  evaluateBatch(genomes, settings, position, seed, food) {
    return Promise.all(genomes.map((genome) => runTrial(genome, settings, position, seed, food)));
  }

  terminate() {}
}

/**
 * Evolve a creature for N generations in headless mode.
 * Writes the final genome as JSON to outputPath when given (Node only).
 */
export async function evolveHeadless(numGenerations, settings, outputPath, seed = 42) {
  const loop = new LearningLoop({ evaluator: new LocalEvaluator(), seed });
  loop.settings = { ...loop.settings, ...settings };

  const rewards = [];
  const traits = [];

  console.log(`[Evolve] Starting ${numGenerations} generations...`);

  for (let gen = 0; gen < numGenerations; gen++) {
    const result = await loop.runRound();
    rewards.push(result.bestReward);
    traits.push(result.traits);

    if (gen % 10 === 0) {
      console.log(
        `Gen ${gen}: reward=${result.bestReward.toFixed(1)}, ` +
        `limbs=${result.traits.limbCount}, ` +
        `sigma=${result.sigma.toFixed(3)}`
      );
    }
  }

  const finalGenome = loop.genome;
  console.log(`[Evolve] Done. Best reward: ${Math.max(...rewards).toFixed(1)}`);

  if (outputPath) {
    const { writeFile } = await import("node:fs/promises");
    const json = { ...finalGenome, brain: Array.from(finalGenome.brain) };
    await writeFile(outputPath, JSON.stringify(json, null, 2));
  }

  loop.terminate();

  return {
    genome: finalGenome,
    rewards,
    traits,
  };
}
