import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Apply all custom forces to all bodies every step.
 * Called once per physics timestep (1/30 second).
 */
export function applyCustomForces(world, bodies) {
  const settings = world.settings;
  const waterLevel = settings.waterLevel; // 0-1, scales island height
  const dt = 1 / 30; // timestep

  for (const body of bodies) {
    // Skip static bodies (ground, trees)
    if (body.isFixed()) continue;

    // Rapier forces persist across steps, so clear last step's forces first
    body.resetForces(true);

    const vel = body.linvel();
    const pos = body.translation();

    // --- 1. WATER DRAG AND BUOYANCY ---
    // Only apply if body is below water surface
    if (pos.y < waterLevel * 10) {
      // Water density = 1000 kg/m³
      // For each face of the body's bounding box:
      // Drag force = 0.5 * ρ * Cd * A * (v·n)²
      const waterDensity = 1000;
      const dragCoeff = 1.0; // from config.js
      
      // Approximate body as a box
      const boxHalfExtents = getBBoxHalfExtents(body);
      const faceAreas = [
        boxHalfExtents.y * boxHalfExtents.z, // x faces
        boxHalfExtents.y * boxHalfExtents.z,
        boxHalfExtents.x * boxHalfExtents.z, // z faces
        boxHalfExtents.x * boxHalfExtents.z,
        boxHalfExtents.x * boxHalfExtents.y, // y faces
        boxHalfExtents.x * boxHalfExtents.y,
      ];
      const faceNormals = [
        [-1, 0, 0], [1, 0, 0],
        [0, 0, -1], [0, 0, 1],
        [0, -1, 0], [0, 1, 0],
      ];

      for (let i = 0; i < 6; i++) {
        const n = faceNormals[i];
        const A = faceAreas[i];
        const vDotN = vel.x * n[0] + vel.y * n[1] + vel.z * n[2];
        
        if (vDotN > 0) {
          // Force magnitude
          const F = 0.5 * waterDensity * dragCoeff * A * vDotN * vDotN;
          
          // Apply opposite to normal
          const forceDir = {
            x: -n[0] * F,
            y: -n[1] * F,
            z: -n[2] * F,
          };
          body.addForce(forceDir, true); // wake up body
        }
      }

      // BUOYANCY
      // Upward force = ρ * g * V_submerged
      const volume = boxHalfExtents.x * boxHalfExtents.y * boxHalfExtents.z * 8;
      const buoyantForce = waterDensity * 9.81 * volume;
      body.addForce({ x: 0, y: buoyantForce, z: 0 }, true);
    }

    // --- 2. GROUND LAYER DRAG ---
    // Bodies inside grass/snow/mud layer feel drag
    if (pos.y < getGroundLayerHeight(settings)) {
      const layerHeight = getGroundLayerHeight(settings);
      const drag = getGroundLayerDrag(settings);
      
      // Linear drag: F = -c * v, where c is drag coefficient
      // Reduce velocity proportionally
      const dragForce = {
        x: -vel.x * drag,
        y: -vel.y * drag * 0.5, // less vertical drag
        z: -vel.z * drag,
      };
      body.addForce(dragForce, true);
    }

    // --- 3. WIND ---
    if (settings.wind.strength > 0) {
      const windStrength = settings.wind.strength;
      const windDir = settings.wind.direction; // 0-360 degrees
      
      // Convert direction to vector
      const rad = (windDir * Math.PI) / 180;
      const windVec = {
        x: Math.cos(rad),
        y: 0,
        z: Math.sin(rad),
      };
      
      // Estimate box area facing wind
      const boxHalfExtents = getBBoxHalfExtents(body);
      const areaFacingWind = boxHalfExtents.y * boxHalfExtents.z; // frontal area
      
      // Force = strength * area * direction
      const windForce = {
        x: windVec.x * windStrength * areaFacingWind * 50,
        y: 0,
        z: windVec.z * windStrength * areaFacingWind * 50,
      };
      body.addForce(windForce, true);
    }
  }
}

/**
 * Apply weather progression each round.
 * Rain raises mud and water. Snow raises snow depth and halves friction.
 */
export function applyWeatherStep(settings) {
  const newSettings = { ...settings };

  if (settings.weather === "rain") {
    newSettings.mud = Math.min(1.0, settings.mud + 0.02);
    newSettings.waterLevel = Math.min(0.5, settings.waterLevel + 0.005);
  } else if (settings.weather === "snow") {
    newSettings.snowDepth = Math.min(0.3, settings.snowDepth + 0.01);
    // Friction is halved (handled in trial, not here)
  } else if (settings.weather === "clear") {
    newSettings.mud = Math.max(0, settings.mud - 0.05);
    newSettings.snowDepth = Math.max(0, settings.snowDepth - 0.05);
  }

  return newSettings;
}

// ---- HELPERS ----

function getBBoxHalfExtents(body) {
  // Get AABB (axis-aligned bounding box)
  const aabb = body.collider(0).halfExtents();
  return { x: aabb.x, y: aabb.y, z: aabb.z };
}

function getGroundLayerHeight(settings) {
  if (settings.weather === "snow") {
    return settings.snowDepth || 0.08;
  } else if (settings.mud > 0) {
    return Math.min(0.2, settings.mud * 0.2);
  }
  return 0.08; // grass layer
}

function getGroundLayerDrag(settings) {
  if (settings.weather === "snow") {
    return 2.0; // heavy drag in snow
  } else if (settings.mud > 0) {
    return 0.5 + settings.mud * 1.5; // proportional to mud
  }
  return 0.5; // grass
}
