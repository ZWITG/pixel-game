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
  broken: { foe: 1.9, hero: 1.2 },
  hero: { block: 0.12, heavy: 0.5, parry: -0.15, perfect: -0.3, vanish: -0.25, dodge: -0.08, back: 0.1, rest: 1.5 },
  // Defence windows, seconds after the guard goes up.
  parry: { perfect: 0.12, plain: 0.22 },
  counter: { perfect: 2, plain: 1.5, secs: 1.8 },
  parried: { perfect: 1.6, plain: 1 },    // seconds a parried foe is dazed
  parryPosture: { perfect: 3, plain: 2 },
  blocked: 0.2, crushed: 0.6,
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

// Which smash Triangle throws after `hits` light hits, in the air or not.
export function smashFor(hits, air) {
  if (air) return 'spike';
  return COMBAT.order[Math.min(hits, COMBAT.order.length - 1)];
}

// Spirit is kept as a number of pips, fractions included.
export const clampSpirit = (v) => Math.max(0, Math.min(COMBAT.spirit.pips, v));
