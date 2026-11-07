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

## Open-world prototype (`/world.html`, `src/open/`)
- `main.js`: the shared world, cameras, join and leave, the adaptive split, day cycle (`CLOCK`), resolution control (`LEVELS`; `?level=N` pins one). `player.js`: one hero (input, body, skills, bag, HUD). `hero3d.js`: the jointed toon hero; new poses go in `POSES`, picked by `Player.motion`.
- `work.js`: solid objects, chopping and mining; `work.actor` is the player whose blow is being worked out. `melee.js`: punches and blasts.
  `monsters.js`: adapter around `entities/Enemy.js`. `rooms.js`: house interiors. `splitView.js`: puts two views on screen.
- `terrain.js`: pure height plus saved dents. With `FEATURES.voxelWorld`, `height()` is the top of the half-tile cube column (`CUBE`) and `smoothHeight()` the land underneath (use it for steepness). `ground.js` `blockData()` meshes cube land (merged tops, walls, skirts, a flat water sheet); `voxelArt.js` `cubeMesh()` builds the cube trees, rocks and grass tufts used by foliage.js. `ground.js`: land, tree and grass data as plain arrays, run off the frame in `groundWorker.js`. `chunks.js`: streaming around every hero (near trees, far picture trees, per-chunk water), `deform()` edits live ground; dents go to the workers too. Use `chunks.settle()` after a teleport.
- `post.js`: own picture pipeline (scene, glow, shafts, tone curve). `materials.js`: terrain, water, sky, `masonry()`, shared noise texture, fog chunks. `foliage.js`: leaf and grass cards. `compass.js`: compass strip and place names.
- `startMenu.js`: the title screen (Continue, New Game, Controls, Graphics). `/world.html?play` skips it, which tests should use. Continue reads `lumen.spot`; New Game moves the save to `lumen.old.*`.
- `gameMenu.js`: the menu in play (Options): tabs for Map, Powers (the Spirit Tree), Satchel, Controls, Settings; L1/R1 change tab. `mapWorker.js` surveys the chart once in the background.
- `conquerors.js`: the five Conquerors and their powers as data. `powers.js`: what each `kind` does, effects (`PowerFx`), the D-pad bar. `conquerorPick.js`: the permanent choice. `/world.html?play=titan` starts as one (titan, storm, void, ember, frost). A later update adds the secret boss from `docs/legend-hero.json`; old saves move to `lumen.legend.*`.
- `nations.js`: the six nations (`NATIONS`), borders (`nationAt`), conquest and banners. Strongholds are `camp`, `den`, `bandit`, `keep` sites; a ruler's seat site stays sealed until enough fall. `world.nations.allFallen` is the trigger for the secret boss.
- `scars.js`: what powers do to the land: a grid of cells around the heroes where fire, ice, void, storm and earth spread by their own rules, sent to the shaders as a texture. `elementFx.js` and `PowerFx` in `powers.js`: how each element looks. `element` on a Conqueror picks both.
- `realm.js`: the living country: each nation's gold, troops, captains and choices (utility scores with `weights` in `doctrines.js`), wars, borders, growth, Chronicle. `settlements.js`: places grow by people through `TIERS`, meshes only near a hero. `doctrines.js`: each nation's character, machines, forts and field attacks. `realm.nations`, `.settlements`, `.outposts` save to `lumen.realm`.
- `kit.js`: the toon shapes, ink and glow every figure uses. `figures.js`: people, one skeleton with an outfit per look (`OUTFITS`). `creatures.js`: monsters and bosses (`CREATURES`), replacing the old models through `MODELS` in monsters.js. `architecture.js`: buildings by nation (`STYLES`), each a painted sheet plus four house shapes, one draw call each, windows lit at night.
- `fortress.js`: walls, round towers, gatehouses, citadels, ruins and tents as painted parts for one masonry mesh; `STONEWORK` is each nation's palette. Hero gear is `signature()` in hero3d.js; `STAGES` in player.js shows Mastery on the body through `ascend()`.
- `raze.js`: destruction sites. `WORKS` are the structures, `LAYOUTS` what each site has; `sites.struck` feeds them from any blast, `scars` from fire and frost.
- `economy.js`: goods, markets, prices, prosperity, taxes, tolls and trade runs (`runs`, drawn on the map; phase 5 puts them on the roads). Owned by `realm.economy`, ticked from `realm.grow()`. Tune `TRADES` rates and `NEEDS` first. Plan: `docs/world-upgrade-plan.md`.
- `roads.js`: road graph from `ROADS` in terrain.js, `route(a, b)`, `crossings()` (bridges, fords, ferries), `along()`. `caravans.js`: wagons, beasts and guards for trade runs near a hero; rob (`struck`), `extort`, `escort`, `buyLoad`, bandit ambushes; `world.caravans`. `market.js`: the trade screen (towns and caravans), one per player. Coin is `bag.gold`; trade goods are items (`itemOf(good)`, ore is the `iron` item).
- `estates.js`: kingdom buildings per settlement (`ESTATES` models and jobs, `fall()` costs, `rebuild()` with scaffolding). Tiers and rebuild costs live in economy.js (`ESTATE_TIER`, `REBUILD`); `s.ruined[kind]` (negative while waiting, 0..1 while rebuilding) is saved with the settlement. `world.estates`.
- `voxels.js` + `voxelWorker.js`: breakable voxel structures. `world.voxels.adopt(owner, group, parts, lit)` turns kit parts into a volume in the worker; `hit()` cuts and drops unsupported pieces, `fell()` brings it all down, `mend()` restores. `raze.js` `strike(w, force, hero, fx, burst, at)` cuts at `at`; works and estates use it. Hero collision is `voxels.blocks/floor` (solids with `voxel: true` are skipped for the hero). Off switch: `FEATURES.voxels`.
- `digs.js`: diggable ground. A heavy blow (melee `crater`) or a punch into a hillside turns a 32×32-tile patch (`HALF`, grid-snapped) into land voxels (turf, soil, clay, rock, iron ore, deep rock; `layer()`); pits, tunnels and caves, roofs fall in by `reach`. Cuts are saved to `lumen.digs` and dug again when a hero returns; `digs.floor()` is the ground inside a patch (player, monsters). Land volumes are `plain`: support is checked exactly with `Volume.around()`. Shaders: `uDigs` hides the smooth ground over a patch, `uDigMask` the grass only where dug. Off switch: `FEATURES.digs`.
- `smoke.js`: `world.smoke` puffs (`puff`, `dust`, `column`), one instanced draw call; `FireLights` (3 point lights kept in the scene, moved to the biggest fires). Voxel fire lives in voxels.js: `ignite(x, y, z, r, hero)` lights burnable cubes, `burn()` spreads and removes them every `FIRE_TICK`, `voxels.fires` feeds the lights; scars.js ignites structures from burning ground. Off switch: `FEATURES.atmosphere`.
- `roadsidePlan.js`: pure layout (worker-safe) of inns, waystations, tolls and `WORKS` (mills, quarries, lumber camps, mines) from `ROADS` and the land; ground.js keeps their yards clear of trees. `roadside.js`: their buildings, moving parts, keepers and what the Cross button does (`spot()` returns `{ label, menu }` or `{ label, act }`). Menus open in the trade screen (`market.open({ menu: { title, sub, rows } })`). `fairs.js`: a fair every `EVERY` days at `TOWNS` in turn, its court in `struck()`. `events.js`: ambush, bridge, siege (the realm's `war()` hands marches near a hero to `events.siege`, settled by `realm.settle`) and refugees (`realm.houseLost` → `events.flee`). Places that come and go use `showPlace`/`hidePlace` in compass.js.
- `animals.js`: `KINDS` (speed, flee, hp, drops, herd size), `herdSpots()` (deterministic pastures), boid herds spawned near heroes, `struck()`; the hero's horse (`steed`, saved to `lumen.horse`): `whistle`, `mount`, `dismount`, `speed()` (stamina, `RIDE`). Riding is `state.riding` in player.js: the horse sets the pace and climb limit, the hero uses the `ride` pose and sits `SADDLE` higher. `whistle` is an ACTION (L3 / H).
- `blueprints.js`: `houseVoxels(style, shape, seed)` builds a house as voxel data matching its painted model; `voxels.houses()` swaps houses to voxels within `HOUSE_NEAR` of a hero (`MOST_HOUSES` cap) and back when far. Worker `hollow()` gives adopted models rooms and storey floors; `Volume.budget` keeps a structure standing as built.
- `cityPlan.js`: street plans for every place (`makePlan`: wall ring, gates from `ROADS`, main/side streets/lanes grown Parish-and-Müller style, burgage plots by district, `TYPES` of building, `civic` spots for estates). `townPlans()` for TOWNS, `settlementPlan()` for places founded in play (told to the ground workers). `streetDistance` paints streets. Houses fill `plan.plots` by `pop / limitOf` in settlements.js. Houses are batched (`placeBuilding` in architecture.js; `h.mesh` is a stand-in, call `sync()` after moving it). Solids are found through `nearSolids` (solidGrid.js). City stonework is in `T.pieces`/`T.sectors` (towns.js) and turns to voxels near a hero (`voxels.walls()`).
- `nature.js`: per-Conqueror twists on shared skills, tree names and earned disciplines (`NATURES`); read with `player.nature`, shown on the Gifts tab and the Spirit Tree (`skillMap.js` builds one tree per Conqueror).
- Debug handle: `window.__world`. Testing while the user plays: use a separate pane tab, stub `Storage.prototype.setItem` and
  `navigator.getGamepads`, set `__world.world.skipRender = true`, and render only captured frames, or the save changes or the tab crashes.

## Rules
- New enemy types need an entry in `FIGHTERS` (foes.js) or `keepAway`. Before shipping, sweep every type in `ENEMIES` at point-blank range for a few seconds of real fighting: spawning and removing them proves nothing.
- Balance lives in `ROLES` (evolve.js: hits to kill, bite), `level` on NATIONS, and `body.might` for powers and monsters. Tune those before touching anything else.
- Keep everything original. Genre conventions are fine; don't copy characters, maps, names or assets from existing games.
- After a feature change, update `FEATURES.md` (table, backlog, changelog), test in the browser, commit and push to GitHub.
- Bump `version` in package.json for each playable milestone.
- Every version stays playable: before committing a new version, run `node scripts/snapshot.mjs` on the last commit of the current one (the user asked for this on 2026-11-01). It builds into `versions/<number>/` and tags it; commit that folder and push tags. `Play Old Version.bat` runs any of them on its own port, so saves never mix.
- The 2D Phaser version lives at git tag `v0.2.0-2d`.
