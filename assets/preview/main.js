import * as THREE from 'three';
import { CATALOG, CATEGORIES, createUnderwaterFx } from '../src/world3d/catalog.js';
import { createSkySystem, TIME_PRESETS } from '../src/world3d/sky.js';
import { setCurvedWorld, setWind, updateWorldTime, setSnowCaps, flatMaterial } from '../src/world3d/core.js';
import { createEffects } from '../src/world3d/effects.js';
import { GROUND_NAMES, TERRAIN_SHAPES } from '../src/world3d/ground.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

/* ---------------- renderer, scene, sky ---------------- */
const host = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
const sky = createSkySystem();
scene.add(sky.group);
const effects = createEffects(scene);
const underwater = createUnderwaterFx(scene);

/* ---------------- orbit camera ---------------- */
const orbit = { target: new THREE.Vector3(), dist: 14, yaw: 0.6, pitch: 0.45 };
orbit.set = (o) => {
  if (o.target) orbit.target.set(...o.target);
  if (o.dist !== undefined) orbit.dist = o.dist;
  if (o.pitch !== undefined) orbit.pitch = o.pitch;
  if (o.yaw !== undefined) orbit.yaw = o.yaw;
};
function placeCamera() {
  const cp = Math.cos(orbit.pitch);
  camera.position.set(
    orbit.target.x + Math.sin(orbit.yaw) * cp * orbit.dist,
    orbit.target.y + Math.sin(orbit.pitch) * orbit.dist,
    orbit.target.z + Math.cos(orbit.yaw) * cp * orbit.dist
  );
  camera.lookAt(orbit.target);
}
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointerup', () => (drag = null));
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.pan) {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    orbit.target.addScaledVector(right, -dx * orbit.dist * 0.002);
    orbit.target.y += dy * orbit.dist * 0.002;
  } else {
    orbit.yaw -= dx * 0.006;
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.006, -1.2, 1.45);
  }
});
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = THREE.MathUtils.clamp(orbit.dist * Math.exp(e.deltaY * 0.001), 1.2, 160); }, { passive: false });

/* ---------------- state ---------------- */
const ctx = {
  snowDepth: 0, mudAmount: 0, waterLevel: 0.8, windStrength: 0, windDir: 0, terrainShape: 'flat', ground: 'grass',
  limbLength: 0.45, limbWidth: 0.16, limbThickness: 0.16, limbCount: 2, rain: 0, snowfall: 0, morphing: false,
  effects, orbit, time: 0, planetRadius: 150,
};
window.__terrarium = { ctx, scene, camera, renderer, sky, orbit, setCategory: (c) => setCategory(c), instances: () => instances, applyAll: () => applyAll() };

/* ---------------- layout ---------------- */
const pedestalMat = flatMaterial();
const pedestalGeo = (() => {
  const g = new THREE.CylinderGeometry(1, 1.05, 0.14, 14, 1);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(0.9), 3));
  g.setAttribute('aUp', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0), 1));
  return g.toNonIndexed();
})();
{
  // flat shaded pedestal colors
  const g = pedestalGeo, col = [], up = [];
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const l = 0.78 + Math.max(0, n.getY(i)) * 0.14;
    col.push(l, l + 0.03, l + 0.06); up.push(0);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aUp', new THREE.Float32BufferAttribute(up, 1));
}

let instances = [];
let current = null;
const labelHost = document.body;

function clearInstances() {
  for (const it of instances) {
    scene.remove(it.holder);
    it.holder.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    it.label.remove();
  }
  instances = [];
  if (underwater.isActive()) underwater.update(new THREE.Object3D(), { userData: { getWaterRadius: () => 0, getWaterY: () => 0 }, position: new THREE.Vector3(1e6, 0, 0) }, [sky.dome, sky.clouds]);
}

function setCategory(cat) {
  current = cat;
  document.querySelectorAll('#cats button').forEach((b) => b.classList.toggle('on', b.dataset.c === cat));
  clearInstances();
  const entries = CATALOG.filter((e) => e.cat === cat);
  const rowMax = 44;
  let x = 0, z = 0, rowDepth = 0, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  // first pass: rows
  const rows = [[]];
  let w = 0;
  for (const e of entries) {
    const d = e.size * 2 + 1;
    if (w + d > rowMax && rows[rows.length - 1].length) { rows.push([]); w = 0; }
    rows[rows.length - 1].push(e); w += d;
  }
  let zc = 0;
  for (const row of rows) {
    const depth = Math.max(...row.map((e) => e.size * 2 + 1));
    const width = row.reduce((s, e) => s + e.size * 2 + 1, 0);
    let xc = -width / 2;
    for (const e of row) {
      const d = e.size * 2 + 1;
      const holder = new THREE.Group();
      holder.position.set(xc + d / 2, 0, zc + depth / 2);
      const obj = e.make(ctx);
      const spinner = new THREE.Group();
      spinner.add(obj);
      holder.add(spinner);
      if (e.spin) {
        const ped = new THREE.Mesh(pedestalGeo, pedestalMat);
        ped.scale.set(e.size * 0.85, 1, e.size * 0.85);
        ped.position.y = -0.07;
        ped.receiveShadow = true;
        holder.add(ped);
      }
      scene.add(holder);
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = e.label;
      labelHost.appendChild(label);
      instances.push({ entry: e, obj, spinner, holder, label });
      minX = Math.min(minX, holder.position.x - e.size); maxX = Math.max(maxX, holder.position.x + e.size);
      minZ = Math.min(minZ, holder.position.z - e.size); maxZ = Math.max(maxZ, holder.position.z + e.size);
      xc += d;
    }
    zc += depth;
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, (maxZ - minZ) * 1.2);
  const single = entries.length === 1 && entries[0].camera;
  if (single) orbit.set({ target: [cx + entries[0].camera.target[0], entries[0].camera.target[1], cz + entries[0].camera.target[2]], dist: entries[0].camera.dist, pitch: entries[0].camera.pitch, yaw: 0.7 });
  else orbit.set({ target: [cx, span * 0.04, cz], dist: Math.max(7, span * 0.95), pitch: 0.5, yaw: 0.45 });
  sky.focus.set(cx, 0, cz);
  applyAll();
  buildActions();
}

function applyAll() {
  for (const it of instances) if (it.entry.apply) it.entry.apply(it.obj, ctx);
}

function buildActions() {
  const host = document.getElementById('actions');
  host.innerHTML = '';
  for (const it of instances) {
    for (const a of it.entry.actions || []) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => a.run(it.obj, ctx);
      host.appendChild(b);
    }
  }
  if (!host.children.length) host.innerHTML = '<span style="color:#6B7C93">No buttons for this category.</span>';
}

/* ---------------- UI ---------------- */
const catsEl = document.getElementById('cats');
CATEGORIES.forEach((c) => {
  const b = document.createElement('button');
  b.textContent = c; b.dataset.c = c; b.onclick = () => setCategory(c);
  catsEl.appendChild(b);
});

function slider(hostId, label, key, min, max, step, onChange) {
  const host = document.getElementById(hostId);
  const row = document.createElement('div');
  row.className = 'row';
  const name = document.createElement('span'); name.textContent = label;
  const val = document.createElement('span'); val.className = 'v';
  const input = document.createElement('input');
  input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = ctx[key];
  const show = () => (val.textContent = Number(ctx[key]).toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0));
  input.oninput = () => { ctx[key] = parseFloat(input.value); show(); onChange && onChange(); applyAll(); };
  show();
  row.append(name, val, input);
  host.appendChild(row);
  return input;
}

slider('world', 'Snow depth (m)', 'snowDepth', 0, 0.3, 0.005);
slider('world', 'Mud amount', 'mudAmount', 0, 1, 0.01);
slider('world', 'Water level', 'waterLevel', 0, 1, 0.01);
slider('world', 'Wind strength', 'windStrength', 0, 1, 0.01, () => setWind(ctx.windStrength, ctx.windDir));
slider('world', 'Wind direction (radians)', 'windDir', 0, 6.28, 0.05, () => setWind(ctx.windStrength, ctx.windDir));
slider('world', 'Rain', 'rain', 0, 1, 0.01);
slider('world', 'Snowfall', 'snowfall', 0, 1, 0.01);
slider('time', 'Time of day (0 noon, 0.25 sunset, 0.5 night)', 'time', 0, 1, 0.002, () => sky.setTime(ctx.time));
const tb = document.getElementById('time');
Object.entries(TIME_PRESETS).forEach(([n, v]) => {
  const b = document.createElement('button'); b.textContent = n;
  b.onclick = () => { ctx.time = v; sky.setTime(v); tb.querySelector('input').value = v; tb.querySelector('.v').textContent = v.toFixed(3); };
  tb.appendChild(b);
});
const unmorph = () => { ctx.morphing = false; };
slider('blobctl', 'Limb length (m)', 'limbLength', 0.1, 1.4, 0.01, unmorph);
slider('blobctl', 'Limb width (m)', 'limbWidth', 0.05, 0.4, 0.005, unmorph);
slider('blobctl', 'Limb thickness (m)', 'limbThickness', 0.05, 0.4, 0.005, unmorph);
slider('blobctl', 'Limb count', 'limbCount', 0, 6, 1);
slider('curvectl', 'Planet radius (m)', 'planetRadius', 40, 400, 5, () => setCurvedWorld(document.getElementById('curve').checked, ctx.planetRadius));

const groundSel = document.getElementById('ground');
GROUND_NAMES.forEach((g) => groundSel.add(new Option(g, g)));
groundSel.onchange = () => { ctx.ground = groundSel.value; applyAll(); };
const shapeSel = document.getElementById('shape');
TERRAIN_SHAPES.forEach((g) => shapeSel.add(new Option(g, g)));
shapeSel.onchange = () => { ctx.terrainShape = shapeSel.value; applyAll(); };
document.getElementById('biome').onchange = (e) => sky.setBiome(e.target.value);
document.getElementById('curve').onchange = (e) => setCurvedWorld(e.target.checked, ctx.planetRadius);

/* ---------------- loop ---------------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let t = 0;
const v3 = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  updateWorldTime(t);
  placeCamera();
  for (const it of instances) {
    if (it.entry.spin) it.spinner.rotation.y += dt * 0.5;
    if (it.entry.update) it.entry.update(it.obj, dt, t, ctx);
    if (it.entry.underwater) underwater.update(camera, it.obj, [sky.dome, sky.clouds]);
    // label position
    v3.copy(it.holder.position); v3.y += 0.2; v3.z += it.entry.size * 0.9;
    v3.project(camera);
    const vis = v3.z < 1 && v3.z > -1;
    it.label.style.display = vis ? 'block' : 'none';
    it.label.style.left = ((v3.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    it.label.style.top = ((-v3.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  }
  sky.update(dt, camera);
  effects.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const params = new URLSearchParams(location.search);
setCategory(params.get('cat') || 'Plants');
frame();
