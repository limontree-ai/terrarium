import seedrandom from "seedrandom";
import * as config from "../config.js";
import { clampGenome } from "./genome.js";

/**
 * Mutate brain weights with Gaussian noise.
 */
export function mutateBrain(genome, sigma, rng) {
  const mutated = { ...genome, brain: new Float32Array(genome.brain) };

  for (let i = 0; i < config.BRAIN.WEIGHTS; i++) {
    // Gaussian noise: Box-Muller transform
    const u1 = 1 - rng(); // (0, 1], avoids log(0)
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    mutated.brain[i] += z * sigma;
  }

  return mutated;
}

/**
 * Mutate body (30% chance per variation).
 */
export function mutateBody(genome, rng) {
  const mutated = {
    ...genome,
    core: { ...genome.core },
    limbs: genome.limbs.map((limb) => ({
      ...limb,
      segments: limb.segments.map((seg) => ({ ...seg })),
    })),
  };

  const jointCount =
    1 + mutated.limbs.reduce((sum, limb) => sum + limb.segments.length, 0);
  const canAddJoint = jointCount < config.CREATURE.MAX_TOTAL_JOINTS;

  const choice = rng() * 8; // 8 possible mutations

  if (choice < 1) {
    // Grow/shrink core
    const scale = 1 + (rng() - 0.5) * 0.25;
    mutated.core.sizeA *= scale;
    mutated.core.sizeB *= scale;
  } else if (choice < 2) {
    // Grow/shrink a segment
    if (mutated.limbs.length > 0) {
      const limb = mutated.limbs[Math.floor(rng() * mutated.limbs.length)];
      if (limb.segments.length > 0) {
        const seg = limb.segments[Math.floor(rng() * limb.segments.length)];
        const scale = 1 + (rng() - 0.5) * 0.25;
        seg.length *= scale;
      }
    }
  } else if (choice < 3) {
    // Flatten/thicken
    if (mutated.limbs.length > 0) {
      const limb = mutated.limbs[Math.floor(rng() * mutated.limbs.length)];
      if (limb.segments.length > 0) {
        const seg = limb.segments[Math.floor(rng() * limb.segments.length)];
        const scale = 1 + (rng() - 0.5) * 0.2;
        seg.width *= scale;
        seg.thickness /= scale; // inverse
      }
    }
  } else if (choice < 4) {
    // Add segment
    if (mutated.limbs.length > 0) {
      const limb = mutated.limbs[Math.floor(rng() * mutated.limbs.length)];
      if (canAddJoint && limb.segments.length < 3) {
        limb.segments.push({
          length: 0.2 + rng() * 0.3,
          width: 0.1,
          thickness: 0.05,
          axis: Math.floor(rng() * 3),
          minAngle: -45,
          maxAngle: 45,
          strength: 0.5, // small for new parts
        });
      }
    }
  } else if (choice < 5) {
    // Remove segment
    if (mutated.limbs.length > 0) {
      const limb = mutated.limbs[Math.floor(rng() * mutated.limbs.length)];
      if (limb.segments.length > 1) {
        limb.segments.pop();
      }
    }
  } else if (choice < 6) {
    // Add limb
    if (canAddJoint && mutated.limbs.length < 4) {
      mutated.limbs.push({
        half: Math.floor(rng() * 2),
        face: Math.floor(rng() * 6),
        u: rng(),
        v: rng(),
        segments: [
          {
            length: 0.2 + rng() * 0.3,
            width: 0.1,
            thickness: 0.05,
            axis: Math.floor(rng() * 3),
            minAngle: -45,
            maxAngle: 45,
            strength: 0.5,
          },
        ],
      });
    }
  } else if (choice < 7) {
    // Remove limb
    if (mutated.limbs.length > 0) {
      mutated.limbs.pop();
    }
  } else {
    // Move joint
    if (mutated.limbs.length > 0) {
      const limb = mutated.limbs[Math.floor(rng() * mutated.limbs.length)];
      limb.u = Math.max(0, Math.min(1, limb.u + (rng() - 0.5) * 0.3));
      limb.v = Math.max(0, Math.min(1, limb.v + (rng() - 0.5) * 0.3));
    }
  }

  return clampGenome(mutated);
}

/**
 * Lerp between two genomes (same topology).
 * Used for smooth body morphing.
 */
export function lerpGenome(a, b, t) {
  if (a.limbs.length !== b.limbs.length) return a; // topologies don't match

  const lerped = {
    ...a,
    core: {
      sizeA: a.core.sizeA * (1 - t) + b.core.sizeA * t,
      sizeB: a.core.sizeB * (1 - t) + b.core.sizeB * t,
    },
    limbs: a.limbs.map((limbA, idx) => {
      const limbB = b.limbs[idx];
      if (!limbB || limbA.segments.length !== limbB.segments.length) return limbA;

      return {
        ...limbA,
        segments: limbA.segments.map((segA, segIdx) => {
          const segB = limbB.segments[segIdx];
          return {
            ...segA, // keep axis, angles, strength
            length: segA.length * (1 - t) + segB.length * t,
            width: segA.width * (1 - t) + segB.width * t,
            thickness: segA.thickness * (1 - t) + segB.thickness * t,
          };
        }),
      };
    }),
  };

  return lerped;
}

/**
 * Extract traits for evolution and speciation.
 */
export function traitsOf(genome) {
  let limbCount = genome.limbs.length;
  let segmentCount = 0;
  let flatnessSum = 0;
  let lengthSum = 0;

  for (const limb of genome.limbs) {
    segmentCount += limb.segments.length;
    for (const seg of limb.segments) {
      flatnessSum += seg.width / (seg.thickness + 0.01); // avoid division by zero
      lengthSum += seg.length;
    }
  }

  const avgFlatness = limbCount > 0 ? flatnessSum / limbCount : 0;
  const avgLength = segmentCount > 0 ? lengthSum / segmentCount : 0;
  const height = genome.core.sizeA + (limbCount > 0 ? lengthSum / limbCount : 0);

  return {
    limbCount,
    segmentCount,
    flatness: avgFlatness,
    limbLength: avgLength,
    height,
  };
}
