# Features

Switches live in `src/config/features.js`. Set one to `false` to remove that feature without deleting code.

## Controls
| Action | Keyboard | Controller |
|---|---|---|
| Move | WASD / arrows | Left stick / D-pad |
| Attack | Space / J | X, or A when no one is nearby |
| Talk | E | A or Y (when next to a villager) |
| Menus: choose / confirm / leave | W S / E Space Enter / Q Esc | Stick or D-pad / A / B |
| Restart after falling | R | Start or A |

## In the game (v0.2.0)
| Feature | Switch | Notes |
|---|---|---|
| Overworld | — | 60×40 seeded map: grass, flowers, paths, ponds, trees (`src/world/generateWorld.js`) |
| Hero movement | — | 2-frame walk, camera follow; analog stick speed |
| Controller support | `gamepad` | Any standard-layout gamepad (Xbox, PlayStation, etc.), via `src/systems/controls.js` |
| Sword combat | `combat` | 350 ms cooldown, knockback |
| Enemies | `enemies` | Data-driven (`src/data/enemies.js`): Slime, Fire Slime (from Lv 3); up to 14, respawn every 4 s |
| Leveling | `leveling` | XP bar; each level +1 max HP (cap 15), full heal; +1 ATK every 2 levels |
| Coins | `coins` | 70% drop chance, counter top-right |
| Damage numbers | `damageNumbers` | Floating text on hits |
| Village: Lumen Hollow | `village` | Top-left of the map: 3 houses, market stall, name banner; wards push monsters out and they won't chase you inside |
| Villagers and dialogue | `dialogue` | Elder Mirae, Mina, Pip, Guard Bram (`src/data/npcs.js`); typewriter text box, world pauses while talking |
| Shop | `shop` | Mina's Goods (`src/data/items.js`): Herb Tonic 5c (full heal), Steel Sword 25c (+1 ATK), Wind Boots 20c (+20% speed), Heart Charm 30c (+1 max heart) |
| Death & respawn | — | "You fell..." screen |

## Ideas backlog (pick, add, or cross out)
- [x] NPC village with dialogue
- [x] Shop (spend coins)
- [ ] Inventory and equipment screen (swords, armor)
- [ ] Quests (e.g. Elder asks you to clear slimes)
- [ ] Save / load (localStorage)
- [ ] Dungeon with stairs and a boss
- [ ] Hero up/down facing sprites
- [ ] Magic / dash skill
- [ ] Day / night cycle
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Mobile touch controls
- [ ] Controller rumble on hits

## Changelog
- 2026-10-27 v0.2.0: village Lumen Hollow, 4 villagers with dialogue, Mina's shop, controller support, shared controls module
- 2026-10-27 v0.1.0: first playable (overworld, combat, slimes, XP, coins, death screen)
