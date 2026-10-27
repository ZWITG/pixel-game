# Features

Switches live in `src/config/features.js`. Set one to `false` to remove that feature without deleting code.

## In the game (v0.1.0)
| Feature | Switch | Notes |
|---|---|---|
| Overworld | — | 60×40 seeded map: grass, flowers, paths, ponds, trees (`src/world/generateWorld.js`) |
| Hero movement | — | WASD / arrows, 2-frame walk, camera follow |
| Sword combat | `combat` | Space / J, 350 ms cooldown, knockback |
| Enemies | `enemies` | Data-driven (`src/data/enemies.js`): Slime, Fire Slime (from Lv 3); up to 14, respawn every 4 s |
| Leveling | `leveling` | XP bar; each level +1 max HP (cap 12), full heal; +1 ATK every 2 levels |
| Coins | `coins` | 70% drop chance, counter top-right |
| Damage numbers | `damageNumbers` | Floating text on hits |
| Death & respawn | — | "You fell..." screen, press R |

## Ideas backlog (pick, add, or cross out)
- [ ] NPC village with dialogue
- [ ] Shop (spend coins)
- [ ] Inventory and equipment (swords, armor)
- [ ] Quests
- [ ] Save / load (localStorage)
- [ ] Dungeon with stairs and a boss
- [ ] Hero up/down facing sprites
- [ ] Magic / dash skill
- [ ] Day / night cycle
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Mobile touch controls

## Changelog
- 2026-10-27 v0.1.0: first playable (overworld, combat, slimes, XP, coins, death screen)
