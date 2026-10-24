import { runTrial } from "./trial.js";
import { startGenome } from "../blob/blob.js";
import * as config from "../config.js";

/**
 * Benchmark: run 8 trials in parallel and measure time.
 */
export async function benchmark() {
  const genome = startGenome();
  const settings = config.WORLD_DEFAULTS;
  const startPos = { x: 0, y: 1, z: 0 };

  const numTrials = 8;
  const startTime = Date.now();

  const promises = [];
  for (let i = 0; i < numTrials; i++) {
    promises.push(runTrial(genome, settings, startPos, i));
  }

  const results = await Promise.all(promises);
  const elapsed = (Date.now() - startTime) / 1000;

  console.log(`Generation time: ${elapsed.toFixed(2)}s`);
  console.log(`Average trial: ${(elapsed / numTrials).toFixed(3)}s`);

  // Print results
  for (let i = 0; i < results.length; i++) {
    console.log(
      `Trial ${i}: reward=${results[i].reward.toFixed(1)}, ` +
      `progress=${results[i].progress.toFixed(1)}m, ` +
      `failed=${results[i].failed}`
    );
  }

  // Success if under 1 second total
  if (elapsed < 1.0) {
    console.log("✓ PASS: Generation under 1 second");
    process.exit(0);
  } else {
    console.log("✗ FAIL: Generation over 1 second");
    process.exit(1);
  }
}

benchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
