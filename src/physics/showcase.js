// Live Rapier world on the main thread for the creatures you watch on the island.
// Evaluation happens headlessly in workers; this only animates each generation's champions.
import RAPIER from '@dimforge/rapier3d-compat';
import { buildCreature, actuate, SIM_DT } from '../evolution/simulate.js';

export const ARENA_RADIUS = 8;

// Initialise the WASM module once; re-initialising invalidates every existing Rapier object.
let rapierReady;
const initRapier = () => (rapierReady ??= RAPIER.init());

export class Showcase {
  static async create(settings) {
    await initRapier();
    return new Showcase(settings);
  }

  constructor(settings) {
    this.world = new RAPIER.World({ x: 0, y: -settings.gravity, z: 0 });
    this.world.timestep = SIM_DT;
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(0.5, ARENA_RADIUS + 1).setTranslation(0, -0.5, 0).setFriction(1));
    this.creatures = [];
    this.time = 0;
    this.accumulator = 0;
  }

  setGravity(g) {
    this.world.gravity = { x: 0, y: -g, z: 0 };
  }

  // Replace the current creatures with a new set of genomes, spaced in a ring.
  spawn(genomes) {
    for (const c of this.creatures) c.bodies.forEach((b) => this.world.removeRigidBody(b));
    this.creatures = genomes.map((genome, i) => {
      const angle = (i / genomes.length) * Math.PI * 2;
      const r = ARENA_RADIUS * 0.45;
      const creature = buildCreature(RAPIER, this.world, genome, [Math.cos(angle) * r, 1, Math.sin(angle) * r]);
      return { ...creature, genome };
    });
    this.time = 0;
  }

  update(dt) {
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= SIM_DT) {
      for (const c of this.creatures) actuate(c, this.time);
      this.world.step();
      this.time += SIM_DT;
      this.accumulator -= SIM_DT;
    }
  }

  dispose() {
    this.world.free();
  }
}
