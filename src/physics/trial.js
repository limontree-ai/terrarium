import { applyCustomForces } from "./forces.js";
import { buildBlob } from "../blob/blob.js";
import { createLocalWorld } from "./world.js";
import { createFoodSequence } from "./food.js";
import { PHYSICS, REWARD } from "../config.js";

const FAILED = { reward: 0, progress: 0, foodEaten: 0, energy: 0, failed: true };

/**
 * Run one 180 step rollout and score it with the fixed reward:
 * signed progress toward food + eating bonus - motor energy. A failed rollout scores 0.
 * @param {Genome} genome
 * @param {WorldSettings} settings
 * @param {Vector3} startPos - blob position snapshot
 * @param {number} seed - shared by every candidate in a round
 * @param {Vector3} [food] - food position snapshot; drawn from the seeded sequence when omitted
 * @returns {TrialResult} { reward, progress, foodEaten, energy, failed }
 */
export async function runTrial(genome, settings, startPos, seed, food) {
  const world = await createLocalWorld(settings, seed);
  const blob = buildBlob(world, genome, startPos);
  if (!blob) {
    world.free();
    return { ...FAILED };
  }

  const foodSequence = createFoodSequence(seed);
  let foodTarget = food ? { x: food.x, y: food.y, z: food.z } : foodSequence.next(startPos);

  let progress = 0;
  let foodEaten = 0;
  let energy = 0;
  let failed = false;
  const dt = PHYSICS.DT;

  for (let step = 0; step < PHYSICS.TRIAL_STEPS; step++) {
    const before = blob.bodies[0].translation();
    const prevPos = { x: before.x, y: before.y, z: before.z };

    const outputs = blob.brain.forward(blob.sense(foodTarget));
    blob.act(outputs);
    applyCustomForces(world, blob.bodies);
    world.step();

    const t = blob.bodies[0].translation();
    const pos = { x: t.x, y: t.y, z: t.z };
    const vel = blob.bodies[0].linvel();
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    if (
      ![pos.x, pos.y, pos.z, speed].every(Number.isFinite) ||
      speed > PHYSICS.MAX_SPEED_CAP ||
      pos.y < PHYSICS.FLOOR_Y ||
      Math.abs(pos.x) > PHYSICS.ARENA_HALF ||
      Math.abs(pos.z) > PHYSICS.ARENA_HALF
    ) {
      failed = true;
      break;
    }

    // Signed: moving away from the food costs as much as moving toward it earns.
    progress += (distance(prevPos, foodTarget) - distance(pos, foodTarget)) * REWARD.PROGRESS_PER_METER;
    energy += blob.motorWork(dt) * REWARD.ENERGY_COST;

    if (distance(pos, foodTarget) < REWARD.EAT_RADIUS) {
      foodEaten += 1;
      foodTarget = foodSequence.next(pos);
    }
  }

  world.free();
  if (failed) return { ...FAILED };

  return {
    reward: progress + foodEaten * REWARD.FOOD_BONUS - energy,
    progress,
    foodEaten,
    energy,
    failed: false,
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
