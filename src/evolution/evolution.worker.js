// Evaluates a batch of genomes in its own Rapier world, off the main thread.
import RAPIER from '@dimforge/rapier3d-compat';
import { evaluate } from './simulate.js';

const ready = RAPIER.init();

self.onmessage = async ({ data }) => {
  await ready;
  const { jobId, genomes, settings, seconds } = data;
  const fitness = genomes.map((genome) => evaluate(RAPIER, genome, settings, seconds));
  self.postMessage({ jobId, fitness });
};
