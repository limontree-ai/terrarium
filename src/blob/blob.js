/**
 * Placeholder blob: a single box body with a 29-16-8 brain.
 * Prompt 2 replaces this with the real articulated blob; it keeps
 * the interface runTrial() needs: startGenome() and buildBlob().
 */
import RAPIER from "@dimforge/rapier3d-compat";
import seedrandom from "seedrandom";
import { BRAIN, CREATURE } from "../config.js";

export function startGenome() {
  const rng = seedrandom("start-genome");
  const brain = new Float32Array(BRAIN.WEIGHTS);
  for (let i = 0; i < brain.length; i++) brain[i] = (rng() - 0.5) * 0.2;
  return {
    core: { sizeA: 0.4, sizeB: 0.3 },
    limbs: [],
    density: 800,
    rhythmHz: 1.0,
    brain,
    sigma: 0.1,
  };
}

function createBrain(weights) {
  const { INPUTS, HIDDEN, OUTPUTS } = BRAIN;
  const w1 = 0;
  const w2 = w1 + INPUTS * HIDDEN;
  const b1 = w2 + HIDDEN * OUTPUTS;
  const b2 = b1 + HIDDEN;
  return {
    forward(inputs) {
      const hidden = new Array(HIDDEN);
      for (let h = 0; h < HIDDEN; h++) {
        let sum = weights[b1 + h];
        for (let i = 0; i < INPUTS; i++) sum += inputs[i] * weights[w1 + i * HIDDEN + h];
        hidden[h] = Math.tanh(sum);
      }
      const outputs = new Array(OUTPUTS);
      for (let o = 0; o < OUTPUTS; o++) {
        let sum = weights[b2 + o];
        for (let h = 0; h < HIDDEN; h++) sum += hidden[h] * weights[w2 + h * OUTPUTS + o];
        outputs[o] = Math.tanh(sum);
      }
      return outputs;
    },
  };
}

function clampSize(value) {
  return Math.min(CREATURE.CORE_SIZE_MAX, Math.max(CREATURE.CORE_SIZE_MIN, value));
}

export function buildBlob(world, genome, startPos) {
  const size = clampSize(genome.core.sizeA);
  const height = clampSize(genome.core.sizeB);

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
    startPos.x,
    startPos.y,
    startPos.z
  );
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, height / 2, size / 2)
    .setDensity(genome.density);
  world.createCollider(colliderDesc, body);

  const dt = world.timestep;
  let time = 0;

  return {
    bodies: [body],
    brain: createBrain(genome.brain),
    sense(foodPosition) {
      const pos = body.translation();
      const vel = body.linvel();
      const phase = 2 * Math.PI * genome.rhythmHz * time;
      const inputs = new Array(BRAIN.INPUTS).fill(0);
      inputs[0] = (foodPosition.x - pos.x) / 20;
      inputs[1] = (foodPosition.z - pos.z) / 20;
      inputs[2] = vel.x / 10;
      inputs[3] = vel.y / 10;
      inputs[4] = vel.z / 10;
      inputs[5] = pos.y;
      inputs[6] = Math.sin(phase);
      inputs[7] = Math.cos(phase);
      return inputs;
    },
    act(outputs) {
      time += dt;
      const strength = 0.05 * body.mass();
      body.applyImpulse(
        { x: outputs[0] * strength, y: 0, z: outputs[1] * strength },
        true
      );
    },
  };
}
