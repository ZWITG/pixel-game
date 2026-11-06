# Eradication: World Upgrade Plan

Planning doc for the user's brief "world upgrade" (2026-11-06). It covers the look, destruction, models, trade,
kingdoms and places. Every phase ships as its own playable version, as before. Open questions for the user are at the end.

## 1. What the references show

| Reference | What it is | What we take from it |
|---|---|---|
| [Teardown: 8 Minutes of PS5 Gameplay (IGN)](https://youtu.be/OmPGyUpdKFY) | Tuxedo Labs' fully destructible voxel sandbox | Everything built from small cubes of real materials (wood, brick, concrete, glass, metal). Holes are cut exactly where a blow lands, loose parts fall as solid chunks, fire spreads through wood, collapses throw up smoke, dust, splinters and glass. Blocky shapes lit realistically. |
| [9 Days: start of the game vs later (MVR)](https://youtube.com/shorts/gtuUicH1b2A) | A solo-dev, Dragon Ball-like open-world action game | Power scale. At the start a blast dents a wall. Later the same move erases a street. Destruction has to grow with the hero, which fits our `body.might`. |
| What we have | Smooth HD toon heroes, ink outlines, painted buildings, our own lighting pipeline (`post.js`), scars, craters | We keep the heroes, the sky, the light and the elemental scars, and put voxel structures inside that world. |

What we learned about how Teardown works:
- Nearly all its rendering, lighting included, is voxel ray tracing. Teardown's own developer calls the mix of blocky shapes and realistic light the heart of the look. Because anything can move, nothing can be pre-lit.
- At launch, buildings didn't collapse when their supports were cut: "entire buildings will often be held up by one voxel" (PC Gamer). The developer has since shown a structural integrity prototype.
- Its materials decide what breaks: wood burns and breaks easily, while rock and heavy metal can't be destroyed.

Teardown's ray tracing doesn't run in a browser at our frame rate. We copy what the player sees (materials, clean cuts, falling chunks, smoke and dust, fire through timber) using techniques a browser can run, listed in section 3.

## 2. The look: "Teardown x 9 Days x Eradication"

- **Structures become voxel.** Houses, walls, towers, castles, forts, bridges, raze works, fences, carts and market stalls are all built from cubes **0.5 tiles** across. A house is about 20 × 16 × 16 voxels. Each voxel stores a material and a color shade.
- **Materials.** Each one has a set strength and its own look:

  | Material | Strength | Burns | Breaks into |
  |---|---|---|---|
  | Thatch | 0.2 | fast | straw puffs |
  | Wood / timber | 0.4 | yes | splinters, embers |
  | Plaster / daub | 0.5 | no | white dust |
  | Brick | 0.8 | no | red chunks, orange dust |
  | Stone / masonry | 1.0 | no | grey chunks, heavy dust |
  | Glass | 0.1 | no | glints that shatter |
  | Iron | 2.0 | no | bends, sparks |
  | Bedrock / castle core | ∞ until late game | no | only rulers' seats, until the hero is at the very top |

- **Detail up close, cheap far away.** Near the hero (about 250 tiles), structures are real voxels. Further out they're today's painted meshes, generated from the same blueprint so they match. A building's far mesh switches to rubble once the building is destroyed.
- **Light without ray tracing.** Ambient occlusion goes into each voxel corner as the mesh is built, which gives Teardown's soft crevices cheaply. It joins our existing sun shadows, glow and tone curve, plus a warm light that flickers off fires. Ink outlines stay on heroes and creatures only, so structures read as solid matter and figures stay anime.
- **Heroes and creatures stay smooth HD toon** (the user chose Smooth HD earlier). This is the mix: anime figures in a world made of breakable material. Question 1 at the end can change this.
- **Atmosphere.** Real-time dust and smoke volumes rise from collapses, using soft particle sprites with depth fade. Fire smoke columns can be seen from far away, so a burning town is visible across the map.

## 3. Destruction redesign

### How a blow works
1. **Carve.** Every blast (fists, powers, Powder Stores, siege machines) removes voxels in a sphere around the hit. Radius grows with `body.might` and power rank, and each material's strength decides what survives. This is the 9 Days curve: an early punch chips stone, a late-game Worldbreaker deletes the keep.
2. **Check what's still held up.** After a carve, only the touched building is checked. A flood fill starts from voxels resting on the ground. A cheap support rule, which Teardown didn't have at launch, limits how far each material can reach sideways from support: wood beams span far, stone arches need pillars. Anything unsupported breaks loose.
3. **Loose pieces fall as solid chunks.** Each loose group becomes one rigid chunk with its own small mesh. It falls with spin, bounces off the ground and breaks into smaller pieces when it lands hard. Small chunks turn into particles. Chunks can crush monsters and soldiers.
4. **Settling.** After a few seconds still, a chunk joins the rubble pile around the building. Rubble can be walked over and stays in the save, so a city you destroyed stays destroyed.
5. **Fire, frost and rot.** Burning scars spread into wood and thatch voxels and eat them away over time, so a burning roof collapses on its own. Frost makes material brittle, Void rot crumbles plaster, and Storm sets thatch alight.

### Keeping it fast in a browser
These numbers are targets to check by profiling.
- Voxel data is stored per building in **16³ bricks** of compact typed arrays. Only bricks that change get remeshed.
- **Greedy meshing runs in a Web Worker** (we already use `groundWorker.js` and `mapWorker.js`). Each frame has a remesh budget, with the nearest bricks first, so a big blast spreads its cost over a few frames instead of stalling.
- The support check is limited to the building that was hit (about 5,000 voxels) and also runs in the worker.
- **Debris limits:** at most about 60 rigid chunks moving at once (more turn straight into dust) and about 400 small pieces in one `InstancedMesh`.
- **Rubble collision** uses a coarse height grid per building, not per voxel.
- Far buildings stay as one draw call each, as now.
- Damage is saved as a list of carves per building (centre, radius, strength), not full voxel grids. Loading replays the list, so saves stay small.
- **Adaptive quality** (`LEVELS`) also reduces the debris limit, particle count and voxel range on weak machines.

### What changes in play
- **Raze works** stop toppling whole and break voxel by voxel.
- **Strongholds and seats** can be taken apart wall by wall. A breached wall lets troops pour through.
- **Siege machines** cut real holes, so the Aurel siege doctrine becomes visible.
- **Bridges can be destroyed.** That cuts trade routes and troop paths until a nation rebuilds them (section 5).
- **Diggable ground (the user chose this on 2026-11-06).** The heightmap stays everywhere for speed, and the ground turns into voxels only where a blast goes deeper than a crater. That patch becomes a local voxel volume of 0.5-tile cubes built from the land's height and biome layers (soil, clay, rock, ore veins). The ground mesh is masked out over the patch so the voxel volume shows through. Blasts and powers then dig tunnels, caves and overhangs into hills, and unsupported overhangs fall using the same support check and chunks as buildings.
  - Patches are created only near heroes, use the same worker meshing and frame budget, and are capped in number. Old patches far from every hero go back to a stored dent plus their saved carve list.
  - Monsters and the hero walk inside dug patches using the voxel volume's own collision. Swimming, `scars.floor` and grass skip those cells.
  - This is the heaviest part of the plan, so it gets its own phase and its own performance gate.

## 4. Better models (structures and NPCs)

- **Structures:** A **blueprint system** builds them from parts: foundation, framing, wall infill, window, door, beam, balcony, chimney, roof (thatch, tile, slate or shingle), and trims per nation style (`STYLES`).
  - Blueprints come in sizes per building type (section 6) and grow with their settlement. A hamlet hut becomes a two-storey townhouse.
  - Interiors are real voxel rooms (tables, shelves, beds, hearth, barrels), so a blown-open wall shows what's inside, and `rooms.js` can use the same data.
  - Each nation gets its own look: Aurel white stone with gold roofs, Thorn timber with ivy, Frost slate with ice, Cinder black basalt with glowing seams, Mire stilts with reeds, Bone piled ribs with hide.
- **NPCs:** more parts on the shared `figures.js` skeleton.
  - Hair cards, layered clothes (tunic, apron, cloak, hood, belt pouches), job tools (hammer, ledger, sack, pitchfork, lantern), body types (stocky, tall, old, child), faces with brows and expressions, and nation colours on clothes.
  - New idle and work poses: hammering, carrying a sack, haggling, sweeping, drinking.
  - Animals with simple rigs: horses, oxen, mules, dogs, chickens, sheep.
- **Budget:** NPCs within about 120 tiles get full detail. Further out they're simpler shapes with matching colours, so a crowded market stays cheap.

## 5. Trade system: a living economy

Based on how Bannerlord's villages, towns and caravans work (villages produce, towns consume, caravans move goods for profit, raids starve towns) and on the "emergent economies" agent model (bazaarBot: buyers and sellers with price beliefs, so prices move with supply and demand).

### Goods
Grain, fish, livestock, wood, stone, iron ore, tools, weapons and armour, cloth, ale, salt, luxuries (wine, spice, jewels) and pearls (lake). Land decides what a place makes: farmland makes grain, forest makes wood, mountains make ore and stone, the lake makes fish and pearls, frost lands make furs, cinder lands make obsidian and coal.

### Markets
- Each settlement has a stockpile, a production rate from its buildings and land, and needs that grow with population (food first, then tools, cloth, ale, luxuries).
- **Prices** come from stock against need. Scarcity raises them and gluts lower them. Each market has its own prices, so carrying goods between markets pays.
- **Prosperity** rises when needs are met and falls when they aren't. It drives growth (`settlements.js` already grows by people) and the taxes owed to the nation's **treasury**.

### Moving goods: caravans and traders
- Traders are real NPC parties on the map:
  - lone peddlers with a pack mule
  - farm carts with an ox
  - merchant caravans: 2 to 4 wagons, horses and hired guards
  - nation supply trains carrying food and weapons to forts and armies
- They plan the best-paying trip they can (profit minus distance and danger) over the **road graph**: today's roads, plus bridges, fords and ferries. They stop at **inns and waystations**, pay **tolls** at bridges and city gates to the owner's treasury, and avoid places known for bandits or your attacks.
- Peddlers trade with each other when they meet. Their stock and coin move from one to the other, so rumours and goods spread on their own.
- Simulation runs in two layers: groups far from any hero move along the graph as numbers only (cheap, like the realm sim today), and turn into real wagons, horses and guards when a hero comes near.

### Where Eradication's war comes in
This is what ties trade to the premise: **breaking a nation's economy breaks the nation.**
- Burning farms, sinking ferries, destroying bridges, robbing caravans and smashing granaries starve towns. Prosperity drops, the treasury empties, and fewer troops can be paid.
- An **armory** needs iron and tools to equip soldiers, so cutting the iron road leaves new recruits poorly armed and weaker.
- Nations respond by their doctrine: they escort caravans, rebuild bridges, raise tolls, open smuggling routes or hunt you.
- What you can do depends on question 4: rob, extort, trade or all three.

## 6. Kingdom and settlement buildings

Medieval towns grew around a market square, with the town hall, guild halls and main church around it. Craft quarters (tanners, dyers, smiths) sat near water or outside the walls because of smell and fire risk. Gates closed at night and collected tolls on goods coming in. The castle or citadel housed the ruler and the garrison. Manor Lords works the same way: districts grow out from the market, and residential plots also bring in the money.

New buildings by tier (each one works, and each one can be destroyed):

| Tier | Adds | What it does in the sim |
|---|---|---|
| Hamlet | houses, fields, well, woodpile | Grain and wood, a few people |
| Village | mill, smithy, chapel, market stall, granary | Turns grain into flour, makes tools, keeps food through winter |
| Town | market square, warehouse, tavern/inn, guild hall, barracks, palisade, toll gate | Prices and trade, recruits, tolls go to the treasury |
| City | **treasury/mint**, **armory**, stone walls and gatehouses, craft quarter, **trade quarter**, **civilian quarter**, temple, stables | Treasury holds the nation's gold (break in or burn it), armory equips troops, stables give caravans horses |
| Seat / Kingdom | citadel/palace, royal treasury, arsenal, great hall, garrison, harbour or great bridge | The ruler's base. A destroyed arsenal or treasury cripples the whole nation |

- **Districts** are laid out in rings, by real-town rules:
  - centre: market, civic buildings, temple
  - next ring: civilian homes on narrow street-front plots
  - outer ring or riverside: craft quarter
  - by the main gate: trade quarter, warehouses, inns
  - high ground: citadel
- Each nation's doctrine shapes its towns. Aurel builds big treasuries and walls, Thorn hidden stores, Cinder forges, Mire stilts over water, Bone hoards.
- Destroying a building has a consequence matching its job. Barracks: no recruits. Granary: hunger. Treasury: no wages, so soldiers desert. Armory: weak troops. Walls: open for raids.
- Rebuilding is visible: scaffolding and workers come back, and that work takes timber and stone carried in by trade.

## 7. A lived-in world: new places and life

- **Daily routines:** NPCs work at their building by day, shop at the market, go to the tavern at dusk and sleep at night. Guards change shifts. Fairs come round every so many days and draw caravans from far away.
- **Traffic:** carts on roads, horses tied outside inns, herders driving sheep, fishing boats on the lake, ferries crossing the river.
- **New places to find:**
  - **Along the roads:** roadside inns and waystations, toll bridges with keepers, river ferries, watermills and windmills, quarries, mines, lumber camps.
  - **Hidden or remote:** smuggler coves, a merchant guild vault, abandoned caravan wrecks, battlefields left by realm wars (with salvage), shrines on peaks, ruined watchtowers with views.
  - **Events:** a travelling circus or fair camp.
- **Events in motion:** caravans ambushed by bandits (save them or join in), a bridge being rebuilt, a town under siege by a rival nation, a plague cart from the Mire, refugees fleeing a city you burned.

## 8. Phases (each one is a playable version)

| Phase | Version | Content | Main files |
|---|---|---|---|
| 1 | v0.19 | Voxel engine: bricks, materials, worker greedy meshing, corner shading, carving, support check, falling chunks, debris and dust. One test building and the raze works converted. | new `voxels.js`, `voxelWorker.js`, `debris.js`; `raze.js`, `melee.js`, `powers.js` |
| 2 | v0.20 | Blueprints: every house, wall, tower, fort and castle becomes voxel near the hero, with far meshes from the same blueprint, nation styles, voxel interiors and saved rubble | `architecture.js`, `fortress.js`, `towns.js`, `settlements.js`, `rooms.js` |
| 2b | v0.20.5 | Diggable ground: voxel patches where blasts go deep, tunnels, caves, falling overhangs, walking inside them | new `groundVoxels.js`; `chunks.js`, `terrain.js`, `materials.js`, `work.js`, `monsters.js` |
| 3 | v0.21 | Atmosphere: smoke and dust volumes, fire through timber, glass shatter, fire light, smoke columns seen from afar | `post.js`, `elementFx.js`, `scars.js` |
| 4 | v0.22 | Economy core (simulation only): goods, production, needs, prices, prosperity, treasury, tolls. Shown on the Nations tab and town signs. | new `economy.js`; `realm.js`, `settlements.js` |
| 5 | v0.23 | Caravans and traders: road graph with bridges and ferries, visible wagons, horses and guards, inns, robbing or escorting, supply trains | new `caravans.js`, `roads.js`; `terrain.js`, `creatures.js` |
| 6 | v0.24 | Kingdom buildings and districts: treasury, armory, barracks, granary, quarters, the effects of destroying each, rebuilding with scaffolding | `settlements.js`, `realm.js`, `doctrines.js`, `raze.js` |
| 7 | v0.25 | NPC detail and routines, animals, new places, fairs and events | `figures.js`, `creatures.js`, `sites.js`, `landmarks.js` |

**Performance gate for every phase:** the frame rate is measured in the busiest city with a Worldbreaker blast before and after, and the version doesn't ship if it got slower.

## 9. Decisions

The user decided these on 2026-11-06:
1. **Look:** structures and props are voxel. Heroes and creatures stay smooth HD toon.
2. **Collapse:** full structural support. Cut the pillars and the floor above comes down.
3. **Ground:** diggable. Voxel patches where blasts go deep, with tunnels and caves (section 3, phase 2b).
4. **Economy role:** rob, extort and trade. The player chooses how to break each nation.

Still open:
5. **Order:** start with destruction and visuals (phases 1 to 3) or with trade and kingdoms (phases 4 to 6).

## Sources
- [Teardown: 8 Minutes of PS5 Gameplay, IGN](https://youtu.be/OmPGyUpdKFY), [9 Days start vs later, MVR](https://youtube.com/shorts/gtuUicH1b2A), [9 Days on Steam](https://store.steampowered.com/app/2075720)
- [Teardown technical review, PC Games Hardware](https://www.pcgameshardware.de/Teardown-Spiel-73677/Specials/PC-Game-Test-Benchmark-Voxel-Dynamic-Destruction-1394545/2/), [Teardown and voxel rendering with Dennis Gustafsson, SE Daily](https://softwareengineeringdaily.com/2025/01/02/teardown-and-voxel-based-rendering-with-dennis-gustafsson/), [Teardown review, PC Gamer](https://www.pcgamer.com/teardown-review/), [Ray tracing in Teardown, TechRadar](https://www.techradar.com/gaming/consoles-pc/ray-tracing-is-so-crucial-to-teardown-that-the-world-goes-black-if-you-turn-it-off), [Structural integrity prototype, 80.lv](https://80.lv/articles/this-real-time-voxel-building-demolition-is-so-satisfying/), [Teardown frame breakdown, acko.net](https://acko.net/blog/teardown-frame-teardown/)
- [Voxel assembly splitting, GameDev.net](https://gamedev.net/forums/topic/714520-determine-if-two-voxels-are-in-the-same-assembly), [Recreating Teardown destruction, Unity forum](https://discussions.unity.com/t/want-to-recreate-teardown-destructable-voxel-physics/828648), [Background greedy meshing, r/VoxelGameDev](https://redlib.hackliberty.org/r/VoxelGameDev/comments/1f2dcet/fully_destructible_voxel_environment/lnf3z04/?context=3), [voxel-three](https://cdn.jsdelivr.net/npm/voxel-three@0.3.0/README.md)
- [Bannerlord economy and trade, TechRaptor](https://techraptor.net/gaming/news/mount-blade-ii-bannerlord-economy-and-trade-detailed), [Bannerlord dev blog 12](https://www.taleworlds.com/en/Games/Bannerlord/Blog/14), [bazaarBot: emergent economies](https://www.gamedeveloper.com/design/bazaarbot-an-open-source-economics-engine), [Emergent Economies for RPGs, Parberry](https://ianparberry.com/pubs/econ.pdf)
- [Manor Lords burgage plots, PC Gamer](https://pcgamer.com/games/city-builder/manor-lords-burgage-plot), [Manor Lords buildings wiki](https://wiki.hoodedhorse.com/Manor_Lords/Buildings), [Urban fortifications and public places, Encyclopedia.com](https://www.encyclopedia.com/history/news-wires-white-papers-and-books/urban-fortifications-and-public-places), [Medieval towns and cities, History Crunch](https://historycrunch.com/medieval-towns-and-cities/), [Road tolls (historical), Wikipedia](https://en.wikipedia.org/wiki/Road_toll_(historical)), [Trade in medieval Europe, World History](https://www.worldhistory.org/article/1301/trade-in-medieval-europe/)
