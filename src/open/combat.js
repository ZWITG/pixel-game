// The fighting core as numbers: rush chains, smashes, Structure, Spirit and parries.
// Pure data and small helpers, so scripts/balance.mjs can read it without a browser.
// Damage is a multiple of the hero's blow (Melee.force). Times are seconds, distances tiles.

export const COMBAT = {
  // Square: up to five light hits. The last one knocks the foe away.
  chain: [1, 1, 1.1, 1.2, 1.6],
  chainTime: [1, 1, 1, 1.05, 1.3],   // of the hero's punch time
  chainWindow: 0.55,                 // seconds after a hit to keep the chain going
  airChain: [0.9, 0.95, 1.15],       // Square in the air after a Pursuit
  hover: 0.9,                        // seconds both hang in the air after each air hit
  homing: 4.5,                       // tiles a hit steps in toward its target
  // Triangle after n light hits; `order[n]` is the smash it becomes.
  order: ['breaker', 'launcher', 'sweep', 'driver', 'slam', 'finisher'],
  smash: {
    breaker: { name: 'Breaker', power: 2.2, posture: 3, time: 0.62, react: 'stagger', armored: true },
    launcher: { name: 'Launcher', power: 1.4, posture: 1.5, time: 0.46, react: 'launch' },
    sweep: { name: 'Sweep', power: 1.3, posture: 1.5, time: 0.5, react: 'knockdown', reach: 6.5 },
    driver: { name: 'Wall Driver', power: 1.8, posture: 1.5, time: 0.5, react: 'fly' },
    slam: { name: 'Ground Slam', power: 1.6, posture: 2, time: 0.52, react: 'bounce' },
    finisher: { name: 'Finisher', power: 3, posture: 3, time: 0.7, react: 'fly', reach: 6 },
    spike: { name: 'Spike', power: 2, posture: 2, time: 0.42, react: 'spike' },
    execute: { name: 'Execute', power: 3.5, posture: 0, time: 0.7, react: 'fly' },
    riposte: { name: 'Riposte', power: 1.6, posture: 0, time: 0.58, react: 'knockdown' },
  },
  repeat: 0.5,          // the same smash twice in one string: this much, and the string ends
  // How a blow throws a monster: tiles per second away, and up.
  react: {
    flinch: { fling: 3, rise: 0, stun: 0.45 },
    stagger: { fling: 6, rise: 2, stun: 0.9 },
    launch: { fling: 1, rise: 24, stun: 1.4 },
    knockdown: { fling: 8, rise: 6, stun: 1.2, down: 1.1 },
    fly: { fling: 36, rise: 6, stun: 1, flung: 0.7 },
    bounce: { fling: 2, rise: 15, stun: 1.2 },
    spike: { fling: 0, rise: -55, stun: 1.2 },
  },
  wall: { power: 1.2, stun: 1.4 },  // a flung foe meeting a wall: more hurt, and stuck there a moment
  // Structure. Foes: points by role, one per light hit. The hero: a 0..1 bar.
  posture: { fodder: 3, fighter: 5, brute: 9, machine: 6, ruler: 40, watcher: 18 },
  postureBack: 1.2,     // points a foe gets back each second it isn't hit
  postureRest: 2,       // seconds before it starts to recover
  postureHurt: 0.35,    // a foe near death gets Structure back only this share as fast (it scales with health left)
  broken: { foe: 1.9, hero: 1.2 },
  hero: { block: 0.12, heavy: 0.5, parry: -0.15, perfect: -0.3, vanish: -0.25, dodge: -0.08, back: 0.1, rest: 1.5 },
  // Defence windows, seconds after the guard goes up.
  parry: { perfect: 0.12, plain: 0.22 },
  counter: { perfect: 2, plain: 1.5, secs: 1.8 },
  parried: { perfect: 1.6, plain: 1 },    // seconds a parried foe is dazed
  // Riposte (v0.47.0): after a Perfect parry, Square within `window` seconds (the world slowed for `slow`)
  // strikes back up close: the Riposte smash (doubled by the counter) plus `base` + `share` of the foe's Structure.
  riposte: { window: 0.65, slow: 0.45, base: 2, share: 0.12 },
  // Weapon clashes (v0.48.0): a smash meeting a foe's strike locks the two together. The bar starts at `start`;
  // each Square press adds `press`, the foe pushes back `push[role]` a second; full wins, empty loses, and after
  // `secs` whoever is ahead wins. Won: `base` + `share` of the foe's Structure, a counter, `spirit` pips. Lost:
  // `hurt` of the foe's blow and a dented guard. `every`: seconds before the same hero can clash again.
  // Foes that guard (v0.49.0): human fighters (GUARDERS in foes.js) raise a guard while waiting their turn or
  // after `after` light hits in a row. Light hits from the front then do `chip` of their damage (Structure still
  // builds); after `counter` blocked hits it swings back. A smash or a chain's last hit breaks it (`breakPosture`
  // extra Structure); blows from behind, powers and grabs go round it. `raise` seconds to lift it, `turn` radians a
  // second it turns to face you (a Vanish behind gets through), `secs` how long it holds; `react` scales the
  // chance of raising one mid-string.
  foeGuard: { react: 0.5, chip: 0.2, counter: 3, after: 2, breakPosture: 2, raise: 0.35, turn: 3, secs: [1.4, 2.4], counterTell: 0.3 },
  clash: { start: 0.5, press: 0.09, secs: 2.2, base: 2, share: 0.6, spirit: 1, hurt: 0.6, every: 4, stun: 1.2,
    push: { fodder: 0.15, fighter: 0.3, brute: 0.45, machine: 0.3, ruler: 0.55, watcher: 0.5 } },
  // Parries break Structure (v0.43.0): `base` points plus `share` of the foe's whole Structure, and each parry in a
  // row (within `chainSecs` of the last, no hit taken between) adds `chain` more, up to `chainMost` steps.
  parryPosture: { perfect: 3, plain: 2, share: { perfect: 0.15, plain: 0.07 }, chain: 0.35, chainMost: 3, chainSecs: 3 },
  blocked: 0.2, crushed: 0.6,
  // Rally: health a blow took that hitting back wins back. Shares of the damage that turn grey (`hit` clean,
  // `block` blocked, `crushed` through a broken guard); `window` seconds it holds, then it drains (`fade` of the
  // grey a second, at least `floor` of max health). Won back: `light`/`smash` of max health per blow that lands,
  // `parry`/`perfect` of the grey pool, an Execute all of it.
  rally: { hit: 0.5, block: 1, crushed: 0.7, window: 2.5, fade: 0.8, floor: 0.05, light: 0.04, smash: 0.1, parry: 0.5, perfect: 1 },
  // Spirit: five pips.
  spirit: { pips: 5, hit: 0.12, smash: 0.25, parry: 0.5, perfect: 1, execute: 1, drain: 0.08, rest: 8 },
  cost: { vanish: 1, breakout: 2 },
  vanish: { window: 0.18, combo: 0.7, most: 2, behind: 3 },
  breakout: { reach: 8, power: 0.6, safe: 0.5 },
  // Feel: hit-stop and slow motion, in seconds.
  stop: { light: 0.04, smash: 0.08, execute: 0.18, perfect: 0.14 },
  slow: { last: 0.7, execute: 0.4, vanish: 0.25 },
  impact: 0.06,         // seconds of an anime impact frame
  // Fighting practice: a little for each blow that lands (anything a wave reaches counts), more for
  // a kill, by role, a little more for evolved forms. See LEVEL_PACE in skills.js for the body.
  xp: { hit: 0.3, kill: { fodder: 1.5, fighter: 2.5, brute: 4, machine: 2, ruler: 25, watcher: 12 }, tier: 0.25 },
  // Wrath fills from fighting, 0..1 (ultimate.js). `hurt` is per share of the hero's health lost.
  wrath: { hit: 0.008, smash: 0.015, execute: 0.06, perfect: 0.04, parry: 0.02, vanish: 0.02, kill: 0.025, hurt: 0.6 },
  // Surge: seconds; Spirit a second; blows this much harder; powers cool this much faster; a sixth hit.
  surge: { secs: 12, spirit: 0.25, power: 1.2, cool: 1.5, hit: 1.9, hitTime: 1.3 },
  // The Titan's Grounded: on natural ground, blows and powers this much stronger; Perfect parries this much longer.
  grounded: { power: 1.2, parry: 0.04 },
  // Spirit Arts (spiritArts.js): a shot and a held beam, in blows and Spirit pips.
  arts: {
    shot: { power: 0.5, cost: 1 / 3, every: 0.18, speed: 70, range: 45 },
    wave: { cost: 2, charge: 0.45, secs: 1.4, least: 0.4, tick: 0.1, power: 0.25, reach: 40, width: 2.2 },
  },
};

export const ROLE_POSTURE = (role) => COMBAT.posture[role] ?? COMBAT.posture.fighter;

// Structure a parry takes off a foe whose whole Structure is `most`; `n` is its place in a row of parries (1 = first).
export function parryWear(perfect, most, n = 1) {
  const pp = COMBAT.parryPosture, kind = perfect ? 'perfect' : 'plain';
  return (pp[kind] + pp.share[kind] * most) * (1 + pp.chain * Math.min(Math.max(0, n - 1), pp.chainMost));
}

// Which smash Triangle throws after `hits` light hits, in the air or not.
export function smashFor(hits, air) {
  if (air) return 'spike';
  return COMBAT.order[Math.min(hits, COMBAT.order.length - 1)];
}

// Spirit is kept as a number of pips, fractions included.
export const clampSpirit = (v) => Math.max(0, Math.min(COMBAT.spirit.pips, v));
