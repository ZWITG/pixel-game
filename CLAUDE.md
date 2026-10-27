# Pixel RPG

An original anime-fantasy action RPG, built in Phaser 3 (JS) + Vite. It grows feature by feature with the user.

## Run
- `npm install`, then `npm run dev` → http://localhost:5180
- `npm run build` must pass before committing.
- Debug handle: `window.__game` (e.g. `__game.scene.getScene('World').player`, `__game.registry`).
- Testing in the browser pane: the pane throttles the game loop, so step frames by hand with `__game.step(t, 16.7)`
  (keep `t` at or after `performance.now()`). Fake a controller by overriding `navigator.getGamepads` with an object
  that has `buttons[i].pressed` and `axes`.

## Layout
- `src/config/features.js`: on/off switch per feature. Every new feature gets one.
- `src/config/stats.js`: player stats in the registry, XP and level-up rules.
- `src/data/`: enemy (and later item/NPC/quest) definitions. Prefer data over code.
- `src/art/sprites.js`: all pixel art as character grids plus a palette. No external image files yet.
- `src/world/`: seeded map generation.
- `src/entities/`: Player, Enemy.
- `src/scenes/`: Boot (textures, anims), World (gameplay), UI (HUD, dialogue box, shop menu).
- `src/systems/controls.js`: all input (keyboard + gamepad). Read actions from it; never add raw key handlers.
- `src/systems/shop.js`: buying rules. Items and shops are in `src/data/items.js`, villagers in `src/data/npcs.js`.
- Phaser updates the UI scene before World each frame; World ignores input for 150 ms after a menu closes.

## Rules
- Keep everything original. Don't copy characters, maps or names from existing games.
- After a feature change, update `FEATURES.md` (table, backlog, changelog), test in the browser, commit and push to GitHub.
- Bump `version` in package.json for each playable milestone.
