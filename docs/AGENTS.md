# Terrarium

One light purple jelly blob evolves his body and brain live through physics, and people reshape the world by voice. Your task is in the prompt you were given.

## Commands
1. Install: npm install
2. Run: npm run dev
3. Test: npm test (must pass)
4. Build: npm run build (zero errors)
5. Benchmark: npm run bench

Run test and build before reporting done, and paste the output. Fix code, never tests.

## Git rules
1. Never commit or push to main. Main changes only through merged pull requests.
2. One branch per feature: feat/<area>_<feature>. Fixes: fix/<area>_<bug>.
3. Areas: physics, blob, learning, world3d, voice, ui.
4. Rebase on origin/main before opening a pull request. Resolve conflicts only in your own folder.
5. One small pull request per feature, with what changed, how it was tested, and test output.
6. Commit messages: <area>: <what changed>
7. Never add a Co-Authored-By trailer, a "Generated with" line, or any AI attribution to commits, pull requests, or comments.
8. Only Sweeya merges.

## Ownership
src/physics: Prompt 1. src/blob: Prompt 2. src/learning: Prompt 3. src/world3d: Prompt 4. src/voice, src/ui, server: Prompt 5. src/contracts.js and src/config.js: Sweeya only.

## Rules agents break
1. Never reward body parts. Reward is progress, food, and energy only.
2. Never use spheres for physics colliders. The blob looks round, but colliders are boxes.
3. World physics changes apply at the next learning round. Visuals change right away.
4. Physics and blob code never import browser APIs.
5. API keys stay on the server.
