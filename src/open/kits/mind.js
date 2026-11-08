import * as THREE from 'three';
import { stagger } from '../foes.js';
import { NATIONS, nationAt } from '../nations.js';
import { near, ground, time, world, hit, cone, terror, nearestPlace, shake } from './common.js';

// The Sovereign's kit (v0.54.0): conquest by will. Foes are turned on each other, towns are taken
// without a siege, nations are set at each other's throats.
//   Turned (e.turnedUntil): monsters.update asks `lure`, which points a turned foe at another foe;
//   foes.strike lands its blows on that foe (twice as hard). The foe it attacks fights back.
//   Kneel (e.kneelUntil): badly hurt foes near the Sovereign may Kneel; a kneeling foe takes double.
//   Dazed (e.dazedUntil): from the Psychic Lance; part of what the Dominion discipline feeds on.
// Hooks: lure, blow, afflicted, tick, meter, finisher.
const PINK = '#ff4ad0', GOLD = '#f0d488', PALE = '#ffd8f4';
const KNEEL_REACH = 9, KNEEL_UNDER = 0.3, KNEEL_ODDS = 0.3, KNEEL_SECS = 3, KNEELING = 2;
const RETARGET = 3;          // seconds a turned foe keeps the same target

const turned = (set, e) => e.turnedUntil > time(set) && !e.dying;

function turn(set, e, secs) {
  if (e.boss || e.watch || e.dying) return false;
  e.turnedUntil = time(set) + secs * (1 + set.player.nature.depth);
  e.turnFoe = null;
  e.fleeUntil = 0;
  set.player.nature.deed('dominion');
  world(set).vfx.burst(e.x, e.group.position.y + 3, e.z, [PINK, PALE], 14, 5, { up: 1.4 });
  return true;
}

// A ring of light at a foe's crown, so you can see whose side it's on.
function crown(set, e) {
  set.fx.glow(e.x, e.group.position.y + e.radius * 2 + 2.2, e.z, 1.3, PINK, 0.45, 0.9);
}

export const MIND = {
  // Psychic Lance: the shared piercing bolt; what it touches is Dazed (afflicted).
  psylance(set, job, aim) {
    set.bolt(job, aim);
  },

  enthrall(set, job, aim) {
    const p = set.player, e = aim.target, { def, rank } = job;
    if (!e) return p.hud.message('Enthrall needs a target.');
    if (!turn(set, e, def.secs + rank * 2)) return p.hud.message('Its will is too strong.');
    p.hud.float('Yours', e.x, e.group.position.y + 4, e.z, PINK);
    world(set).vfx.beam(new THREE.Vector3(p.state.x, p.state.y + 2, p.state.z), new THREE.Vector3(e.x, e.group.position.y + 2, e.z), 0.25, PINK, 0.4);
  },

  // Telekinesis: everything in front of you, lifted and hurled.
  kinesis(set, job, aim) {
    const p = set.player, s = p.state, { def, rank, force } = job, reach = def.reach + rank;
    for (const e of cone(set, s.x, s.z, aim.dx, aim.dz, reach, 0.35)) {
      hit(set, job.pid, e, force, 'launch');
      if (!e.boss && !e.watch) e.vel.set(aim.dx, aim.dz).multiplyScalar(16);
    }
    // Loose stones and trees go with them.
    p.world.work.actor = p;
    const x = s.x + aim.dx * reach * 0.5, z = s.z + aim.dz * reach * 0.5;
    p.melee.waves.push({ queue: p.world.work.chunks.near(x, z, reach * 0.5).map((o) => ({ o, at: 0.05, force: force * 1.5 })), x, z, reach: reach * 0.5, t: 0, drops: {}, broke: false });
    world(set).vfx.shock(x, ground(set, x, z), z, reach * 0.6, PINK, 0.4);
    for (let i = 0; i < 10; i++) set.fx.glow(s.x + aim.dx * i * reach * 0.1, s.y + 1.5, s.z + aim.dz * i * reach * 0.1, 1.2 + i * 0.2, i % 2 ? PINK : PALE, 0.3, 1.4);
  },

  // Dread Word: every foe that hears it drops its weapon and runs; folk flee too.
  dread(set, job) {
    const p = set.player, s = p.state, { def, rank } = job, t = time(set), reach = def.reach + rank * 1.5, secs = def.secs + rank * 0.5;
    for (const e of near(set, s.x, s.z, reach)) {
      if (e.boss || e.watch) continue;
      e.fleeUntil = t + secs;
      e.disarmedUntil = t + secs + 4;
      p.hud.float('Flees!', e.x, e.group.position.y + 3, e.z, PINK);
    }
    terror(set, s.x, s.z, reach * 2, secs * 3);
    world(set).vfx.shock(s.x, ground(set, s.x, s.z), s.z, reach, PINK, 0.7);
    world(set).vfx.tint(PINK, 0.2, 0.8, 0.3);
    p.nature.deed('dominion');
  },

  // Mind Crush: one mind, broken.
  crush(set, job, aim) {
    const p = set.player, e = aim.target, { force } = job, t = time(set);
    if (!e) return p.hud.message('Mind Crush needs a target.');
    const weak = e.hp < e.maxHp * 0.5;
    hit(set, job.pid, e, force, weak ? 'knockdown' : null);
    if (weak && !e.dying) {
      e.brokenUntil = t + 3;
      stagger(e, 2.5, t, true);
      p.hud.float('Broken!', e.x, e.group.position.y + 4, e.z, PINK);
    }
    set.fx.impact('mind', e.x, e.group.position.y, e.z, 2.5);
  },

  // Discord: they turn on each other.
  discord(set, job) {
    const p = set.player, s = p.state, { def, rank } = job, reach = def.reach + rank;
    let n = 0;
    for (const e of near(set, s.x, s.z, reach)) if (turn(set, e, def.secs + rank)) n++;
    world(set).vfx.shock(s.x, ground(set, s.x, s.z), s.z, reach, PINK, 0.9);
    p.hud.float(`Discord ×${n}`, s.x, s.y + 3.6, s.z, PINK);
  },

  // Usurp: a town's crown, taken by will.
  usurp(set, job) {
    const p = set.player, s = p.state, w = world(set), place = nearestPlace(set, s.x, s.z, job.def.reach);
    if (!place) return p.hud.message('No town near enough to take.');
    if (place.owner === 'hero') return p.hud.message(`${place.name} is already yours.`);
    const was = place.owner, nation = NATIONS.find((n) => n.id === was);
    place.owner = 'hero';
    w.towns?.colors(place);
    const force = w.realm?.of(was);
    if (force) force.troops = Math.max(0, force.troops - place.pop * 0.05);
    w.realm?.say(`${place.name} kneels to you${nation ? `, turning from ${nation.name}` : ''}. Its soldiers go home; its taxes are yours.`, PINK);
    w.omega?.deed?.('house');
    p.hud.herald?.('Usurp', `${place.name} is yours`, PINK);
    w.vfx.tint(GOLD, 0.3, 1.5, 0.2);
    p.nature.deed('dominion', 4);
  },

  // Sow War: the nation you stand in marches on its neighbour.
  sowwar(set) {
    const p = set.player, s = p.state, w = world(set), here = nationAt(s.x, s.z) ?? NATIONS.find((n) => n.id === nearestPlace(set, s.x, s.z)?.owner);
    if (!here || w.nations?.isFallen?.(here)) return p.hud.message('No living nation here to turn.');
    const force = w.realm?.of(here.id);
    if (force) force.grudge = (force.grudge ?? 0) + 1;
    const target = w.realm?.weakestNeighbor(here.id), other = target ? NATIONS.find((n) => n.id === target.owner) : null;
    w.realm?.war(here.id);
    // And the one it marches on answers in kind.
    if (other && !w.nations?.isFallen?.(other)) w.realm?.war(other.id);
    w.realm?.say(`${here.name} marches to war${other ? ` against ${other.name}` : ''}. No one remembers who whispered it.`, PINK);
    p.hud.herald?.('Sow War', `${here.name}${other ? ` against ${other.name}` : ''}`, PINK);
    p.nature.deed('dominion', 6);
  },

  // ---- hooks ----
  // Turned foes hunt other foes; the foe being hunted turns to fight back.
  lure(set, e) {
    const t = time(set);
    if (turned(set, e)) {
      if (!e.turnFoe || e.turnFoe.dying || t > (e.turnAt ?? 0) || Math.hypot(e.turnFoe.x - e.x, e.turnFoe.z - e.z) > 24) {
        e.turnAt = t + RETARGET;
        // Its own former side first; under Discord, when everyone is turned, whoever is nearest.
        const others = near(set, e.x, e.z, 30).filter((o) => o !== e).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
        e.turnFoe = others.find((o) => !turned(set, o)) ?? others[0] ?? null;
        if (e.turnFoe) e.turnFoe.grudgeOn = e;
        crown(set, e);
      }
      return e.turnFoe ? { foe: e.turnFoe } : { lost: true };
    }
    if (e.grudgeOn && turned(set, e.grudgeOn) && Math.hypot(e.grudgeOn.x - e.x, e.grudgeOn.z - e.z) < 16) return { foe: e.grudgeOn };
    return null;
  },

  blow(set, e) {
    const t = time(set);
    if (e.kneelUntil > t) {
      e.kneelUntil = 0;
      e.frozenUntil = 0;
      return KNEELING;
    }
    return 1;
  },

  afflicted(set, e) {
    if (e.dying) return;
    e.dazedUntil = time(set) + 2;
  },

  tick(set, dt) {
    const p = set.player, s = p.state, t = time(set);
    if ((set.kneelIn = (set.kneelIn ?? 0) - dt) > 0) return;
    set.kneelIn = 1;
    let n = 0;
    for (const e of near(set, s.x, s.z, 60)) {
      if (turned(set, e)) {
        n++;
        crown(set, e);
        continue;
      }
      if (e.boss || e.watch || e.kneelUntil > t || e.hp > e.maxHp * KNEEL_UNDER || Math.hypot(e.x - s.x, e.z - s.z) > KNEEL_REACH) continue;
      if (Math.random() > KNEEL_ODDS) continue;
      e.kneelUntil = t + KNEEL_SECS;
      e.frozenUntil = t + KNEEL_SECS;
      p.hud.float('Kneels', e.x, e.group.position.y + 3, e.z, GOLD);
    }
    set.turned = n;
  },

  meter(set) {
    const n = set.turned ?? 0;
    return { value: Math.min(1, n / 6), color: PINK, hot: n >= 3, label: n ? `Turned ${n}` : 'Dominion' };
  },

  // The chain's Finisher: Subjugation. The weak it leaves alive are turned.
  finisher(melee, e) {
    const set = melee.player.powers;
    if (!e.boss && !e.watch && e.hp < e.maxHp * 0.6) set.fx.after(0.3, () => { if (!e.dying) turn(set, e, 10); });
    set.fx.impact('mind', e.x, e.group.position.y, e.z, 2);
    return 'knockdown';
  },
};
