const FAILED_RESULT = { reward: 0, progress: 0, foodEaten: 0, energy: 0, failed: true };

const createTrialWorker = () =>
  new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

/**
 * Pool of Web Workers for parallel trial evaluation.
 */
export class WorkerPool {
  constructor(numWorkers = 8, createWorker = createTrialWorker) {
    this.numWorkers = numWorkers;
    this.workers = [];
    this.queue = []; // pending tasks
    this.activeCount = 0;

    for (let i = 0; i < numWorkers; i++) {
      const worker = createWorker();
      worker.busy = false;
      worker.onmessage = (e) => this.onWorkerMessage(e, worker);
      worker.onerror = (e) => {
        console.error("Worker error:", e);
        this.finishTask(worker, FAILED_RESULT);
      };
      this.workers.push(worker);
    }
  }

  /**
   * Evaluate a batch of genomes. Every genome runs in the same world (same seed),
   * so rewards are comparable.
   * Returns promise that resolves with array of TrialResult, in genome order.
   */
  evaluateBatch(genomes, settings, position, seed) {
    return new Promise((resolve) => {
      const results = new Array(genomes.length);
      let remaining = genomes.length;
      if (remaining === 0) resolve(results);

      for (let i = 0; i < genomes.length; i++) {
        this.queue.push({
          genome: genomes[i],
          settings,
          position,
          seed,
          resolve: (result) => {
            results[i] = result;
            remaining--;
            if (remaining === 0) resolve(results);
          },
        });
      }
      this.processQueue();
    });
  }

  processQueue() {
    while (this.queue.length > 0 && this.activeCount < this.numWorkers) {
      const worker = this.workers.find((w) => !w.busy);
      if (!worker) break;

      const task = this.queue.shift();
      worker.busy = true;
      worker.currentTask = task;
      this.activeCount++;

      worker.postMessage({
        type: "runTrial",
        genome: task.genome,
        settings: task.settings,
        position: task.position,
        seed: task.seed,
      });
    }
  }

  onWorkerMessage(e, worker) {
    const { type, result } = e.data;
    if (type === "trialResult") {
      this.finishTask(worker, result);
    }
  }

  finishTask(worker, result) {
    const task = worker.currentTask;
    if (!task) return;
    worker.currentTask = null;
    worker.busy = false;
    this.activeCount--;

    task.resolve(result);
    this.processQueue();
  }

  terminate() {
    for (const worker of this.workers) {
      worker.terminate();
    }
  }
}
