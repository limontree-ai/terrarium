import seedrandom from "seedrandom";
import * as config from "../config.js";

/**
 * Create a random starting genome.
 */
export function startGenome() {
  return {
    id: Math.random().toString(36).slice(2),
    speciesId: "species-0",
    core: {
      sizeA: 0.4, // start medium
      sizeB: 0.4,
    },
    limbs: [], // start with no limbs
    density: 800, // kg/m³
    rhythmHz: 1.0,
    brain: new Float32Array(config.BRAIN.WEIGHTS), // zeros
    sigma: 0.1, // mutation sigma
  };
}

/**
 * Generate a random genome.
 */
export function randomGenome(rng) {
  const genome = startGenome();

  // Random sizes (smaller range for start)
  genome.core.sizeA = 0.2 + rng() * 0.2;
  genome.core.sizeB = 0.2 + rng() * 0.2;

  // Random 0-2 starting limbs (small)
  const limbCount = Math.floor(rng() * 3);
  for (let i = 0; i < limbCount; i++) {
    genome.limbs.push({
      half: Math.floor(rng() * 2), // attach to A or B half
      face: Math.floor(rng() * 6), // 6 faces per box
      u: rng(), // position on face
      v: rng(),
      segments: [
        {
          length: 0.1 + rng() * 0.2,
          width: 0.1,
          thickness: 0.05,
          axis: Math.floor(rng() * 3),
          minAngle: -45,
          maxAngle: 45,
          strength: 1.0,
        },
      ],
    });
  }

  // Random brain weights
  for (let i = 0; i < config.BRAIN.WEIGHTS; i++) {
    genome.brain[i] = (rng() - 0.5) * 0.2; // small random
  }

  genome.density = 400 + rng() * 800;
  genome.rhythmHz = 0.5 + rng() * 2.5;

  return genome;
}

/**
 * Check if genome is valid.
 */
export function validateGenome(g) {
  if (!g.core) return false;
  if (g.core.sizeA < 0.2 || g.core.sizeA > 0.6) return false;
  if (g.core.sizeB < 0.2 || g.core.sizeB > 0.6) return false;
  if (g.limbs.length > config.CREATURE.MAX_LIMBS) return false;

  let totalJoints = 1; // core hinge
  for (const limb of g.limbs) {
    totalJoints += limb.segments.length;
    for (const seg of limb.segments) {
      if (seg.length < 0.1 || seg.length > 0.8) return false;
      if (seg.width < 0.05 || seg.width > 0.5) return false;
      if (seg.thickness < 0.03 || seg.thickness > 0.3) return false;
    }
  }

  if (totalJoints > config.CREATURE.MAX_TOTAL_JOINTS) return false;
  if (g.density < 400 || g.density > 1200) return false;
  if (g.rhythmHz < 0.5 || g.rhythmHz > 3.0) return false;
  if (g.brain.length !== config.BRAIN.WEIGHTS) return false;

  return true;
}

/**
 * Clamp genome to valid ranges.
 */
export function clampGenome(g) {
  const clamped = {
    ...g,
    core: { ...g.core },
    limbs: g.limbs.map((limb) => ({
      ...limb,
      segments: limb.segments.map((seg) => ({ ...seg })),
    })),
    brain: new Float32Array(g.brain),
  };

  clamped.core.sizeA = Math.max(0.2, Math.min(0.6, g.core.sizeA));
  clamped.core.sizeB = Math.max(0.2, Math.min(0.6, g.core.sizeB));

  for (const limb of clamped.limbs) {
    for (const seg of limb.segments) {
      seg.length = Math.max(0.1, Math.min(0.8, seg.length));
      seg.width = Math.max(0.05, Math.min(0.5, seg.width));
      seg.thickness = Math.max(0.03, Math.min(0.3, seg.thickness));
    }
  }

  clamped.density = Math.max(400, Math.min(1200, g.density));
  clamped.rhythmHz = Math.max(0.5, Math.min(3.0, g.rhythmHz));

  return clamped;
}
