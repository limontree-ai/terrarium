import { applyCustomForces, applyWeatherStep } from "./forces.js";
import { buildBlob } from "../blob/blob.js"; // imported from Prompt 2
import { createLocalWorld } from "./world.js";

/**
 * Run one trial.
 * @param {Genome} genome - creature to evaluate
 * @param {WorldSettings} settings - world settings
 * @param {Vector3} startPos - creature start position
 * @param {number} seed - random seed
 * @returns {TrialResult} { reward, progress, foodEaten, energy, failed }
 */
export async function runTrial(genome, settings, startPos, seed) {
  const world = await createLocalWorld(settings, seed);

  // Place creature
  const blob = buildBlob(world, genome, startPos);
  if (!blob) {
    world.free();
    return { reward: 0, progress: 0, foodEaten: 0, energy: 0, failed: true };
  }

  // Simulation
  let totalReward = 0;
  let totalProgress = 0;
  let foodEaten = 0;
  let totalEnergy = 0;
  let failed = false;
  let foodTarget = world.foodPosition;

  const TRIAL_STEPS = 180; // 6 seconds at 30 Hz
  const DT = 1 / 30;
  const ENERGY_COST = 0.002;

  for (let step = 0; step < TRIAL_STEPS; step++) {
    // === SENSE ===
    const inputs = blob.sense(world.foodPosition);

    // === BRAIN ===
    const outputs = blob.brain.forward(inputs);

    // === ACT ===
    blob.act(outputs);

    // === PHYSICS STEP ===
    applyCustomForces(world, blob.bodies);
    world.step();

    // === REWARD CALCULATION ===
    const pos = blob.bodies[0].translation(); // torso position
    const distToFood = distance(pos, foodTarget);

    // Progress: +1 per meter closer
    if (distToFood < 0.5) {
      totalReward += 5; // food bonus
      foodEaten += 1;
      // Pick new food target
      foodTarget = {
        x: Math.random() * 40 - 20,
        y: 0.5,
        z: Math.random() * 40 - 20,
      };
      totalProgress += 0.5; // approximate
    } else {
      const prevDist = distance(blob.prevPos || pos, foodTarget);
      const progressThisStep = Math.max(0, prevDist - distToFood);
      totalProgress += progressThisStep;
      totalReward += progressThisStep;
    }
    blob.prevPos = pos;

    // Energy cost
    // Motor work = |torque| * |speed| * dt
    // Approximate as sum of absolute outputs (motors fire)
    const motorWork = outputs.reduce((sum, out) => sum + Math.abs(out), 0);
    const energyCost = motorWork * ENERGY_COST;
    totalReward -= energyCost;
    totalEnergy += energyCost;

    // Check for blowups (NaN or extreme speed)
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
      failed = true;
      totalReward = 0;
      break;
    }

    const vel = blob.bodies[0].linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    if (speed > 50) {
      // Speed cap from config
      totalReward = 0;
      failed = true;
      break;
    }

    // Check if fell off island
    if (pos.y < -10 || Math.abs(pos.x) > 100 || Math.abs(pos.z) > 100) {
      totalReward = 0;
      failed = true;
      break;
    }
  }

  world.free();

  return {
    reward: totalReward,
    progress: totalProgress,
    foodEaten,
    energy: totalEnergy,
    failed,
  };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
