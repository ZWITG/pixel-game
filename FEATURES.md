# Features

Switches live in `src/config/features.js`. Set one to `false` to remove that feature without deleting code.

## Controls
Controller prompts use the PS5 layout. Any standard gamepad works (Xbox: A = Cross, B = Circle, X = Square, Y = Triangle, LB/RB = L1/R1, LT/RT = L2/R2).
On-screen prompts switch between keyboard keys and PS5 buttons depending on what you used last.
Press Options (or Esc) in game for the controls screen with a controller diagram.

| Action | Keyboard / mouse | PS5 controller |
|---|---|---|
| Move (relative to camera) | WASD / arrows | Left stick / D-pad |
| Turn camera | Drag with mouse, or Z / X | Right stick |
| Attack | Space / J | Square or R1 |
| Spin slash (hits all around, 1.2 s cooldown) | F / L | R2 or Triangle |
| Dodge roll | Shift / K | Circle |
| Lock on / unlock | Q / Tab | L2 or click R3 |
| Switch target (locked on) | Z / X | Flick right stick |
| Talk | E | Cross |
| Recenter camera behind you | V | L1 |
| Top-down view (only with `topDownCamera` on) | C | Create or touchpad |
| Controls screen | Esc / P | Options |
| Menus: choose / confirm / back | W S / E Space Enter / Q Esc | D-pad or stick / Cross / Circle |
| Shop: Buy / Sell tab | A D / arrows | L1 R1 / D-pad left right |
| Rise after falling | R | Cross or Options |

## In the game (v0.6.0, 3D)
| Feature | Switch | Notes |
|---|---|---|
| 3D voxel world, HD | — | Three.js at full resolution with anti-aliasing, soft shadows, filmic tone mapping, gradient sky, fog; 60×40 seeded map (`src/world/`) |
| World regions | — | Each has its own ground color, trees, details, monsters and a name banner (`src/world/regions.js`):<br>**Sunpetal Meadow** (oaks, flowers, windmill, slimes and boars), **The Dimwood** (dense pines, leaf litter, glowing mushrooms, a fairy-ring clearing, Puffcaps and Wisps), **Glimmer Lake** (sandy shore, reeds, lily pads, a long boardwalk, Puffcaps), **Thornback Moors** (boulders, old pillar ruins with an altar, boars and fire slimes), **Spirit Hill** (the great dimmed Spirit Tree, standing stones with runes, glowing flowers, Wisps) |
| River and bridges | — | A river runs from the northern hills into Glimmer Lake; railed wooden bridges where roads cross water |
| Day/night cycle | `dayNight` | 8 minutes per day, clock in the top right. Dawn and dusk colors, moonlit nights with stars; lanterns, windows, runes and mushrooms glow brighter at night; Wisps also roam anywhere after dark |
| Ambient life | `ambientLife` | Grass and treetops sway in the wind, butterflies over flowers, birds that take off when you come close, fireflies, motes rising from the Spirit Tree, fish jumping in the lake and ponds, chimney smoke, the windmill turning (`src/world/ambient.js`) |
| Wandering villagers | `wanderingVillagers` | Villagers stroll around their spots, Pip runs about, Guard Bram patrols; they stop and face you when you come near |
| Retro pixel mode | `retroPixels` | Off by default: renders at 1/3 resolution for a chunky pixel look |
| Grass blades | `grassBlades` | ~8,000 instanced blades; turn off on slow machines |
| Block shading | — | Darker block bottoms (fake ambient occlusion), smooth ground color blending, glossy water |
| Scenery | — | Oak, pine and birch trees; rocks, berry bushes, little mushrooms, lily pads; drifting voxel clouds; glowing lanterns (`src/render/props.js`) |
| Hero look | — | Spiky hair, shoulder guards, belt buckle and a cape that lifts while running |
| HUD design | — | Framed panels with gold corner studs, name tags in dialogue, area-name ribbon, stat chips, vignette |
| Behind-the-hero camera | — | The only camera: free look with right stick / mouse, L1 recenters, swings behind you when locked on; rises over trees and houses that block the view, and pulls in only if that isn't enough (`src/core/CameraRig.js`) |
| Top-down camera | `topDownCamera` | Off since v0.4.0 (the user asked to remove it); turn on to switch views with C / Create |
| Voxel hero | — | Blocky anime-style model with walk cycle and sword swing (`src/render/models.js`) |
| Controller support | `gamepad` | PS5 layout with PS button prompts (any standard pad works), controls screen with a controller diagram built from the bindings (`src/systems/controls.js`, `src/ui/glyphs.js`, `src/ui/controllerMap.js`) |
| Sword combat | `combat` | 0.35 s cooldown, crescent slash effect, knockback, hit flash |
| Spin slash | `spinSlash` | Full turn hitting every enemy within 1.35 tiles for ATK + 1; 1.2 s cooldown |
| Lock-on targeting | `lockOn` | Picks the closest enemy in front (9 tiles), gold marker + name and HP bar, camera swings behind you, hero strafes facing the target; switches left/right; jumps to the next enemy when the target dies; drops past 13 tiles (`src/systems/lockOn.js`) |
| Dodge roll | `dodgeRoll` | 0.4 s somersault, about 2.4 tiles, invincible for the first 0.3 s ("Dodge!"), 0.2 s cooldown, presses buffered 0.15 s; rolls away from a locked target when the stick is idle |
| Enemies | `enemies` | Data-driven (`src/data/enemies.js`), up to 18, respawn every 4 s. Each has a model and an AI type (`src/entities/Enemy.js`):<br>Slime (Lv 1, chases), Puffcap (Lv 1, slow mushroom that splits into 2 fast Sporelings), Thornback Boar (Lv 2, paws the ground then charges in a line, dazed if it hits a wall), Fire Slime (Lv 3), Wisp (Lv 3, floats at a distance and fires slow orbs you can roll through) |
| Leveling | `leveling` | XP bar; each level +1 max heart (cap 15), full heal; +1 ATK every 2 levels |
| Coins | `coins` | 70% drop chance, spinning voxel coins |
| Monster drops | `monsterDrops` | Slime Gel (2c), Spore Cap (3c), Boar Hide (5c), Ember Core (6c), Wisp Dust (8c), Boar Tusk (12c), rare Slime Pearl (15c) (`src/data/items.js` LOOT, chances in `enemies.js`); walk over drops to pick them up, nearby drops slide to you |
| Loot drop on death | `lootDrop` | Falling leaves your coins and drops in a satchel with a gold light beam; you wake up in Lumen Hollow keeping level and gear; walk to the satchel to get it all back; fall again first and the old satchel is lost |
| Damage numbers | `damageNumbers` | Floating text over 3D positions |
| Village: Lumen Hollow | `village` | 5 houses, market stall, fence with gaps at the roads, lanterns, barrels, crates, notice board; wards push monsters out (over the fence); name banner per section |
| Market Row | `village` | East section of the village: fountain plaza, Odo's stone forge with anvil, yellow-roof house, Lyra the bard |
| Villagers and dialogue | `dialogue` | Elder Mirae, Mina, Pip, Guard Bram, Odo the Smith, Lyra the Bard (`src/data/npcs.js`); they face you when you talk; world pauses |
| Shop | `shop` | Mina's Goods (`src/data/items.js`): Buy tab with Herb Tonic 5c, Steel Sword 25c (+1 ATK), Wind Boots 20c (+20% speed), Heart Charm 30c (+1 heart); Sell tab for monster drops (one at a time or Sell all). Odo's Forge: Knight Blade 70c (+2 ATK), Iron Vest 45c (take 1 less damage, min 1), Swift Greaves 35c (+15% speed); also buys drops |
| Death & respawn | — | "You fell..." screen; with `lootDrop` off, falling restarts the whole game |

The 2D Phaser version is kept at git tag `v0.2.0-2d`.

## Ideas backlog (pick, add, or cross out)
- [x] NPC village with dialogue
- [x] Shop (spend coins)
- [x] 3D with two camera modes
- [x] Lock-on targeting
- [x] Dodge roll with brief invincibility
- [x] Monster drops to sell, loot satchel on death
- [x] PS5 controller layout and controls screen
- [x] Camera avoids trees and houses (rises over them)
- [x] More monster types (Puffcap, Sporeling, Thornback Boar, Wisp)
- [x] Market Row village section with a blacksmith
- [ ] Inventory and equipment screen (swords, armor, carried tonics on Triangle)
- [ ] Block / parry on L1 (L1 currently switches the camera)
- [ ] Quests (e.g. Elder asks you to clear slimes)
- [ ] Save / load (localStorage)
- [ ] Dungeon with stairs and a boss
- [ ] Magic / special skill
- [x] Day / night cycle with lanterns
- [x] Distinct world regions, landmarks and ambient life
- [ ] Climb Spirit Hill quest: rekindle the Spirit Tree
- [ ] Weather (rain, fog in the Dimwood)
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Controller rumble on hits
- [ ] Mobile touch controls

## Changelog
- 2026-10-30 prototype: Skills page replaced by a visual skill map: the Spirit Tree at night, with glowing pixel-icon nodes on each skill's bough
- 2026-10-30 prototype: Swimming learned by trial and error (breath bar, wash ashore, practice saved), new Skills page (Options / Esc)
- 2026-10-30 prototype look pass: leaf-card trees with bark, thick swaying ground cover, 2D pixel sprite hero with walk frames and lantern, finer ground pixels, bloom, sun shafts, color grading, dithered finish, softer clouds, clearings around landmarks
- 2026-10-30 open-world prototype (`/world.html`, `src/open/`, not yet the main game): 8 km streamed terrain, pixel-art ground shader, mountains, lake, roads, Lantern Spire, colossal Spirit Tree, Drifting Isles, Titan Ribs
- 2026-10-27 v0.6.0: living world: five regions with their own look and monsters, river and lake with bridges and a boardwalk, the Spirit Tree on Spirit Hill, standing stones, moor ruins, Dimwood fairy ring, windmill; day/night cycle; wind, butterflies, birds, fireflies, fish, chimney smoke; villagers walk and patrol
- 2026-10-27 v0.5.0: new monsters (Puffcap that splits, charging Thornback Boar, orb-shooting Wisp), Market Row village section with fountain, Odo's Forge (Knight Blade, Iron Vest, Swift Greaves; defense stat) and Lyra the bard, village fence and lanterns, three tree kinds, wild props, clouds, hero cape, framed HUD; camera rises over trees
- 2026-10-27 v0.4.0: lock-on targeting, dodge roll with invincibility, spin slash, monster drops sold to Mina (Sell tab), loot satchel on death, PS5 controller layout (shoulders no longer turn the camera) with button prompts and a controls screen, behind-the-hero camera only (top-down switched off), L1 recenters the camera
- 2026-10-27 v0.3.1: HD rendering (full resolution, anti-aliasing, soft shadows, tone mapping), grass blades, smooth ground, glossy water, sky gradient; retro mode kept as a switch
- 2026-10-27 v0.3.0: rebuilt in 3D (Three.js, voxel pixel style), top-down and behind-the-hero cameras, camera-relative movement, mouse/right-stick camera
- 2026-10-27 v0.2.0: village Lumen Hollow, 4 villagers with dialogue, Mina's shop, controller support
- 2026-10-27 v0.1.0: first playable (overworld, combat, slimes, XP, coins, death screen)
