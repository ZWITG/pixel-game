# Eradication: Combat Upgrade Plan

Planning doc for the user's brief "combat upgrade" (2026-11-07). It covers fighting, the five Conquerors' kits, ultimates,
skill trees, the Omega Level, siege machines, armies, the Watchers and balance. Every phase ships as its own playable
version, as before. Open questions for the user are at the end. Nothing here is built yet.

## 1. What the references show

| Reference | What it is | What we take from it |
|---|---|---|
| [9 Days: start vs later (MVR)](https://youtube.com/shorts/gtuUicH1b2A) | Listed as the Sparking Zero example. It is actually the 9 Days short from the world plan. | Power scale again: the same move grows from a dent to erasing a street. I used Sparking Zero guides below for the combo side. |
| Dragon Ball: Sparking! Zero (guides, see sources) | 3D arena fighter | **Rush chains**: up to 4-5 light hits, then a heavy that branches the chain. Long chains do more damage, and a chain can't repeat itself. **Vanish**: blink behind a foe, either to dodge a hit or to carry on your own combo after knocking them away. **Perception / super counter**: a timed press that turns a hit around. **Revenge counter**: breaks out of an enemy combo for a cost. A **skill gauge** pays for these, so defence is a resource, not a free button. Ki blasts and beams give everyone a ranged option. |
| [SIFU: Master, no damage ($ho)](https://youtu.be/msJWFGntJds) | Sloclap's kung fu brawler | **Structure**: both sides have a stance gauge. Blocking fills your own, avoiding and parrying empty it, and a full gauge leaves you open to a takedown. **Groups**: only about two enemies attack at once while the rest circle. The skill is turning a crowd into a run of 1-on-1s, using walls, throws and parries. The no-damage run shows the target feel: every enemy attack is readable and has an answer. |
| [Anime lightning users (ViniiTube)](https://youtu.be/KnORKfd7U6Q) | Montage of anime lightning techniques | Lightning is speed first: flash-steps that strike everything on the way, afterimages, the sky darkening before a strike, a bolt shaped like a beast called down from clouds. The power is in the **build-up** (gathering clouds, crackling body) and the **white-out** on impact. |
| [Full potential of the Ten Shadows (Eternal Flame)](https://youtu.be/KJkWxb5nzew) | JJK discussion of a summoner's technique | A summoner's power grows by **owning more** (each tamed beast added to the roster), **fusing** summons into something stronger, and summons that **adapt**. |
| [Jinwoo vs Baran (Crunchyroll)](https://youtu.be/l9Zd8gBZC-s) | Solo Leveling S2 fight | The fallen rise as shadows that keep their skills. The army is **stored** and **called out**, the summoner swaps places with a summon, and the army grows with the hero until it fills a battlefield. |
| [Anime fire users (ViniiTube)](https://youtu.be/yXZBWEacROg) | Fire technique montage | Fire as **heat that builds**: colour shifts (orange to blue to white), shimmering air, fire that propels the user, giant fists and serpents of flame, a small sun held overhead. |
| [Anime ice users (ViniiTube)](https://youtu.be/TzmUvf6tszs) | Ice technique montage | Ice at **landscape scale**: glaciers racing up a hillside, whole seas frozen, ice weapons made on the spot, foes sealed in crystal, and stillness (everything stops, then shatters). |
| [Strongest magic types in Black Clover (AnimeUproar)](https://youtu.be/8Zf1f-3WM34) | Ranking of magic types | Power types beyond the five elements: space, gravity, time, light, anti-magic, spirits and souls. Good material for **Watcher** elements and late **sub-elements** (metal, lava, plasma, blue flame, crystal). |
| Avatar-style earthbending (the user's Titan example) | Genre convention | Earth is a **material you move, not a ball you throw**: columns that launch, plates you surf on, armour pulled up from the ground, sensing through the feet, then sub-arts (sand, metal, lava). |

Other sources I checked:
- **Killer Instinct "Shadows"** record every action of a player's matches (up to 40 per matchup) and replay their habits: combos, how they wake up, even taunts. Much of it is hand-built rules fed by recorded data, not pure machine learning ([Game Developer](https://gamedeveloper.com/programming/the-killer-groove-the-shadow-ai-of-killer-instinct), [GamesRadar](https://www.gamesradar.com/future-fighting-game-ai), [critpoints](https://critpoints.net/2018/02/20/the-future-of-video-game-ai/)). This is the model for the Watchers' learning.
- **Wanted / heat systems** (Mafia, Watch Dogs 2, Just Cause): stages that bring stronger responders, with a strike team at the top. Beating it, or hiding, resets the meter ([All The Tropes: Wanted Meter](https://AllTheTropes.org/wiki/Wanted_Meter), [Watch Dogs wiki](https://watchdogs.fandom.com/wiki/Heat_Level_in_Watch_Dogs_2)). Our Omega Level should **ratchet** instead: the world doesn't forget a burned city.
- **Warner Bros.' Nemesis patent** covers generated enemies promoted or demoted by their wins and losses who **remember** past fights with the player, organised in a hierarchy. It runs to 2036-08-11 ([Destructoid](https://vip-develop.destructoid.com/?p=263956), [TechRadar](https://techradar.com/gaming/shadow-of-mordors-nemesis-system-will-remain-warner-bros-property-until-2036)). The Watchers must learn **fighting habits** (Killer Instinct style), not form a rank ladder with personal memories. Note: our realm's captains already have ranks, kills and "remember how it ends". That is fine at today's size, but we shouldn't grow it toward a promotion hierarchy. This isn't legal advice, only a design line to stay on.
- Sparking Zero guides: [Bandai Namco: combos and features](https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-sparking-zero-combos-and-features), [GamingBolt tips](https://gamingbolt.com/dragon-ball-sparking-zero-guide-14-best-tips-and-tricks), [Niche Gamer: countering](https://nichegamer.com/dragon-ball-sparking-zero-deflect-guide), [Deltia's: revenge counter](https://deltiasgaming.com/?p=73516), [GameWitted: vanish](https://www.gamewitted.com/gaming/dragon-ball-sparking-zero-evade-vanish-and-teleport-guide).
- Sifu: [PlayStation Blog: how Sifu's combat works](https://blog.playstation.com/2021/11/18/how-sifus-kung-fu-combat-works/), [Unreal Engine interview](https://www.unrealengine.com/en-US/developer-interviews/old-boy-john-wick-sifu-the-design-of-a-pak-mei-master), [Deep Design Dive: Sifu](https://steventus.substack.com/p/deep-design-dive-sifu), [naguide: enemy patterns](https://naguide.com/?p=62236).

**Everything stays original.** We take genre ideas (rush chains, stance gauges, summoned armies, lightning beasts) and give them our own names, looks and rules. No names, characters or signature moves are copied.

## 2. What we have now, and why it feels thin

Read from `melee.js`, `powers.js`, `foes.js`, `conquerors.js`, `doctrines.js`, `monsters.js`:
- **One button of offence.** Square is a 3-hit chain (1, 1.25, 2) that always plays the same. Holding Square becomes the Destructive Blow, so mashing and charging fight over one button.
- **Defence has no cost.** Guard, parry (0.22 s) and roll exist, but nothing builds or drains, so there's no tension and no reward for reading a fight.
- **No air game and no reactions.** Enemies stagger or reel, and that's all. There are no launches, wall bounces, knockdowns or juggles.
- **Powers are 8 cooldown buttons in 8 shared shapes** (`bolt`, `nova`, `strike`, `dash`, `buff`, `zone`, `orbit`, `wall`). Every Conqueror has a nova, a line strike and a buff, which is why they look alike. Titan's Fault Line, Earth Spikes and Frost's Avalanche are the same line of pops.
- **Effects are small pooled sprites, cones and rings.** No trails, beams, distortion, impact frames or build-up.
- **Siege machines all fire `fireOrb`**: the same slow orb (shot speed 12) at a fixed height, hitting only within 1 tile. That's why they're all the same and almost never land.
- **Group fights** already use turns (`TURN_TAKERS = 2`), which is good Sifu groundwork.

## 3. The new combat core ("Sifu footwork, Sparking power")

### Buttons (PS5, open world)

| Button | Now | New |
|---|---|---|
| Square | punch chain; hold = Destructive Blow | **Light**: rush chain of up to 5 hits |
| Triangle | open the Satchel | **Heavy / Smash**: branches the chain; hold to charge (Destructive Blow moves here) |
| Circle | roll | roll; pressed just before a hit = **Vanish** (costs Spirit) |
| L2 | guard (held) | hold = guard; tap at the hit = **Parry** |
| R1 | grab / throw | grab / throw; in a chain, a **throw finisher** |
| L1 | recenter camera (tap) | tap = recenter; **hold = Spirit shift**: L1 + D-pad = second power page, L1 + Square = Spirit Shot, L1 + Triangle (hold) = Spirit Wave beam |
| L1 + R1 together | — | **Ultimate** when Wrath is full |
| R2 | sprint | sprint; R2 + Square = dash strike |
| Cross | jump | jump; in the air after a launch = **Pursuit** (fly up to the launched foe) |
| Touchpad | camera (off) | **Satchel** |

Keyboard gets the same as a matching set (J light, K roll, U heavy, G guard, F grab, Q Spirit shift). `controllerMap.js` redraws itself from `ACTIONS`.

### The rush chain
- **Light chain**: up to 5 hits. Each hit steps in (homing up to 4 tiles when locked on). The last hit knocks the foe back.
- **Heavy branches**: Triangle after hit *n* gives a different smash, so the chain is a choice, not a mash:

  | After | Smash | Does |
  |---|---|---|
  | 0 (alone) | Breaker | slow, armoured, big Structure damage |
  | 1 | Launcher | throws the foe up; Cross = Pursuit into an air chain |
  | 2 | Sweep | knocks down everything in a half-circle (crowds) |
  | 3 | Wall Driver | sends the foe flying; a wall, tree or house = wall-splat and bounce back |
  | 4 | Ground Slam | bounces the foe off the ground, so the chain can start again |
  | 5 | Conqueror finisher | each Conqueror's own (earth pillar, lightning flash, void hands, flame burst, ice shatter) |
- **Air chain**: 3 lights, then a heavy **spike** that slams the foe into the ground (crater, using the existing `blast`).
- **Vanish combo extension** (Sparking): after a knock-back hit, Circle teleports behind the flying foe to carry on. It costs 1 Spirit pip, with at most 2 per chain.
- **No repeats**: the same smash twice in one chain does half damage and drops the chain. This rewards variety.
- **Power cancels**: any D-pad power can be fired out of the end of a chain hit. Some powers get a **link bonus** when they're used that way (for example, Pillar Launch on a Launched foe).
- **Directional input**: stick toward the foe + Square = lunge opener; stick away + Triangle = backstep counter-swing.

### Defence, Structure and Spirit
- **Structure (both sides)**, following Sifu:
  - Blocking hits fills *your* Structure.
  - Parries, vanishes and well-timed rolls *empty* it.
  - Full Structure = **Broken**: 1.2 s open, and no guard.
  - Enemies have it too. Hits, parries and heavies fill it. A Broken enemy can be **Executed** with heavy (a short takedown, with extra damage near walls, cliffs, water or fire).
  - Big foes (brutes, Watchers, rulers) have tall Structure bars. Breaking them is the main way to beat them.
- **Spirit (5 pips)**, following Sparking's skill gauge:
  - It builds from landing hits, parries and Executes, and drains slowly out of combat.
  - It pays for Vanish (1 pip), **Breakout** (2 pips: a burst that knocks a combo or a crowd off you; it has invincible start-up, and Watchers can read it), Spirit Shot (1 pip per 3 shots) and Spirit Wave (2 pips).
  - Powers keep their cooldowns and don't cost Spirit. Spirit is the *fighting* resource, cooldowns the *power* resource.
- **Parry tiers**: a tap within 0.12 s of the hit = **Perfect** (foe staggers, +1 Spirit, and the next hit is a Counter ×2). Within 0.22 s = Parry. Holding = Block (fills your Structure).
- **Heavy attacks** (red flash tell) can't be blocked. Roll, vanish or Perfect-parry them.

### Wrath and Surge
- **Wrath** is a separate bar that fills from damage dealt, damage taken, Executes and destruction. Full Wrath allows either:
  - **Ultimate** (L1 + R1): a short cinematic at full power, different for each Conqueror (section 4).
  - or **Surge** (L1 + R1 held 1 s): 12 s of super state. The hero changes form (glowing hair and eyes, element aura), Spirit refills twice as fast, powers cool 50% faster, and light chains gain a 6th hit. This is our own take on "sparking mode".

### Crowds (Sifu)
- Keep turn-taking (`TURN_TAKERS`), but the number grows with Omega phase (2 at first, 3 to 4 later) and with enemy role.
- **Edge-of-screen markers** show attackers off camera, with a red flash on their tell.
- **Bodies are weapons**: a knocked-back foe hurts whoever it hits. A wall-splatted one stuns those next to it. A thrown one becomes a bowling ball.
- **Morale**: fodder near a brutal Execute may flee (this ties into Omega, section 6).
- Circlers feint (step in, step back) so the ring feels alive.

### Feel
- Hit-stop per hit type (light 0.04 s, smash 0.08 s, Execute 0.18 s), and camera punch toward the hit direction.
- **Impact frames**: 2 frames of high-contrast ink flash for smashes, Executes and ultimates, done in `post.js`.
- Speed lines on Pursuit and Vanish, afterimages on dashes, and slow-motion on the last enemy of a group.
- Enemy reactions: `flinch`, `stagger`, `launch`, `knockdown`, `wallsplat`, `crumple`, `broken`. The new poses go in `creatures.js` / `figures.js`.

## 4. The five Conquerors, reworked

Rules for every kit:
- **10 powers**: 8 worn (4 on the D-pad, 4 on L1 + D-pad), plus 2 held in reserve.
- A **signature mechanic** only that Conqueror has.
- A **Conqueror finisher** at the end of the chain.
- An **ultimate**.
- **Late sub-arts** (the Black Clover idea of branching magic) opened through the skill tree.
- **No two kits share a shape.** Any power that duplicated another is replaced.
- Ranks from removed powers carry to their replacement, so Mastery is never lost.

### Titan (earth: the land is a weapon you move)
- **Signature: Grounded.** While on natural ground, Titan's blows and earth powers are 20% stronger, and the Perfect-parry window grows. In the air or on water he loses it. This is the earth "stance".
- **Seismic Sense** (passive, through the skill tree): standing still briefly shows foes through walls and in caves, and shows the tells of heavy attacks early.

| Power | Status | What it does |
|---|---|---|
| Pillar Launch | new | A stone column bursts under the target and launches it. Links into Pursuit. |
| Slab Hurl | reworks Boulder Hurl | Tears a slab out of the ground, leaving a real dent. Hold to make it bigger. Punch it in flight to shatter it into a shotgun of stone. |
| Earth Surf | replaces Titan Charge (it looked like Storm Surge and Shadow Step) | Ride a rolling wave of earth that tramples and tears up the ground behind it. |
| Stone Mail | reworks Stone Skin | Plates rise from the ground and lock onto the body. Each hit visibly knocks a plate off, and lost plates can be punched back in. |
| Spear Garden | reworks Earth Spikes | A ring of spears around the target, not a line. Pins foes in place. |
| Quicksand | replaces Gravity Well (gravity isn't earth) | Ground turns to sand, foes sink and can't dodge, and heavies on sunk foes do double. |
| Rift Jaw | replaces Fault Line (same as Avalanche) | A chasm opens under a group, they drop in, and it slams shut. Big ones are left half-buried and Broken. |
| Mountain Form | reworks Colossus | Titan grows into a stone giant shell: slower, huge reach, armoured. |
| Ironbend | new sub-art (Forge tree) | Rip the iron out of armour and siege machines: disarms soldiers and crumples machines. |
| Magma Vein | new sub-art (Forge tree) | Molten lines through the ground that burst upward. Earth plus fire. |

- **Finisher:** Pillar Uppercut. The last hit drives the foe onto a column that erupts under them.
- **Ultimate: Upheaval.** Titan tears up a plate of land 40 tiles across with every foe on it, lifts it overhead, and slams it back down. It leaves a permanent dent (using `deform` and `digs`). Destroyed buildings on the plate come down as voxels.

### Stormcaller (lightning: speed, build-up, white-out)
- **Signature: Charge.** Storm powers leave foes Charged. A Charged foe hit by any lightning arcs to every other Charged foe.
- **Stormclouds:** Storm can gather clouds over a fight. Under clouds, sky powers cast instantly and hit harder, and the sky really darkens through `dayNight`.

| Power | Status | What it does |
|---|---|---|
| Arc Bolt | kept, new look | Branching bolt, a white core with a blue halo, and a bloom flash on hit. |
| Thunderstep | replaces Storm Surge | Flash-step through foes and strike everything on the line. Can be chained up to 3 times. Leaves afterimages. |
| Gather Storm | new | Raise stormclouds over an area for 30 s (see Stormclouds). |
| Thunderstrike | kept, linked to clouds | Under clouds: instant, and calls 3 bolts. |
| Stormspear | new, replaces Chain Lightning's role | A thrown javelin of lightning that pins a foe and then detonates. Chaining now comes from Charge. |
| Railgun | new | Charge a straight beam. It can clash with a Watcher's beam (mash to win). |
| Living Current | replaces Static Cloak | Body becomes lightning: speed up, and light attacks auto-Vanish (2 pips) out of the first hit that would land. |
| Cyclone | reworks Gale Burst and Tempest into one | A real funnel of wind and lightning that lifts foes and drops them. |
| Magnet Field | new sub-art (Tempest tree) | Pulls iron: soldiers in armour, bolts and machines slide toward the storm. |
| Plasma Lance | new sub-art | A melting beam that cuts through stone (voxel cut). |

- **Finisher:** Flashpoint. Storm vanishes and strikes from 4 sides in one instant, then a white-out.
- **Ultimate: Stormwyrm.** The clouds churn, and a serpent of lightning dives from the sky, coils through the battlefield and strikes everything it passes. It's bigger for each Gather Storm used in the last minute.

### Voidwalker, reborn as a summoner of the fallen
The user asked for necromancy and summoning that grows with the player until it can be an army.
- **Signature: the Hollow.** Foes the Voidwalker kills leave a **Husk** for 8 s, a dark silhouette on the ground.
  - **Rise** turns Husks into **Thralls**: void-black copies that keep the foe's moves and size.
  - Thralls are **stored in the Hollow** when dismissed, and the roster is saved (`lumen.hollow`).
  - Raising a captain, a Watcher or a ruler makes a **Marshal**, who keeps that foe's powers.
- **Growth:** the number of Thralls in the field grows with Mastery and the Dominion tree: 3, 6, 12, 24, 50, and at the top of the tree a **Legion** of 200 shown as an instanced crowd (section 7). Stored Thralls have no cap, so the Hollow becomes a collection.
- **Commands** (one D-pad slot, hold to pick from a wheel): Attack my target, Guard me, Hold here, Swarm everything.

| Power | Status | What it does |
|---|---|---|
| Rise | new, signature | Raises every Husk in range as Thralls. |
| Command | new | The wheel above. |
| Shade Swap | replaces Shadow Step | Swap places with any Thrall in sight. |
| Soul Lance | reworks Void Lance | Pierces, and every foe it kills leaves a Husk instantly. |
| Grave Tide | new | Every Thrall charges forward as one wave of shadow. |
| Husk Burst | new | Detonate chosen Thralls in void blasts. They return to the Hollow to rest for 60 s, not destroyed. |
| Amalgam | new | Fuse 5 or more Thralls into one giant beast for 30 s. Its size and moves come from what was fused. |
| Soul Drain | kept, rebuilt | Drains from Husks and Thralls as well as foes. |
| Hollow Gate | new sub-art | A portal that calls stored Thralls straight from the Hollow, not only from Husks. |
| Reaping Mark | reworks Reaping Hour | Marks every foe in sight. Marked foes that die rise at once. |

- **Superspeed** stays as Voidwalker's evolution, renamed **Shade Run** (Running).
- **Finisher:** Hollow Grasp. Shadow hands drag the foe down and leave a Husk even if it survives.
- **Ultimate: The Hollow Opens.** A rift tears open behind the Voidwalker and the whole stored roster pours out for 20 s. Everything killed in that time rises too. Late game this is the "summon an army" moment.
- **Balance guard:** Thralls deal a share of the Voidwalker's might, not the original foe's. Total Thrall damage per second is capped by a **Command** budget that grows with the tree, so 200 Thralls don't delete a ruler. A large Legion takes Spirit upkeep.

### Emberlord (fire: heat that builds until it's a sun)
- **Signature: Heat.** A 0-100 gauge.
  - Fighting and fire powers raise it.
  - At 40 the flames turn white-gold, at 80 blue, and fire powers grow.
  - At 100 the Emberlord **Overheats**: powers are strongest, but he takes a little self-burn each second.
  - Venting powers spend Heat for huge effects.
  - The body really changes: shimmering air, glowing cracks in the skin, and the hair becomes flame.
- **Brand:** fire hits leave Brands. **Ignite** detonates every Brand at once.

| Power | Status | What it does |
|---|---|---|
| Flame Fist | replaces Fireball | A giant fist of fire flies out and bursts through the first foe. |
| Ignite | new | Detonate all Brands. More Heat means bigger blasts. |
| Jet Burst | replaces Burning Stride | Fire jets from the feet: dash, double jump, and short flight that leaves a fire trail. |
| Pyre Serpent | new | A coiling serpent of flame that wraps a foe and burns everything it passes. |
| Flare Wall | reworks Firewall | A rising wall of fire you can push forward like a wave. |
| Inferno Pillar | new, replaces Cinder Rain | A column of fire straight up from the ground that lifts foes. |
| Meteor | kept, new look | The sky glows red, the meteor's trail lights the land, and the impact leaves a molten crater. |
| Supernova | reworks Supernova into a vent | Spends all Heat. Its size grows with the Heat spent. |
| Blue Inferno | new sub-art (Sun tree) | Works only at 80+ Heat. A thin blue flame that cuts through voxels. |
| Sunlance | new sub-art | A beam of light-fire that leaves glass on the ground. |

- **Finisher:** Pyre Break. A brand-detonating palm strike that sends the foe off as a rocket of flame.
- **Ultimate: Second Sun.** The Emberlord rises and raises a small sun overhead that swells as it eats Heat (and the Brands in range). It's thrown down, and the ground turns to molten glass (a new scar type). Sky light shifts to white while it's held.

### Frostwarden (ice: weapons, glaciers, stillness)
- **Signature: Frostforge.** Frostwarden shapes ice weapons, and the weapon changes the rush chain:
  - **Blade**: fast, 5 hits.
  - **Maul**: slow, shatters, big Structure damage.
  - **Glaive**: long reach, sweeps crowds.
  - Swap with L1 + R1 tap; the ultimate is L1 + R1 held.
- **Shatter:** heavy or Execute on a Frozen foe does triple damage and bursts into shards that hit others.

| Power | Status | What it does |
|---|---|---|
| Ice Shards | kept, new look | Real cut-crystal shards with refraction glints. |
| Glacier | replaces Avalanche (same as Fault Line) | A glacier races out of the ground and up hills, freezing everything it reaches. It's walkable and stays for a while. |
| Crystal Prison | new | Seal one foe in a crystal. It can't act. Break it for a big Shatter. Works on Watchers for a shorter time. |
| Frost Mirror | new | An ice copy of the Frostwarden draws attacks, then bursts. |
| Ice Wall | kept, rebuilt | A real slab wall. Foes can break it, and it becomes Glacier terrain. |
| Hailfall | new, replaces Ice Lance's role | Ice spears rain on the target area, each one pinning. |
| Rime Field | reworks Glacial Field | The ground freezes, foes slide, and Shatter gets bigger on it. |
| Frost Armor | kept, reworked | Armour that **counters**: a blocked hit freezes the attacker. |
| Icebound Sea | new sub-art (Winter tree) | Freezes water in a wide area into walkable ice roads. |
| Frostforge: Bow | new sub-art | A fourth weapon: charged ice arrows. |

- **Finisher:** Shatterpoint. The weapon breaks on the foe and every shard flies out.
- **Ultimate: Stillness.** A dome of white spreads 50 tiles. Inside it **time stops** for 4 s: foes, arrows and fire all freeze mid-air while the Frostwarden moves freely and strikes. Then everything inside shatters at once.

### More powers (Black Clover example)
- **Spirit Arts for everyone:** Spirit Shot (a fast volley) and Spirit Wave (a held beam). This gives every Conqueror a ranged neutral game. Beams **clash** with Watcher beams, and you mash to push.
- **Element reactions** between powers and the land, built on `scars.js`:

  | Mix | Result |
  |---|---|
  | Fire + Ice | a steam cloud that blinds |
  | Lightning + Water or Ice | arcs through the whole sheet |
  | Earth + Fire | magma |
  | Void + any element | corrupts it so it spreads twice as far |

  In co-op, two Conquerors' powers combine the same way.
- **Sub-arts** (the last two powers in each table) are the "more magic types" layer, opened through the tree.

## 5. Skill trees, made unique

The Spirit Tree today shares the same boughs (running, jumping, swimming, climbing, punching...) with renamed titles, plus 8 powers and one discipline. The new tree for each Conqueror:
- **Three branches of its own.** Each has power nodes, upgrades that change a power (for example, "Slab Hurl splits in three"), passives, new chain moves, and a capstone.
- **One shared trunk** (Fighting) for the combat core: Vanish charges, Perfect window, a 6th light hit, Breakout.
- Points still come from **doing** (the learn-by-doing rule stays). Using a branch's powers and doing its deeds feeds that branch.

| Conqueror | Branches | Removed shared boughs |
|---|---|---|
| Titan | **Mountain** (armour, Grounded, Seismic Sense) · **Quake** (Upheaval, Rift, Destructive Blow) · **Forge** (Ironbend, Magma) | Swimming (Bedrock Lungs becomes a Mountain passive) |
| Stormcaller | **Thunder** (Charge, bolts) · **Sky** (clouds, flight, Stormwyrm) · **Tempest** (wind, Magnet, Plasma) | Climbing (flight makes it pointless) |
| Voidwalker | **Legion** (Thrall cap, Amalgam) · **Dominion** (Command budget, Marshals, Hollow Gate) · **Hollow** (own void combat, Shade Run) | Swimming, Climbing |
| Emberlord | **Pyre** (Brands, Ignite) · **Sun** (Heat stages, Blue Inferno, Second Sun) · **Cinder** (Jet Burst, fire movement) | Swimming |
| Frostwarden | **Forge** (weapons, Bow) · **Glacier** (terrain, Icebound Sea) · **Stillness** (freeze, Crystal Prison, the ultimate) | Running (ice-skating moves into Glacier) |

- Removed boughs keep their levels in the save. Their effects fold into the branch named above, so nothing earned is lost.
- `skillMap.js` already draws one tree per Conqueror. It gets three branch colours and capstone glyphs.

## 6. The Omega Level: how the world sees you

### What it is
- A number from 0 to 1000, shown as phases. It's the world's verdict on the hero.

  | Phase | Name | From | What the world does |
  |---|---|---|---|
  | 0 | Unknown | 0 | Nothing special. |
  | 1 | Rumour | 60 | Guards watch you. Prices rise in towns you hurt. Bounty notices go up. |
  | 2 | Menace | 180 | Towns close their gates at your approach. People flee on sight. **Hunter squads** track you (an elite band plus a machine crew). |
  | 3 | Scourge | 380 | **Warbands with real siege engines** come out to meet you. **The first Watchers appear.** Fodder may break and run from you. |
  | 4 | Calamity | 620 | A nation sends its **army** (section 7). Nations make temporary pacts against you. |
  | 5 | Omega | 900 | A **coalition army** of every standing nation. Watchers hunt in pairs. Leads into the secret boss once all nations fall. |
- **What raises it** (each deed has a weight in a data table, `OMEGA` in a new `omega.js`):
  - soldiers and captains killed
  - townsfolk killed (heavy)
  - houses, estates and settlements destroyed
  - strongholds taken and rulers' seats broken
  - caravans robbed
  - land scarred (area per day)
  - Watchers slain
  - nations fallen
- **It ratchets.** It can fall back toward the start of the current phase if you lie low for days, but never below it. A burned city isn't forgotten.
- **It's also power.** Each phase gives the hero something: fear makes low foes hesitate, rising Wrath gain, Mastery speed, and tribute from cowed towns at phase 3+. Being feared is part of the fantasy, not only a punishment.
- **HUD:** an Omega sigil by the health bar, a ring that fills toward the next phase, and a screen-wide pulse plus a Chronicle line when a phase rises. The map shows bounty marks and army marches.

### Where it plugs in
- The realm's `threat(id)` and `grudge` become **per-nation views** of the global Omega. `Realm.decide()` weights (raise, field, hunt, war) read the phase.
- `events.js` gets **hunter squads** and **warbands**. `realm.heroFell` lowers Omega a little (the world thinks you're beaten).

## 7. Feedback on "nations send armies when your Omega reaches its limits"

**Verdict: a strong idea. It closes the loop between destroying things and the world fighting back. Build it with these six changes, or it will feel like a punishment instead of a war.**

1. **Escalate in steps, not only at the limit.** If the army only comes at the top, phases 1-3 feel empty. Squads, then warbands, then armies, then a coalition (the phase table above) gives a curve to climb.
2. **Announce it and let the player choose the ground.**
   - War horns, a Chronicle line, and the army shown **marching on the map** for a day or two. Their camp, supply wagons and road can all be seen.
   - The player can meet it head-on, **ambush it on a road** (`roads.js`), burn its supply (fewer reinforcements), or hit its home while it's away.
   - A surprise army arriving while you're shopping is the frustration case.
3. **Morale and commanders, not a 500-kill grind.**
   - An army is built from:
     - Levies (fodder that **routs** when morale breaks)
     - Veterans
     - Siege crews
     - Captains
     - A **Commander**, a Watcher at phase 4+
   - Killing captains, burning machines and big Executes drop morale. Below a threshold whole blocks flee.
   - A good fight is about 6-10 minutes, not an hour.
4. **Real troops with real cost.** The army is drawn from `realm` troops. Crushing it leaves that nation weak (its forts are easier and its towns open), so beating an army is a strategic win, not just XP. Each beaten army raises Omega, which pulls in the next nation. The war escalates on its own and ends in the finale.
5. **A breather.** After an army is beaten or routed, the nations need a set number of in-game days to raise the next one. That's a truce window to explore and build.
6. **Performance has to be designed in.** A browser can't run 300 full `Enemy` AIs. We use three levels of detail:

   | Level | Distance | How it runs |
   |---|---|---|
   | Near | about 40 nearest | full fighters |
   | Mid | out to 200 tiles | squads of 10 as one AI with instanced bodies (one draw call per block) and shared animation |
   | Far | beyond | banners and dust columns on the map and horizon |

   A squad splits into full fighters as the hero closes in. The same crowd system draws the Voidwalker's Legion.
- **Co-op:** both heroes' Omega adds up, at 70% each, and armies size to the pair.

## 8. Siege machines that matter

- **Why they don't hurt now:** every machine uses `Monsters.fireOrb`. It's a slow orb at a fixed height that hits only inside 1 tile, and it's the same orb for all six kinds.
- **New rules:**
  - Every machine has its own projectile and a **ground telegraph** (a red marker that fills before impact).
  - It **leads its shot** (aims where you'll be).
  - It damages **structures** too (voxels, houses), so a siege really wrecks a town.
  - It has a **crew**. Kill the crew to silence it. Titan's Ironbend crumples it, and a Voidwalker can raise the crew to turn it on its own side.
  - Big hits knock the hero down and break guard. You roll or Vanish them, not tank them.

| Machine (nation) | Projectile | Hit (share of hero health) |
|---|---|---|
| Ballista (Legion) | Fast bolt in a line, pierces, pins the hero 0.6 s | 0.20 |
| Trebuchet (Legion, new) | Arcing boulder, 1.4 s telegraph circle, crater, flattens houses | 0.35 at the centre |
| Thorn Spitter | Fan of 5 thorns, poison | 0.06 each |
| Frost Cannon | Shell that leaves a freezing field (slows, then freezes) | 0.15 plus freeze |
| Flame Cannon | Cone of liquid fire that sticks to the ground (burn) | 0.08 per second |
| Plague Engine | Gas cloud: damage over time, and **raises the dead** on the enemy side (the Voidwalker can steal them) | 0.05 per second |
| Bone Engine | Spikes that burrow and burst under the hero's feet | 0.22 |

## 9. The Watchers

### What they are
- Beings of the same kind as the Conquerors. They have powers, Structure, Spirit and Wrath, and they fight with the **same combat core as the player** (rush chains, Vanish, parry, powers, an ultimate).
- They're the world's immune response: they appear at Omega phase 3 and lead armies at phase 4.
- They have their own elements, from the "more magic types" idea. All names and designs are original:

  | Watcher | Element | Style |
  |---|---|---|
  | The Lantern | light | blinding flashes, light-speed steps, beams |
  | The Anchor | gravity | pins you to the ground, pulls you out of the air, crushes guard |
  | The Hush | sound | silences powers (cooldowns lock), shockwave parries |
  | The Echo | mirror | takes your **own** Conqueror's element and fights with your own habits |
  | The Thornwarden | blood-root | drains, roots you in place, heals from the land |

### How they learn (Killer Instinct style, not the Nemesis pattern)
- **What's recorded:** while a Watcher fights, the game records the player's **habits** as small counts that fade over time (`lumen.watchers`):
  - which chain branches you use, and at which hit
  - how often you open with a power, and which one
  - roll and Vanish direction
  - parry timing (early, perfect, late)
  - whether you Breakout when pressured
  - how far away you like to fight
  - how you answer each of their attacks
  - the order of your last 2 actions, to predict your next one (an n-gram)
- **What they do with it:**
  - Each Watcher keeps a table of **counters**: perception-parry the hit you always end on, delay their own attacks to beat early parries, cast where you usually roll, sidestep a power you spam, close distance if you zone.
  - Each counter's weight rises when it worked and falls when it didn't (a simple bandit learner).
  - **Insight** (0-5) caps how much of the model a Watcher uses. It rises each time any Watcher fights you, so they get better together. They watch: it's in the name.
  - **Adaptation:** a Watcher hit by the same element many times in one fight grows a resistance to it, shown as a visible crystal ward. You have to vary your kit.
- **Training (the user wants to help):**
  - A **Watcher Trial** arena from the Satchel: fight any met Watcher at a chosen Insight.
  - A **"What it learned" panel** listing the top habits it has read and the counters it's favouring.
  - Buttons to **reset** or **freeze** a profile, and a debug export to `__world.watchers.profile()`.
  - The arena records just like the open world, so practice there trains them.
- **Kept away from the patent:**
  - Watchers don't promote or demote one another.
  - There's no generated hierarchy.
  - They don't remember personal encounters as story events.
  - They learn **how you fight**, as one shared style model.

### Fairness
- Watchers telegraph like everything else. Their counters always leave a window (a Perfect parry or a Vanish still works). Insight raises the chance of a counter, never makes it certain (at most 70%).
- **Balance:** a new role `watcher: { hits: 45, bite: 0.11 }` in `ROLES`, with a tall Structure bar. Breaking Structure is the intended way to win.

## 10. Balance

- **Single source:** `ROLES` (evolve.js) stays the place to tune foes. New tables:
  - `COMBAT` (combat.js): chain multipliers, Structure, Spirit, parry windows
  - `OMEGA` (omega.js): deed weights and phases
  - `SIEGE` (doctrines.js): machine bites
  - A **power budget** in conquerors.js
- **Power budget:** each power's damage × targets ÷ cooldown has to land within ±15% of its kind's target. Ultimates are set to about 30% of a ruler's health at the same level.
- **`scripts/balance.mjs`:** works out damage per second for every kit at Mastery 0/5/12/20, time-to-kill for every role, and Thrall army damage against the Command cap. It prints a table and **fails** if anything is off its target. It runs before every commit in this plan.
- **Live checks (CLAUDE.md rule):** sweep every enemy type at point-blank range for real fighting, every Watcher at Insight 0 and 5, and one army fight per phase, with a fake PS5 pad in the browser pane.

## 11. Phases (each one a playable version)

| Version | Phase | Contents |
|---|---|---|
| 0.31 | **Combat core** | New buttons, rush chain + smashes, air chain + Pursuit, Vanish, Structure, Spirit, parry tiers, Breakout, enemy reactions, crowd markers, hit feel, balance script |
| 0.32 | **Effects and ultimates** | VFX kit (ribbon trails, beams, distortion rings, impact frames, GPU sparks, sky takeover), Wrath, Surge, ultimate camera, Spirit Arts, element reactions, the new skill tree frame |
| 0.33 | **Titan** | Full kit, Grounded, Upheaval, Mountain / Quake / Forge tree |
| 0.34 | **Stormcaller** | Full kit, Charge, Stormclouds, Stormwyrm, beam clash |
| 0.35 | **Emberlord** | Full kit, Heat, Brands, Second Sun, glass scars |
| 0.36 | **Frostwarden** | Full kit, Frostforge weapons, Shatter, Stillness |
| 0.37 | **Voidwalker** | Husks, Thralls, the Hollow roster, Commands, Amalgam, The Hollow Opens; crowd LOD (shared with armies) |
| 0.38 | **Omega + sieges** | Omega Level, phases 0-3, hunter squads, warbands, new siege machines and Trebuchet |
| 0.39 | **Armies** | Phase 4-5, marching armies on the map, morale, commanders, LOD squads, truce windows |
| 0.40 | **Watchers** | The five Watchers, learning, Insight, Trial arena, "What it learned" panel; final balance pass |

- Each version follows the house rules: a `FEATURES` switch per feature, update `FEATURES.md`, test with a fake PS5 pad, bump the version, snapshot the last commit of the previous version, then commit and push.
- Saves: removed powers map their ranks to their replacements, the new tree reads old skill levels, and the Hollow, Omega and Watchers get their own keys.

## 12. Questions for the user

1. **Buttons:** OK to move the Satchel from Triangle to the touchpad, so Triangle becomes Heavy/Smash? (Recommended. Every action game puts heavy there.)
2. **Voidwalker's name:** keep "Voidwalker" for the necromancer, or rename (for example "Gravecaller")? Old Void saves keep their ranks either way.
3. **Ultimate button:** L1 + R1 together, OK?
4. **Omega:** ratchet as above (it can fall within a phase but never below it), or never fall at all?
5. **Watchers training:** should they also learn from your normal open-world fights against other enemies (faster learning), or only from fights with Watchers (purer)?
6. **Army size:** aim for about 40 full fighters plus up to 300 in squads (smooth on your PC), or push higher at some cost to frame rate?
7. **Order:** combat core first, then Titan as listed, or start with the Voidwalker rework?
