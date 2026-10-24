// Sky dome, lighting presets, low poly sun and moon, clouds, stars, moon biome sky.
import * as THREE from 'three';
import { PALETTE, SKY, LIGHTING } from './palette.js';
import { Builder, meshFrom, paintFaces, rng, rawColor, worldUniforms, setHorizonFade, patchMaterial } from './core.js';

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

/* ------------------------------------------------------------------ */
/* Individual objects                                                  */
/* ------------------------------------------------------------------ */

// Faceted bright yellow sphere with a soft glow made of two translucent shells.
export function createSun({ radius = 6 } = {}) {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(radius, 1), { palette: PALETTE.sun, jitter: radius * 0.03, seed: 5, vary: 0.02 });
  const core = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  g.add(core);
  [[1.45, 0.22], [2.0, 0.1]].forEach(([s, o]) => {
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * s, 1),
      new THREE.MeshBasicMaterial({ color: '#FFE9A0', transparent: true, opacity: o, depthWrite: false, fog: false })
    );
    g.add(shell);
  });
  g.userData.kind = 'sun';
  return g;
}

// Faceted pale sphere with a few crater facets.
export function createMoon({ radius = 5 } = {}) {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(radius, 1), { palette: PALETTE.moon, jitter: radius * 0.02, seed: 9, vary: 0.01 });
  const geo = b.build();
  const faces = geo.attributes.position.count / 3;
  const r = rng(21);
  const craters = [];
  for (let i = 0; i < 7; i++) craters.push(Math.floor(r() * faces));
  paintFaces(geo, craters, PALETTE.moonCrater.mid);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  g.add(
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 1.35, 1),
      new THREE.MeshBasicMaterial({ color: '#DDE4FF', transparent: true, opacity: 0.12, depthWrite: false, fog: false })
    )
  );
  g.userData.kind = 'moon';
  return g;
}

let _cloudMat = null;
function cloudMaterial() {
  if (!_cloudMat) {
    _cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, emissive: '#FFFFFF', emissiveIntensity: 0.42 });
    patchMaterial(_cloudMat, { cacheKey: 'cloud' });
  }
  return _cloudMat;
}

// A cluster of 3 to 6 faceted puffs. White with pale blue gray shadow faces.
export function createCloud({ seed = 1, scale = 1 } = {}) {
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 4);
  const b = new Builder();
  for (let i = 0; i < n; i++) {
    const rad = 0.8 + r() * 0.6;
    const x = (i - (n - 1) / 2) * 0.95 + (r() - 0.5) * 0.3;
    const y = rad * 0.55 + (i % 2) * 0.25 + (r() - 0.5) * 0.15;
    const z = (r() - 0.5) * 0.8;
    b.add(new THREE.IcosahedronGeometry(rad, 1), {
      palette: PALETTE.cloud,
      pos: [x, y, z],
      scale: [1, 0.78, 1],
      jitter: rad * 0.1,
      seed: seed * 10 + i,
      vary: 0.01,
    });
  }
  const mesh = meshFrom(b, {}, { castShadow: false, receiveShadow: false, material: cloudMaterial() });
  mesh.scale.setScalar(scale);
  mesh.userData.kind = 'cloud';
  return mesh;
}

// Drifting layer of clouds. update(dt) moves them.
export function createCloudLayer({ count = 14, radius = 150, minHeight = 32, maxHeight = 58, seed = 3, scaleMul = 1 } = {}) {
  const group = new THREE.Group();
  const r = rng(seed);
  const speeds = [];
  for (let i = 0; i < count; i++) {
    const c = createCloud({ seed: seed * 100 + i, scale: (4 + r() * 5) * scaleMul });
    const a = r() * Math.PI * 2;
    const d = (radius > 60 ? 30 : 0) + Math.sqrt(r()) * radius;
    c.position.set(Math.cos(a) * d, minHeight + r() * (maxHeight - minHeight), Math.sin(a) * d);
    c.rotation.y = r() * Math.PI;
    speeds.push(0.6 + r() * 0.8);
    group.add(c);
  }
  group.userData.update = (dt) => {
    group.children.forEach((c, i) => {
      c.position.x += speeds[i] * dt;
      if (c.position.x > radius + 40) c.position.x = -radius - 40;
    });
  };
  return group;
}

// Small points on a big sphere. opacity is driven by the sky system.
export function createStars({ count = 450, radius = 460, seed = 8 } = {}) {
  const r = rng(seed);
  const pos = [];
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const y = Math.abs(u) * 0.95 + 0.05;
    pos.push(Math.cos(a) * s * radius, y * radius, Math.sin(a) * s * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#FFFFFF', size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

// Big faceted planet that hangs on the horizon in the moon biome.
export function createHorizonPlanet({ radius = 70 } = {}) {
  const b = new Builder();
  b.add(new THREE.IcosahedronGeometry(radius, 2), { palette: PALETTE.planetSea, jitter: 0, seed: 2, vary: 0.01 });
  const geo = b.build();
  const faces = geo.attributes.position.count / 3;
  const r = rng(44);
  const land = [];
  for (let f = 0; f < faces; f++) {
    const x = geo.attributes.position.getX(f * 3), y = geo.attributes.position.getY(f * 3), z = geo.attributes.position.getZ(f * 3);
    if (Math.sin(x * 0.07) * Math.cos(z * 0.06) + Math.sin(y * 0.09) * 0.6 > 0.35) land.push(f);
  }
  paintFaces(geo, land, PALETTE.planetLand.mid);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  m.userData.kind = 'planet';
  return m;
}

/* ------------------------------------------------------------------ */
/* Sky dome                                                            */
/* ------------------------------------------------------------------ */
export function createSkyDome({ radius = 500 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTop: { value: rawColor(SKY.day.top) }, uHorizon: { value: rawColor(SKY.day.horizon) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir;
      void main(){ float h = normalize(vDir).y; float t = smoothstep(-0.05, 0.75, h); gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Time of day                                                         */
/* ------------------------------------------------------------------ */
// time 0..1: 0 noon, 0.25 sunset, 0.5 midnight, 0.75 sunrise, 1 noon again.
const KEYS = [
  [0.0, 'day'],
  [0.18, 'day'],
  [0.25, 'sunset'],
  [0.33, 'night'],
  [0.67, 'night'],
  [0.75, 'sunset'],
  [0.82, 'day'],
  [1.0, 'day'],
];

export const TIME_PRESETS = { day: 0, sunset: 0.25, night: 0.5, sunrise: 0.75 };

function stateFor(name) {
  const L = LIGHTING[name];
  const S = SKY[name === 'moon' ? 'moon' : name];
  return { top: S.top, horizon: S.horizon, sun: L.sun, sunI: L.sunI, amb: L.amb, ambI: L.ambI, ground: L.ground, stars: L.stars };
}

// Blend the day, sunset and night presets for a time value between 0 and 1.
export function sampleTimeOfDay(t, out = {}) {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const [t0, n0] = KEYS[i];
  const [t1, n1] = KEYS[i + 1];
  const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  const a = stateFor(n0), b = stateFor(n1);
  const mixHex = (x, y, raw) => {
    const A = raw ? rawColor(x, tmpA) : tmpA.set(x);
    const B = raw ? rawColor(y, tmpB) : tmpB.set(y);
    return A.clone().lerp(B, k);
  };
  out.top = mixHex(a.top, b.top, true);
  out.horizon = mixHex(a.horizon, b.horizon, true);
  out.sun = mixHex(a.sun, b.sun, false);
  out.amb = mixHex(a.amb, b.amb, false);
  out.ground = mixHex(a.ground, b.ground, false);
  out.sunI = a.sunI + (b.sunI - a.sunI) * k;
  out.ambI = a.ambI + (b.ambI - a.ambI) * k;
  out.stars = a.stars + (b.stars - a.stars) * k;
  return out;
}

/* ------------------------------------------------------------------ */
/* Full sky system                                                     */
/* ------------------------------------------------------------------ */
// Sky dome + sun + moon + stars + clouds + lights. Add system.group to the scene.
// system.setTime(t), system.setBiome('earth' | 'moon'), system.update(dt, camera)
export function createSkySystem({ shadows = true, clouds = true } = {}) {
  const group = new THREE.Group();
  const dome = createSkyDome();
  const sun = createSun();
  const moon = createMoon();
  const stars = createStars();
  const planet = createHorizonPlanet();
  planet.position.set(-150, 70, -330);
  planet.visible = false;
  const cloudLayer = createCloudLayer();
  cloudLayer.visible = clouds;
  group.add(dome, sun, moon, stars, planet, cloudLayer);

  const hemi = new THREE.HemisphereLight('#BFD9FF', '#A8D88B', 1);
  const dir = new THREE.DirectionalLight('#FFF1CC', 2.4);
  dir.castShadow = shadows;
  dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 220;
  dir.shadow.bias = -0.0006;
  dir.shadow.normalBias = 0.05;
  group.add(hemi, dir, dir.target);

  const system = {
    group, dome, sun, moon, stars, planet, clouds: cloudLayer, hemi, dir,
    time: 0,
    biome: 'earth',
    state: {},
    focus: new THREE.Vector3(),
    setTime(t) { system.time = t; },
    setBiome(b) { system.biome = b; },
    update(dt = 0, camera = null) {
      if (cloudLayer.userData.update) cloudLayer.userData.update(dt);
      const moonBiome = system.biome === 'moon';
      const s = system.state;
      sampleTimeOfDay(system.time, s);
      if (moonBiome) {
        const m = stateFor('moon');
        s.top = rawColor(m.top, new THREE.Color());
        s.horizon = rawColor(m.horizon, new THREE.Color());
        s.sun = new THREE.Color(m.sun); s.sunI = m.sunI;
        s.amb = new THREE.Color(m.amb); s.ambI = m.ambI;
        s.ground = new THREE.Color(m.ground); s.stars = m.stars;
      }
      dome.material.uniforms.uTop.value.copy(s.top);
      dome.material.uniforms.uHorizon.value.copy(s.horizon);
      worldUniforms.uFadeColor.value.copy(s.horizon);

      // sun orbit (x, y plane with a slight tilt), moon sits opposite
      const a = Math.PI / 2 - system.time * Math.PI * 2;
      const sunDir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.3).normalize();
      const center = camera ? camera.position : system.focus;
      sun.position.copy(center).addScaledVector(sunDir, 380);
      moon.position.copy(center).addScaledVector(sunDir, -380);
      dome.position.copy(center);
      stars.position.copy(center);
      planet.position.set(center.x - 150, center.y + 60, center.z - 330);
      planet.visible = moonBiome;
      sun.visible = !moonBiome || true;
      sun.scale.setScalar(moonBiome ? 0.5 : 1);
      moon.visible = !moonBiome;
      stars.material.opacity = THREE.MathUtils.clamp(s.stars, 0, 1) * (moonBiome ? 1 : 0.95);
      stars.material.size = moonBiome ? 3.2 : 2.4;

      // directional light follows whichever of sun or moon is above the horizon
      const lightDir = sunDir.y >= 0 ? sunDir.clone() : sunDir.clone().negate();
      lightDir.y = Math.max(lightDir.y, 0.18);
      lightDir.normalize();
      const fade = THREE.MathUtils.smoothstep(Math.abs(sunDir.y), 0.0, 0.1);
      dir.position.copy(system.focus).addScaledVector(lightDir, 70);
      dir.target.position.copy(system.focus);
      dir.color.copy(s.sun);
      dir.intensity = s.sunI * (0.25 + 0.75 * fade);
      hemi.color.copy(s.amb);
      hemi.groundColor.copy(s.ground);
      hemi.intensity = s.ambI;
    },
  };
  system.update(0);
  return system;
}

export { setHorizonFade };
