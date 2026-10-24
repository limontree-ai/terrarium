import RAPIER from "@dimforge/rapier3d-compat";
import { createLocalWorld } from "../physics/world.js";
import { applyCustomForces } from "../physics/forces.js";
import { buildBlob } from "../blob/blob.js";
import { createFoodSequence } from "../physics/food.js";
import { PHYSICS, REWARD } from "../config.js";

const DT = PHYSICS.DT;
const MAX_STEPS_PER_FRAME = 4;

// RAPIER.init() only short-circuits once it has finished; overlapping calls (React
// StrictMode mounts twice) load the wasm twice and corrupt live objects.
let rapierReady = null;

/**
 * Display simulation: the creature you watch, running the current genome in its
 * own physics world on the main thread (same physics as trials).
 */
export class DisplaySim {
  static async create(genome, settings, seed, startPos = { x: 0, y: 1, z: 0 }, food) {
    rapierReady ??= RAPIER.init();
    await rapierReady;
    const world = await createLocalWorld(settings, seed);
    return new DisplaySim(world, buildBlob(world, genome, startPos), seed, food);
  }

  constructor(world, blob, seed, food) {
    this.world = world;
    this.blob = blob;
    this.foodSequence = createFoodSequence(seed);
    this.food = food ?? { ...world.foodPosition };
    this.outputs = [];
    this.accumulator = 0;
    this.foodEaten = 0;
    this.failed = false;
    this.trees = [];
    world.forEachCollider((c) => {
      if (c.shapeType() === RAPIER.ShapeType.Cylinder) {
        const t = c.translation();
        this.trees.push({ x: t.x, y: t.y, z: t.z });
      }
    });
  }

  step(dtSeconds) {
    if (this.failed) return;
    this.accumulator = Math.min(this.accumulator + dtSeconds, DT * MAX_STEPS_PER_FRAME);
    while (this.accumulator >= DT) {
      const inputs = this.blob.sense(this.food);
      this.outputs = this.blob.brain.forward(inputs);
      this.blob.act(this.outputs);
      applyCustomForces(this.world, this.blob.bodies);
      this.world.step();
      this.accumulator -= DT;
    }

    const pos = this.position;
    if (![pos.x, pos.y, pos.z].every(Number.isFinite) || pos.y < PHYSICS.FLOOR_Y || Math.abs(pos.x) > PHYSICS.ARENA_HALF || Math.abs(pos.z) > PHYSICS.ARENA_HALF) {
      this.failed = true;
      return;
    }

    if (Math.hypot(pos.x - this.food.x, pos.z - this.food.z) < REWARD.EAT_RADIUS) {
      this.foodEaten++;
      this.food = this.foodSequence.next(pos);
    }
  }

  bodyStates() {
    return this.blob.bodies.map((b) => ({ position: b.translation(), quaternion: b.rotation() }));
  }

  get position() {
    return this.blob.bodies[0].translation();
  }

  // Facing angle in the xz plane: forward (local +x) = (cos h, 0, sin h).
  get heading() {
    const q = this.blob.bodies[0].rotation();
    const fx = 1 - 2 * (q.y * q.y + q.z * q.z);
    const fz = 2 * (q.x * q.z - q.w * q.y);
    return Math.atan2(fz, fx);
  }

  free() {
    this.world.free();
  }
}
