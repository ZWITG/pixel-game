# Eradication: local (native) version plan

Approved by the user on 2026-11-12. Milestones are approved one at a time; nothing is built until its milestone is approved.

## Context

- Eradication (repo `pixel-rpg`, v0.56.0) is a Three.js browser game: 96 files and about 30,600 lines in `src/open/`, plus `world.html` (713 lines of HUD and styles). All art and sound is made by code; the only asset files are fonts in `public/fonts/` (open licence, `OFL.txt`).
- It runs offline through `Play Pixel RPG.bat`, but still needs Node, git and a browser, and saves live in browser storage (`lumen.*` keys).
- The user wants a real local game, as a separate project. Decisions made on 2026-11-12:
  - **Approach:** rewrite in a native engine, and fix everything on the way (performance, look, known bugs, redesign of weak systems).
  - **Engine:** Godot 4.
  - **Location:** new folder `C:\Users\zwivh\Projects\eradication-local` with its own private GitHub repo.
  - **Priorities:** controller feel, performance, sharing with others, Steam release (all four).
  - **Order:** a playable slice first, then one system group per milestone.
  - **Meanwhile:** a small Electron `.exe` of today's game, for sharing while the rewrite is built.
  - **Where new features are made later:** undecided. Decision point after milestone N3 (see "Two games at once").

## Why Godot 4

- Free and open source: no fees, no royalty, about 150 MB.
- Projects are text files and it builds, runs, tests and exports from the command line, so nearly all work can be written and tested without hand-clicking in an editor.
- PS5 pad and rumble work out of the box; Steam through the GodotSteam add-on; one-command Windows `.exe` export.
- Pipeline precompilation (Godot 4.4+) removes the shader-stutter problem that `warmShaders()` works around today.
- Language: **C#** for all game code (.NET SDK 9.0.317 is already installed; Godot 4 needs 8 or newer). One typed language, compile errors caught by `dotnet build`, fast enough for land and voxel meshing on threads. Shaders in Godot's shading language.
- Renderer: Forward+ (the PC has an RTX 3050 6 GB laptop GPU and 16 GB RAM). Target: 1080p at a steady 60 fps on this PC, measured in N1 and held as a budget in every later milestone.

## What is reused and what is rewritten

| Part | How it moves |
|---|---|
| Game data (`conquerors.js`, `src/data/enemies.js`, `items.js`, `NATIONS`, `ROLES` in `evolve.js`, `COMBAT` in `combat.js`, `ROADS`, `TOWNS`, `FEELS` in `rumble.js`, `CUES` in `sound.js`) | **Reused.** A Node script in the new repo imports these modules from `pixel-rpg` and writes JSON; the native game loads the JSON. Nothing is retyped. |
| The map (`terrain.js`, 296 lines, pure math) | **Ported line for line**, then proven equal: a Node script samples heights on a grid, a C# test checks the port gives the same numbers. Same 8 km world, same places. |
| Sound (`soundWorker.js`, 883 lines, pure math, no browser calls) | **Reused.** A Node script runs the existing synthesis and writes `.wav` files; Godot plays them through buses (sfx, ui, ambience, reverb) with 3D placement. No sound is redesigned unless asked. |
| Combat numbers and balance (`combat.js`, `scripts/balance.mjs`) | **Ported and checked** against the current `balance.mjs` output. |
| Fonts (`public/fonts/`) | **Reused** (converted from woff2 to ttf). |
| Game logic (combat, foes, powers, kits, realm, economy, watchers, and so on) | **Rewritten in C#**, one system group per milestone, using `docs/architecture.md` as the map. Each group gets a short "keep / fix / redesign" review with the user before it is rebuilt. |
| Rendering (`post.js`, `materials.js`, `kit.js` toon shapes, `foliage.js`, voxel meshes) | **Rewritten** for Godot: proper shadows, water, fog and glow; same voxel anime look, sharper. |
| HUD and menus (`world.html`, `skillPage.js`, `gameMenu.js`, `startMenu.js`) | **Rewritten** as Godot UI with a theme carrying the War banner tokens (iron, brass, cloth, Cinzel). |
| Browser plumbing (`localStorage`, Web Workers, `navigator.getGamepads`, `AudioContext`, URL flags) | **Dropped.** Replaced by a save file, C# threads, Godot input, Godot audio and command-line flags (`--play=titan`, `--level=N`). |

## New project structure

```
C:\Users\zwivh\Projects\eradication-local\      (GitHub: private repo "eradication-local")
  project.godot, Eradication.sln
  core/        C# library with no engine code: terrain, combat maths, realm, economy, save format
  core.tests/  dotnet tests, including "same as the browser game" checks
  game/        Godot side: scenes, world streaming, meshing, hero, foes, effects, shaders
  ui/          HUD, menus, theme
  data/        JSON written by tools/export-data.mjs
  audio/       .wav files written by tools/bake-sound.mjs
  tools/       export-data.mjs, bake-sound.mjs, sample-terrain.mjs, release.ps1, autotest scene
  builds/      exported versions (not in git)
  docs/        architecture.md, FEATURES.md, parity.md (every v0.56.0 system: not started / done / redesigned)
  CLAUDE.md    run, test and engine rules for this repo
  Play Eradication.bat, Play Old Version.bat
```

- The tools read `pixel-rpg` from `..\pixel-rpg` at the pinned tag `v0.56.0`, so the port has a fixed target.
- `pixel-rpg` itself is not changed by the rewrite (only by milestone E0 below, and one small save-export button).

## Saves

- Native save: one file per slot at `%APPDATA%\Eradication\saves\slot1.json`, with a `version` number and one section per old key (`spot`, `conqueror`, `skills`, `realm`, `digs`, `dents`, `horse`, `nations`, `omega`, `sites`, `watchers`, `hollow`, `world`, `settings`, player two under `p2`).
- Written safely: to a temp file, then renamed; the last 5 saves are kept as backups.
- **Moving a browser save across:** the browser game gets an "Export save" entry in its Settings tab that downloads every `lumen.*` key as `eradication-save.json` (small change in `gameMenu.js`; `play.mjs` already has the matching `/save-import.json` route). The native start menu gets "Import browser save", which reads that file and maps each key to its section.
- Sections for systems not yet rebuilt are kept untouched in the file, so an imported save loses nothing while the native game catches up.
- Retired Conquerors: the `RETIRED` mapping in `powers.js` is exported with the data, so old picks still land on their successors.

## Controller

- Godot input actions named after today's actions (punch, heavy, dodge, guard, powers on D-pad, L1/R1 shifts, whistle on L3).
- PS5 pad through Godot's built-in SDL mappings; rumble through `Input.StartJoyVibration` (weak and strong motors, the same two values `FEELS` uses today).
- Button prompts follow the last device used (PlayStation glyphs, Xbox glyphs, keyboard).
- Dead zones, stick curves and input buffering are tuned in N1 with the user playing, since controller feel is priority one.
- Steam Input can present a PS5 pad as an Xbox pad; handled in the Steam milestone.

## Keeping every version playable

- Each approved milestone is a version (native numbering starts at `0.1.0`; the browser game keeps its own `0.56.x` line).
- `tools/release.ps1`: builds, runs the tests, exports `builds/<version>/Eradication.exe`, zips it, tags `v<version>`, and uploads the zip to a GitHub Release. Builds are not committed to git (they are about 100 MB each).
- `Play Old Version.bat` lists `builds/` and starts the chosen one with its own save folder (`--save-dir`), so saves never mix. Same promise as today's `versions/` folder and per-port saves.
- The browser game's 59 kept versions and its `Play Old Version.bat` stay as they are.

## How I test without hands on the pad

- `dotnet test` for `core/` (terrain equals the browser game, combat numbers equal `balance.mjs`, save round trips, save import).
- `tools/autotest`: starts the real game with a script that feeds fake pad input, steps frames, saves screenshots and a frame-time log; I read both. Used for every milestone before the user plays.
- The enemy rule carries over: every enemy type fights at point-blank range for a few seconds in the autotest before a milestone ships.
- The user play-tests each milestone with the PS5 pad; feel can only be judged that way.

## Milestones (approve one at a time)

Sizes are rough guesses in work sessions; the rewrite is large and the later ones will move.

| # | Milestone | Done when | Size |
|---|---|---|---|
| E0 | **Electron `.exe` of today's game** (in `pixel-rpg/desktop/`, own `package.json`) | `Eradication.exe` opens v0.56.0 in its own fullscreen-capable window with no browser, Node or internet; pad, rumble and sound work; saves are mirrored to `%APPDATA%\Eradication-Web\save.json`; a zip a friend can run | 1 |
| N0 | **Set up** | Godot 4 (latest stable, .NET build) installed; folder and private GitHub repo created; empty window exports to `.exe`; `CLAUDE.md`, `docs/parity.md`, release script and autotest work; data export, sound bake and terrain sampling tools run | 1 |
| N1 | **Playable slice** | Same land as the browser game streaming around one hero; move, jump, camera; PS5 pad with rumble; one enemy type; light chain and dodge; health bar; position saves; 60 fps at 1080p; ships as `0.1.0` | 3-4 |
| N2 | **Look** | Day cycle, sky, shadows, water, fog, glow, foliage, toon ink; side-by-side shots against v0.56.0 approved by the user | 2-3 |
| N3 | **Full combat** | Smashes, parries, Structure, rally, finishers, riposte, clashes, foe guard, tells, duel camera, hero and foe animation, every enemy in `ENEMIES` swept; numbers match `balance.mjs` | 5-6 |
| N4 | **Sound, menus, saves** | Baked sounds on all hooks; start menu, settings, game menu shell; save slots; browser-save import | 2-3 |
| N5 | **Conquerors I** | Powers framework and effects, Conqueror pick, first five kits (titan, storm, void, ember, frost) | 4-5 |
| N6 | **Conquerors II** | Second five kits (gravity, blade, blood, blast, dragon), ultimates, Wrath, Spirit arts, skills, levelling, skill tree | 4-5 |
| N7 | **Destruction** | Breakable voxel structures, diggable ground, scars on the land, raze sites, smoke and fire | 3-4 |
| N8 | **Places** | Towns and street plans, buildings by nation, fortresses, settlements, townsfolk, rooms, roads, roadside sites, landmarks, map and compass | 4-5 |
| N9 | **Living realm** | Nations and conquest, realm, economy, caravans, markets, estates, fairs, events, animals and horse, Omega, armies, sieges, Watchers | 5-6 |
| N10 | **Two players and the rest** | Split screen, satchel and items, chopping and mining, anything left in `docs/parity.md` | 2-3 |
| N11 | **Steam** | GodotSteam added, store app created (the user pays Steam's one-off fee and owns the account), achievements, cloud saves, Steam Input, overlay | 2 |
| N12 | **1.0** | `docs/parity.md` fully ticked, all known bugs closed, final performance pass | 2 |

Each native milestone runs the same way: review that group's systems with the user (keep / fix / redesign) → build → tests and autotest → user plays → release script → update `FEATURES.md`, `docs/architecture.md`, `docs/parity.md` and the Obsidian project note.

## Two games at once

- The port targets tag `v0.56.0`. Other sessions are still adding features to the browser game; anything added there after v0.56.0 goes on a "to port" list in `docs/parity.md` instead of moving the target.
- Recommendation: from N1 on, limit the browser game to bug fixes, or the native version never catches up.
- Decision point after N3 (combat feels right natively): freeze the browser game and build only in Godot, or keep both.

## Risks

- **Size.** About 40-50 sessions in total by the guesses above. The slice-first order means there is a playable `.exe` after N1 and the user can stop or re-order at any milestone.
- **Feel drift.** A rewrite can match the numbers and still feel different. Guarded by ported combat numbers, side-by-side play against the Electron build, and user play-tests every milestone.
- **Look.** Godot's lighting differs from the hand-made pipeline in `post.js`; N2 exists to settle it early, before content piles on.
- **Editor work.** Scenes are built in code and text files, but a few things (import settings, export presets) may need the user to click once in the Godot editor; I will give exact steps.
- **Godot and C#.** C# projects cannot export to web or (officially) consoles; fine for Windows and Steam, which is the goal.
- **Installs.** Godot (.NET build), its export templates and Electron are downloads from their official sites; I ask before each.
- **Steam.** Needs the user's own Steamworks account, fee and store paperwork; I cannot do those parts.
- **Redesign scope.** "Redesign weak systems" is open-ended; it is pinned down per milestone in the review step so it cannot stall the port.

## Verification of this plan's first steps

- E0: build the `.exe`, launch it, confirm the title screen, pad input, rumble call, sound, a save written to the file, and that it runs with the network off; send the zip path.
- N0: `dotnet test` green; exported empty `.exe` starts; `tools/sample-terrain.mjs` output matches the C# terrain port at 10,000 sample points; `git push` to the new private repo succeeds.

