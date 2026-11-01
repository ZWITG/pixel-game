# Pixel RPG — Design Bible (draft for decision)

Status: proposal, 2026-10-27. Nothing here is built yet. Pick a direction (section 3), then we build phase by phase (section 8).

## 1. Why it feels basic today

| Area | What we have | Why it reads as generic |
|---|---|---|
| Rendering | Flat vertex colors, default Lambert lighting, ACES tone map | Every surface is lit the same way; no shading language, no outlines, no light you can *feel* |
| World | Seeded random map with regions painted on top | Nothing was *placed*; no composed views, no reason to stand anywhere |
| Terrain | Perfectly flat | No hills, cliffs or paths that lead the eye; landmarks can't be hidden and revealed |
| Combat feel | Slash ring, knockback, flash | No hit-stop, no anticipation, no particles, no sound; hits have no weight |
| Story / goal | Lore line from the Elder, no objective | Nothing to *do* beyond grinding slimes |
| UI | Pixel font, navy panels, gold corner studs | A pixel font over HD 3D clashes; studs and gradients are decoration, not identity |
| Sound | None | Half of "feel" is missing |

Research takeaways (Sable, Death's Door, Tunic and "juice" talks):
- Strong small-team styles start from **one clear reference blend**, then build a **rendering approach around it** (cel shading, ink outlines, flat colors) and stay **restrained** in detail.
- Each region gets **its own color and music**, inside one shared tone.
- Game feel comes from **many small layered effects**: hit-stop of about 0.05–0.1 s on *both* attacker and target, shake scaled to the hit, particles at the impact, sound on everything.

## 2. The idea (what makes this game *this* game)

> **In this game, light — the Spirit Tree's fading glow — becomes the art style, the goal and the interface.**

We already have it in the fiction: the village is *Lumen Hollow*, the Spirit Tree has *dimmed*, wisps drift where it glowed. So:
- **Art:** the world is drawn *dimmed* (muted, cool, ink-shaded). Light sources — lanterns, wisps, embers, your own lantern — are the only saturated, glowing things on screen.
- **Goal:** you rekindle the light region by region. A rekindled region **regains its color** (live shader change), gains life (villagers, music, shops), and its monsters change.
- **UI:** your health and power are shown as a lantern and its flame, not hearts in a box.

Competitor test: "restore color to a grey world" exists as a convention, but *a lantern-bearer rekindling a dimmed Spirit Tree, with light as health, currency and map* belongs to our world and names (Lumen Hollow, Spirit Hill, wisps, embers). Keep it.

## 3. Three directions (pick one)

All three keep: anime fantasy, voxel characters, the behind-the-hero camera, PS5 controls, Lumen Hollow and its villagers, the Spirit Tree, lock-on/roll/spin combat, loot and the satchel.

### A. Lanternlight Storybook — *recommended*
- **Look:** soft cel shading (3-tone ramps), thin dark ink outlines on characters and props, painterly sky, bloom only on light sources. Dimmed regions are desaturated blue-grey ink washes; rekindled ones burst into warm color.
- **Feel:** cozy-but-dangerous, like a lantern walk at dusk. Ghibli warmth meets a storybook.
- **Why:** strongest match to the idea; keeps our voxel models (they look great with outlines); each feature we add has a visual purpose.
- **Cost:** medium (shader + post-processing work, a world remake into handcrafted areas).

### B. Ink & Ember
- **Look:** near-monochrome ink world (paper whites, ink blacks), a single accent color per light source; heavy contrast, stark silhouettes, noir-like.
- **Feel:** dramatic, melancholy, very distinctive in screenshots.
- **Why not first:** bold but cold; harder to keep "anime fantasy" warmth and cuteness; readability of enemies in dark scenes is risky.
- **Cost:** low–medium.

### C. Miniature Diorama
- **Look:** clean pastel tilt-shift miniatures, each area a hand-built diorama island; high top-down-ish camera.
- **Feel:** toy-like, charming, very tidy.
- **Why not first:** conflicts with the behind-the-hero camera you chose; needs every area hand-modelled; less atmosphere.
- **Cost:** high.

## 4. Art bible (direction A)

**Palette roles** (dimmed → rekindled):
- Dim world: ground `#55606e`, foliage `#4d6a6e`, shadow ink `#1b2233`, sky `#8fa3b8`.
- Rekindled world: meadow `#7cc35a`, foliage `#2f8a55`, warm path `#d8b07a`, sky `#ffd9a8 → #6fa8e8`.
- Light (always saturated, always glows): lantern amber `#ffb547`, spirit cyan `#9fe8ff`, ember `#ff6a3d`.
- Rule: **only light is saturated** in a dim region. That makes every lantern, wisp and pickup readable at a glance.

**Shading:** toon material with a 3-step gradient ramp; rim light on characters; ink outline (inverted hull, 0.02–0.03 units) on characters, enemies, props — not on terrain.

**Post-processing (Three.js EffectComposer):** selective bloom (light sources only), one color-grading pass (per-region tint + saturation driven by "rekindled" amount), soft vignette, optional subtle film grain. Keep FXAA/SMAA. Budget: 60 fps on a mid laptop, <150 draw calls.

**Shapes:** big readable silhouettes. Hero: oversized lantern on the hip, scarf that streams in the wind, larger head (more anime chibi proportion). Enemies get a clear "tell" color for attacks.

**Terrain:** add elevation — stepped voxel cliffs, ramps and stairs, a raised Spirit Hill you *climb*, a sunken Dimwood. Terrain leads the eye to landmarks.

## 5. World design (handcrafted)

Replace the random map with an **authored map** (a hand-drawn grid in a data file), so every view is composed:
- **Lumen Hollow** — the hub, already warm. Your home, your lantern, the shrine where rekindled light is offered.
- **Sunpetal Meadow** — first region, gentle, teaches combat; rekindle its shrine first.
- **The Dimwood** — sunken, misty, fireflies; puffcaps; a light puzzle (carry flame to braziers).
- **Glimmer Lake** — boardwalk, islands, wisps over water at night.
- **Thornback Moors + Ruins** — windy highland, boars, the ruins' altar holds a key memory.
- **Spirit Hill** — final climb, the Tree itself.

Each region: one landmark visible from its entrance, one shrine to rekindle, one secret, one mini-boss.

## 6. Gameplay direction

**Core loop — Rekindle:**
1. Explore a dim region → 2. defeat monsters to gather **Lumen** (the light they stole) → 3. reach and defend the region's **Shrine** (a short wave fight / mini-boss) → 4. the region regains color, music and villagers; new shop items unlock → 5. carry the light onward.

**Your lantern** (the hero's signature):
- Health is the lantern's flame; it dims as you take damage.
- At night and in the Dimwood it lights a radius around you; enemies avoid or are drawn to it.
- Lumen powers skills: the spin slash becomes a **flame spin**; later a **lantern flare** (stun) and **wisp dash**.

**Game feel pass (juice):** hit-stop 0.06 s (both sides), scaled screen shake, impact sparks and ember particles, attack anticipation frames, enemy attack tells (glow + sound), slow-motion on a perfect dodge.

**Sound:** WebAudio synth effects (no asset files needed at first): swings, hits, roll, pickups, lantern hum; one music theme per region, dim and rekindled variants.

**Progress:** save/load (localStorage), a quest log driven by the Elder.

**Body attributes (built 2026-10-30):** Strength, Speed and Endurance start at 10 and grow from skill practice, never from menus (`src/open/skills.js`, `trains`). All their effects live in `src/open/body.js`. Strength is the long-term pillar: today it sets steepest climbable slope, hero size, jump height, blow force on trees and rocks (`damageScale`), bag size (`carry`) and which boulders crack (Strength 14). Combat reads the same `damageScale` when it moves over, and later Strength should also gate heavy weapons and armor, pushing objects, and hauling yourself up cliffs.

**Punching (built 2026-11-01):** Square punches anywhere, in a three-hit chain (left, right, finisher at double force). The punch grows through six stages, Jab to Worldbreaker (`src/open/melee.js`, `PUNCHES`). Each needs both the Punching level and a Strength value, so practice alone or muscle alone isn't enough. From Heavy Blow on, a blow sends out a shockwave that cracks the ground and breaks what it reaches as it passes. Monsters should plug into the same blow: `force` from `land()`, reduced with distance along the wave.

**Mass (built 2026-11-01):** Mass starts at 60 and builds on Strength, Endurance and Fighting practice (`src/open/skills.js`), never directly. Compared to 60, it multiplies every blow, spreads shockwaves by its square root, softens hits and knockback, makes the hero bigger, and past 90 turns jump landings into stomps. Fighting monsters is the fastest route: hits, kills and getting hurt all count.

**Destruction (built 2026-11-01):** the land takes real damage: dents sit on top of the height function (`addDent`, saved in `lumen.dents`), shown by editing live chunks in place. Heavy punches press craters, tear up grass, and can flood when dug below water level. Houses lean, then collapse into rubble and rebuild with the trees. The Spire, Ribs and Spirit Tree stay unbroken, with no craters right beside them, because their models sit at fixed heights.

**Local co-op (built 2026-11-01):** a second controller joins with OPTIONS. Each player is a `Player` (`src/open/player.js`) with their own sprite, HUD, body, skills and bag; world, monsters and damage are shared. One camera frames both while they're close, then the screen splits horizontally, Player 1 on top and Player 2 below (`splitView.js`, `updateSplit` in main.js). Both views start identical, so the split has no pop. Terrain streams around both heroes.

**Satchel and crafting (built 2026-11-01):** Triangle opens a pixel page with Bag and Craft tabs (`src/open/packPage.js`). Items and recipes are data in `src/open/items.js`. Gear goes in five slots and potions give timed bonuses; both feed `bonus()` in `body.js`, so force and Mass also strengthen punches and shockwaves. In co-op each hero's Satchel fills their half and doesn't pause the other hero. Potions can be made anywhere; gear needs a house, where chest contents count. Chests hold materials only.

**Levels and evolving monsters (built 2026-11-01):** hero level comes from Mass before gear, plus Speed (`Body.level`). Six forms in `src/open/evolve.js` (plain, Thorned, Ironhide, Dread, Ancient, Cataclysm) add spikes, armor, burning eyes, horns, crowns, orbiting stones and auras to any monster. Live monsters behind the level stop, shudder and transform where you can watch; ones that survive a blow can too. Health and damage scale from the nearest hero's punch and toughness.

**Places (built 2026-11-01):** ten categories in `src/open/sites.js`, each with its own goal and reward kind, marked by colored beams. The HUD points to the nearest unfinished one. Lasting perks feed `Body.bonus()`.

**Hero against hero (built 2026-11-01):** blows and shockwaves hurt the other hero, capped at a quarter of their health per blow, and send them flying.

**Explorable locations (built 2026-11-01):** `TOWNS` in terrain.js levels the land for two walled cities, five villages, six bandit camps and three ruined keeps; `towns.js` builds them from their names. Houses there are normal houses. Townsfolk wander, talk, heal and trade, and monsters stay out. Caves (`cave.js`) are interiors of chambers and tunnels with their own monsters and a chest at the end. Bandits are a human enemy that evolves in strength without monster parts.

**Jumping and Flight (built 2026-11-01):** every jump is Jumping practice. Its top level evolves it into Flight: jump and hold X (Cross or Space) to climb, release to glide. Flight is its own skill, practised by time aloft; its level sets time in the air, top height and speed, up to unlimited (`FLY_*` in player.js). Above 22 tiles nothing blocks the hero.

**Superspeed (built 2026-11-01):** Running's top level evolves it into Superspeed, its own skill, practised by time at speed. At full sprint, let go and press sprint again. Speed builds from a sprint over several seconds and carries on a moment after letting go; hard turns scrub it off. Level sets duration (4 s to unlimited), top speed and how quickly it builds (`SUPER_*` in player.js, capped at 130 tiles a second). From level 3 the hero stays on top of water if moving fast enough. Whatever they barrel into takes a hit, harder with speed. The camera becomes a steady chase view as speed rises.

**Destructive Blow (built 2026-11-01):** the top level of Punching evolves into it. Hold Square to gather it, walking slowly, and let go to explode around the hero. Its own skill, practised by using it, sets charge time, force and reach (`BLOW_*` in melee.js); a longer charge is stronger, and force and Mass add on top. It breaks and craters like other blows.

## 7. UI direction (from the taste rules)

- **One typeface** with anime-fantasy warmth that reads at all sizes (candidate: *Zen Maru Gothic*, rounded), replacing the pixel font. Two sizes do the work: large numbers/titles, small text.
- **One ground, one ink, one accent:** night-ink `#141a28` ground, paper `#f3ead8` text, lantern amber `#ffb547` accent for the one action and the flame.
- **No ornament:** remove gold corner studs, gradients, glows and boxed chips. Panels separate by a tone step, not lines.
- **Diegetic HUD:** a lantern in the corner shows health (flame) and Lumen (glass fill); coins as a small number beside it. Region names appear as large brush-like titles that fade, not ribbons.
- **Menus feel like objects from the world:** the shop is Mina's ledger, the controls screen is the guard's notice board, dialogue boxes are paper slips.
- Title screen: the dim Spirit Tree at night, the hero's lantern the only light, "Press ✕".

## 8. Roadmap (each phase ships and is play-tested)

| Phase | Version | Contents | Proves |
|---|---|---|---|
| 1. Look | v0.7 | Toon shading + outlines, post-processing (bloom, grading, vignette), dim/rekindled color system, new UI type and lantern HUD | Does the style land? (screenshots compared before/after) |
| 2. Feel | v0.8 | Hit-stop, particles, anticipation, attack tells, WebAudio sounds | Combat feels weighty |
| 3. World | v0.9 | Authored map with elevation, landmarks per region, hero redesign (lantern, scarf) | Places feel designed |
| 4. Loop | v0.10 | Lumen, shrines, rekindling Sunpetal Meadow, save/load, quest log | There is a goal |
| 5. Content | v0.11+ | Dimwood puzzle, mini-bosses, region music, remaining shrines, Spirit Hill finale | A full playable arc |

## 9. What stays and what changes

- **Stays:** everything in FEATURES.md that works (combat, lock-on, roll, loot, shops, villagers, day/night, ambient life, PS5 layout), the voxel model builder, the data-driven design.
- **Changes:** rendering, the map (random → authored), the HUD/menus, the hero's look, and a real goal.
- **Removed:** the pixel font, corner studs and gradient panels; the random world generator (kept in git history).

## 10. Decisions needed from you

1. Direction: **A Lanternlight Storybook** (recommended), B Ink & Ember, or C Miniature Diorama.
2. OK to replace the random map with a hand-designed one?
3. OK to retire the pixel font for a rounded anime-style face?

Sources: [Sable's influences (Gamereactor)](https://www.gamereactor.eu/sables-art-style-influenced-by-akira-french-comics-and-more/), [Death's Door preview (GamingTrend)](https://gamingtrend.com/previews/remarkable-reaping-deaths-door-preview/), [Death's Door review (Xbox Tavern)](https://www.xboxtavern.com/deaths-door-review/), [Three.js post-processing manual](https://threejs.org/manual/en/post-processing), [Game feel: flash, shake, particles (eastondev)](https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/), [Making a juicy game (RPG Playground)](https://rpgplayground.com/research-making-a-juicy-game/), [Game juice checklist](https://gamejuice.pages.dev/articles/game-juice-checklist-30-techniques).
