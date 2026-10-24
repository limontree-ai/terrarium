import * as THREE from "three";
import { layoutBlob } from "../blob/build.js";
import * as config from "../config.js";
import { applyCurve } from "./shaders.js";

// Visuals are round jelly; each ellipsoid is a bit bigger than its box collider.
const JELLY_ROUNDNESS = 1.15;
const partGeom = new THREE.SphereGeometry(1, 24, 16);
const jointGeom = new THREE.SphereGeometry(0.05, 8, 8);

/**
 * Create a Three.js mesh for a creature (jelly blob): one jelly ellipsoid per
 * physics body, two eyes on the front (+x) of core half A, and a glow at each joint.
 * Pass the scene's curveUniforms so the creature follows the planet curve.
 */
export function createCreatureMesh(genome, curveUniforms) {
  const group = new THREE.Group();
  const layout = layoutBlob(genome);

  const bodyMat = new THREE.MeshPhongMaterial({
    color: config.DISPLAY.BLOB_COLOR,
    emissive: 0x8b6ba8,
    emissiveIntensity: 0.35,
    shininess: 90,
    transparent: true,
    opacity: 0.85,
  });
  const eyeMat = new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 120 });
  if (curveUniforms) {
    applyCurve(bodyMat, curveUniforms);
    applyCurve(eyeMat, curveUniforms);
  }

  // One pivot per physics body; the jelly child carries the scale.
  group.parts = layout.parts.map((part) => {
    const pivot = new THREE.Group();
    pivot.position.set(...part.center);
    const jelly = new THREE.Mesh(partGeom, bodyMat);
    jelly.scale.set(...part.half.map((h) => h * JELLY_ROUNDNESS));
    jelly.castShadow = true;
    pivot.add(jelly);
    pivot.jelly = jelly;
    group.add(pivot);
    return pivot;
  });

  // Eyes
  const [hx, hy, hz] = layout.parts[0].half;
  const eyeGeom = new THREE.SphereGeometry(Math.max(0.03, hx * 0.18), 12, 8);
  group.eyes = [-1, 1].map((side) => {
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(hx * JELLY_ROUNDNESS * 0.88, hy * 0.35, side * hz * 0.35);
    group.parts[0].add(eye);
    return eye;
  });

  // Glowing joints, at each hinge anchor on the child body
  group.joints = layout.joints.slice(0, 8).map((joint) => {
    const glowMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00 });
    if (curveUniforms) applyCurve(glowMat, curveUniforms);
    const glow = new THREE.Mesh(jointGeom, glowMat);
    glow.position.set(...joint.anchor2);
    glow.visible = false;
    group.parts[joint.child].add(glow);
    return glow;
  });

  group.genome = genome;
  group.layout = layout;

  return group;
}

/**
 * Update creature mesh each frame.
 * - bodyStates[i] = { position, quaternion } of physics body i (same order as buildBlob)
 * - Joint glows from motor outputs
 */
export function updateCreatureMesh(group, bodyStates, motorOutputs = [], elapsedTime) {
  if (bodyStates) {
    for (let i = 0; i < Math.min(group.parts.length, bodyStates.length); i++) {
      group.parts[i].position.copy(bodyStates[i].position);
      group.parts[i].quaternion.copy(bodyStates[i].quaternion);
    }
  }

  // Update joint glow (brightness = output magnitude)
  for (let i = 0; i < Math.min(group.joints.length, motorOutputs.length); i++) {
    const joint = group.joints[i];
    const intensity = Math.abs(motorOutputs[i]) * 2;
    joint.material.emissive.setHSL(0.15, 1, Math.min(0.6, intensity * 0.5));
    joint.visible = intensity > 0.1;
  }
}

/**
 * Morph creature smoothly when body changes (genome lerp over morphTime seconds).
 * Call on a mesh built from newGenome; parts start at their old sizes and grow
 * into the new ones. Skipped when the topology changed.
 */
export function morphCreature(group, oldGenome, newGenome, morphTime = config.DISPLAY.MORPH_TIME) {
  const from = layoutBlob(oldGenome).parts;
  const to = layoutBlob(newGenome).parts;
  if (from.length !== to.length || to.length !== group.parts.length) {
    group.morphStartTime = null;
    return;
  }

  group.morphStartTime = performance.now();
  group.morphDuration = morphTime * 1000; // ms
  group.morphFrom = from;
  group.morphTo = to;
  updateMorphAnimation(group, group.morphStartTime);
}

/**
 * Apply morph animation each frame.
 */
export function updateMorphAnimation(group, now = performance.now()) {
  if (!group.morphStartTime) return;

  const t = Math.min(1, (now - group.morphStartTime) / group.morphDuration);

  group.parts.forEach((pivot, i) => {
    const a = group.morphFrom[i].half;
    const b = group.morphTo[i].half;
    pivot.jelly.scale.set(
      ...a.map((h, k) => (h * (1 - t) + b[k] * t) * JELLY_ROUNDNESS)
    );
  });

  if (t >= 1) group.morphStartTime = null;
}
