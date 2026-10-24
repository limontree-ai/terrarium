// Weather: rain streaks, rain splash rings, snowfall, wind leaves and wind streaks.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { basicMaterial, patchMaterial, rng, setWind } from './core.js';

// createWeather({ radius, height }) returns a Group. Add it to the scene and call api.update(dt, center).
// api: setRain(0..1), setSnow(0..1), setWind(strength 0..1, angle radians), setSurfaceY(y)
export function createWeather({ radius = 16, height = 14, seed = 12 } = {}) {
  const group = new THREE.Group();
  const r = rng(seed);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const state = { rain: 0, snow: 0, wind: 0, windAngle: 0, surfaceY: 0, t: 0 };

  const rand = (n) => Array.from({ length: n }, () => [(r() * 2 - 1) * radius, r() * height, (r() * 2 - 1) * radius, r()]);

  /* rain */
  const RAIN = 900;
  const rainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.7, 0.018),
    basicMaterial({ color: '#CFEFFF', transparent: true, opacity: 0.6, depthWrite: false }), RAIN);
  const rainP = rand(RAIN);
  rainMesh.frustumCulled = false;
  rainMesh.count = 0;

  /* splash rings on the surface */
  const RINGS = 70;
  const ringGeo = new THREE.RingGeometry(0.65, 1, 8);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.InstancedMesh(ringGeo, basicMaterial({ color: '#E8F8FF', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }), RINGS);
  const ringP = Array.from({ length: RINGS }, () => [(r() * 2 - 1) * radius * 0.7, (r() * 2 - 1) * radius * 0.7, r()]);
  ringMesh.frustumCulled = false;
  ringMesh.count = 0;

  /* snow */
  const SNOW = 800;
  const snowMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), basicMaterial({ color: '#FFFFFF' }), SNOW);
  const snowP = rand(SNOW);
  snowMesh.frustumCulled = false;
  snowMesh.count = 0;

  /* wind leaves */
  const LEAVES = 90;
  const leafGeo = new THREE.OctahedronGeometry(1, 0);
  leafGeo.scale(0.09, 0.015, 0.05);
  const leafMat = patchMaterial(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8, side: THREE.DoubleSide }), {});
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
  const leafCols = [PALETTE.foliage.light, PALETTE.foliage.mid, PALETTE.leafAutumn.mid, PALETTE.leafAutumn.light];
  const leafP = rand(LEAVES);
  const leafC = new THREE.Color();
  for (let i = 0; i < LEAVES; i++) leafMesh.setColorAt(i, leafC.set(leafCols[i % 4]));
  leafMesh.frustumCulled = false;
  leafMesh.count = 0;

  /* wind streaks */
  const STREAKS = 70;
  const streakMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.012, 0.012),
    basicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.28, depthWrite: false }), STREAKS);
  const streakP = rand(STREAKS);
  streakMesh.frustumCulled = false;
  streakMesh.count = 0;

  group.add(rainMesh, ringMesh, snowMesh, leafMesh, streakMesh);

  const wrap = (v, lim) => ((((v + lim) % (2 * lim)) + 2 * lim) % (2 * lim)) - lim;

  const api = {
    setRain: (v) => { state.rain = THREE.MathUtils.clamp(v, 0, 1); },
    setSnow: (v) => { state.snow = THREE.MathUtils.clamp(v, 0, 1); },
    setWind: (s, a = state.windAngle) => { state.wind = THREE.MathUtils.clamp(s, 0, 1); state.windAngle = a; setWind(state.wind, a); },
    setSurfaceY: (y) => { state.surfaceY = y; },
    update(dt = 1 / 60, center = new THREE.Vector3()) {
      state.t += dt;
      group.position.set(center.x, center.y, center.z);
      const wx = Math.cos(state.windAngle), wz = Math.sin(state.windAngle);

      // rain
      const nr = Math.round(RAIN * state.rain);
      rainMesh.count = nr;
      rainMesh.visible = nr > 0;
      const tilt = Math.atan2(state.wind * 5, 16);
      for (let i = 0; i < nr; i++) {
        const p = rainP[i];
        p[1] -= (15 + p[3] * 4) * dt;
        p[0] += wx * state.wind * 5 * dt;
        p[2] += wz * state.wind * 5 * dt;
        if (p[1] < 0) { p[1] += height; p[0] = (r() * 2 - 1) * radius; p[2] = (r() * 2 - 1) * radius; }
        p[0] = wrap(p[0], radius); p[2] = wrap(p[2], radius);
        e.set(wz * tilt, 0, -wx * tilt);
        q.setFromEuler(e);
        m4.compose(pv.set(p[0], p[1], p[2]), q, sv.set(1, 1, 1));
        rainMesh.setMatrixAt(i, m4);
      }
      rainMesh.instanceMatrix.needsUpdate = true;

      // splash rings: expand then vanish
      const ng = Math.round(RINGS * state.rain);
      ringMesh.count = ng;
      ringMesh.visible = ng > 0;
      for (let i = 0; i < ng; i++) {
        const p = ringP[i];
        const k = (state.t * 1.7 + p[2]) % 1;
        const s = 0.04 + k * 0.3;
        m4.compose(pv.set(p[0], state.surfaceY - center.y + 0.04, p[1]), q.identity(), sv.set(k > 0.97 ? 0 : s, 1, k > 0.97 ? 0 : s));
        ringMesh.setMatrixAt(i, m4);
      }
      ringMesh.instanceMatrix.needsUpdate = true;

      // snow
      const ns = Math.round(SNOW * state.snow);
      snowMesh.count = ns;
      snowMesh.visible = ns > 0;
      for (let i = 0; i < ns; i++) {
        const p = snowP[i];
        p[1] -= (0.9 + p[3] * 0.9) * dt;
        p[0] += (Math.sin(state.t * 0.9 + p[3] * 20) * 0.4 + wx * state.wind * 3) * dt;
        p[2] += (Math.cos(state.t * 0.7 + p[3] * 14) * 0.4 + wz * state.wind * 3) * dt;
        if (p[1] < 0) p[1] += height;
        p[0] = wrap(p[0], radius); p[2] = wrap(p[2], radius);
        m4.compose(pv.set(p[0], p[1], p[2]), q.identity(), sv.setScalar(0.7 + p[3] * 0.8));
        snowMesh.setMatrixAt(i, m4);
      }
      snowMesh.instanceMatrix.needsUpdate = true;

      // wind leaves and streaks
      const w = state.wind;
      const nl = w < 0.06 ? 0 : Math.round(LEAVES * w);
      leafMesh.count = nl;
      leafMesh.visible = nl > 0;
      for (let i = 0; i < nl; i++) {
        const p = leafP[i];
        const sp = 2.5 + w * 9 + p[3] * 2;
        p[0] += wx * sp * dt; p[2] += wz * sp * dt;
        p[0] = wrap(p[0], radius); p[2] = wrap(p[2], radius);
        const y = 0.5 + p[3] * 4 + Math.sin(state.t * 2.2 + p[3] * 30) * 0.5;
        e.set(state.t * (2 + p[3] * 3) + p[3] * 10, state.t * 1.5 + p[3] * 7, state.t * 2.5);
        q.setFromEuler(e);
        m4.compose(pv.set(p[0], y, p[2]), q, sv.setScalar(1));
        leafMesh.setMatrixAt(i, m4);
      }
      leafMesh.instanceMatrix.needsUpdate = true;
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;

      const nk = w < 0.06 ? 0 : Math.round(STREAKS * w);
      streakMesh.count = nk;
      streakMesh.visible = nk > 0;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -state.windAngle);
      for (let i = 0; i < nk; i++) {
        const p = streakP[i];
        const sp = 6 + w * 14;
        p[0] += wx * sp * dt; p[2] += wz * sp * dt;
        p[0] = wrap(p[0], radius); p[2] = wrap(p[2], radius);
        m4.compose(pv.set(p[0], 0.4 + p[3] * 5, p[2]), q, sv.set(0.6 + w, 1, 1));
        streakMesh.setMatrixAt(i, m4);
      }
      streakMesh.instanceMatrix.needsUpdate = true;
    },
  };
  group.userData.api = api;
  group.userData.kind = 'weather';
  return group;
}
