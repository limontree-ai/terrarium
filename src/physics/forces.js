import { PHYSICS, GROUND_LAYER } from "../config.js";

const FACES = [
  [-1, 0, 0], [1, 0, 0],
  [0, -1, 0], [0, 1, 0],
  [0, 0, -1], [0, 0, 1],
];
const CORNERS = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]];

/** Water surface height in meters for a world's waterLevel (0-1). */
export function waterSurfaceY(settings) {
  return (settings?.waterLevel ?? 0) * PHYSICS.WATER_SURFACE_MAX;
}

/**
 * Apply all custom forces to all bodies every step: water drag, buoyancy and
 * angular drag, ground layer drag, and wind. Called once per 1/30 s timestep.
 */
export function applyCustomForces(world, bodies) {
  const settings = world.settings ?? {};
  const surface = waterSurfaceY(settings);
  const g = (settings.gravity ?? 1) * PHYSICS.GRAVITY;
  const layerHeight = groundLayerHeight(settings);
  const layerDrag = groundLayerDrag(settings);

  for (const body of bodies) {
    if (body.isFixed()) continue;
    // Rapier forces persist across steps, so clear last step's forces first.
    body.resetForces(true);
    body.resetTorques(true);

    const pos = body.translation();
    const vel = body.linvel();
    const h = body.collider(0).halfExtents();
    const q = body.rotation();

    if (surface > 0) {
      const fraction = submergedFraction(pos.y, q, h, surface);
      if (fraction > 0) applyWater(body, pos, vel, q, h, fraction, g);
    }

    if (pos.y < layerHeight) {
      body.addForce({ x: -vel.x * layerDrag, y: -vel.y * layerDrag * 0.5, z: -vel.z * layerDrag }, true);
    }

    const wind = settings.wind;
    if (wind && wind.strength > 0) {
      const rad = (wind.direction * Math.PI) / 180;
      const area = 4 * h.y * Math.max(h.x, h.z);
      const f = wind.strength * area * 50;
      body.addForce({ x: Math.cos(rad) * f, y: 0, z: Math.sin(rad) * f }, true);
    }
  }
}

// Velocity-normal drag per face, applied at the face center so it produces torque,
// plus buoyancy from the submerged volume and rotational drag.
function applyWater(body, pos, vel, q, h, fraction, g) {
  const rho = PHYSICS.WATER_DENSITY;
  const cd = PHYSICS.DRAG_COEFFICIENT;
  const dt = PHYSICS.DT;
  const mass = body.mass();
  const w = body.angvel();
  const half = [h.x, h.y, h.z];

  for (const local of FACES) {
    const axis = local.findIndex((v) => v !== 0);
    const others = [0, 1, 2].filter((i) => i !== axis);
    const area = 4 * half[others[0]] * half[others[1]];
    const n = rotate(q, local);
    const r = rotate(q, [local[0] * h.x, local[1] * h.y, local[2] * h.z]);
    // Velocity of the face center: v + ω × r
    const v = [
      vel.x + w.y * r[2] - w.z * r[1],
      vel.y + w.z * r[0] - w.x * r[2],
      vel.z + w.x * r[1] - w.y * r[0],
    ];
    const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    if (vn <= 0) continue;
    // Explicit drag must not reverse the face's motion within one step.
    const f = Math.min(0.5 * rho * cd * area * vn * vn * fraction, (mass * vn) / (dt * 3));
    body.addForceAtPoint(
      { x: -n[0] * f, y: -n[1] * f, z: -n[2] * f },
      { x: pos.x + r[0], y: pos.y + r[1], z: pos.z + r[2] },
      true
    );
  }

  const volume = 8 * h.x * h.y * h.z;
  body.addForce({ x: 0, y: rho * g * volume * fraction, z: 0 }, true);

  const size = 2 * Math.max(h.x, h.y, h.z);
  const spin = Math.hypot(w.x, w.y, w.z);
  const inertia = (mass * (h.x * h.x + h.y * h.y + h.z * h.z)) / 3;
  const k = Math.min(PHYSICS.ANGULAR_DRAG * rho * size ** 5 * fraction * spin, inertia / (dt * 2));
  body.addTorque({ x: -k * w.x, y: -k * w.y, z: -k * w.z }, true);
}

/** Fraction (0-1) of a rotated box's height that lies below the water surface. */
export function submergedFraction(y, q, h, surface) {
  let extent = 0;
  for (const c of CORNERS) {
    extent = Math.max(extent, Math.abs(rotate(q, [c[0] * h.x, c[1] * h.y, c[2] * h.z])[1]));
  }
  if (extent <= 0) return y < surface ? 1 : 0;
  return Math.max(0, Math.min(1, (surface - (y - extent)) / (2 * extent)));
}

/**
 * Apply weather progression each round.
 * Rain raises mud and water. Snow raises snow depth.
 */
export function applyWeatherStep(settings) {
  const newSettings = { ...settings };

  if (settings.weather === "rain") {
    newSettings.mud = Math.min(1.0, settings.mud + 0.02);
    newSettings.waterLevel = Math.min(0.5, settings.waterLevel + 0.005);
  } else if (settings.weather === "snow") {
    newSettings.snowDepth = Math.min(0.3, settings.snowDepth + 0.01);
  } else if (settings.weather === "clear") {
    newSettings.mud = Math.max(0, settings.mud - 0.05);
    newSettings.snowDepth = Math.max(0, settings.snowDepth - 0.05);
  }

  return newSettings;
}

/** Height of the grass/snow/mud layer above the ground, in meters. */
export function groundLayerHeight(settings) {
  if (settings.snowDepth > 0) return Math.max(settings.snowDepth, GROUND_LAYER?.GRASS_DEPTH ?? 0.08);
  if (settings.mud > 0) return Math.min(0.2, settings.mud * 0.2);
  return GROUND_LAYER?.GRASS_DEPTH ?? 0.08;
}

function groundLayerDrag(settings) {
  if (settings.snowDepth > 0) return 2.0;
  if (settings.mud > 0) return 0.5 + settings.mud * 1.5;
  return 0.5;
}

function rotate(q, [x, y, z]) {
  const ix = q.w * x + q.y * z - q.z * y;
  const iy = q.w * y + q.z * x - q.x * z;
  const iz = q.w * z + q.x * y - q.y * x;
  const iw = -q.x * x - q.y * y - q.z * z;
  return [
    ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  ];
}
