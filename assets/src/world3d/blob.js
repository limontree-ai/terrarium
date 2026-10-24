// The blob: the only smooth object in the world. Light purple translucent glossy jelly,
// two black eyes, limbs that grow from the body and morph gradually, glowing joints,
// and visual jelly polish (wobble, squash and stretch, ripples) layered over the physics.
import * as THREE from 'three';
import { patchMaterial } from './core.js';

export const BLOB_COLOR = '#C8A8F0';

// Slot order around the body. Angle 0 is the front (+z), positive turns toward +x.
const LIMB_ANGLES = [Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI / 4, -Math.PI / 4];
export const MAX_LIMBS = LIMB_ANGLES.length;

function makeJellyMaterial() {
  const uniforms = {
    uLag: { value: new THREE.Vector3() },
    uWobble: { value: 0.008 },
    uRipple: { value: new THREE.Vector4(0, 1, 0, 0) },
    uRippleT: { value: 10 },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color: BLOB_COLOR,
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
    emissive: '#8F6BD6',
    emissiveIntensity: 0.18,
    sheen: 0.6,
    sheenColor: new THREE.Color('#EBDDFF'),
    specularIntensity: 1,
  });
  patchMaterial(m, {
    cacheKey: 'jelly',
    extraUniforms: uniforms,
    extraDecl: 'uniform vec3 uLag; uniform float uWobble; uniform vec4 uRipple; uniform float uRippleT;',
    vertexExtra: `
      {
        vec3 dirN = normalize(position + vec3(0.0001));
        float k = smoothstep(-0.55, 0.55, position.y);
        transformed.xz += uLag.xz * k * k;
        transformed.y += uLag.y * k * 0.5;
        float wob = sin(uTime * 3.1 + position.x * 6.0 + position.z * 4.0) * cos(uTime * 2.3 + position.y * 5.0);
        transformed += dirN * wob * uWobble;
        float dd = acos(clamp(dot(dirN, uRipple.xyz), -1.0, 1.0));
        float rp = sin(dd * 14.0 - uRippleT * 16.0) * exp(-uRippleT * 3.2) * exp(-dd * 1.4) * uRipple.w;
        transformed += dirN * rp;
      }`,
    fragmentExtra: `
      {
        float fres = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.86, 1.0), fres * 0.6);
        diffuseColor.a = mix(diffuseColor.a, 0.97, fres * 0.75);
      }`,
  });
  return { material: m, uniforms };
}

function glowMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: '#FFD9FF', transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false,
  });
}

// Simple damped spring step, returns new [x, v].
function spring(x, v, target, k, c, dt) {
  const a = k * (target - x) - c * v;
  v += a * dt;
  x += v * dt;
  return [x, v];
}

/*
  createBlob({ size, limbCount, limbs: { length, width, thickness } })
  API (group.userData.blob):
    setLimbCount(n)                      show 0 to 6 limbs
    setLimbParams({length,width,thickness})   set instantly
    evolve({length,width,thickness}, seconds)  morph gradually (default 90 seconds)
    setJointActivity(limbIndex, jointIndex, 0..1)   jointIndex 0 shoulder, 1 elbow
    setMotorActivities(array)            flat array, limb * 2 + joint
    impact(worldDir, strength)           ripple + shake when he bumps into something
    landed(speed), push(strength)        squash on landing, stretch on pushing off
    update(dt, { velocity, grounded })   call every frame
*/
export function createBlob({ size = 1, limbCount = 0, limbs = { length: 0.45, width: 0.16, thickness: 0.16 } } = {}) {
  const root = new THREE.Group();
  const pivot = new THREE.Group(); // squash and stretch around the feet
  root.add(pivot);

  const bodyJelly = makeJellyMaterial();
  const limbJelly = makeJellyMaterial();
  limbJelly.uniforms.uWobble.value = 0.004;

  // body
  const BODY_R = 0.5, BODY_Y = 0.44, BODY_SY = 0.88;
  const body = new THREE.Mesh(new THREE.SphereGeometry(BODY_R, 56, 40), bodyJelly.material);
  body.scale.set(1, BODY_SY, 1);
  body.position.y = BODY_Y;
  body.renderOrder = 5;
  body.castShadow = false;
  pivot.add(body);

  // eyes: two small black spheres on the front. Nothing else on the face.
  const eyeMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#0B0A10', roughness: 0.18, metalness: 0.2 }), {});
  const eyes = [];
  [-1, 1].forEach((s) => {
    const dir = new THREE.Vector3(s * 0.33, 0.2, 0.92).normalize();
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), eyeMat);
    eye.position.set(dir.x * 0.51, BODY_Y + dir.y * 0.51 * BODY_SY, dir.z * 0.51);
    eye.renderOrder = 6;
    pivot.add(eye);
    eyes.push(eye);
  });

  // limbs
  const limbParams = { length: limbs.length, width: limbs.width, thickness: limbs.thickness };
  const limbList = [];
  const unitSphere = new THREE.SphereGeometry(1, 20, 14);
  const glowGeo = new THREE.SphereGeometry(1, 12, 8);

  function makeLimb(i) {
    const th = LIMB_ANGLES[i];
    const root_ = new THREE.Group();
    const dir = new THREE.Vector3(Math.sin(th) * Math.cos(0.75), -Math.sin(0.75), Math.cos(th) * Math.cos(0.75)).normalize();
    root_.position.set(Math.sin(th) * 0.43, 0.3, Math.cos(th) * 0.43);
    root_.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const upper = new THREE.Mesh(unitSphere, limbJelly.material);
    upper.renderOrder = 5;
    const elbow = new THREE.Group();
    const lower = new THREE.Mesh(unitSphere, limbJelly.material);
    lower.renderOrder = 5;
    elbow.add(lower);
    root_.add(upper, elbow);

    const mkGlow = () => {
      const inner = new THREE.Mesh(glowGeo, glowMaterial(0.2));
      const halo = new THREE.Mesh(glowGeo, glowMaterial(0.08));
      inner.renderOrder = 2;
      halo.renderOrder = 2;
      return { inner, halo };
    };
    const g0 = mkGlow(), g1 = mkGlow();
    root_.add(g0.inner, g0.halo);
    elbow.add(g1.inner, g1.halo);
    pivot.add(root_);
    const limb = { root: root_, upper, elbow, lower, glows: [g0, g1], activity: [0, 0], shown: [0, 0], bend: -0.9 - (i % 2) * 0.1 };
    return limb;
  }
  for (let i = 0; i < MAX_LIMBS; i++) limbList.push(makeLimb(i));

  function applyLimbParams() {
    const { length: L, width: W, thickness: T } = limbParams;
    const L2 = L * 0.9;
    limbList.forEach((l) => {
      l.upper.scale.set(W * 0.5, L * 0.5, T * 0.5);
      l.upper.position.y = L * 0.5 - 0.02;
      l.elbow.position.y = L - 0.04;
      l.elbow.rotation.set(l.bend, 0, 0);
      l.lower.scale.set(W * 0.43, L2 * 0.5, T * 0.43);
      l.lower.position.y = L2 * 0.5 - 0.02;
      const gr = Math.max(0.02, W * 0.28);
      l.glows[0].inner.scale.setScalar(gr);
      l.glows[0].halo.scale.setScalar(gr * 2.1);
      l.glows[0].inner.position.y = 0.02;
      l.glows[0].halo.position.y = 0.02;
      l.glows[1].inner.scale.setScalar(gr);
      l.glows[1].halo.scale.setScalar(gr * 2.1);
    });
  }

  let shownCount = 0;
  function setLimbCount(n) {
    shownCount = Math.max(0, Math.min(MAX_LIMBS, Math.round(n)));
    limbList.forEach((l, i) => (l.root.visible = i < shownCount));
  }

  // gradual morph
  const morph = { active: false, from: null, to: null, t: 0, dur: 1 };
  function evolve(target, seconds = 90) {
    morph.active = true;
    morph.from = { ...limbParams };
    morph.to = { length: target.length ?? limbParams.length, width: target.width ?? limbParams.width, thickness: target.thickness ?? limbParams.thickness };
    morph.t = 0;
    morph.dur = Math.max(0.01, seconds);
  }
  function setLimbParams(p) {
    morph.active = false;
    Object.assign(limbParams, p);
    applyLimbParams();
  }

  // jelly physics visuals
  const J = {
    sq: 0, sqv: 0,
    lag: new THREE.Vector3(), lagv: new THREE.Vector3(),
    prevVel: new THREE.Vector3(), prevGrounded: true,
    rippleT: 10,
  };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  function impact(worldDir, strength = 1) {
    // worldDir points from the blob toward the thing it hit
    tmpQ.copy(root.quaternion).invert();
    tmpV.copy(worldDir).normalize().applyQuaternion(tmpQ);
    const u = bodyJelly.uniforms;
    u.uRipple.value.set(tmpV.x, tmpV.y, tmpV.z, Math.min(0.14, 0.03 + strength * 0.04));
    J.rippleT = 0;
    J.lagv.addScaledVector(tmpV, -strength * 0.5);
    J.sqv -= strength * 0.8;
  }
  const landed = (speed = 3) => { J.sqv -= Math.min(6, speed * 1.4); };
  const push = (strength = 1) => { J.sqv += Math.min(6, strength * 3.5); };

  function setJointActivity(limbIndex, jointIndex, v) {
    if (limbList[limbIndex]) limbList[limbIndex].activity[jointIndex] = THREE.MathUtils.clamp(v, 0, 1);
  }
  function setMotorActivities(arr) {
    for (let i = 0; i < arr.length; i++) setJointActivity(i >> 1, i & 1, arr[i]);
  }

  function update(dt = 1 / 60, { velocity = null, grounded = true } = {}) {
    dt = Math.min(dt, 1 / 20);
    // limb morph
    if (morph.active) {
      morph.t += dt;
      const k = THREE.MathUtils.smootherstep(Math.min(1, morph.t / morph.dur), 0, 1);
      for (const key of ['length', 'width', 'thickness']) limbParams[key] = morph.from[key] + (morph.to[key] - morph.from[key]) * k;
      applyLimbParams();
      if (morph.t >= morph.dur) morph.active = false;
    }
    // joint glow easing
    limbList.forEach((l) => {
      for (let j = 0; j < 2; j++) {
        l.shown[j] += (l.activity[j] - l.shown[j]) * Math.min(1, dt * 10);
        const a = l.shown[j];
        l.glows[j].inner.material.opacity = 0.18 + 0.82 * a;
        l.glows[j].halo.material.opacity = 0.06 + 0.4 * a;
      }
    });
    // velocity driven polish
    const vel = velocity || tmpV.set(0, 0, 0);
    const accel = vel.clone().sub(J.prevVel).divideScalar(Math.max(dt, 1e-4));
    J.prevVel.copy(vel);
    if (grounded && !J.prevGrounded) landed(Math.abs(vel.y) + 2);
    J.prevGrounded = grounded;
    // lag spring: top of the blob trails behind motion
    const lagTarget = new THREE.Vector3(-vel.x, -vel.y * 0.5, -vel.z).multiplyScalar(0.035);
    ['x', 'y', 'z'].forEach((ax) => {
      const [x, v] = spring(J.lag[ax], J.lagv[ax], lagTarget[ax], 90, 6, dt);
      J.lag[ax] = THREE.MathUtils.clamp(x, -0.2, 0.2);
      J.lagv[ax] = v;
    });
    J.lagv.addScaledVector(accel, -0.00035);
    const lagU = bodyJelly.uniforms.uLag.value;
    // lag is defined in world space, convert to the blob's local space
    tmpQ.copy(root.quaternion).invert();
    lagU.copy(J.lag).applyQuaternion(tmpQ);
    limbJelly.uniforms.uLag.value.copy(lagU).multiplyScalar(0.6);
    // squash and stretch
    const stretchTarget = grounded ? 0 : THREE.MathUtils.clamp(vel.y * 0.035, -0.22, 0.3);
    const [sq, sqv] = spring(J.sq, J.sqv, stretchTarget, 120, 7, dt);
    J.sq = THREE.MathUtils.clamp(sq, -0.45, 0.5);
    J.sqv = sqv;
    const sy = 1 + J.sq;
    const sxz = 1 / Math.sqrt(sy);
    pivot.scale.set(sxz, sy, sxz);
    // ripple clock
    J.rippleT += dt;
    bodyJelly.uniforms.uRippleT.value = J.rippleT;
    const speed = Math.hypot(vel.x, vel.z);
    bodyJelly.uniforms.uWobble.value = 0.008 + Math.min(0.012, speed * 0.004);
  }

  root.scale.setScalar(size);
  setLimbCount(limbCount);
  applyLimbParams();

  const api = { setLimbCount, setLimbParams, evolve, setJointActivity, setMotorActivities, impact, landed, push, update, limbParams, body, eyes, limbs: limbList, pivot };
  root.userData.blob = api;
  root.userData.kind = 'blob';
  return root;
}
