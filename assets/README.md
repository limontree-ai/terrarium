# Terrarium assets

Every asset from the Terrarium asset spec, generated as procedural Three.js code. Nothing is wired into the world yet. All factories live in `src/world3d/` and are exported from `src/world3d/assets.js`.

## Run the preview

From this folder run a static server and open the preview page:

    python3 -m http.server 8000
    # then open http://localhost:8000/preview/

The page loads Three.js 0.170 from a CDN. The panel has category tabs, turntables for every asset, and the sliders and toggles from section 12 of the spec: snow depth, mud amount, water level, wind strength and direction, time of day, ground material, terrain shape, blob limb length, width and thickness (with a gradual morph button), and the curved world shader on or off. The "Demo world" tab shows many assets together on the curved planet.

To use the assets in your own project run `npm install` here (it installs `three`) and import from `src/world3d/assets.js`.

## Files

| File | What it holds |
| --- | --- |
| `palette.js` | All colors from the spec: 3 tone palettes, sky gradients, lighting presets |
| `core.js` | Curved world shader, horizon fade, wind sway, snow caps, flat material factories, geometry Builder, instancing helpers |
| `sky.js` | Sky dome, day, sunset and night lighting, sun, moon, clouds, stars, moon biome planet |
| `ground.js` | Terrain shapes, 5 ground materials, snow layer, mud puddles |
| `water.js` | Lake with sand shore, faceted waves, depth color, foam, seaweed, pebbles, bubbles, underwater fog |
| `plants.js` | Round, pine and palm trees, bushes, flowers, grass tufts, reeds |
| `rocks.js` | Rocks, boulders, cliffs, logs, snow mounds, ice plates, ice crystals, icebergs, moon boulders |
| `blob.js` | The smooth purple jelly blob with limbs, glowing joints and jelly polish |
| `food.js` | Fruit with spawn and eaten animations, fruit at tree bases |
| `effects.js` | Fruit pop, dust puff, water splash, mud splash |
| `weather.js` | Rain, splash rings, snowfall, wind leaves and streaks |
| `catalog.js` | Entry list used by the preview page |

## Spec coverage

1. Style rules: flat shaded facets, 3 tone palette per object, no textures. Every low poly mesh is built through `Builder`, which colors each face from its normal.
2. Planet view: `setCurvedWorld(enabled, radius)` bends every patched material. Horizon fade uses `setHorizonFade(start, end)`. The follow camera is yours to add, the preview has a free orbit camera.
3. Palette: `PALETTE`, `SKY`, `LIGHTING` in `palette.js`.
4. Sky and lighting: `createSkySystem()` gives dome, sun, moon, stars, clouds and lights. `system.setTime(0..1)` and `system.setBiome('earth' | 'moon')`.
5. Ground: `createTerrain({ shape, ground })`, `createSnowLayer(terrain).userData.setDepth(0 to 0.3)`, `createMudPuddles().userData.setAmount(0 to 1)`. The sand shore band is part of the lake basin.
6. Water: `createLake({ radius, level })` and `lake.userData.setLevel(0 to 1)`. It includes depth coloring, shoreline foam, sandy floor, seaweed, pebbles and bubbles. `createUnderwaterFx(scene).update(camera, lake)` switches fog and tint when the camera is below the surface.
7. Plants: `createRoundTree`, `createPineTree`, `createPalmTree` (sizes small, medium, large), `createBush`, `createFlowerField`, `createGrassTufts` (`setSnowDepth`), `createReeds`, and instanced `createTreeField`. Sway and wind lean come from `setWind(strength, angle)`. Snow caps come from `setSnowCaps(0 to 1)`.
8. Rocks, ice and props: `createSmallRock`, `createBoulder`, `createCliffChunk`, `createLog`, `createSnowMound`, `createIcePlate`, `createIceCrystal`, `createIceberg`, `createMoonBoulder`, and instanced `createRockField`.
9. Blob: `createBlob({ limbCount })`. Use `blob.userData.blob.evolve({ length, width, thickness }, seconds)` for the gradual morph, `setJointActivity` for joint glow, `impact`, `push` and `landed` for jelly polish, and `update(dt, { velocity, grounded })` every frame.
10. Food: `createFruit`, `createFruitAtTrees`.
11. Weather and effects: `createWeather()` then `api.setRain`, `api.setSnow`, `api.setWind`. `createEffects(scene)` gives `fruitPop`, `dustPuff`, `waterSplash`, `mudSplash`.
12. Preview page: `preview/index.html`.

## Notes for integration

Call `updateWorldTime(t)` once per frame so waves, sway and the blob wobble animate.

Shadows are cast by the unbent geometry, so very far shadows can differ slightly from the bent view. Keep the shadow camera tight around the blob.

The sky dome, sun, moon and stars are not bent, because they sit at infinity.

Every material that goes through `patchMaterial` supports the curve and horizon fade. If you add your own meshes, wrap their material with `patchMaterial(material, { sway: heightInMeters, snowCap: true })`.
