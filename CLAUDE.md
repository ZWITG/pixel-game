# Pixel RPG

An original anime-fantasy action RPG in 3D voxel style, rendered in HD (the user wants it high quality, not low-res), built with Three.js (JS) + Vite.
It grows feature by feature with the user, who plays and tests with a controller.

## Run
- `npm install`, then `npm run dev` → http://localhost:5180
- If the dev server serves stale modules after a dependency change, restart it with `npx vite --port 5180 --force`.
- `npm run build` must pass before committing.
- Debug handle: `window.__game` (e.g. `__game.player`, `__game.store.get('hp')`, `__game.rig.mode`).

## Testing in the browser pane
- The pane throttles requestAnimationFrame, so drive frames by hand: `__game.step(1 / 60)`.
- Fake a controller by overriding `navigator.getGamepads` with an object that has 18 `buttons[i].pressed` and `axes`
  (PS5 names, standard order: Cross 0, Circle 1, Square 2, Triangle 3, L1 4, R1 5, L2 6, R2 7, Create 8, Options 9,
  L3 10, R3 11, D-pad 12-15, PS 16, touchpad 17; axes 0-1 left stick, 2-3 right stick).
- Prompts follow `__game.controls.device` ('pad' after any pad input, 'keyboard' after a key press).
- Keyboard: `dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))`, then keyup.
- Never await requestAnimationFrame in pane scripts: it never fires while the pane is hidden. Step frames, then screenshot
  (if the screenshot shows an old frame, take it again).
- Screenshots crop to 800×600 of a 1024×768 page, so HUD items on the right/bottom edge can be cut off.

## Layout
- `src/core/Game.js`: renderer, loop (`step(dt)`), world setup, spawning, combat glue, talking.
- `src/core/CameraRig.js`: camera-relative movement and the 'third' (behind-the-hero) camera. The 'top' mode is still there but off
  (`FEATURES.topDownCamera`, the user asked to remove the top-down view on 2026-10-27).
- `src/core/Store.js`: player stats (get/set/on). Stats rules in `src/config/stats.js`.
- `src/config/features.js`: on/off switch per feature. Every new feature gets one.
- `src/data/`: enemies, villagers, items/shops. Prefer data over code. Distances and speeds are in tiles.
- `src/render/voxel.js`: `VoxelBuilder` merges colored boxes into one mesh. `src/render/models.js`: characters, monsters (slime, boar, wisp, mushroom),
  trees (oak/pine/birch), houses (incl. smithy), stall, pickups, effects. `src/render/props.js`: scenery drawn into shared builders
  (rocks, bushes, fences, lanterns, fountain, barrels, crates, clouds, glow sprites).
- `src/art/looks.js`: character color sets. `src/art/icons.js`: HUD pixel icons as SVG.
- `src/world/regions.js`: named regions (center, radius, ground color, trees, flowers). `generateWorld.js`: seeded tile map with
  regions, river, lake, bridges, landmarks (`LANDMARKS`) and the village layout. `buildWorld.js` (3D meshes, returns animated parts),
  `collision.js` (tiles + rectangles; `fence: true` rects stop the hero but not monsters).
- Enemy behaviour is picked by `ai` in `data/enemies.js` ('chase', 'charge', 'shoot'); wisp orbs live in `Game.projectiles`.
  Where monsters spawn comes from their `regions` (and `night`).
- `src/systems/dayNight.js`: clock, sky, sun/moon, fog, stars, night glow. `src/world/ambient.js`: decorative life.
  `src/render/wind.js`: shared wind clock and `addWind(material)` for swaying grass and trees.
- Villagers (`src/entities/Npc.js`) walk using `wander` / `route` from `data/npcs.js`; their solid rect moves with them (`owner`).
- `src/entities/`: Player (attack, spin slash, dodge roll), Enemy, Npc. `src/ui/Hud.js` + `hud.css`: HTML overlay (stats, dialogue, shop, controls screen, prompts).
- Pickups (coins and monster drops) and the death satchel live in `Game.js` (`pickups`, `satchel`, `revive()`).
- `src/systems/controls.js`: all input (keyboard, mouse drag, gamepad) and the control scheme (`ACTIONS`, PS5 button names).
  Read actions from it; never add raw key handlers elsewhere. `src/ui/glyphs.js` draws prompts and `src/ui/controllerMap.js`
  builds the controls-screen diagram from `ACTIONS`, so rebinding there updates both.
- `src/systems/lockOn.js`: lock-on targeting. `src/systems/shop.js`: buy, sell and bag helpers.
- One loop: while a menu is open, only the HUD gets input; the world is paused.

## Rules
- Keep everything original. Genre conventions are fine; don't copy characters, maps, names or assets from existing games.
- After a feature change, update `FEATURES.md` (table, backlog, changelog), test in the browser, commit and push to GitHub.
- Bump `version` in package.json for each playable milestone.
- The 2D Phaser version lives at git tag `v0.2.0-2d`.
