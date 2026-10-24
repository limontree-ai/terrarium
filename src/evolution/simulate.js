// Headless physics evaluation of one genome. Runs in a Web Worker (and in Node for tests).
// Fitness = horizontal distance the creature's centre of mass travels.

export const SIM_DT = 1 / 60;

export function buildCreature(RAPIER, world, genome, origin = [0, 1, 0]) {
  const bodies = genome.nodes.map((node) => {
    const [x, y, z] = node.offset;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(origin[0] + x, origin[1] + y + node.radius, origin[2] + z)
        .setLinearDamping(0.5),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(node.radius).setFriction(1.2).setRestitution(0.2).setDensity(1),
      body,
    );
    return body;
  });

  const muscles = genome.muscles.map((m) => ({
    ...m,
    rest: dist(bodies[m.a].translation(), bodies[m.b].translation()),
  }));

  return { bodies, muscles };
}

// Apply spring + oscillating muscle forces. Call once per physics step, before world.step().
export function actuate(creature, time) {
  for (const body of creature.bodies) body.resetForces(true);
  for (const m of creature.muscles) {
    const a = creature.bodies[m.a];
    const b = creature.bodies[m.b];
    const pa = a.translation();
    const pb = b.translation();
    const d = dist(pa, pb) || 1e-6;
    const target = m.rest * (1 + m.amplitude * Math.sin(2 * Math.PI * m.frequency * time + m.phase));
    const va = a.linvel();
    const vb = b.linvel();
    const dir = { x: (pb.x - pa.x) / d, y: (pb.y - pa.y) / d, z: (pb.z - pa.z) / d };
    const relVel = (vb.x - va.x) * dir.x + (vb.y - va.y) * dir.y + (vb.z - va.z) * dir.z;
    // Scale by mass so stiffness is an acceleration: keeps small blobs numerically stable at 60 Hz.
    const mass = Math.min(a.mass(), b.mass());
    const f = mass * (m.stiffness * (d - target) + 4 * relVel); // spring + damping
    a.addForce({ x: dir.x * f, y: dir.y * f, z: dir.z * f }, true);
    b.addForce({ x: -dir.x * f, y: -dir.y * f, z: -dir.z * f }, true);
  }
}

export function centerOfMass(creature) {
  const c = { x: 0, y: 0, z: 0 };
  for (const body of creature.bodies) {
    const p = body.translation();
    c.x += p.x;
    c.y += p.y;
    c.z += p.z;
  }
  const n = creature.bodies.length;
  return { x: c.x / n, y: c.y / n, z: c.z / n };
}

export function evaluate(RAPIER, genome, settings, seconds = 10) {
  const world = new RAPIER.World({ x: 0, y: -settings.gravity, z: 0 });
  world.timestep = SIM_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.1, 100).setTranslation(0, -0.1, 0).setFriction(1));

  const creature = buildCreature(RAPIER, world, genome);
  const start = centerOfMass(creature);
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    actuate(creature, i * SIM_DT);
    world.step();
  }
  const end = centerOfMass(creature);
  world.free();

  const fitness = Math.hypot(end.x - start.x, end.z - start.z);
  return Number.isFinite(fitness) ? fitness : 0;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
