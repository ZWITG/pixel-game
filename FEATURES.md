# Features

Switches live in `src/config/features.js`. Set one to `false` to remove that feature without deleting code.

## Controls
| Action | Keyboard / mouse | Controller |
|---|---|---|
| Move (relative to camera) | WASD / arrows | Left stick / D-pad |
| Turn camera | Drag with mouse, or Z / X | Right stick, or LB / RB |
| Look up/down (behind view) | Drag with mouse | Right stick |
| Switch camera (top-down / behind) | V | Select (Back/View) or click R3 |
| Attack | Space / J | X, or A when no one is nearby |
| Talk | E | A or Y (when next to a villager) |
| Menus: choose / confirm / leave | W S / E Space Enter / Q Esc | Stick or D-pad / A / B |
| Restart after falling | R | Start or A |

## In the game (v0.3.1, 3D)
| Feature | Switch | Notes |
|---|---|---|
| 3D voxel world, HD | — | Three.js at full resolution with anti-aliasing, soft shadows, filmic tone mapping, gradient sky, fog; 60×40 seeded map (`src/world/`) |
| Retro pixel mode | `retroPixels` | Off by default: renders at 1/3 resolution for a chunky pixel look |
| Grass blades | `grassBlades` | ~8,000 instanced blades; turn off on slow machines |
| Block shading | — | Darker block bottoms (fake ambient occlusion), smooth ground color blending, glossy water |
| Two cameras | `cameraToggle` | Angled top-down (orbit with right stick) and behind-the-hero with free look (`src/core/CameraRig.js`) |
| Voxel hero | — | Blocky anime-style model with walk cycle and sword swing (`src/render/models.js`) |
| Controller support | `gamepad` | Any standard-layout gamepad (Xbox, PlayStation, etc.), via `src/systems/controls.js` |
| Sword combat | `combat` | 0.35 s cooldown, crescent slash effect, knockback, hit flash |
| Enemies | `enemies` | Data-driven (`src/data/enemies.js`): Slime, Fire Slime (from Lv 3); squash-and-stretch hop; up to 14, respawn every 4 s |
| Leveling | `leveling` | XP bar; each level +1 max heart (cap 15), full heal; +1 ATK every 2 levels |
| Coins | `coins` | 70% drop chance, spinning voxel coins |
| Damage numbers | `damageNumbers` | Floating text over 3D positions |
| Village: Lumen Hollow | `village` | 3 voxel houses, market stall, name banner; wards push monsters out |
| Villagers and dialogue | `dialogue` | Elder Mirae, Mina, Pip, Guard Bram (`src/data/npcs.js`); they face you when you talk; world pauses |
| Shop | `shop` | Mina's Goods (`src/data/items.js`): Herb Tonic 5c, Steel Sword 25c (+1 ATK), Wind Boots 20c (+20% speed), Heart Charm 30c (+1 heart) |
| Death & respawn | — | "You fell..." screen |

The 2D Phaser version is kept at git tag `v0.2.0-2d`.

## Ideas backlog (pick, add, or cross out)
- [x] NPC village with dialogue
- [x] Shop (spend coins)
- [x] 3D with two camera modes
- [ ] Lock-on targeting (common action-RPG mechanic)
- [ ] Dodge roll with brief invincibility
- [ ] Fade trees and walls that block the behind camera
- [ ] Inventory and equipment screen (swords, armor)
- [ ] Quests (e.g. Elder asks you to clear slimes)
- [ ] Save / load (localStorage)
- [ ] Dungeon with stairs and a boss
- [ ] Magic / special skill
- [ ] Day / night cycle with lanterns
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Controller rumble on hits
- [ ] Mobile touch controls

## Changelog
- 2026-10-27 v0.3.1: HD rendering (full resolution, anti-aliasing, soft shadows, tone mapping), grass blades, smooth ground, glossy water, sky gradient; retro mode kept as a switch
- 2026-10-27 v0.3.0: rebuilt in 3D (Three.js, voxel pixel style), top-down and behind-the-hero cameras, camera-relative movement, mouse/right-stick camera
- 2026-10-27 v0.2.0: village Lumen Hollow, 4 villagers with dialogue, Mina's shop, controller support
- 2026-10-27 v0.1.0: first playable (overworld, combat, slimes, XP, coins, death screen)
