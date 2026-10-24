// Runs generations: splits the population across a pool of workers, then selects and breeds.
import { randomGenome, mutate, crossover } from './genome.js';

const WORKER_COUNT = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));

export class Population {
  constructor({ size = 48, eliteFraction = 0.2, evalSeconds = 10 } = {}) {
    this.size = size;
    this.eliteCount = Math.max(2, Math.round(size * eliteFraction));
    this.evalSeconds = evalSeconds;
    this.genomes = Array.from({ length: size }, randomGenome);
    this.generation = 0;
    this.nextJobId = 0;
    this.pending = new Map();
    this.workers = Array.from({ length: WORKER_COUNT }, () => {
      const worker = new Worker(new URL('./evolution.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        this.pending.get(data.jobId)?.(data.fitness);
        this.pending.delete(data.jobId);
      };
      return worker;
    });
  }

  async evaluateAll(settings) {
    const chunk = Math.ceil(this.genomes.length / this.workers.length);
    const batches = this.workers.map((worker, i) => {
      const genomes = this.genomes.slice(i * chunk, (i + 1) * chunk);
      if (!genomes.length) return Promise.resolve([]);
      const jobId = this.nextJobId++;
      return new Promise((resolve) => {
        this.pending.set(jobId, resolve);
        worker.postMessage({ jobId, genomes, settings, seconds: this.evalSeconds });
      });
    });
    return (await Promise.all(batches)).flat();
  }

  // Evaluate the current generation, breed the next one, and return stats for charts.
  async step(settings) {
    const fitness = await this.evaluateAll(settings);
    const ranked = this.genomes
      .map((genome, i) => ({ genome, fitness: fitness[i] }))
      .sort((a, b) => b.fitness - a.fitness);

    const elite = ranked.slice(0, this.eliteCount).map((r) => r.genome);
    const pick = () => elite[Math.floor(Math.random() * elite.length)];
    this.genomes = [
      ...elite,
      ...Array.from({ length: this.size - elite.length }, () => mutate(crossover(pick(), pick()))),
    ];

    const sum = fitness.reduce((a, b) => a + b, 0);
    const stats = {
      generation: this.generation++,
      best: ranked[0].fitness,
      mean: sum / fitness.length,
      avgNodes: ranked.reduce((a, r) => a + r.genome.nodes.length, 0) / ranked.length,
      champions: elite.slice(0, 8),
    };
    return stats;
  }

  dispose() {
    this.workers.forEach((w) => w.terminate());
  }
}
