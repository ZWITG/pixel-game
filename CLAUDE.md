# Pixel RPG

An original anime-fantasy action RPG in 3D voxel pixel style, built with Three.js (JS) + Vite.
It grows feature by feature with the user, who plays and tests with a controller.

## Run
- `npm install`, then `npm run dev` → http://localhost:5180
- If the dev server serves stale modules after a dependency change, restart it with `npx vite --port 5180 --force`.
- `npm run build` must pass before committing.
- Debug handle: `window.__game` (e.g. `__game.player`, `__game.store.get('hp')`, `__game.rig.mode`).

## Testing in the browser pane
- The pane throttles requestAnimationFrame, so drive frames by hand: `__game.step(1 / 60)`.
- Fake a controller by overriding `navigator.getGamepads` with an object that has `buttons[i].pressed` and `axes`
  (standard mapping: A 0, B 1, X 2, Y 3, LB 4, RB 5, Select 8, Start 9, R3 11, D-pad 12-15; axes 0-1 left stick, 2-3 right stick).
- Keyboard: `dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))`, then keyup.
- After rendering by hand, wait two animation frames before a screenshot, or it may show an old frame.
- Screenshots crop to 800×600 of a 1024×768 page, so HUD items on the right/bottom edge can be cut off.

## Layout
- `src/core/Game.js`: renderer, loop (`step(dt)`), world setup, spawning, combat glue, talking.
- `src/core/CameraRig.js`: 'top' and 'third' camera modes, camera-relative movement.
- `src/core/Store.js`: player stats (get/set/on). Stats rules in `src/config/stats.js`.
- `src/config/features.js`: on/off switch per feature. Every new feature gets one.
- `src/data/`: enemies, villagers, items/shops. Prefer data over code. Distances and speeds are in tiles.
- `src/render/voxel.js`: `VoxelBuilder` merges colored boxes into one mesh. `src/render/models.js`: hero, villagers, slime, tree, house, stall, coin, slash.
- `src/art/looks.js`: character color sets. `src/art/icons.js`: HUD pixel icons as SVG.
- `src/world/generateWorld.js` (seeded tile map + village layout), `buildWorld.js` (3D meshes), `collision.js` (tiles + rectangles).
- `src/entities/`: Player, Enemy, Npc. `src/ui/Hud.js` + `hud.css`: HTML overlay (stats, dialogue, shop, prompts).
- `src/systems/controls.js`: all input (keyboard, mouse drag, gamepad). Read actions from it; never add raw key handlers elsewhere.
- One loop: while a menu is open, only the HUD gets input; the world is paused.

## Rules
- Keep everything original. Genre conventions are fine; don't copy characters, maps, names or assets from existing games.
- After a feature change, update `FEATURES.md` (table, backlog, changelog), test in the browser, commit and push to GitHub.
- Bump `version` in package.json for each playable milestone.
- The 2D Phaser version lives at git tag `v0.2.0-2d`.
