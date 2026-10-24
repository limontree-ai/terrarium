import * as THREE from "three";
import { createBlob, MAX_LIMBS } from "../../assets/src/world3d/assets.js";
import { traitsOf } from "../blob/mutate.js";
import { DISPLAY } from "../config.js";

const GROUNDED_Y = 0.12; // meters; feet this close to the ground count as grounded
const MAX_ASSET_JOINTS = 2; // asset limbs show a shoulder and an elbow

/**
 * Visual blob parameters from a genome. The physics genome stays the source of
 * truth; the asset blob is an approximation: limb count from traitsOf, limb
 * length, width and thickness averaged across segments.
 */
export function blobVisualParams(genome) {
  const segments = genome.limbs.flatMap((l) => l.segments);
  const mean = (key, fallback) =>
    segments.length ? segments.reduce((s, seg) => s + seg[key], 0) / segments.length : fallback;
  return {
    size: genome.core.sizeA + genome.core.sizeB,
    limbCount: Math.min(MAX_LIMBS, traitsOf(genome).limbCount),
    limbs: {
      length: mean("length", 0.45),
      width: mean("width", 0.16),
      thickness: mean("thickness", 0.16),
    },
  };
}

// Physics joint index (0 is the core hinge) to the asset's flat limb * 2 + joint slot.
function motorSlots(genome) {
  const slots = [];
  let joint = 1;
  genome.limbs.forEach((limb, li) => {
    limb.segments.forEach((_, si) => {
      if (li < MAX_LIMBS && si < MAX_ASSET_JOINTS) slots.push({ joint, slot: li * 2 + si });
      joint++;
    });
  });
  return slots.filter((s) => s.joint < 8);
}

/**
 * The asset blob driven by the display physics.
 */
export function createBlobView(genome) {
  const params = blobVisualParams(genome);
  const root = createBlob(params);
  const api = root.userData.blob;
  const view = {
    root,
    api,
    params,
    slots: motorSlots(genome),
    lastPosition: null,
    velocity: new THREE.Vector3(),
  };
  return view;
}

/**
 * Adopt a new genome: limb count changes at once, limb shape morphs over
 * DISPLAY.MORPH_TIME seconds through the asset's evolve().
 */
export function setBlobGenome(view, genome, morph = true) {
  const params = blobVisualParams(genome);
  view.api.setLimbCount(params.limbCount);
  if (morph) view.api.evolve(params.limbs, DISPLAY.MORPH_TIME);
  else view.api.setLimbParams(params.limbs);
  view.root.scale.setScalar(params.size / view.params.size);
  view.slots = motorSlots(genome);
}

/**
 * Follow the physics core, light joints by motor output and animate the jelly.
 * @param {Array<{position, quaternion}>} bodyStates - from DisplaySim.bodyStates()
 * @param {number[]} outputs - brain outputs this step
 * @param {number} heading - core yaw from DisplaySim.heading
 */
export function updateBlobView(view, dt, bodyStates, outputs, heading) {
  if (!bodyStates.length) return { grounded: true, landed: false };
  const a = bodyStates[0].position;
  const b = bodyStates[1]?.position ?? a;
  const scale = view.root.scale.x;
  const halfHeight = 0.44 * view.params.size * scale * 0.5;
  const x = (a.x + b.x) / 2;
  const z = (a.z + b.z) / 2;
  const y = Math.max(0, Math.min(a.y, b.y) - halfHeight);

  if (view.lastPosition && dt > 0) {
    view.velocity.set(x - view.lastPosition.x, y - view.lastPosition.y, z - view.lastPosition.z).divideScalar(dt);
  }
  const wasGrounded = view.grounded ?? true;
  const grounded = y < GROUNDED_Y;
  view.lastPosition = { x, y, z };
  view.grounded = grounded;
  view.root.position.set(x, y, z);
  view.root.rotation.y = -heading;

  const activity = new Array(MAX_LIMBS * MAX_ASSET_JOINTS).fill(0);
  for (const { joint, slot } of view.slots) activity[slot] = Math.min(1, Math.abs(outputs[joint] ?? 0));
  view.api.setMotorActivities(activity);
  view.api.update(dt, { velocity: view.velocity, grounded });
  return { grounded, landed: grounded && !wasGrounded };
}
