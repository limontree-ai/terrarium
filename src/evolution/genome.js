// A creature's genome: a jelly body of 2–6 blobs connected by springs, and a brain of
// one sine oscillator per spring that rhythmically changes its rest length (a muscle).

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const MIN_NODES = 2;
export const MAX_NODES = 6;

export function randomGenome() {
  const count = Math.floor(rand(MIN_NODES, MAX_NODES + 1));
  const nodes = Array.from({ length: count }, () => ({
    offset: [rand(-0.8, 0.8), rand(0, 0.8), rand(-0.8, 0.8)],
    radius: rand(0.15, 0.4),
  }));
  return {
    nodes,
    muscles: fullyConnect(count).map(([a, b]) => randomMuscle(a, b)),
    hue: Math.random(),
  };
}

function fullyConnect(count) {
  const pairs = [];
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) pairs.push([a, b]);
  return pairs;
}

function randomMuscle(a, b) {
  return {
    a,
    b,
    stiffness: rand(20, 120),
    frequency: rand(0.5, 3), // Hz
    phase: rand(0, Math.PI * 2),
    amplitude: rand(0, 0.5), // fraction of rest length
  };
}

const jitter = (v, scale, rate) => (Math.random() < rate ? v + rand(-scale, scale) : v);

export function mutate(genome, rate = 0.2) {
  let nodes = genome.nodes.map((n) => ({
    offset: n.offset.map((o) => clamp(jitter(o, 0.2, rate), -1, 1)),
    radius: clamp(jitter(n.radius, 0.05, rate), 0.1, 0.5),
  }));

  // Occasionally grow or lose a blob; muscles are rebuilt to keep the body connected.
  if (Math.random() < rate * 0.3 && nodes.length < MAX_NODES) {
    nodes.push({ offset: [rand(-0.8, 0.8), rand(0, 0.8), rand(-0.8, 0.8)], radius: rand(0.15, 0.4) });
  } else if (Math.random() < rate * 0.3 && nodes.length > MIN_NODES) {
    nodes = nodes.slice(0, -1);
  }

  const existing = new Map(genome.muscles.map((m) => [`${m.a}-${m.b}`, m]));
  const muscles = fullyConnect(nodes.length).map(([a, b]) => {
    const m = existing.get(`${a}-${b}`);
    if (!m) return randomMuscle(a, b);
    return {
      a,
      b,
      stiffness: clamp(jitter(m.stiffness, 15, rate), 10, 150),
      frequency: clamp(jitter(m.frequency, 0.3, rate), 0.2, 4),
      phase: jitter(m.phase, 0.5, rate),
      amplitude: clamp(jitter(m.amplitude, 0.1, rate), 0, 0.6),
    };
  });

  return { nodes, muscles, hue: (jitter(genome.hue, 0.03, rate) + 1) % 1 };
}

export function crossover(a, b) {
  const parent = Math.random() < 0.5 ? a : b;
  const other = parent === a ? b : a;
  return {
    nodes: parent.nodes.map((n, i) => (other.nodes[i] && Math.random() < 0.5 ? other.nodes[i] : n)),
    muscles: parent.muscles.map((m) => {
      const match = other.muscles.find((o) => o.a === m.a && o.b === m.b);
      return match && Math.random() < 0.5 ? match : m;
    }),
    hue: Math.random() < 0.5 ? a.hue : b.hue,
  };
}
