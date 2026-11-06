# Eradication: World Upgrade Plan

Planning doc for the user's brief "world upgrade" (2026-11-06). It covers the look, destruction, models, trade,
kingdoms and places. Every phase ships as its own playable version, as before. Open questions for the user are at the end.

## 1. What the references show

| Reference | What it is | What we take from it |
|---|---|---|
| [Teardown: 8 Minutes of PS5 Gameplay (IGN)](https://youtu.be/OmPGyUpdKFY) | Tuxedo Labs' fully destructible voxel sandbox | Everything built from small cubes of real materials (wood, brick, concrete, glass, metal). Holes are cut exactly where a blow lands, loose parts fall as solid chunks, fire spreads through wood, collapses throw up smoke, dust, splinters and glass. Blocky shapes lit realistically. |
| [9 Days: start of the game vs later (MVR)](https://youtube.com/shorts/gtuUicH1b2A) | A solo-dev, Dragon Ball-like open-world action game | Power scale. At the start a blast dents a wall. Later the same move erases a street. Destruction has to grow with the hero, which fits our `body.might`. |
| What we have | Smooth HD toon heroes, ink outlines, painted buildings, our own lighting pipeline (`post.js`), scars, craters | We keep the heroes, the sky, the light and the elemental scars, and put voxel structures inside that world. |

What we learned about how Teardown works, checked across several sources:
- **Data.** Every object is its own 3D texture with **one byte per voxel**, an index into a 256-entry palette of colour and material. The developer's blog and the acko.net frame breakdown agree on this.
- **Drawing.** Each object is drawn as one box, and the shader ray-marches into its volume. A coarse 1-bit world volume (2×2×2 voxels per byte) carries shadows, reflections and large-scale shading. Lights cast one jittered shadow ray per pixel, then everything is denoised over several frames (acko.net, PC Games Hardware).
- **Destruction.** Voxels are erased in place. Pieces that end up disconnected become new objects with their own volumes, and this can repeat without limit. One explosion in the analysed frame caused about 50 small shadow-volume uploads (acko.net).
- **Collapse.** At launch, support wasn't simulated: PC Gamer and the Escapist both note that "entire buildings will often be held up by one voxel". The team later showed a structural integrity prototype (80.lv).
- **Materials.** These decide what breaks. Wood burns and spreads fire, while rock and heavy metal can't be destroyed (PC Gamer, Wikipedia). Smoke fills enclosed rooms.
- **The look.** The developer calls the meeting of "abstract voxel appearance" and "very realistic lighting" the heart of it (TechRadar). Because anything can move, nothing can be pre-lit.

Two other games solve the support problem Teardown left open:
- **Red Faction Guerrilla (Geo-Mod 2.0).** Each building computes its own stress from load-bearing parts, and stone needs a metal frame to stand. Its terrain could not be destroyed (Red Faction wiki, Wikipedia, GamesBeat).
- **7 Days to Die.** Each block has mass, vertical support and horizontal support. Vertical support is effectively unlimited, and how far a structure can reach sideways is the real limit. Support is recalculated when a block is removed (7 Days to Die wiki, player guides).

Teardown's per-pixel ray marching and denoising cost too much fill-rate for a browser that also draws our open world. We copy what the player sees (palette materials, clean cuts, falling pieces, smoke and dust, fire through timber) with mesh-based techniques listed in section 3. WebGL2 does support 3D textures, so ray-marched volumes stay possible later for a few hero objects if profiling allows.

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
2. **Check what's still held up** (the user chose full structural support). After a carve, only the building that was hit is checked, as Red Faction does.
   - First, a flood fill from voxels resting on the ground finds pieces cut off entirely. The flood fill or a disjoint-set (union-find) is the standard approach (GameDev.net, Unity forum).
   - Then a 7 Days to Die-style rule runs: every material has a **mass** and a **horizontal reach**. Support flows straight down without limit, while sideways it weakens per voxel by the weight it carries. Wood beams span far, stone needs pillars or arches, iron frames hold stone up.
   - Voxels past their reach break loose. Removing the last pillar brings down the floor above.
3. **Loose pieces fall as solid chunks.** Each loose group becomes one rigid chunk with its own small mesh. It falls with spin, bounces off the ground and breaks into smaller pieces when it lands hard. Small chunks turn into particles. Chunks can crush monsters and soldiers.
4. **Settling.** After a few seconds still, a chunk joins the rubble pile around the building. Rubble can be walked over and stays in the save, so a city you destroyed stays destroyed.
5. **Fire, frost and rot.** Burning scars spread into wood and thatch voxels and eat them away over time, so a burning roof collapses on its own. Frost makes material brittle, Void rot crumbles plaster, and Storm sets thatch alight.

### Keeping it fast in a browser
These numbers are targets to check by profiling.
- Voxel data is stored per building in **16³ bricks** of compact typed arrays. Only bricks that change get remeshed.
- **Greedy meshing runs in a Web Worker** (we already use `groundWorker.js` and `mapWorker.js`). Greedy meshing merges faces with matching material into large quads.
  - Reported savings range from about 30 to 97% depending on shape: blocky buildings save the most and round shapes the least (0fps). Flat walls and floors, which most structures are made of, sit near the top of that range.
  - 0fps recommends a quick culled mesh right after a hit, swapped for the greedy mesh once the worker finishes, so damage shows on the next frame.
  - Each frame has a remesh budget, with the nearest bricks first (r/VoxelGameDev). One developer found that sending large meshing jobs to a worker still caused hitches, so jobs are kept small.
- **Corner shading.** Each vertex gets a shade from its two side neighbours and its corner neighbour. Quads flip their split diagonal to avoid streaks, and faces only merge when their shading matches (0fps, "Ambient occlusion for Minecraft-like worlds"). This stands in for Teardown's ray-traced occlusion.
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
  - Other games do the same. Unity's Digger tool adds voxel caves and overhangs on top of a heightmap terrain instead of replacing it. Enshrouded's fully voxel world is known for stutters while digging, from streaming new voxels in real time (performance guides, PC Games Hardware). That's why we keep patches small, few and close to the hero.

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

Built from four games and the medieval record. Each point below is backed by more than one source.
- **Mount & Blade II: Bannerlord.**
  - Villages produce goods from their production buildings. Villagers carry them to the nearby town, and caravans move goods between towns looking for the best profit (developer blog, TechRaptor).
  - Food, security and loyalty all feed **prosperity**, and prosperity sets taxes. When bandits block villagers, the town runs short of food and prosperity falls (several guides and player reports).
  - Raiding villages or stopping villagers "impoverishes towns".
- **X4: Foundations.** Prices come from supply and demand curves built from the stock levels at stations. They settle toward balance over time, and wars move them (Egosoft, player reports).
- **The "Emergent Economies for RPGs" model (Doran and Parberry), as documented with bazaarBot.**
  - Agents hold a **price range** for each good. A trade that goes through narrows it, and a failed one widens it and shifts it toward the market average.
  - A clearing house matches the highest bids with the lowest asks, and the price is the average of the two.
  - Bankrupt agents switch to the most profitable job. A "market opportunity" check then fills jobs that are in short supply.
  - The author warns the agents are "really stupid" and that **simple economies are more fun**. We start small: about a dozen goods and three kinds of trader.
- **The medieval record.**
  - **Tolls** were taken at bridges, gates and river chokepoints, often several along one road (Wikipedia, World History).
  - **Staple right** let some cities force passing merchants to unload and offer their goods for about three days, or pay a fee instead (Wikipedia).
  - **Straßenzwang** forced traders in some goods onto set roads, and in return they got **escort right (Geleitrecht)**, guaranteed safe passage (Wikipedia).
  - Armed bands demanded payment not to attack, which was called **Danegeld** (Wikipedia). That's real history behind letting the player extort.
  - **Guilds** controlled trade in a town, set prices and quality, and often ran the town (Wikipedia).
- **Travel times.** A loaded cart did about 15 miles a day and a rider 20 to 30, with inns about a day's travel apart (several history and worldbuilding sources, no primary documents found). In our time scale that sets caravan speed and spaces inns along roads.

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
- **What you can do (the user chose rob, extort and trade):**
  - **Rob** caravans and stores.
  - **Extort** with a Danegeld demand: a town or caravan pays you not to burn it, which drains its nation's treasury without a fight.
  - **Trade** and buy up a nation's food or iron to starve it by price.
  - **Seize** a toll bridge or a staple town and its income flows to you.
- **How nations respond:** escorts under their own escort right, tolls raised on routes you threaten, rebuilt bridges, smuggling paths, and hunting you down.

## 6. Kingdom and settlement buildings

How real towns and castles were laid out, cross-checked:
- **Town centre.** Towns grew around a market square, with the town hall, guild halls and main church around it (History Crunch, Encyclopedia.com, and a Heidelberg-digitised study of planned towns).
- **Craft quarters.** Tanners, dyers and smiths sat by water or outside the walls because of smell and fire risk (several sources).
- **Gates.** They closed at night and charged tolls on goods coming in to be sold (Encyclopedia.com, Wikipedia on road tolls).
- **Castles.**
  - The **great hall** was where meals were eaten and business was done.
  - The **treasury** was a secure chamber beside or above the hall (Castles of England, castle guides).
  - **Armouries** were often built into the walls, so weapons reached the battlements fast. Some, like Tittmoning in 1428 and Burghausen in 1427, were **granary and armoury in one** (University of Passau).
  - **Soldiers** lived in the gatehouse, the towers or under the keep.
  - **Storerooms** were what let a castle hold out through a siege.
- **Manor Lords** works the same way: districts grow out from the market, and street-front houses are both homes and the main income (PC Gamer, the official wiki).

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

- **Daily routines:** NPCs work at their building by day, shop at the market, go to the tavern at dusk and sleep at night. Guards change shifts.
  - Lesson from Oblivion's Radiant AI: schedules promised as fully autonomous ended up "largely static" (GameBanshee), and free goal-seeking led to NPCs killing a merchant to get skooma (GamesBeat). Their designers note that the system works best when players don't notice it.
  - So routines are simple schedules a player can read, with a small number of needs. Strange choices are cut off before they turn into chaos.
- **Fairs** come round every so many days and draw caravans from far away. The Champagne fairs could run for up to 49 days (World History).
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
| 4 | **v0.19 (done 2026-11-06)** | Economy core (simulation only): goods, production, needs, prices, prosperity, treasury, tolls. Shown on the Nations tab and town signs. | new `economy.js`; `realm.js`, `settlements.js` |
| 5 | **v0.20 (done 2026-11-06; inns and riding moved to phase 7)** | Caravans and traders: road graph with bridges and ferries, visible wagons, horses and guards, inns, robbing or escorting, supply trains | new `caravans.js`, `roads.js`; `terrain.js`, `creatures.js` |
| 6 | **v0.21 (done 2026-11-06)** | Kingdom buildings and districts: treasury, armory, barracks, granary, quarters, the effects of destroying each, rebuilding with scaffolding | `settlements.js`, `realm.js`, `doctrines.js`, `raze.js` |
| 7 | v0.25 | NPC detail and routines, animals, new places, fairs and events, roadside inns and waystations, riding | `figures.js`, `creatures.js`, `sites.js`, `landmarks.js` |

**Order (the user chose 2026-11-06): trade and kingdoms first, phases 4, 5 and 6, then destruction, phases 1 to 3, then 7.** The version numbers in the table for those phases will move up to follow.

**Performance gate for every phase:** the frame rate is measured in the busiest city with a Worldbreaker blast before and after, and the version doesn't ship if it got slower.

## 9. Decisions

The user decided these on 2026-11-06:
1. **Look:** structures and props are voxel. Heroes and creatures stay smooth HD toon.
2. **Collapse:** full structural support. Cut the pillars and the floor above comes down.
3. **Ground:** diggable. Voxel patches where blasts go deep, with tunnels and caves (section 3, phase 2b).
4. **Economy role:** rob, extort and trade. The player chooses how to break each nation.

Still open:
5. **Order:** start with destruction and visuals (phases 1 to 3) or with trade and kingdoms (phases 4 to 6).

## 10. How sure we are

| Claim | Confidence | Why |
|---|---|---|
| Teardown's data and rendering (palette bytes, volumes per object, ray marching, splitting into new objects) | High | Developer blog, acko.net frame breakdown and PC Games Hardware agree |
| Teardown at launch didn't simulate support | High | PC Gamer and the Escapist say so. One promotional page disagrees, and we set it aside. |
| Red Faction per-building stress | Medium | Press and fan wiki agree. No developer talk was found. |
| 7 Days to Die support model | Medium | Official wiki plus guides. The exact numbers vary between game versions. |
| Greedy meshing and corner shading savings | High | 0fps articles with measurements, matched by voxel developer discussions |
| Bannerlord economy loop | Medium to high | Developer blog plus press and many guides. Exact numbers vary by patch. |
| bazaarBot and the Doran and Parberry model | Medium | Implementer's article. The paper's PDF wouldn't extract to read directly. |
| Staple right, tolls, Geleitrecht, Danegeld, guilds | High | Wikipedia articles with cited history, and they agree with each other |
| Castle rooms (treasury, armoury, garrison) | Medium | A university page plus several general guides. No academic monograph was read. |
| Daily travel and inn spacing | Low to medium | Several secondary sources agree, but none cite primary records |
| Enshrouded digging stutter | Medium | Several performance guides agree. Not confirmed by the developer. |
| The 9 Days look | Low | Only the short and the Steam page. No written description of its graphics or destruction exists, so the plan reads it as power scale only. |

## Sources
- [Teardown: 8 Minutes of PS5 Gameplay, IGN](https://youtu.be/OmPGyUpdKFY), [9 Days start vs later, MVR](https://youtube.com/shorts/gtuUicH1b2A), [9 Days on Steam](https://store.steampowered.com/app/2075720)
- [Teardown technical review, PC Games Hardware](https://www.pcgameshardware.de/Teardown-Spiel-73677/Specials/PC-Game-Test-Benchmark-Voxel-Dynamic-Destruction-1394545/2/), [Teardown and voxel rendering with Dennis Gustafsson, SE Daily](https://softwareengineeringdaily.com/2025/01/02/teardown-and-voxel-based-rendering-with-dennis-gustafsson/), [Teardown review, PC Gamer](https://www.pcgamer.com/teardown-review/), [Ray tracing in Teardown, TechRadar](https://www.techradar.com/gaming/consoles-pc/ray-tracing-is-so-crucial-to-teardown-that-the-world-goes-black-if-you-turn-it-off), [Structural integrity prototype, 80.lv](https://80.lv/articles/this-real-time-voxel-building-demolition-is-so-satisfying/), [Teardown frame breakdown, acko.net](https://acko.net/blog/teardown-frame-teardown/)
- [Voxel assembly splitting, GameDev.net](https://gamedev.net/forums/topic/714520-determine-if-two-voxels-are-in-the-same-assembly), [Recreating Teardown destruction, Unity forum](https://discussions.unity.com/t/want-to-recreate-teardown-destructable-voxel-physics/828648), [Background greedy meshing, r/VoxelGameDev](https://redlib.hackliberty.org/r/VoxelGameDev/comments/1f2dcet/fully_destructible_voxel_environment/lnf3z04/?context=3), [voxel-three](https://cdn.jsdelivr.net/npm/voxel-three@0.3.0/README.md)
- [Bannerlord economy and trade, TechRaptor](https://techraptor.net/gaming/news/mount-blade-ii-bannerlord-economy-and-trade-detailed), [Bannerlord dev blog 12](https://www.taleworlds.com/en/Games/Bannerlord/Blog/14), [bazaarBot: emergent economies](https://www.gamedeveloper.com/design/bazaarbot-an-open-source-economics-engine), [Emergent Economies for RPGs, Parberry](https://ianparberry.com/pubs/econ.pdf)
- [Manor Lords burgage plots, PC Gamer](https://pcgamer.com/games/city-builder/manor-lords-burgage-plot), [Manor Lords buildings wiki](https://wiki.hoodedhorse.com/Manor_Lords/Buildings), [Urban fortifications and public places, Encyclopedia.com](https://www.encyclopedia.com/history/news-wires-white-papers-and-books/urban-fortifications-and-public-places), [Medieval towns and cities, History Crunch](https://historycrunch.com/medieval-towns-and-cities/), [Road tolls (historical), Wikipedia](https://en.wikipedia.org/wiki/Road_toll_(historical)), [Trade in medieval Europe, World History](https://www.worldhistory.org/article/1301/trade-in-medieval-europe/)
- Further reading for the deeper pass: [Teardown voxel palette, Voxagon blog](https://blog.voxagon.se/), [Teardown multiplayer and destruction tech, 80.lv](https://80.lv/articles/teardown-developer-breaks-down-multiplayer-and-voxel-destruction-tech), [Teardown, Wikipedia](https://en.wikipedia.org/wiki/Teardown_(video_game)), [Geo-Mod 2.0, Red Faction wiki](https://www.redfactionwiki.com/wiki/GeoMod_2.0), [Red Faction: Guerrilla, Wikipedia](https://www.wikipedia.org/wiki/Red_Faction_Guerilla), [Red Faction: Guerrilla review, GamesBeat](https://gamesbeat.com/red-faction-guerrilla-review/), [Structural integrity, 7 Days to Die wiki](https://7daystodie.wiki.gg/wiki/Structural_Integrity), [Meshing in a Minecraft game, 0fps](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/), [Ambient occlusion for Minecraft-like worlds, 0fps](https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/), [Digger: caves and overhangs for Unity terrains](https://discussions.unity.com/t/digger-caves-overhangs-for-unity-terrains/726282), [Enshrouded tech test, PC Games Hardware](https://www.pcgameshardware.de/Enshrouded-Spiel-74267/Specials/Test-Release-Steam-Gameplay-1438724/), [Enshrouded performance guide](https://checkfps.io/en/optimize-fps/enshrouded), [X4 economy discussion, Steam](https://steamcommunity.com/app/392160/discussions/0/1742232339928886123), [Bannerlord prosperity guide](https://gamerempire.net/mount-blade-2-bannerlord-how-to-increase-prosperity/), [Bannerlord settlement management, GameWatcher](https://www.gamewatcher.com/mount-and-blade-ii-settlement-castle-management-guide), [Stapelrecht, Wikipedia](https://en.wikipedia.org/wiki/Stapelrecht), [Guild, Wikipedia](https://en.wikipedia.org/wiki/Guild), [Armouries and storage in castles, University of Passau](https://visit.uni-passau.de/en/visit-schaufenster/mit-burgen-im-bund/armouries-and-storages-in-castles), [Castles of England: domestic areas](https://kwx.liehendr.com/content/wikibooks_en_all_maxi_2021-03/A/Castles_of_England/Domestic_Area_Design), [Oblivion Radiant AI, UESP](https://en.uesp.net/wiki/Oblivion:Radiant), [Dimming the Radiant AI, GamesBeat](https://gamesbeat.com/dimming-the-radiant-ai-in-oblivion/), [Oblivion retrospective, GameBanshee](https://gamebanshee.com/r8f4), [Medieval travel distances, World Anvil](https://www.worldanvil.com/w/scarterra-scalenex/a/how-far-can-characters-travel-over-land-in-a-single-day3F-article)
