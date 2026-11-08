# Eradication (repo: pixel-rpg)

The game's title, chosen by the user on 2026-11-01. Save keys stay `lumen.*` so saves keep working.

An original anime-fantasy action RPG in 3D voxel style, rendered in HD (the user wants it high quality, not low-res), built with Three.js (JS) + Vite.
It grows feature by feature with the user, who plays and tests with a controller.

## Run
- Offline: double-click `Play Pixel RPG.bat` (`scripts/play.mjs`). It serves a finished build from `.play/` on port 5181 with no internet, and pulls from GitHub when it can. Every commit pushed to `main` reaches it, so always push.
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

## Where things are
- The game is the open world: `/world.html` and `src/open/`. The older voxel game (`index.html`, `src/core`, ...) is kept but not developed.
- **Before changing a system, grep `docs/architecture.md` for it and read that entry** (files, key functions, hooks, save keys). Keep that map current when you add or change a system.
- Hubs: `main.js` (world, loop, cameras, wiring), `player.js` (one hero), `melee.js` + `combat.js` (fighting, numbers), `monsters.js` + `foes.js` (enemies), `powers.js` + `kits/` (Conquerors), `skillPage.js` (HUD), `gameMenu.js` (menu), `src/config/features.js` (one switch per feature).
- Plans: `docs/combat-upgrade-plan.md`, `docs/world-upgrade-plan.md`.

## Engine rules
- Performance rules (v0.36.1): lights must stay counted the whole game (never hide a light or its parent; park it far away instead), or every shader rebuilds; effect buffers send only live ranges (`addUpdateRange`) and nothing when empty; main.js `warmShaders()` builds hidden effects' shaders twice after loading (`WARM_AFTER`) into `views[0].post.main` (compiling for the screen builds the wrong shaders); materials a kit creates on demand get a hidden stand-in in `PowerFx` so they're warmed too; the HUD writes through `put()` in skillPage.js. Pane timing is unreliable: measure with counters (`R.info.programs`, buffer bytes, DOM mutations), and the first frame drawn after many skipped ones always re-uploads the land.
- Look (v0.41): the War banner style block at the end of world.html's styles (`--iron`, `--brass`, `--cloth`, `--serif` Cinzel, `--rivets`, `--frame`) restyles every HUD piece and menu; add new HUD pieces with those tokens. `hud.setHero(def)` (main.js, each frame) fills the banner (`#omega`: `em` emblem, `b` numeral, `span` phase, `u s` progress) and the name in `#lv`; `setHealth` adds `low` and `body.low-hp` (`#hurt-veil`).
- Debug handle: `window.__world`. Testing while the user plays: use a separate pane tab, stub `Storage.prototype.setItem` and
  `navigator.getGamepads`, set `__world.world.skipRender = true`, and render only captured frames, or the save changes or the tab crashes.
- Every edit to world.html reloads the pane tab: keep the test setup in `sessionStorage` and `eval` it after each reload. Pane screenshots are often stale: render a frame, then take it again.

## Rules
- New enemy types need an entry in `FIGHTERS` (foes.js) or `keepAway`. Before shipping, sweep every type in `ENEMIES` at point-blank range for a few seconds of real fighting: spawning and removing them proves nothing.
- Balance lives in `ROLES` (evolve.js: hits to kill, bite), `level` on NATIONS, and `body.might` for powers and monsters. Tune those before touching anything else.
- Keep everything original. Genre conventions are fine; don't copy characters, maps, names or assets from existing games.
- After a feature change, update `FEATURES.md` (table, backlog, changelog) and the system's entry in `docs/architecture.md`, test in the browser, commit and push to GitHub.
- Bump `version` in package.json for each playable milestone.
- Every version stays playable: before committing a new version, run `node scripts/snapshot.mjs` on the last commit of the current one (the user asked for this on 2026-11-01). It builds into `versions/<number>/` and tags it; commit that folder and push tags. `Play Old Version.bat` runs any of them on its own port, so saves never mix.
- The 2D Phaser version lives at git tag `v0.2.0-2d`.
