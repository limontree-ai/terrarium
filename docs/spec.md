# Spec: Terrarium (version 3, checked against the pushed code)
Author: Sweeya Ghanta. October 24, 2026.
Repo: https://github.com/limontree-ai/terrarium
Branch of record: main. Latest merge: PR #12 from feat/voice_ui_complete.
This replaces every earlier spec.md, including the one in docs/spec.md in the repo.

## 0. Repo facts
1. The work is on **main**. Every feature branch is already merged: feat/scaffold_initial, feat/physics_core, feat/blob_complete, feat/learning_core, feat/world3d_core, feat/voice_ui_complete
2. A remote branch named **assets** also exists, and its contents are already on main under the assets folder, so there is nothing left to merge from it
3. Start the fix work from a new branch off main: fix/core_corrections
4. The prebuilt assets live at **assets/src/world3d/** and they are complete: assets.js, blob.js, catalog.js, core.js, effects.js, food.js, ground.js, palette.js, plants.js, rocks.js, sky.js, water.js, weather.js, plus a preview page at assets/preview/
5. Commands: npm install, npm run dev, npm test, npm run build
6. No commit or pull request may carry AI attribution. Sweeya is the only author and the only person who merges

## 1. Summary
Terrarium is a 3D low poly planet with one light purple jelly blob on it. The blob learns to move through real policy search running live in the browser on a CPU. People change the world by speaking into a mic. The physics changes, and the blob's body and brain adapt: fins in water, legs on land, tall legs in snow, hoppers on the moon.

The reward is fixed everywhere. No body part is ever rewarded. Shapes appear because the physics makes them pay.

## 2. The learning method
A (1+lambda) evolution strategy with hidden trials, which is policy search in the reinforcement learning family.

Every round:
1. Snapshot the blob position, the world settings, and the food position
2. Build the current blob plus 8 variations. Every variation gets Gaussian noise on the brain. Some also get a body mutation
3. Run each candidate for 180 steps at 30 Hz off screen in Web Workers
4. Score each with the fixed reward in section 4
5. Adopt the best variation only if it beats the current blob by the adoption margin
6. Adapt sigma with the one fifth success rule
7. Body changes morph in gradually. The brain switches at once

Every candidate in a round starts from the identical snapshot and the identical seeded food sequence, so a score difference comes from the candidate alone.

## 3. The blob
1. Core: two box halves joined by one revolute joint, so the blob can inchworm with zero limbs
2. Up to 4 limbs, each up to 3 box segments, at most 8 joints in total including the core hinge
3. Colliders are boxes only. The renderer draws smooth jelly on top
4. Brain: 29 inputs, 16 tanh hidden, 8 outputs, 616 weights
5. Inputs: 8 joint angles, 8 joint speeds, 4 foot contacts, 3 for the core up vector, 2 for food direction in the body frame, 1 food distance, 1 fraction underwater, 2 for sine and cosine of the rhythm phase
6. **Motors are velocity motors.** act(outputs) sets each joint's target angular speed times its strength. Outputs are not target angles. Any text claiming target angles is wrong
7. Density range 400 to 1200, default 800, against a water density of 1000

## 4. The reward (fixed in every biome)
Per 180 step rollout, the score is progress plus eating minus energy. A failed rollout scores 0.

| Term | Rule |
| --- | --- |
| Progress | Each step, previous distance to food minus current distance, summed. **Signed. Moving away must cost.** Plus 1 per meter |
| Eating | Plus 5 when the core comes within 0.6 m of the food. Food then respawns from the seeded sequence |
| Energy | Each step, sum over joints of applied motor force times absolute joint speed times dt, times ENERGY_WEIGHT |
| Failure | NaN, speed over the cap, or leaving the area sets the score to 0 |

Never rewarded: limb count, limb length, body height, shape, raw speed, time alive.

## 5. The world
Voice can change waterLevel, snowDepth, mud, rain, wind, gravity, groundType, treeCount, and timeOfDay. World changes apply at the start of the next round, never mid rollout. Full ranges stay as implemented in src/config.js.

## 6. Voice
1. Browser Web Speech API with push to talk, plus a text box of equal standing
2. POST /api/world calls the **Anthropic API** with tool use, two tools: update_world and reply
3. ANTHROPIC_API_KEY lives in the server env, never in the browser, never committed
4. The server clamps every value to the config ranges
5. A keyword parser covers any failure
6. No voice output

## 7. Rendering and the asset contract
1. Three.js, low poly with flat shading everywhere, except the blob, which is smooth translucent jelly in light purple
2. **Every visible object comes from assets/src/world3d/.** No file under src may build its own terrain, water, sky, trees, rocks, food, weather, or blob. Import from the barrel at assets/src/world3d/assets.js and nowhere else
3. The assets are verified present on main. The remote branch named assets is identical to main for this folder and can be ignored
4. Curved world, wind, snow caps, and horizon fade come from core.js through setCurvedWorld, setWind, setSnowCaps, and setHorizonFade. src/world3d/shaders.js duplicates this and must be removed

### The blob
createBlob from assets/src/world3d/blob.js is the only blob. src/world3d/creature.js is a separate hand built blob and must be deleted. Its API:

```
createBlob({ size, limbCount, limbs: { length, width, thickness } })
  setLimbCount(n)
  setLimbParams({ length, width, thickness })        instant
  evolve({ length, width, thickness }, seconds)      gradual morph, 90 s default
  setJointActivity(limbIndex, jointIndex, 0 to 1)
  setMotorActivities(array)                          flat, limb times 2 plus joint
  impact(worldDir, strength), landed(speed), push(strength)
  update(dt, { velocity, grounded })                 call every frame
BLOB_COLOR is #C8A8F0. MAX_LIMBS comes from the asset
```

The genome carries per limb and per segment sizes. createBlob takes one shared limb size. The adapter maps genome traits to the asset: limbCount from traitsOf().limbCount, and length, width, and thickness from the mean across limbs. The visual is an approximation of the physics body on purpose, and the physics stays the source of truth.

The gradual body morph uses blob.evolve, not a hand written lerp in the renderer. The 90 second morph in section 2 is already implemented inside the asset.

### Where each asset goes
| Need | Call |
| --- | --- |
| Sky, sun, moon, clouds, stars, time of day | createSkySystem, TIME_PRESETS |
| Ground, snow layer, mud | createTerrain, createSnowLayer, createMudPuddles |
| Water and underwater tint | createLake, createUnderwaterFx |
| Trees, bushes, flowers, grass, reeds | createTreeField, createFlowerField, createGrassTufts, createReeds |
| Rocks, ice, moon boulders | createRockField, createIceCrystal, createIceberg, createMoonBoulder |
| Food | createFruit, createFruitAtTrees |
| Rain, snow, wind particles | createWeather |
| Splashes and dust | createEffects |
| Colors and lighting presets | PALETTE, SKY, LIGHTING |

## 8. Audit against the pushed code
Checked at commit 62fe28c on main. Each row is a fact about the code as it stands.

| # | Requirement | Where | Status |
| --- | --- | --- | --- |
| 1 | Progress must be signed | src/physics/trial.js line 66 | **FAILS.** Math.max(0, ...) clamps progress to zero or above, so moving away is free. A blob that vibrates in place earns reward forever. This is the dominant reward hack |
| 2 | prevPos must be a copy | src/physics/trial.js line 70 | **FAILS or risks failing.** blob.prevPos = pos stores whatever translation() returned. If that object is reused by Rapier, prevDist is always 0 and progress is always 0, so the only signal left is the food bonus. Copy it as a plain object |
| 3 | Water drag must respond to body rotation | src/physics/forces.js lines 36 to 62 | **FAILS.** Face normals are hardcoded in body local space and dotted against world velocity, so the body rotation is never applied. A flat limb sweeping broadside gets the same drag as edge on, which means fins can never beat no fins. This single bug blocks the water demo |
| 4 | Drag applied at the face, not the center | src/physics/forces.js line 60 | **FAILS.** addForce applies at the center of mass, so drag produces no torque and a stroke loses most of its asymmetry |
| 5 | Buoyancy must use the submerged fraction | src/physics/forces.js lines 24 and 66 to 70 | **FAILS.** The test is a single center crossing, and the full box volume is used whenever it passes, so the blob pops at the surface |
| 6 | Food respawn must be seeded and reachable | src/physics/trial.js lines 57 to 62 | **FAILS twice.** It calls Math.random, so candidates in one round get different food and cannot be compared. It also places food anywhere in a 40 by 40 box, up to 28 m away, which no 6 second rollout can reach |
| 7 | Energy must come from config and have units | src/physics/trial.js lines 33 and 73 to 76 | **FAILS.** ENERGY_COST is hardcoded at 0.002 in the file, so src/config.js is ignored. Motor work is approximated as the sum of absolute brain outputs, which is not force times speed, so the weight has no physical meaning |
| 8 | Adoption margin must scale with the score | src/learning/evolution.js line 71, src/config.js line 96 | **FAILS.** A flat 0.05 against scores near 10 is half a percent, so noise gets adopted |
| 9 | Drag coefficient must come from config | src/physics/forces.js line 28 | **FAILS.** dragCoeff is hardcoded at 1.0 with a comment claiming it comes from config.js. Tuning the config does nothing |
| 10 | Water surface height from config | src/physics/forces.js line 24 | **FAILS.** waterLevel times 10 is a magic number in the file |
| 11 | Angular drag in water | src/physics/forces.js | **MISSING.** Spinning in water is free, so the blob can spin in place |
| 12 | Eat radius 0.6 m | src/physics/trial.js line 54 | Minor mismatch. The code uses 0.5 |
| 13 | Motor strength must be able to move the body | src/blob/build.js lines 11 and 226 | **SUSPECT.** MOTOR_FACTOR is 1.0 against bodies of roughly 20 to 30 kg. Verify the blob can move at all before tuning anything else |
| 14 | The app must use the prebuilt assets | src/world3d/ and assets/ | **FAILS, and this is the biggest visual gap.** Nothing under src imports anything from assets. src/world3d/scene.js imports only three and its own shaders, so every asset you built is unused and the app renders its own plain scene |
| 15 | Push to talk on the space bar | src/ui/, src/voice/ | **MISSING.** No key handler exists anywhere |
| 16 | Voice calls Anthropic | server/voice-api.js | **PASSES.** It uses the Anthropic SDK with a model from ANTHROPIC_MODEL and falls back to keywords with no key |
| 17 | Velocity motors | src/blob/build.js line 226 | **PASSES.** configureMotorVelocity, which matches this spec and contradicts the old spec |
| 18 | Core is two halves on one hinge | src/blob/genome.js | **PASSES** |
| 19 | Rhythm phase in the inputs | src/config.js line 73 | **PASSES.** RHYTHM_HZ exists and the genome carries it |
| 20 | Quadratic, normal based drag shape | src/physics/forces.js lines 51 to 53 | **PASSES in form.** The formula is correct, and item 3 is what breaks it in practice |

## 9. Fix order
Do these in order. Items 1 to 4 decide whether the demo exists.

1. **Progress.** Remove the Math.max clamp in trial.js and copy prevPos as { x, y, z } taken before the step
2. **Water drag rotation.** Rotate each face normal by the body rotation before the dot product with velocity, and apply each face force with addForceAtPoint at that face's center
3. **Food.** Use the seeded generator, not Math.random, and respawn 2 to 3 m from the blob
4. **Energy.** Import ENERGY_COST from config, compute work from motor force times absolute joint speed times dt, and set the weight so energy costs about 15 percent of a working run's progress. Start from 0.0001
5. **Motor strength.** Raise MOTOR_FACTOR until a hand written sine wave on the core hinge moves the start blob at least 0.5 m in 180 steps on grass
6. **Adoption margin.** 2 percent of the current score with a floor of 0.05
7. **Assets.** Rebuild src/world3d/scene.js on the barrel at assets/src/world3d/assets.js, and replace src/world3d/creature.js with createBlob. Delete creature.js and shaders.js. See section 7 for the full contract
8. **Buoyancy.** Submerged fraction per collider
9. **Push to talk.** Hold space to listen, release to send, and stop the space bar from scrolling
10. **Config cleanup.** Remove every hardcoded duplicate of a config value in trial.js and forces.js
11. **Angular drag in water**

## 10. Acceptance gates
The build is not working until all five pass.

1. A hand written sine wave on the core hinge moves the start blob at least 0.5 m in 180 steps on grass
2. **In a water world, a body with two wide flat limbs out scores the same body with two narrow limbs on the same seed.** If this fails, drag is still wrong and no amount of learning time will produce fins
3. A blob that vibrates in place scores at or below zero
4. Two runs with the same seed produce identical rewards for 60 rounds
5. 500 random genomes run 180 steps in grass, water, snow, and moon with zero NaN and zero blowups

## 11. Out of scope
Accounts, scores, leaderboards, voice output, a GPU, more than one blob, mobile layout, and saving between sessions.