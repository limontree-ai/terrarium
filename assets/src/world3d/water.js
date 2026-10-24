// Water: lake basin with sandy shore, faceted animated surface, depth coloring, foam,
// seaweed, pebbles, bubbles, underwater tint and fog.
import * as THREE from 'three';
import { PALETTE, colorsOf } from './palette.js';
import {
  Builder, flatMaterial, patchMaterial, toneColor, hash3, rng, writePlacements, worldUniforms, rawColor,
} from './core.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function makeGeo(pos, nor, col, up) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aUp', new THREE.Float32BufferAttribute(up, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
function faceNormal(p, q, r, out = _n) {
  _a.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
  _b.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
  return out.crossVectors(_a, _b).normalize();
}

/* ------------------------------------------------------------------ */
/* Lake                                                                */
/* ------------------------------------------------------------------ */
// createLake({ radius, depth, level })
//   level is the water level from 0 to 1 (0% empty, 100% full to the rim)
// Group userData: setLevel(l), update(t), getWaterY(), getWaterRadius(), floorAt(x, z), refreshDecor()
export function createLake({ radius = 8, depth = 2.4, level = 0.8, seed = 5, decor = true } = {}) {
  const R = radius;
  const group = new THREE.Group();
  const floorH = (r) => (r < R ? -depth * (1 - (r / R) ** 2) : 0);

  /* --- basin with sand shore (polar grid) --- */
  const RF = [0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.82, 0.9, 0.96, 1.0, 1.1, 1.22, 1.36, 1.55];
  const S = 30;
  const rr = rng(seed);
  const jr = [], ja = [];
  for (let i = 0; i < RF.length; i++) {
    jr.push([]); ja.push([]);
    for (let k = 0; k < S; k++) {
      jr[i].push(i === 0 || i === RF.length - 1 ? 0 : (rr() - 0.5) * 0.07);
      ja[i].push((rr() - 0.5) * 0.12);
    }
  }
  const verts = RF.map((f, i) =>
    Array.from({ length: S }, (_, k) => {
      const th = ((k + ja[i][k]) / S) * Math.PI * 2;
      const r = R * (f + (i === 0 ? 0 : jr[i][k]));
      return [Math.cos(th) * r, floorH(r), Math.sin(th) * r];
    })
  );
  const sand = colorsOf(PALETTE.sand), grass = colorsOf(PALETTE.grass);
  const pos = [], nor = [], col = [], up = [];
  const tri = (p, q, r) => {
    let n = faceNormal(p, q, r);
    if (n.y < 0) { [q, r] = [r, q]; n = faceNormal(p, q, r); }
    const cx = (p[0] + q[0] + r[0]) / 3, cz = (p[2] + q[2] + r[2]) / 3;
    const rc = Math.hypot(cx, cz) / R;
    const j = hash3(cx, 0, cz, seed);
    let palette;
    if (rc < 1.1) palette = sand;
    else if (rc < 1.3) palette = j < (1.3 - rc) / 0.2 ? sand : grass;
    else palette = grass;
    const c = toneColor(palette, n.x, n.y, n.z, j, 0.05);
    for (const v of [p, q, r]) {
      pos.push(...v); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); up.push(Math.max(0, n.y));
    }
  };
  for (let k = 0; k < S; k++) {
    const k2 = (k + 1) % S;
    tri(verts[0][0], verts[1][k], verts[1][k2]);
    for (let i = 1; i < RF.length - 1; i++) {
      tri(verts[i][k], verts[i + 1][k], verts[i + 1][k2]);
      tri(verts[i][k], verts[i + 1][k2], verts[i][k2]);
    }
  }
  const basin = new THREE.Mesh(makeGeo(pos, nor, col, up), flatMaterial({ roughness: 0.95 }));
  basin.receiveShadow = true;
  group.add(basin);

  /* --- water surface --- */
  const RW = [0, 0.2, 0.4, 0.6, 0.78, 0.92, 1.0];
  const SW = 28;
  const wr = rng(seed + 2);
  const wv = RW.map((f, i) =>
    Array.from({ length: SW }, (_, k) => {
      const th = ((k + (i === 0 ? 0 : (wr() - 0.5) * 0.3)) / SW) * Math.PI * 2;
      const r = i === 0 ? 0 : f * (i === RW.length - 1 ? 1 : 1 + (wr() - 0.5) * 0.04);
      return [Math.cos(th) * r, 0, Math.sin(th) * r];
    })
  );
  const wpos = [], wnor = [], faceU = [];
  const wtri = (p, q, r) => {
    let n = faceNormal(p, q, r);
    if (n.y < 0) { [q, r] = [r, q]; }
    for (const v of [p, q, r]) { wpos.push(...v); wnor.push(0, 1, 0); }
    faceU.push(Math.hypot((p[0] + q[0] + r[0]) / 3, (p[2] + q[2] + r[2]) / 3));
  };
  for (let k = 0; k < SW; k++) {
    const k2 = (k + 1) % SW;
    wtri(wv[0][0], wv[1][k], wv[1][k2]);
    for (let i = 1; i < RW.length - 1; i++) {
      wtri(wv[i][k], wv[i + 1][k], wv[i + 1][k2]);
      wtri(wv[i][k], wv[i + 1][k2], wv[i][k2]);
    }
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  waterGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wnor, 3));
  waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(wpos.length).fill(1), 3));
  waterGeo.setAttribute('aUp', new THREE.Float32BufferAttribute(new Array(wpos.length / 3).fill(1), 1));
  waterGeo.computeBoundingSphere();

  const waveR = { value: R };
  const waterMat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.8, depthWrite: false,
  });
  patchMaterial(waterMat, {
    cacheKey: 'wave',
    extraUniforms: { uWaveR: waveR },
    extraDecl: 'uniform float uWaveR;',
    vertexExtra: `
      {
        vec3 wp = position * vec3(uWaveR, 1.0, uWaveR);
        float edge = 1.0 - smoothstep(0.82, 1.0, length(position.xz));
        float w = (sin(wp.x * 0.9 + uTime * 1.3) + cos(wp.z * 1.1 + uTime * 1.0)) * 0.045 + sin((wp.x + wp.z) * 1.7 + uTime * 1.9) * 0.028;
        transformed.y += w * (0.35 + 0.65 * edge);
      }`,
  });
  waterMat.defines.TW_WAVE = '';
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  water.renderOrder = 2;
  group.add(water);

  const shallow = colorsOf(PALETTE.shallowWater), deep = colorsOf(PALETTE.deepWater);
  const tmpC = new THREE.Color();
  function recolor(lvl) {
    const c = waterGeo.attributes.color;
    for (let f = 0; f < faceU.length; f++) {
      const u = faceU[f];
      const absDepth = depth * lvl * (1 - u * u);
      const t = THREE.MathUtils.smoothstep(absDepth, 0.05, 1.7);
      const j = hash3(f, 3, 1, seed);
      const tone = j < 0.3 ? 'light' : j < 0.75 ? 'mid' : 'shadow';
      tmpC.copy(shallow[tone]).lerp(deep[tone], t);
      for (let k = 0; k < 3; k++) c.setXYZ(f * 3 + k, tmpC.r, tmpC.g, tmpC.b);
    }
    c.needsUpdate = true;
  }

  /* --- shoreline foam --- */
  const fb = new Builder();
  const ringGeo = new THREE.RingGeometry(0.93, 1.07, SW, 1);
  ringGeo.rotateX(-Math.PI / 2);
  fb.add(ringGeo, { palette: PALETTE.foam, jitter: 0.012, seed: seed + 9, vary: 0.05 });
  const fr = rng(seed + 4);
  for (let i = 0; i < 18; i++) {
    const th = (i / 18) * Math.PI * 2 + fr() * 0.2;
    fb.add(new THREE.IcosahedronGeometry(1, 0), {
      palette: PALETTE.foam, pos: [Math.cos(th) * (1.0 + fr() * 0.05), 0.015, Math.sin(th) * (1.0 + fr() * 0.05)],
      scale: [0.05 + fr() * 0.04, 0.015, 0.04 + fr() * 0.03], rot: [0, th, 0], vary: 0.04, seed: i,
    });
  }
  const foam = new THREE.Mesh(fb.build(), flatMaterial({ roughness: 0.6 }));
  foam.castShadow = false;
  foam.renderOrder = 3;
  group.add(foam);

  /* --- underwater decor --- */
  let seaweed = null, pebbles = null, bubbles = null;
  const bubbleData = [];
  if (decor) {
    const dr = rng(seed + 6);
    // pebbles
    const pgeo = new Builder().add(new THREE.IcosahedronGeometry(1, 0), { palette: PALETTE.pebble, jitter: 0.2, scale: [1, 0.7, 0.85], seed: 3 }).build();
    pebbles = new THREE.InstancedMesh(pgeo, flatMaterial(), 70);
    const pp = [];
    for (let i = 0; i < 70; i++) {
      const a = dr() * Math.PI * 2, d = Math.sqrt(dr()) * R * 1.12;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.06 + dr() * 0.12;
      pp.push({ x, y: floorH(Math.hypot(x, z)) + s * 0.25, z, s, yaw: dr() * 6.28 });
    }
    writePlacements(pebbles, pp);
    pebbles.receiveShadow = true;
    group.add(pebbles);

    // seaweed strands: tall low poly ribbons that sway
    const sb = new Builder();
    const L = [], Rr = [];
    const segs = 6;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const w = 0.09 * (1 - t * 0.85);
      const bend = Math.sin(t * 2.2) * 0.08;
      L.push([-w + bend, t * 1.5, 0]);
      Rr.push([w + bend, t * 1.5, 0]);
    }
    sb.addStrip(L, Rr, { palette: PALETTE.seaweed, vary: 0.05 });
    seaweed = new THREE.InstancedMesh(sb.build(), flatMaterial({ kelp: 1.5, side: THREE.DoubleSide }), 40);
    const sp = [];
    for (let i = 0; i < 40; i++) {
      const a = dr() * Math.PI * 2, d = (0.1 + Math.sqrt(dr()) * 0.78) * R;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      sp.push({ x, y: floorH(d), z, s: 0.8 + dr() * 0.7, yaw: dr() * 6.28 });
    }
    seaweed.userData.placements = sp;
    seaweed.frustumCulled = false;
    group.add(seaweed);

    // bubbles
    const bgeo = new Builder().add(new THREE.IcosahedronGeometry(1, 0), { palette: PALETTE.bubble, vary: 0.02 }).build();
    const bmat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.1, transparent: true, opacity: 0.72 });
    patchMaterial(bmat, {});
    bubbles = new THREE.InstancedMesh(bgeo, bmat, 36);
    for (let i = 0; i < 36; i++) {
      const a = dr() * Math.PI * 2, d = Math.sqrt(dr()) * R * 0.7;
      bubbleData.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 0.04 + dr() * 0.05, ph: dr(), sp: 0.08 + dr() * 0.1 });
    }
    bubbles.frustumCulled = false;
    group.add(bubbles);
  }

  /* --- state + api --- */
  const state = { level: 0, waterY: -depth, waterR: 0 };
  const ud = group.userData;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sv = new THREE.Vector3();
  ud.radius = R;
  ud.depth = depth;
  ud.floorAt = (x, z) => floorH(Math.hypot(x, z));
  ud.getWaterY = () => state.waterY;
  ud.getWaterRadius = () => state.waterR;
  ud.refreshDecor = () => {
    if (!seaweed) return;
    const cap = (p) => state.waterY - p.y;
    writePlacements(seaweed, seaweed.userData.placements, (p) => {
      const c = cap(p);
      if (c < 0.25) return new THREE.Vector3(0, 0, 0);
      return new THREE.Vector3(p.s * 0.9, Math.min(p.s, (c - 0.08) / 1.5), p.s * 0.9);
    });
  };
  ud.setLevel = (l) => {
    state.level = THREE.MathUtils.clamp(l, 0, 1);
    state.waterY = -depth * (1 - state.level);
    state.waterR = R * Math.sqrt(state.level);
    water.visible = foam.visible = state.waterR > 0.15;
    water.position.y = state.waterY;
    water.scale.set(state.waterR, 1, state.waterR);
    waveR.value = state.waterR;
    foam.position.y = state.waterY + 0.03;
    foam.scale.set(state.waterR, 1, state.waterR);
    recolor(state.level);
    ud.refreshDecor();
  };
  ud.update = (t) => {
    const pulse = 1 + Math.sin(t * 1.3) * 0.012;
    foam.scale.set(state.waterR * pulse, 1, state.waterR * pulse);
    if (bubbles) {
      bubbleData.forEach((b, i) => {
        const inside = Math.hypot(b.x, b.z) < state.waterR * 0.9;
        const floorY = floorH(Math.hypot(b.x, b.z));
        const span = state.waterY - floorY;
        if (!inside || span < 0.3) { m4.makeScale(0, 0, 0); bubbles.setMatrixAt(i, m4); return; }
        const k = (t * b.sp + b.ph) % 1;
        const y = floorY + k * span;
        const s = b.r * (0.6 + 0.6 * Math.min(1, k * 4));
        sv.set(s, s, s);
        m4.compose(new THREE.Vector3(b.x + Math.sin(t * 2 + i) * 0.06, y, b.z + Math.cos(t * 1.7 + i) * 0.06), q4, sv);
        bubbles.setMatrixAt(i, m4);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    }
  };
  ud.setLevel(level);
  ud.update(0);
  return group;
}

/* ------------------------------------------------------------------ */
/* Underwater tint and fog                                             */
/* ------------------------------------------------------------------ */
// fx.update(camera, lake, hideList) switches fog and background when the camera dips below the surface.
export function createUnderwaterFx(scene) {
  const fog = new THREE.FogExp2(0x2a94c4, 0.1);
  const bg = new THREE.Color('#1F6FB5');
  const fadeBefore = new THREE.Color();
  let active = false, prevFog = null, prevBg = null;
  return {
    isActive: () => active,
    update(camera, lake, hide = []) {
      const ud = lake.userData;
      const lp = lake.position;
      const dx = camera.position.x - lp.x, dz = camera.position.z - lp.z;
      const inside = Math.hypot(dx, dz) < ud.getWaterRadius() * 0.98 && camera.position.y < lp.y + ud.getWaterY();
      if (inside && !active) {
        active = true;
        prevFog = scene.fog; prevBg = scene.background;
        fadeBefore.copy(worldUniforms.uFadeColor.value);
        scene.fog = fog; scene.background = bg;
        rawColor('#2A94C4', worldUniforms.uFadeColor.value);
        hide.forEach((o) => (o.visible = false));
      } else if (!inside && active) {
        active = false;
        scene.fog = prevFog; scene.background = prevBg;
        worldUniforms.uFadeColor.value.copy(fadeBefore);
        hide.forEach((o) => (o.visible = true));
      }
      return active;
    },
  };
}
