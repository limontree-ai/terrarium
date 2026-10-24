import { describe, it, expect, vi } from "vitest";
import { EvolutionStrategy } from "../learning/evolution.js";
import { WorkerPool } from "../learning/worker-pool.js";
import { LearningLoop } from "../learning/learning.js";
import { evolveHeadless } from "../learning/headless.js";
import { startGenome, validateGenome } from "../blob/genome.js";

class FakeWorker {
  constructor(log) {
    this.log = log;
  }
  postMessage(msg) {
    this.log.push({ worker: this, msg });
  }
  reply(result) {
    this.onmessage({ data: { type: "trialResult", result } });
  }
  terminate() {}
}

const ok = (reward) => ({ reward, progress: 0, foodEaten: 0, energy: 0, failed: false });

describe("WorkerPool", () => {
  it("runs tasks in parallel and returns results in genome order", async () => {
    const log = [];
    const pool = new WorkerPool(3, () => new FakeWorker(log));
    const promise = pool.evaluateBatch([0, 1, 2, 3, 4].map((id) => ({ id })), {}, {}, 7);

    expect(log).toHaveLength(3); // only 3 workers, 2 queued
    expect(log.every((t) => t.msg.seed === 7)).toBe(true);

    let settled = false;
    promise.then(() => (settled = true));

    // Reply out of order; the last genome finishing first must not resolve early.
    log[2].worker.reply(ok(2));
    log[0].worker.reply(ok(0));
    log[1].worker.reply(ok(1));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(log).toHaveLength(5);

    log[4].worker.reply(ok(4));
    log[3].worker.reply(ok(3));
    const results = await promise;
    expect(results.map((r) => r.reward)).toEqual([0, 1, 2, 3, 4]);
  });

  it("turns a worker error into a failed result instead of hanging", async () => {
    const log = [];
    const pool = new WorkerPool(1, () => new FakeWorker(log));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const promise = pool.evaluateBatch([{}, {}], {}, {}, 1);
    log[0].worker.onerror(new Error("boom"));
    log[1].worker.reply(ok(3));
    const results = await promise;
    expect(results[0].failed).toBe(true);
    expect(results[1].reward).toBe(3);
  });
});

describe("EvolutionStrategy selection", () => {
  it("never adopts a failed trial", () => {
    const es = new EvolutionStrategy(startGenome());
    const variations = es.generateVariations();
    const results = variations.map(() => ok(-0.5));
    results[3] = { reward: 0, progress: 0, foodEaten: 0, energy: 0, failed: true };
    const { adopted } = es.selectAndAdopt(variations, results);
    expect(adopted).toBe(false);
  });

  it("reports bodyChanged only when the adopted variation mutated its body", () => {
    const es = new EvolutionStrategy(startGenome(), 1);
    const variations = es.generateVariations();
    const brainOnly = es.bodyMutated.indexOf(false, 1);
    expect(brainOnly).toBeGreaterThan(0);

    const results = variations.map((_, i) => ok(i === brainOnly ? 1 : 0));
    const { adopted, bodyChanged } = es.selectAndAdopt(variations, results);
    expect(adopted).toBe(true);
    expect(bodyChanged).toBe(false);
  });
});

describe("LearningLoop", () => {
  it("evaluates all variations in one world and keeps the adopted genome", async () => {
    const seeds = [];
    const evaluator = {
      evaluateBatch: async (genomes, settings, position, seed) => {
        seeds.push(seed);
        return genomes.map((_, i) => ok(i === 2 ? 1 : 0));
      },
      terminate() {},
    };
    const loop = new LearningLoop({ evaluator, seed: 10 });
    const round = await loop.runRound();
    expect(round.round).toBe(1);
    expect(round.adopted).toBe(true);
    expect(loop.genome).toBe(round.genome);
    expect(loop.genome).not.toBe(startGenome());
    expect(seeds).toEqual([10]);
  });

  it("evolves headless in Node with real physics", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { genome, rewards, traits } = await evolveHeadless(3, {}, undefined, 5);
    expect(rewards).toHaveLength(3);
    expect(traits).toHaveLength(3);
    expect(validateGenome(genome)).toBe(true);
  });
});
