# Terrarium

A 3D island diorama where jelly blobs evolve bodies and brains in real time through physics simulation and natural selection. Visitors reshape the world by speaking commands ("make it snow", "add trees", "less gravity") and the creatures adapt over the generations that follow. No creature is designed by hand: evolution produces all of the diversity.

## Quick start

```bash
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:5173. The simulation runs without an API key; only voice and text commands need one.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite (port 5173) and the API server (port 3001) together, with reload |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serves the API and the built frontend from one Express server |

Voice input uses the browser's Web Speech API (Chrome, Edge and Safari). In other browsers, type commands into the text box.

## How it works

```
 voice / text ──▶ POST /api/command ──▶ Claude Haiku ──▶ new world settings ──▶ scene + simulation
                                                                              │
      ┌───────────────────────────────────────────────────────────────────────┘
      ▼
 Population (main thread) ──▶ Web Workers, each with its own Rapier world, score every genome
      ▲                                     │
      └──── select elite, crossover, mutate ◀┘──▶ champions shown live on the island
```

- **Genome** ([src/evolution/genome.js](src/evolution/genome.js)): a body of 2–6 blobs joined by springs. The brain is one sine oscillator per spring that rhythmically changes its rest length, so each spring acts as a muscle. Blobs can be gained or lost through mutation.
- **Fitness** ([src/evolution/simulate.js](src/evolution/simulate.js)): the horizontal distance a creature's centre of mass travels in 10 simulated seconds under the current gravity.
- **Workers** ([src/evolution/population.js](src/evolution/population.js)): each generation is split across `hardwareConcurrency - 1` workers. The top 20% survive and breed the rest.
- **Showcase** ([src/physics/showcase.js](src/physics/showcase.js)): a main-thread Rapier world that animates each generation's champions on the island.
- **Voice commands** ([server/commandParser.js](server/commandParser.js)): Claude Haiku receives the current settings and the transcript, and returns the complete new settings as structured JSON. The server clamps every value to the ranges in [shared/worldSettings.js](shared/worldSettings.js).

## Project layout

```
server/            Express API (voice command → world settings)
shared/            World settings schema, ranges and defaults (used by client and server)
src/
  scene/           Three.js island, weather, trees, lighting
  physics/         Live Rapier world for the visible creatures
  evolution/       Genomes, headless physics evaluation, worker pool
  ui/              Voice input, stats chart, settings panel
```

## Adding a world setting

1. Add it to `RANGES` (or an enum) and `DEFAULT_SETTINGS` in `shared/worldSettings.js`.
2. Add it to `SettingsSchema` in `server/commandParser.js`.
3. Use it in `TerrariumScene.applySettings` for visuals and/or in `simulate.js` for physics.

## Known gaps

- The physics ground is flat; terrain hills from the asset library are drawn flat to match.
- The asset blob approximates the physics body: limb count comes from the genome, limb length, width and thickness are averaged across segments, and shape changes morph over 90 seconds.
