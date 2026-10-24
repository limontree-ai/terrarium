import RAPIER from "@dimforge/rapier3d-compat";
import { createBrain } from "./brain.js";
import { BRAIN } from "../config.js";

// Creature parts collide with the world but not with each other.
const CREATURE_GROUP = 0x0002;
const COLLISION_GROUPS = (CREATURE_GROUP << 16) | (0xffff & ~CREATURE_GROUP);

const MIN_CLEARANCE = 0.05;
const MAX_JOINT_SPEED = 10; // rad/s
const MOTOR_FACTOR = 1.0;
const FOOD_SENSE_RANGE = 20; // meters

const FACE_NORMALS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];
const HINGE_AXES = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const toVec = ([x, y, z]) => ({ x, y, z });
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const degToRad = (deg) => (deg * Math.PI) / 180;

/**
 * Lay out parts and joints relative to the creature origin.
 * All bodies start unrotated; each limb grows straight out of its face.
 */
function layoutBlob(genome) {
  const { sizeA, sizeB } = genome.core;
  const parts = [
    { center: [0, 0, 0], half: [sizeA / 2, sizeA / 2, sizeA / 2] },
    { center: [0, 0, sizeA / 4 + sizeB / 4], half: [sizeB / 2, sizeB / 2, sizeB / 2] },
  ];
  const joints = [
    {
      parent: 0,
      child: 1,
      anchor1: [0, 0, sizeA / 4],
      anchor2: [0, 0, -sizeB / 4],
      axis: [0, 0, 1],
      limits: [-Math.PI / 4, Math.PI / 4],
      strength: 1,
    },
  ];

  for (const limb of genome.limbs) {
    const normal = FACE_NORMALS[limb.face % 6];
    const normalAxis = normal.findIndex((c) => c !== 0);
    const [tangentU, tangentV] = [0, 1, 2].filter((a) => a !== normalAxis);

    let parentIdx = limb.half === 0 ? 0 : 1;
    const parentHalf = parts[parentIdx].half;
    let anchor = [0, 0, 0];
    anchor[normalAxis] = normal[normalAxis] * parentHalf[normalAxis];
    anchor[tangentU] = (limb.u - 0.5) * 2 * parentHalf[tangentU];
    anchor[tangentV] = (limb.v - 0.5) * 2 * parentHalf[tangentV];

    for (const seg of limb.segments) {
      const half = [0, 0, 0];
      half[normalAxis] = seg.length / 2;
      half[tangentU] = seg.width / 2;
      half[tangentV] = seg.thickness / 2;

      const childAnchor = [0, 0, 0];
      childAnchor[normalAxis] = -normal[normalAxis] * (seg.length / 2);

      const center = sub(add(parts[parentIdx].center, anchor), childAnchor);
      parts.push({ center, half });
      joints.push({
        parent: parentIdx,
        child: parts.length - 1,
        anchor1: anchor,
        anchor2: childAnchor,
        axis: HINGE_AXES[seg.axis % 3],
        limits: [degToRad(seg.minAngle), degToRad(seg.maxAngle)],
        strength: seg.strength,
      });

      parentIdx = parts.length - 1;
      anchor = [0, 0, 0];
      anchor[normalAxis] = normal[normalAxis] * (seg.length / 2);
    }
  }

  return { parts, joints };
}

/**
 * Build a creature in the physics world.
 * Returns { bodies, joints, brain, sense(foodPosition), act(outputs), genome }
 */
export function buildBlob(world, genome, startPos) {
  const layout = layoutBlob(genome);

  const lowest = Math.min(...layout.parts.map((p) => p.center[1] - p.half[1]));
  const lift = Math.max(0, MIN_CLEARANCE - (startPos.y + lowest));
  const origin = [startPos.x, startPos.y + lift, startPos.z];

  const bodies = layout.parts.map((part) => {
    const [x, y, z] = add(origin, part.center);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z));
    const collider = RAPIER.ColliderDesc.cuboid(...part.half)
      .setDensity(genome.density)
      .setCollisionGroups(COLLISION_GROUPS);
    world.createCollider(collider, body);
    return body;
  });

  const jointInfo = layout.joints.map((j) => {
    const data = RAPIER.JointData.revolute(toVec(j.anchor1), toVec(j.anchor2), toVec(j.axis));
    const joint = world.createImpulseJoint(data, bodies[j.parent], bodies[j.child], true);
    // Rapier 0.12 ignores JointData limits for revolute joints; set them on the joint.
    joint.setLimits(j.limits[0], j.limits[1]);
    return { joint, parent: bodies[j.parent], child: bodies[j.child], axis: j.axis, strength: j.strength };
  });
  const joints = jointInfo.map((j) => j.joint);

  let time = 0;
  const sense = (foodPosition) => senseBlobState(bodies, jointInfo, genome, foodPosition, time);
  const act = (outputs) => {
    actBlobJoints(jointInfo, outputs);
    time += world.timestep;
  };

  return { bodies, joints, brain: createBrain(genome), sense, act, genome };
}

// ---- Quaternion helpers ({x, y, z, w}) ----

function quatConj(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function quatMul(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function rotate(q, [x, y, z]) {
  const r = quatMul(quatMul(q, { x, y, z, w: 0 }), quatConj(q));
  return [r.x, r.y, r.z];
}

function jointAngle({ parent, child, axis }) {
  const rel = quatMul(quatConj(parent.rotation()), child.rotation());
  const sign = rel.w < 0 ? -1 : 1; // q and -q are the same rotation
  const s = sign * (rel.x * axis[0] + rel.y * axis[1] + rel.z * axis[2]);
  let angle = 2 * Math.atan2(s, sign * rel.w);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function jointSpeed({ parent, child, axis }) {
  const worldAxis = rotate(parent.rotation(), axis);
  const wp = parent.angvel();
  const wc = child.angvel();
  return (
    (wc.x - wp.x) * worldAxis[0] +
    (wc.y - wp.y) * worldAxis[1] +
    (wc.z - wp.z) * worldAxis[2]
  );
}

/**
 * 29 inputs, fixed slots:
 * [0-15] joint angle/velocity pairs (8 joints, zero-padded)
 * [16-19] foot contacts, [20-22] core up vector,
 * [23-24] food direction (forward/right in body frame), [25] food distance,
 * [26] underwater fraction, [27] ground layer drag, [28] rhythm oscillator
 */
function senseBlobState(bodies, jointInfo, genome, foodPosition, time) {
  const inputs = new Float32Array(BRAIN.INPUTS);

  for (let i = 0; i < Math.min(8, jointInfo.length); i++) {
    inputs[2 * i] = jointAngle(jointInfo[i]) / Math.PI;
    inputs[2 * i + 1] = jointSpeed(jointInfo[i]) / 10;
  }

  // [16-19] foot contacts: not simulated yet

  const core = bodies[0];
  const q = core.rotation();
  const up = rotate(q, [0, 1, 0]);
  inputs[20] = up[0];
  inputs[21] = up[1];
  inputs[22] = up[2];

  if (foodPosition) {
    const pos = core.translation();
    const local = rotate(quatConj(q), [foodPosition.x - pos.x, 0, foodPosition.z - pos.z]);
    const planar = Math.hypot(local[0], local[2]);
    if (planar > 1e-6) {
      inputs[23] = local[0] / planar;
      inputs[24] = local[2] / planar;
    }
    const dist = Math.hypot(foodPosition.x - pos.x, foodPosition.z - pos.z);
    inputs[25] = Math.min(1, dist / FOOD_SENSE_RANGE);
  }

  // [26] underwater fraction, [27] ground layer drag: not simulated yet

  inputs[28] = Math.sin(2 * Math.PI * genome.rhythmHz * time);

  return inputs;
}

function actBlobJoints(jointInfo, outputs) {
  for (let i = 0; i < Math.min(8, jointInfo.length); i++) {
    const { joint, strength } = jointInfo[i];
    const target = Math.max(
      -MAX_JOINT_SPEED,
      Math.min(MAX_JOINT_SPEED, outputs[i] * strength)
    );
    joint.configureMotorVelocity(target, MOTOR_FACTOR);
  }
}
