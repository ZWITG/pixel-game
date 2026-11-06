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
- [x] Living economy: goods, markets, prices, prosperity, treasuries, tolls (v0.19.0)
- [x] Caravans on the roads: wagons, beasts, guards, ferries; rob, extort, escort or trade (v0.20.0)
- [ ] Roadside inns and waystations, riding your own horse (moved to phase 7)
- [x] Kingdom buildings: treasury, armory, barracks, granary, market hall, warehouse, guild hall, each with a job and a cost when destroyed (v0.21.0)
- [x] Voxel destruction of raze works and kingdom buildings (v0.22.0)
- [ ] Voxel blueprints for every house, wall and castle with hollow rooms, diggable ground, smoke and dust (phases 2, 2b, 3)

## Changelog
- 2026-11-06 v0.22.0 Teardown-style destruction (`voxels.js`, `voxelWorker.js`, switch `FEATURES.voxels`): raze works (banners, barracks, watchtowers, idols, powder stores) and every kingdom building become 0.5-tile voxels of real materials (thatch, wood, plaster, tile, stone, glass, iron), turned from their models in a background worker and drawn with greedy meshing and corner shading. Blows cut holes where they land, wider as you grow and narrower in stronger stuff; anything left without support (support runs straight down, but each material only reaches so far sideways) breaks away as chunks that tumble, bounce, crush monsters under them and settle as rubble, with flying bits and dust; when a structure's strength runs out it all comes down in blocks. Fire eats thatch and timber cube by cube. You walk into the walls and through the holes you make, and can stand on what's left. Rebuilt buildings come back whole. Fixed: the watchtower's legs pointed up, leaving its platform floating since v0.17
- 2026-11-06 v0.21.0 kingdom buildings (`estates.js`): as places grow they raise a granary (village), barracks, armory, market hall and warehouse (town), guild hall and treasury (city), each in its own quarter (trade toward the road, the army's away from it, civic near the middle) and in its nation's stonework. Each does a job: the granary keeps a food reserve for lean days, barracks set how many soldiers a nation can raise, the armory keeps arms and lets armourers work, the market hall adds to taxes, the warehouse holds more goods, the guild hall makes crafts better, and a nation with no treasury standing loses tax. Each can be torn down, timber ones burnt: the town calls its guards, and the fall costs what the building held (treasury gold is yours, barracks soldiers die, granary food burns, armory arms scatter). Ruins stay as rubble and broken walls; after a day the nation rebuilds under scaffolding with gold, timber and stone, buying in what its market lacks. Soldiers a nation can't pay desert. Town signs, the map and the Nations tab show what stands and what's down
- 2026-11-06 v0.20.0 caravans on the roads (`roads.js`, `caravans.js`, `market.js`): traders follow the road network (road graph with crossroads joined through towns), cross country only where it's shorter, and take ferry rafts where a road runs through water. Near a hero they become real: peddlers with pack mules, ox carts, covered caravans with horses, drivers and guards in their nation's colours. Speak with one to buy its load, demand a toll (they pay if you're too strong to fight, otherwise their guards draw steel), or hire on as escort for pay. Strike a wagon to rob it: guards fight, the load and the merchant's purse are yours, and the nation remembers (robbing adds to its threat). Bandit camps prey on nearby roads (a burnt camp makes the road safe) and you can rescue wagons for a reward. Nations send supply trains to their forts; seize them and the forts go short. Every town has a market screen (buy, sell, prices move as you trade), you carry coin and trade goods, and places you've conquered pay you taxes
- 2026-11-06 v0.19.0 living economy (`economy.js`): 12 goods made from the land around each settlement and by crafts as it grows (smiths, brewers, weavers, armourers). People move into the trades that pay best, prices rise and fall with stock, and merchants carry goods wherever the price gap pays, paying tolls at walled towns and river crossings. Prosperity comes from needs being met and sets a place's growth and taxes. Nations raise fewer soldiers when their markets are short of arms, and a full treasury keeps a bigger army. Burning a town's fields burns its stores and drives its prosperity down. Town signs show prosperity and the market on arrival, the Nations tab shows each treasury, its income, food and arms, and the map shows traders on the road. Plan for the whole world upgrade in `docs/world-upgrade-plan.md`
- 2026-11-02 v0.18.0 Conquerors change their skills: each has four twists on shared skills (Titan tramples and quakes on landing, Storm jumps twice, Void blinks and needs no air, Ember trails fire and fells burning trees, Frost walks on water and skates) and one discipline only it can earn by doing its deed (Demolition, Conductance, Harvest, Pyromancy, Stillness). New Gifts tab in the menu. The Spirit Tree is now each Conqueror's own: only boughs it can grow, its own bough and rank names, diamonds on nodes that open a twist, and a discipline bough
- 2026-11-02 v0.17.0 strongholds are destruction sites: camps, dens, bandit camps, keeps and forts fall when their works are torn down, each doing something while it stands: War Banners fire up defenders, Barracks send reinforcements, Watchtowers shoot, Blood Idols mend the rest, Powder Stores blow up and set the ground alight. Fire eats them, frost makes them brittle, area powers hit several at once. City and lair seats have works too, and the ruler only comes out once those are down
- 2026-11-02 v0.16.0 balance: enemies have roles (`ROLES` in evolve.js) with target hits-to-kill and bite, nations have a level so land gets dangerous above your strength, powers no longer scale off Titan-only punch stages (`body.might`), Conquerors evened out, rulers are long fights, and nations ignore a weak hero until they're hurt or the hero is strong enough to notice
- 2026-11-02 v0.15.0 the map now shows the living world: every settlement by its size and owner, forts, each nation's seat with its ruler's state (ringed and pulsing when exposed), ash, frost and rot on the land, a fuller legend, and details under the cursor
- 2026-11-02 v0.15.0 heroes and castles: each Conqueror has plate, straps and a signature piece: Titan's rune slab and boulder fists, Stormcaller's lightning spears, Voidwalker's floating scythe, Emberlord's burning sword, Frostwarden's ice shield and crystal sword. Mastery now shows on the body in three stages: veins of light, circling shards, a rune on the ground. Cities have round towers with pointed roofs, battlements, arched gatehouses and a citadel, keeps are jagged ruins, bandit camps have tents and leaning stakes, lairs a ring of black fangs, and the Lantern Spire is round
- 2026-11-01 v0.14.0 new models: every person and monster resculpted in the heroes' toon style with its own silhouette; six rulers and bosses redesigned; every nation builds its own architecture with painted walls, pitched roofs and windows that light at night; roads are rutted earth with laid cobbles and kerbs; city stone is weathered with moss
- 2026-11-01 v0.13.1 a beaten hero wakes close to where they fell, on safe ground away from enemies
- 2026-11-01 v0.13.0 the living country of Vael: six nations think for themselves, earning gold, raising armies, building forts, retaking ground, attacking each other and hunting you, each by its own doctrine with its own troops and war machine: Aurel siege engines, Thorn ambushes, Frostwall blizzards, Cinder scorched earth, Drowned plague and risen dead, Bone swarm. Named captains hunt you and rise in rank if they beat you. Settlers found homesteads that grow by day through hamlet, village, town and city into kingdoms. Borders move with strength. Chronicle in the Nations tab
- 2026-11-01 v0.12.0 elements: every Conqueror's powers now look like their element (real flames, forked lightning, ice crystals, stone spikes, holes of darkness) and change the land: fire spreads through grass and burns forests down, ice creeps out and freezes water solid enough to walk on, the void rots the ground and drains what stands on it, lightning runs across water, and stone ruptures outward. Fire melts ice. Fixed power effects never fading
- 2026-11-01 v0.11.1 fixed the freeze when a soldier came close; soldiers now fight properly, and one broken monster or frame can no longer stop the game
- 2026-11-01 Nations: six nations hold the world: The Aurel Crown, The Thorn League, The Frostwall, The Cinder Reach, The Drowned Court, The Bone Waste. Break 60% of a nation's strongholds to expose its ruler, bring the ruler down to conquer it for a lasting tribute. Banners change, patrols stop, borders show on the map, new Nations tab. Two new rulers hold the cities with guards
- 2026-11-01 Conquerors: New Game asks for one of five, for good: Titan, Stormcaller, Voidwalker, Emberlord, Frostwarden. Each is its own menacing creature (stone colossus, hovering storm spirit, legless shadow wraith, winged fire demon, ice knight) with eight powers that train by use, rank up to 6 and open new ones through Mastery. Four are worn on the D-pad (keys 1 to 4), swapped on the new Powers tab; Skills holds the Spirit Tree. Player 2 chooses their own. Punch stages past Solid Punch and Destructive Blow are Titan only, Flight Stormcaller only, Superspeed Voidwalker only. The Frostwarden boss is now The Rime King
- Backlog: secret boss, the creator's original hero (`docs/legend-hero.json`), arrives only once the player has conquered all nations
- 2026-11-01 menu in play on Options: icon tabs for Map, Powers, Satchel, Controls and Settings, L1 and R1 change tab; a world map drawn from the real land with contours, town icons, heroes and a pin that shows on the compass; settings for graphics, button hints and compass, and a way back to the title
- 2026-11-01 the game is now called Eradication; animated ZWITG studio intro plays while it loads (a button skips it)
- 2026-11-01 open world: start menu over a live title shot at dusk: Continue returns to where you left off and the hour it was, New Game asks first and puts the old hero aside, Controls, Graphics (Auto, High, Balanced, Fast); works with controller, keyboard and mouse
- 2026-11-01 v0.7.0 open world rebuilt for looks and speed: smooth HD renderer (no pixel grid or screen-wide dither), new terrain, water with shallows and foam, soft clouds, low fog, painted trees with far picture trees, tuft grass that fades out, stone walls; real 3D toon heroes with streaming scarves replace the sprites; land builds in background workers (worst frame while running 309 ms to 14 ms); resolution adapts to hold the frame rate; day cycle (16 minutes); compass with goals and towns, place names on arrival, button list hides itself, only the 3 nearest beams show
- 2026-11-01 prototype: six new enemies by land and four huge bosses with powers in their own lairs
- 2026-11-01 prototype: split-screen camera fixed for flight and Superspeed: follows heroes into the air and across water, splits by real height, splits faster at speed, never flickers
- 2026-11-01 prototype: combat rebuilt: enemy tells, moves, turn-taking, stagger; roll, guard, parry, counter, grab, throw, slam, air dive, lock-on, enemy health bar
- 2026-11-01 prototype: ground fixes: no walls around pits, oldest craters fill back in cleanly and up to 1500 are kept, props and crack marks settle with the land, no gaps in the ground at speed, nothing placed on cliff faces, softer crack marks
- 2026-11-01 prototype: world generation: four rivers with fords, roads to every town, red terraced badlands, pooled swamp, stone fields, giant trees
- 2026-11-01 prototype: fixed long freezes when loading new areas; terrain builds in small slices; monsters stop at walls and no longer shrink when hit; skill progress saves on close; chopped-object save stays small; start area stays dry; beds heal; door and charge edge cases
- 2026-11-01 prototype: Destructive Blow escalates with charge and skill: staged poses, rising hero, cracking ground, orbiting boulders; at the top it shatters the earth with pillars, fissures, flung stone, a flash and a long rumble
- 2026-11-01 prototype: many more animations: idle, run, dash, swim, fly, glide, rising, falling, landing, uppercut finisher, charging, hit recoil, body lean, sprint dust; monsters squash when hit and rear up close to you; townsfolk stop and wave
- 2026-11-01 prototype: Destructive Blow, evolved from maxed Punching: hold Square to charge, release to explode, stronger with its own skill. Speed now has diminishing returns
- 2026-11-01 prototype: Superspeed now builds up from a sprint with momentum; a chase camera follows behind the runner and holds steady on hills
- 2026-11-01 prototype: Superspeed skill, evolved from maxed Running; press sprint again at full sprint; afterimages, camera rush, water running from level 3, ramming
- 2026-11-01 prototype: Spirit Tree redrawn as an even fan on a larger map; left and right change bough, up and down move along it
- 2026-11-01 offline launcher: Play Pixel RPG.bat runs the game with no internet and updates from GitHub when online; fonts now ship with the game
- 2026-11-01 prototype: swimming rebuilt for free movement: faster, sprint with R2, no more being sent back to shore (tiring just slows you), jump and punch in water, swim up any bank, take off in flight from water
- 2026-11-01 prototype: Jumping skill, which evolves into a Flight skill at its top level; jump and hold X to fly, glide when released, more time, height and speed as Flight levels
- 2026-11-01 prototype: split-screen shows more: wider lens, camera further back, extra room while moving
- 2026-11-01 prototype: removed the item list from the game screen; items show in the Satchel, with brief +1 notes when picked up
- 2026-11-01 prototype: explorable places: 2 walled cities, 5 villages, 6 bandit camps with new human bandits and chiefs, 3 ruined keeps, 9 caves to walk through; townsfolk talk, heal and trade
- 2026-11-01 prototype: camera fixes: no longer passes through houses or landmarks, shared view climbs hills and avoids walls, no tunnel through the forest in split-screen, blows only shake nearby screens, shorter and capped shake, clean restart after travel, gentler sideways turn
- 2026-11-01 prototype: in co-op each player's Satchel opens in their own half of the screen, both can be open, and the other hero keeps playing
- 2026-11-01 prototype: players can hurt each other; hero level; monsters evolve through six visible forms, live, scaling with the heroes; ten location categories with their own goals, rewards and beams
- 2026-11-01 prototype: Satchel page (Triangle) with inventory and crafting; five gear slots, three potions, ten recipes; gear and potions change force, health, armor, speed, carrying and Mass; gear is crafted in houses using bag and chest
- 2026-11-01 prototype: split-screen is now horizontal, Player 1 on top and Player 2 below, each with their HUD in their own half
- 2026-11-01 prototype: both heroes redrawn from an animated skeleton (taller anime proportions, six-frame walk, idle, punch and jump poses, wrapped fists, no sword). New camera: hero low in frame, eased following, climbs over hills, anything near the lens or between it and a hero dissolves, eases round when walking sideways
- 2026-11-01 prototype: local co-op. A second controller joins with OPTIONS as a second hero with separate progress; shared camera when close, adaptive split-screen when apart; terrain streams around both
- 2026-11-01 prototype: monsters roam the open world, tougher further out, with Elder versions; hero health; Mass grows with Strength, Endurance and fighting and multiplies destruction; Fighting skill; real terrain craters, torn-up grass, destructible houses; heavy heroes stomp when landing
- 2026-11-01 prototype: Square is now a punch (keyboard J) with a three-hit chain; six punch stages from Jab to Worldbreaker need Punching practice plus Strength, adding force, hit-stop, shockwaves and ground cracks; new Punching skill and bough; axe and pick removed
- 2026-11-01 prototype: interactive world. Trees, new rocks, houses and landmarks are solid; chop trees and mine rocks for Wood, Stone and Iron; Woodcutting and Mining skills; Strength sets bag size, blow force and which boulders crack; enter houses, sleep, store items in a chest; cut trees leave stumps and regrow after 15 minutes; jump (Cross / Space), higher with Strength and Speed, clears low rocks
- 2026-10-30 prototype: body attributes (Strength, Speed, Endurance) grow from skill practice and change movement, breath, climbing and hero size; new Climbing and Running skills; skill map gains boughs and body gauges
- 2026-10-30 prototype: PS5 prompts by default, L1 recenters the camera, touchpad travels between landmarks
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
