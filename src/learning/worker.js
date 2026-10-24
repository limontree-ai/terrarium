import { runTrial } from "../physics/trial.js";

/**
 * Web Worker: receives genome, runs trial, sends result.
 */
self.onmessage = async (e) => {
  const { type, genome, settings, position, seed } = e.data;

  if (type === "runTrial") {
    try {
      const result = await runTrial(genome, settings, position, seed);
      self.postMessage({
        type: "trialResult",
        result,
      });
    } catch (err) {
      console.error("Worker trial error:", err);
      self.postMessage({
        type: "trialResult",
        result: {
          reward: 0,
          progress: 0,
          foodEaten: 0,
          energy: 0,
          failed: true,
        },
      });
    }
  }
};
