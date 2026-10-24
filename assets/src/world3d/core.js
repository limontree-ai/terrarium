// Shared core: curved world shader, flat shaded materials, geometry builder, instancing helpers.
import * as THREE from 'three';
import { PALETTE, colorsOf } from './palette.js';

/* ------------------------------------------------------------------ */
/* Random helpers                                                      */
/* ------------------------------------------------------------------ */
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(x, y, z, seed = 0) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123;
  return h - Math.floor(h);
}

/* ------------------------------------------------------------------ */
/* World uniforms shared by every material                             */
/* ------------------------------------------------------------------ */
// Raw sRGB color (no color management conversion), for values written straight to the screen.
export function rawColor(hex, target = new THREE.Color()) {
  return target.setHex(typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex, THREE.LinearSRGBColorSpace);
}

export const worldUniforms = {
  uTime: { value: 0 },
  uCurve: { value: 1 / (2 * 150) }, // planet radius 150 m
  uCurveStart: { value: 6 },
  uFadeStart: { value: 70 },
  uFadeEnd: { value: 150 },
  uFadeColor: { value: rawColor('#CDEBF7') },
  uWind: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uSnowCap: { value: 0 },
  uSnowColor: { value: new THREE.Color('#FFFFFF') },
};

export const worldState = { curveEnabled: true, planetRadius: 150 };

// Turn the curved planet bend on or off, optionally change the planet radius in meters.
export function setCurvedWorld(enabled = true, radius = worldState.planetRadius) {
  worldState.curveEnabled = enabled;
  worldState.planetRadius = radius;
  worldUniforms.uCurve.value = enabled ? 1 / (2 * radius) : 0;
}

// strength 0..1, angle in radians (0 blows toward +x, PI/2 toward +z)
export function setWind(strength = 0, angle = 0) {
  worldUniforms.uWind.value = THREE.MathUtils.clamp(strength, 0, 1);
  worldUniforms.uWindDir.value.set(Math.cos(angle), Math.sin(angle));
}

// 0..1, how much snow sits on top facing faces of trees and rocks
export function setSnowCaps(amount = 0) {
  worldUniforms.uSnowCap.value = THREE.MathUtils.clamp(amount, 0, 1);
}

export function setHorizonFade(start, end, colorHex) {
  worldUniforms.uFadeStart.value = start;
  worldUniforms.uFadeEnd.value = end;
  if (colorHex) rawColor(colorHex, worldUniforms.uFadeColor.value);
}

export function updateWorldTime(t) {
  worldUniforms.uTime.value = t;
}

/* ------------------------------------------------------------------ */
/* Shader patch                                                        */
/* ------------------------------------------------------------------ */
// Adds to any Mesh*Material: planet curve, horizon fade, wind sway/lean, snow caps.
// opts: curve, fade, sway (object height in meters, 0 = off), snowCap, kelp (height), extraUniforms,
//       vertexExtra (glsl injected after begin_vertex), fragmentExtra (injected after color_fragment)
export function patchMaterial(mat, opts = {}) {
  const o = { curve: true, fade: true, sway: 0, snowCap: false, kelp: 0, ...opts };
  mat.userData.tw = o;
  mat.defines = Object.assign({}, mat.defines);
  if (o.curve) mat.defines.TW_CURVE = '';
  if (o.fade) mat.defines.TW_FADE = '';
  if (o.sway) {
    mat.defines.TW_SWAY = '';
    mat.defines.TW_SWAY_H = o.sway.toFixed(3);
  }
  if (o.kelp) {
    mat.defines.TW_KELP = '';
    mat.defines.TW_KELP_H = o.kelp.toFixed(3);
  }
  if (o.snowCap) mat.defines.TW_SNOW = '';
  const key = `tw${o.curve ? 1 : 0}${o.fade ? 1 : 0}${o.sway}${o.kelp}${o.snowCap ? 1 : 0}${o.cacheKey || ''}`;
  mat.customProgramCacheKey = () => key;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms);
    if (o.extraUniforms) Object.assign(shader.uniforms, o.extraUniforms);

    const vDecl = `
      #include <common>
      uniform float uTime;
      uniform float uCurve;
      uniform float uCurveStart;
      uniform float uWind;
      uniform vec2 uWindDir;
      attribute float aUp;
      varying float vTwDepth;
      varying float vTwUp;
      ${o.extraDecl || ''}
    `;
    const vSway = `
      #include <begin_vertex>
      vTwUp = aUp;
      #ifdef TW_SWAY
      {
        float h = clamp(position.y / TW_SWAY_H, 0.0, 1.5);
        float ph = 0.0;
        mat3 m3 = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 1.3;
          m3 = m3 * mat3(instanceMatrix);
        #endif
        float lean = uWind * 0.35 * h * h;
        float amp = (0.025 + uWind * 0.06) * h * h;
        float s = sin(uTime * (1.3 + uWind * 2.2) + ph) * amp;
        vec3 wd = vec3(uWindDir.x, 0.0, uWindDir.y);
        vec3 ld = transpose(m3) * wd;
        float ll = length(ld);
        if (ll > 0.0001) {
          transformed += (ld / ll) * (lean + s);
          transformed.y -= lean * 0.2 * h;
        }
      }
      #endif
      #ifdef TW_KELP
      {
        float hk = clamp(position.y / TW_KELP_H, 0.0, 1.5);
        float phk = 0.0;
        #ifdef USE_INSTANCING
          phk = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.1;
        #endif
        transformed.x += sin(uTime * 1.2 + position.y * 1.6 + phk) * 0.16 * hk;
        transformed.z += cos(uTime * 0.9 + position.y * 1.3 + phk) * 0.1 * hk;
      }
      #endif
      ${o.vertexExtra || ''}
    `;
    const vProject = `
      #include <project_vertex>
      #ifdef TW_CURVE
        float twD = max(0.0, -mvPosition.z - uCurveStart);
        mvPosition.y -= twD * twD * uCurve;
        gl_Position = projectionMatrix * mvPosition;
      #endif
      vTwDepth = -mvPosition.z;
    `;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', vDecl)
      .replace('#include <begin_vertex>', vSway)
      .replace('#include <project_vertex>', vProject);

    const fDecl = `
      #include <common>
      uniform float uFadeStart;
      uniform float uFadeEnd;
      uniform vec3 uFadeColor;
      uniform float uSnowCap;
      uniform vec3 uSnowColor;
      varying float vTwDepth;
      varying float vTwUp;
      ${o.extraDecl || ''}
    `;
    const fColor = `
      #include <color_fragment>
      #ifdef TW_SNOW
        float twCap = smoothstep(0.45, 0.7, vTwUp) * uSnowCap;
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, twCap);
      #endif
      ${o.fragmentExtra || ''}
    `;
    const fEnd = `
      #include <dithering_fragment>
      #ifdef TW_FADE
        float twF = smoothstep(uFadeStart, uFadeEnd, vTwDepth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColor, twF);
      #endif
    `;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', fDecl)
      .replace('#include <color_fragment>', fColor)
      .replace('#include <dithering_fragment>', fEnd);
  };
  mat.needsUpdate = true;
  return mat;
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */
const _matCache = new Map();

// Flat shaded vertex colored material, cached by option set.
export function flatMaterial({ sway = 0, snowCap = false, kelp = 0, side = THREE.FrontSide, roughness = 0.88 } = {}) {
  const key = `flat|${sway}|${snowCap}|${kelp}|${side}|${roughness}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness, metalness: 0, side });
  patchMaterial(m, { sway, snowCap, kelp });
  _matCache.set(key, m);
  return m;
}

// Glossy flat shaded material (ice, wet mud).
export function glossyMaterial({ roughness = 0.15, clearcoat = 1, clearcoatRoughness = 0.1, sway = 0 } = {}) {
  const key = `gloss|${roughness}|${clearcoat}|${clearcoatRoughness}|${sway}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    flatShading: true,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness,
  });
  patchMaterial(m, { sway });
  _matCache.set(key, m);
  return m;
}

// Unlit material with curve and fade (for weather streaks, glow shells).
export function basicMaterial(params = {}, opts = {}) {
  const m = new THREE.MeshBasicMaterial(params);
  patchMaterial(m, opts);
  return m;
}

/* ------------------------------------------------------------------ */
/* Geometry builder with per face tone coloring                        */
/* ------------------------------------------------------------------ */
const SUN_DIR = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
const _n = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _col = new THREE.Color();

// Pick the tone of a face from its normal (lit, side, shadow) plus a small random wobble.
export function toneColor(colors, nx, ny, nz, jitter, vary = 0.03, out = _col) {
  const s = nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z + (jitter - 0.5) * 0.25;
  const base = s > 0.5 ? colors.light : s > -0.05 ? colors.mid : colors.shadow;
  out.copy(base);
  if (vary) out.offsetHSL((jitter - 0.5) * vary * 0.3, 0, (jitter - 0.5) * vary * 2);
  return out;
}

export function jitterGeometry(g, amount, seed = 1) {
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${Math.round(x * 1000)}|${Math.round(y * 1000)}|${Math.round(z * 1000)}`;
    let d = seen.get(key);
    if (!d) {
      d = [
        (hash3(x, y, z, seed) - 0.5) * 2 * amount,
        (hash3(x, y, z, seed + 7) - 0.5) * 2 * amount,
        (hash3(x, y, z, seed + 13) - 0.5) * 2 * amount,
      ];
      seen.set(key, d);
    }
    p.setXYZ(i, x + d[0], y + d[1], z + d[2]);
  }
  return g;
}

export class Builder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.up = [];
    this.faceCount = 0;
  }

  // geo: any BufferGeometry. opts: palette, pos, rot, scale, jitter (relative to geometry), seed, vary
  add(geo, opts = {}) {
    const { palette = PALETTE.rock, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, jitter = 0, seed = 1, vary = 0.03 } = opts;
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (jitter) jitterGeometry(g, jitter, seed);
    const sc = typeof scale === 'number' ? [scale, scale, scale] : scale;
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _m4.compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...sc));
    g.applyMatrix4(_m4);
    g.computeVertexNormals();
    const colors = colorsOf(palette);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let f = 0; f < P.count; f += 3) {
      const nx = N.getX(f), ny = N.getY(f), nz = N.getZ(f);
      const j = hash3(P.getX(f) + P.getX(f + 1), P.getY(f + 1) + P.getY(f + 2), P.getZ(f) + P.getZ(f + 2), seed);
      const c = toneColor(colors, nx, ny, nz, j, vary);
      for (let k = 0; k < 3; k++) {
        this.pos.push(P.getX(f + k), P.getY(f + k), P.getZ(f + k));
        this.nor.push(nx, ny, nz);
        this.col.push(c.r, c.g, c.b);
        this.up.push(Math.max(0, ny));
      }
      this.faceCount++;
    }
    g.dispose();
    return this;
  }

  // Add a polygon strip given as arrays of left/right points (double sided).
  addStrip(left, right, opts = {}) {
    const g = new THREE.BufferGeometry();
    const v = [];
    for (let i = 0; i < left.length - 1; i++) {
      const a = left[i], b = right[i], c = left[i + 1], d = right[i + 1];
      v.push(...a, ...b, ...c, ...b, ...d, ...c);
      v.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return this.add(g, opts);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aUp', new THREE.Float32BufferAttribute(this.up, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// Recolor chosen faces of a built geometry.
export function paintFaces(geo, faceIndices, hex) {
  const c = new THREE.Color(hex);
  const col = geo.attributes.color;
  for (const f of faceIndices) for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, c.r, c.g, c.b);
  col.needsUpdate = true;
}

// Wrap a builder into a mesh with the shared flat material.
export function meshFrom(builder, matOpts = {}, extra = {}) {
  const geo = builder instanceof Builder ? builder.build() : builder;
  const mesh = new THREE.Mesh(geo, extra.material || flatMaterial(matOpts));
  mesh.castShadow = extra.castShadow ?? true;
  mesh.receiveShadow = extra.receiveShadow ?? true;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Instancing                                                          */
/* ------------------------------------------------------------------ */
// Scatter copies of one geometry. area: radius in meters (circle) or [w, d] (rectangle).
// Returns an InstancedMesh with userData.placements (x, y, z, s, yaw).
export function scatterInstances(geometry, material, count, opts = {}) {
  const {
    area = 20,
    seed = 1,
    scale = [0.85, 1.2],
    heightAt = null,
    minDist = 0,
    exclude = null, // (x, z) => true to skip
    tilt = 0,
    center = [0, 0],
    ring = null, // [rMin, rMax] annulus around center
  } = opts;
  const r = rng(seed);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const placements = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let tries = 0;
  while (placements.length < count && tries < count * 40) {
    tries++;
    let x, z;
    if (ring) {
      const a = r() * Math.PI * 2;
      const d = ring[0] + r() * (ring[1] - ring[0]);
      x = center[0] + Math.cos(a) * d;
      z = center[1] + Math.sin(a) * d;
    } else if (Array.isArray(area)) {
      x = center[0] + (r() - 0.5) * area[0];
      z = center[1] + (r() - 0.5) * area[1];
    } else {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * area;
      x = center[0] + Math.cos(a) * d;
      z = center[1] + Math.sin(a) * d;
    }
    if (exclude && exclude(x, z)) continue;
    if (minDist > 0 && placements.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < minDist * minDist)) continue;
    const y = heightAt ? heightAt(x, z) : 0;
    const s = scale[0] + r() * (scale[1] - scale[0]);
    const yaw = r() * Math.PI * 2;
    placements.push({ x, y, z, s, yaw, tx: (r() - 0.5) * tilt, tz: (r() - 0.5) * tilt });
  }
  mesh.count = placements.length;
  placements.forEach((p, i) => {
    e.set(p.tx, p.yaw, p.tz);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.placements = placements;
  return mesh;
}

// Rewrite the matrices of an instanced mesh from placements (use after editing placements).
export function writePlacements(mesh, placements, scaleFn = null) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  placements.forEach((p, i) => {
    const s = scaleFn ? scaleFn(p, i) : p.s;
    e.set(p.tx || 0, p.yaw || 0, p.tz || 0);
    q.setFromEuler(e);
    const sv = typeof s === 'number' ? new THREE.Vector3(s, s, s) : s;
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, sv);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

// Dispose helper
export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
