# Pixel RPG

An original anime-fantasy action RPG, built in Phaser 3 (JS) + Vite. It grows feature by feature with the user.

## Run
- `npm install`, then `npm run dev` → http://localhost:5180
- `npm run build` must pass before committing.
- Debug handle: `window.__game` (e.g. `__game.scene.getScene('World').player`, `__game.registry`).

## Layout
- `src/config/features.js`: on/off switch per feature. Every new feature gets one.
- `src/config/stats.js`: player stats in the registry, XP and level-up rules.
- `src/data/`: enemy (and later item/NPC/quest) definitions. Prefer data over code.
- `src/art/sprites.js`: all pixel art as character grids plus a palette. No external image files yet.
- `src/world/`: seeded map generation.
- `src/entities/`: Player, Enemy.
- `src/scenes/`: Boot (textures, anims), World (gameplay), UI (HUD overlay).

## Rules
- Keep everything original. Don't copy characters, maps or names from existing games.
- After a feature change, update `FEATURES.md` (table, backlog, changelog), test in the browser, commit and push to GitHub.
- Bump `version` in package.json for each playable milestone.
