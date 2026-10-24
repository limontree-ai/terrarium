import RAPIER from "@dimforge/rapier3d-compat";
import seedrandom from "seedrandom";
import { createFoodSequence } from "./food.js";

export async function createLocalWorld(settings, seed) {
  // Wait for Rapier to initialize
  await RAPIER.init();

  // Create world with gravity
  const gravity = new RAPIER.Vector3(0, -settings.gravity * 9.81, 0);
  const world = new RAPIER.World(gravity);
  world.timestep = 1 / 30;

  // Ground (flat plane at y=0)
  // Create a static rigid body at origin
  const groundDesc = RAPIER.RigidBodyDesc.fixed();
  const groundBody = world.createRigidBody(groundDesc);
  
  // Ground collider: infinite plane
  const groundShape = RAPIER.ColliderDesc.cuboid(100, 0.01, 100); // flat box
  groundShape.setFriction(getGroundFriction(settings.groundType));
  world.createCollider(groundShape, groundBody);

  // Trees (static cylinder colliders)
  const treePositions = generateTreePositions(settings.treeCount, seed);
  for (const pos of treePositions) {
    const treeDesc = RAPIER.RigidBodyDesc.fixed();
    treeDesc.setTranslation(pos.x, pos.y + 0.5, pos.z);
    const treeBody = world.createRigidBody(treeDesc);
    const treeShape = RAPIER.ColliderDesc.cylinder(0.5, 0.3); // radius=0.3, height=0.5
    world.createCollider(treeShape, treeBody);
  }

  // Water surface (not a collider, just a plane for rendering)
  world.waterLevel = settings.waterLevel;

  // First food of the seeded sequence, 2 to 3 m from the origin
  world.foodPosition = createFoodSequence(seed).next({ x: 0, z: 0 });

  // Store settings for forces
  world.settings = settings;
  world.seed = seed;

  return world;
}

function generateTreePositions(count, seed) {
  const rng = seedrandom(seed);
  const positions = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: (rng() - 0.5) * 35,
      y: 0,
      z: (rng() - 0.5) * 35,
    });
  }
  return positions;
}

// Helper: get friction value from groundType
function getGroundFriction(groundType) {
  const friction = {
    grass: 0.9,
    sand: 0.7,
    ice: 0.05,
    mud: 0.6,
    moondust: 0.8,
  };
  return friction[groundType] || 0.5;
}
