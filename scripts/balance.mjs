// Balance check for the fighting core: `node scripts/balance.mjs`. Works in units of one hero
// blow (Melee.force) against foes of the hero's own level, the way ROLES is defined, and fails
// (exit code 1) if anything lands outside its target. Run it before committing combat changes.
import { COMBAT, smashFor } from '../src/open/combat.js';
import { ROLES, tierFor } from '../src/open/evolve.js';
import { SKILLS, paceAt } from '../src/open/skills.js';

const BLOW = 1.3;                  // evolve.js: a foe's health is role.hits of these
const PUNCH = 0.34;                // body.punchTime at Strength 10
const sum = (a) => a.reduce((s, v) => s + v, 0);
const smash = (name) => COMBAT.smash[name];
const time = (name) => smash(name).time;
let failed = 0;
const check = (ok, text) => {
  if (!ok) failed++;
  console.log(`${ok ? '  ok ' : ' FAIL'} ${text}`);
};

// Strings a player might throw: damage, Structure worn, seconds, Spirit gained.
const lights = (n) => ({ dmg: sum(COMBAT.chain.slice(0, n)), posture: n, secs: PUNCH * sum(COMBAT.chainTime.slice(0, n)), spirit: n * COMBAT.spirit.hit });
const withSmash = (n, air = false) => {
  const l = lights(n), s = smash(smashFor(n, air));
  return { dmg: l.dmg + s.power, posture: l.posture + s.posture, secs: l.secs + s.time, spirit: l.spirit + COMBAT.spirit.smash };
};
const air = { dmg: sum(COMBAT.airChain) + smash('spike').power, posture: COMBAT.airChain.length + smash('spike').posture, secs: PUNCH * 0.8 * COMBAT.airChain.length + time('spike'), spirit: COMBAT.airChain.length * COMBAT.spirit.hit + COMBAT.spirit.smash };
const launch = withSmash(1);
const STRINGS = {
  'Five lights': lights(5),
  'Two lights + Sweep': withSmash(2),
  'Three lights + Wall Driver': withSmash(3),
  'Light, Launcher, air chain, Spike': { dmg: launch.dmg + air.dmg, posture: launch.posture + air.posture, secs: launch.secs + air.secs + 0.2, spirit: launch.spirit + air.spirit },
  'Breaker alone': withSmash(0),
  'Five lights + Finisher': withSmash(5),
};
console.log('\nStrings (in hero blows)');
console.log('  string                              damage  structure  seconds  dps   spirit');
for (const [name, s] of Object.entries(STRINGS)) {
  console.log(`  ${name.padEnd(36)}${s.dmg.toFixed(1).padStart(6)}${s.posture.toFixed(1).padStart(10)}${s.secs.toFixed(2).padStart(9)}${(s.dmg / s.secs).toFixed(1).padStart(6)}${s.spirit.toFixed(2).padStart(8)}`);
}

// Smashes shouldn't dwarf the chain they come out of.
const lightDps = sum(COMBAT.chain) / (PUNCH * sum(COMBAT.chainTime));
console.log(`\nSmashes against the light chain (${lightDps.toFixed(2)} a second)`);
for (const [name, s] of Object.entries(COMBAT.smash)) {
  const ratio = s.power / s.time / lightDps;
  check(ratio <= 1.75, `${s.name.padEnd(12)} ${(s.power / s.time).toFixed(2)} a second, ${ratio.toFixed(2)}x`);
}

// Each role against the five-light string, with Breaks and Executes.
console.log('\nRoles');
const A = STRINGS['Five lights'], light = A.dmg / 5;
for (const [role, r] of Object.entries(ROLES)) {
  const hp = r.hits * BLOW, posture = COMBAT.posture[role];
  const toBreak = Math.ceil(posture);          // light hits
  const share = (toBreak * light) / hp;        // health gone when it breaks
  const strings = hp / A.dmg;
  console.log(`  ${role.padEnd(8)} health ${hp.toFixed(1).padStart(6)}  structure ${String(posture).padStart(3)}  breaks after ${String(toBreak).padStart(2)} hits (${Math.round(share * 100)}% health)  ${strings.toFixed(1)} strings`);
  if (role === 'fodder') check(A.dmg >= hp, 'fodder falls to one five-hit string');
  if (role === 'fighter') check(A.dmg + smash('execute').power >= hp * 0.95, 'a fighter falls to one string and an Execute');
  if (role === 'brute' || role === 'ruler' || role === 'fighter') check(share < 0.85, `${role} breaks before it falls`);
  if (role === 'ruler') check(strings > 10, 'a ruler takes more than ten strings');
}

// Spirit: what a fight pays, and what defence costs.
console.log('\nSpirit');
const perString = A.spirit;
check(COMBAT.cost.vanish / perString >= 1 && COMBAT.cost.vanish / perString <= 3, `a Vanish costs ${(COMBAT.cost.vanish / perString).toFixed(1)} strings of hits`);
check(COMBAT.spirit.perfect >= COMBAT.cost.vanish, 'a Perfect parry pays for a Vanish');
check(COMBAT.cost.breakout <= COMBAT.spirit.pips / 2, 'a Breakout costs at most half the bar');

// Levelling: how many fighter kills one level takes, now and with the old rules (v0.31.0).
console.log('\nLevelling (fighter kills per hero level, about 7 blows a kill)');
const BLOWS = 7, trains = (id, name) => SKILLS[id].trains[name] ?? 0;
const perKill = (level, old) => {
  const tier = tierFor(level), punching = BLOWS, fighting = old ? BLOWS + 3 * (1 + tier) : BLOWS * COMBAT.xp.hit + COMBAT.xp.kill.fighter * (1 + tier * COMBAT.xp.tier);
  const pace = old ? 1 : paceAt(level), d = (name) => (punching * trains('punching', name) + fighting * trains('fighting', name)) * pace;
  const build = d('strength') * 1.5 + d('endurance') * 1.2 + fighting * pace * 0.3;
  return build / 18 + d('speed') / 10;
};
console.log('  level   kills now   kills before');
const kills = {};
for (const level of [1, 5, 10, 20, 40, 80, 128]) {
  kills[level] = 1 / perKill(level, false);
  console.log(`  ${String(level).padStart(5)}${kills[level].toFixed(1).padStart(12)}${(1 / perKill(level, true)).toFixed(1).padStart(15)}`);
}
check(kills[1] >= 4 && kills[1] <= 12, 'the first levels take a handful of fights');
check(kills[20] >= 25, 'by level 20 a level takes dozens of kills');
check(kills[80] >= 80, 'by level 80 a level takes a long campaign');

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
