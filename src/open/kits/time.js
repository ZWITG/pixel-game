import * as THREE from 'three';
import { near, ground, time, world, blow, hit, raze, slow, dilate, terror, nearestPlace, cone, shake, burst } from './common.js';

// The Chronarch's kit (v0.54.0): time as something you hold, turn back and spend.
//   Hourglass (set.glass, 0..100): fills with every blow and power. Half of it buys Borrowed Time:
//   a blow that would kill you turns time back three seconds instead (spare hook), once in a while.
//   Dilated: every blow slows its target's steps and stretches whatever it is doing (e.dilatedUntil).
//   The Still Hour holds blows on frozen foes (e.heldHarm) and lets them all land at once.
//   Its powers age the world: trees rot and fall, walls crumble, a town grows old (Epoch).
// Hooks: blow, landed, power, spare, tick, meter, finisher.
const TEAL = '#7af0d0', BRASS = '#e8c86a', PALE = '#f4ffe0', GREY = '#9a9a8a';
const GLASS = 100, PER_BLOW = 4, PER_POWER = 6, TURN_COST = 50, TURN_BACK = 3, TURN_WAIT = 45;
const DILATE_SECS = 1.6, DILATE_STEP = 0.6, DILATE_ACT = 0.45;   // how long, how slow they walk, how much their acts stretch
const FRAIL = 1.3;           // a withered foe takes this much more from your blows
const HELD = 0.6, HELD_BACK = 1.5;   // of a blow on a Still foe: what lands now, and how much harder the held part comes back
const KEEP = 4, NOTE_EVERY = 0.1;    // seconds of the hero's past remembered, and how often

const glass = (set) => set.glass ?? 0;
function fill(set, amount) {
  set.glass = Math.min(GLASS, glass(set) + amount);
}

// Where the hero was `secs` ago.
function past(set, secs) {
  const want = time(set) - secs, list = set.past ?? [];
  return list.find((r) => r.t >= want) ?? list[0] ?? null;
}

// A trail of light between two places, as time folds.
function fold(set, a, b) {
  const v = world(set).vfx, y0 = ground(set, a.x, a.z) + 1.4, y1 = ground(set, b.x, b.z) + 1.4;
  v.beam(new THREE.Vector3(a.x, y0, a.z), new THREE.Vector3(b.x, y1, b.z), 0.35, TEAL, 0.45);
  for (let k = 0; k <= 6; k++) set.fx.glow(a.x + (b.x - a.x) * (k / 6), y0 + (y1 - y0) * (k / 6), a.z + (b.z - a.z) * (k / 6), 1.6, k % 2 ? TEAL : PALE, 0.5, 0.8);
}

// The hero stepping back through time to a remembered moment.
function turnBack(set, rec) {
  const p = set.player, s = p.state, from = { x: s.x, z: s.z };
  s.x = rec.x;
  s.z = rec.z;
  if (Math.hypot(from.x - rec.x, from.z - rec.z) > 20) world(set).chunks?.settle?.();
  p.guard = Math.max(p.guard ?? 0, 0.5);
  fold(set, from, rec);
  world(set).vfx.tint(TEAL, 0.35, 0.6, 0.6);
  return from;
}

export const TIME = {
  // Still Hour: everything near stops. Blows on the stopped are held and land together when it ends.
  stop(set, job) {
    const p = set.player, s = p.state, { def, rank } = job, t = time(set), r = def.reach + rank * 2, secs = def.secs + rank * 0.3;
    const caught = near(set, s.x, s.z, r);
    for (const e of caught) {
      e.frozenUntil = t + secs;
      e.heldHarm = 0;
    }
    const v = world(set).vfx, dome = v.dome(s.x, ground(set, s.x, s.z), s.z, TEAL);
    v.tint('#cfe8e0', 0.5, secs, 0.9);
    v.shock(s.x, ground(set, s.x, s.z), s.z, r, PALE, 0.6);
    p.hud.float('Still Hour', s.x, s.y + 3.6, s.z, TEAL);
    const at = { x: s.x, z: s.z };
    let k = 0;
    set.still = { until: t + secs };
    set.kit.push({
      update(dt) {
        k += dt;
        v.shape(dome, r * Math.min(1, k / 0.3), k < secs - 0.3 ? 0.22 : Math.max(0, (secs - k) / 0.3) * 0.22);
        // Arrows and stones hang in the air too.
        for (const o of p.melee.monsters.orbs ?? []) if (Math.hypot(o.orb.position.x - at.x, o.orb.position.z - at.z) < r) { o.life += dt; o.held = true; }
        if (k < secs) return true;
        v.shape(dome, 0, 0);
        set.still = null;
        for (const e of caught) {
          if (e.dying) continue;
          e.frozenUntil = 0;
          if (e.heldHarm > 0) {
            hit(set, 'stop', e, e.heldHarm * HELD_BACK, 'launch');
            set.fx.impact('time', e.x, ground(set, e.x, e.z), e.z, 3);
          }
          e.heldHarm = 0;
          e.dilatedUntil = time(set) + 3;
        }
        v.shock(at.x, ground(set, at.x, at.z), at.z, r, TEAL, 0.5);
        shake(set, 0.3);
        return false;
      },
    });
  },

  // Rewind: back to three seconds ago, with the health of then. The place you left goes off.
  rewind(set, job) {
    const p = set.player, { def, rank } = job, rec = past(set, def.back);
    if (!rec) return;
    const from = turnBack(set, rec);
    if (rec.hp > p.hp) set.heal(rec.hp - p.hp);
    blow(set, job, from.x, from.z, job.force, def.blast + rank * 0.4, 'knockdown');
    set.fx.impact('time', from.x, ground(set, from.x, from.z), from.z, def.blast);
    p.nature.deed('chronomancy');
  },

  // Wither Years: a cone where a century passes.
  wither(set, job, aim) {
    const p = set.player, s = p.state, { def, rank, force } = job, t = time(set), reach = def.reach + rank;
    for (const e of cone(set, s.x, s.z, aim.dx, aim.dz, reach, def.cone)) {
      hit(set, job.pid, e, force);
      e.frailUntil = t + def.frail + rank;
      e.dilatedUntil = t + 3;
      slow(e, 0.5, 3, t);
      burst(set, e.x, e.z, [GREY, BRASS], 8, 4, 2);
    }
    // The land ages: trees rot and fall, walls and houses crumble, the ground turns to dust.
    for (let d = 4; d <= reach; d += 4) {
      const w = (d / reach) * reach * 0.5;
      for (const side of [-1, 0, 1]) {
        const x = s.x + aim.dx * d - aim.dz * side * w * 0.6, z = s.z + aim.dz * d + aim.dx * side * w * 0.6;
        raze(set, x, z, 3.5, force * 2.5);
        set.scar(job, x, z, 4);
        set.fx.after(d * 0.02, () => {
          set.fx.glow(x, ground(set, x, z) + 1, z, 3, side ? GREY : TEAL, 0.6, 1.6);
          world(set).smoke?.dust(x, ground(set, x, z) + 0.4, z, '#8a8270', 1, 3);
        });
      }
    }
    p.nature.deed('chronomancy');
  },

  // Echo Self: a heartbeat after each blow, an echo of you lands it again.
  echo(set, job) {
    const { def, rank } = job, s = set.player.state;
    set.echoUntil = time(set) + def.secs + rank;
    set.echoShare = def.share + rank * 0.05;
    set.fx.impact('time', s.x, ground(set, s.x, s.z), s.z, 2.5);
    set.player.hud.float('Echo', s.x, s.y + 3.4, s.z, TEAL);
  },

  // Quickened: your time runs fast, theirs slow.
  quicken(set, job) {
    set.buff(job);
    set.quickUntil = time(set) + job.def.secs * (1 + job.rank * 0.1);
    world(set).vfx.tint(TEAL, 0.2, job.def.secs, 0.35);
  },

  // Time Loop: a foe is dragged back to where it stood and suffers it all again.
  loop(set, job, aim) {
    const p = set.player, e = aim.target, { def, rank } = job;
    if (!e) return p.hud.message('Time Loop needs a target.');
    const from = { x: e.x, z: e.z, hp: e.hp };
    let k = 0, ring = 0;
    p.hud.float('Looped', e.x, e.group.position.y + 4, e.z, TEAL);
    set.kit.push({
      update(dt) {
        if (e.dying) return false;
        k += dt;
        if ((ring -= dt) <= 0) {
          ring = 0.5;
          p.melee.ring(from.x, ground(set, from.x, from.z), from.z, 2.5, TEAL);
          set.fx.glow(e.x, e.group.position.y + 2.5, e.z, 2, TEAL, 0.4, 1);
        }
        if (k < def.secs) return true;
        const lost = Math.max(0, from.hp - e.hp), was = { x: e.x, z: e.z };
        e.group.position.x = from.x;
        e.group.position.z = from.z;
        fold(set, was, from);
        hit(set, job.pid, e, lost * (1 + rank * 0.1) + job.force, 'knockdown');
        set.fx.impact('time', from.x, ground(set, from.x, from.z), from.z, 3);
        return false;
      },
    });
  },

  // Epoch: the sky turns, and the nearest town ages a generation.
  epoch(set, job) {
    const p = set.player, s = p.state, w = world(set), place = nearestPlace(set, s.x, s.z, job.def.reach);
    const night = (w.clock ?? 0.3) > 0.8 || (w.clock ?? 0.3) < 0.22;
    w.setTime?.(night ? 'morning' : 'night');
    w.vfx.tint(TEAL, 0.6, 2.5, 0.7);
    w.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 60, TEAL, 1.4);
    shake(set, 0.4);
    if (!place) return p.hud.herald?.('Epoch', night ? 'Night becomes day' : 'Day becomes night', TEAL);
    place.pop = Math.max(2, place.pop * 0.72);
    place.prosperity = Math.max(0.05, (place.prosperity ?? 0.6) * 0.7);
    for (let i = 0; i < 2; i++) w.realm?.houseLost(place.id);
    w.realm?.say(`${place.name} has aged a generation in a moment. Its old die, its walls crack.`, TEAL);
    // Near enough to see it: the town crumbles before your eyes.
    if (Math.hypot(place.x - s.x, place.z - s.z) < 220) {
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * 6.283, d = Math.random() * 34, x = place.x + Math.cos(a) * d, z = place.z + Math.sin(a) * d;
        set.fx.after(0.2 + i * 0.15, () => {
          raze(set, x, z, 6, p.body.might * 5);
          w.smoke?.dust(x, ground(set, x, z) + 1, z, '#8a8270', 2, 6);
        });
      }
    }
    terror(set, place.x, place.z, 60, 40);
    p.hud.herald?.('Epoch', `${place.name} grows old`, TEAL);
    p.nature.deed('chronomancy', 3);
  },

  // Entropy: a sphere where a thousand years pass every second.
  entropy(set, job, aim) {
    const p = set.player, { def, rank, force } = job, x = aim.x, z = aim.z, r = def.reach + rank * 0.6, secs = def.secs + rank * 0.4, v = world(set).vfx;
    const dome = v.dome(x, ground(set, x, z), z, BRASS);
    let k = 0, beat = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        v.shape(dome, r * Math.min(1, k / 0.4), 0.28);
        for (const e of near(set, x, z, r)) {
          e.dilatedUntil = time(set) + 0.5;
          slow(e, 0.3, 0.5, time(set));
        }
        if ((beat -= dt) <= 0) {
          beat = 0.5;
          for (const e of near(set, x, z, r)) hit(set, job.pid, e, force);
          raze(set, x, z, r, force * 3);
          set.scar(job, x, z, r);
          v.shock(x, ground(set, x, z), z, r, TEAL, 0.5);
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * 6.283, d = Math.random() * r;
            set.fx.glow(x + Math.cos(a) * d, ground(set, x, z) + Math.random() * r, z + Math.sin(a) * d, 1.2, Math.random() < 0.5 ? GREY : PALE, 0.6, 0.5);
          }
        }
        if (k < secs) return true;
        v.shape(dome, 0, 0);
        if (!p.rooms.house) p.melee.tear(x, z, r * 0.5, 3);
        return false;
      },
    });
  },

  // ---- hooks ----
  blow(set, e) {
    const p = set.player, t = time(set);
    e.dilatedUntil = t + DILATE_SECS;
    slow(e, DILATE_STEP, DILATE_SECS, t);
    let k = e.frailUntil > t ? FRAIL : 1;
    // A blow on a Still foe: some now, the rest held for when time moves again.
    if (set.still && e.frozenUntil > t) {
      e.heldHarm = (e.heldHarm ?? 0) + p.body.might * 1.3 * (1 - HELD);
      set.fx.glow(e.x, e.group.position.y + 2, e.z, 1.4, TEAL, 0.5, 1);
      k *= HELD;
    }
    if (set.echoUntil > t) {
      const share = set.echoShare;
      set.fx.after(0.35, () => {
        if (e.dying) return;
        hit(set, 'echo', e, p.body.might * 1.3 * share);
        set.fx.glow(e.x, e.group.position.y + 2, e.z, 2.6, TEAL, 0.35, 1.6);
      });
    }
    return k;
  },

  landed(set) {
    fill(set, PER_BLOW);
  },

  power(set) {
    fill(set, PER_POWER);
    return 1;
  },

  // Borrowed Time: a killing blow, turned back.
  spare(set) {
    const p = set.player, t = time(set), rec = past(set, TURN_BACK);
    if (glass(set) < TURN_COST || t < (set.turnReady ?? 0) || !rec) return false;
    set.glass = glass(set) - TURN_COST;
    set.turnReady = t + TURN_WAIT;
    turnBack(set, rec);
    p.hp = Math.max(rec.hp, p.body.maxHealth * 0.35);
    p.hud.setHealth(p.hp / p.body.maxHealth);
    p.hud.herald?.('Borrowed Time', 'Three seconds, returned', TEAL);
    set.past = [];
    return true;
  },

  tick(set, dt) {
    const p = set.player, s = p.state, t = time(set);
    // The past, noted ten times a second.
    if ((set.noteIn = (set.noteIn ?? 0) - dt) <= 0) {
      set.noteIn = NOTE_EVERY;
      (set.past ??= []).push({ t, x: s.x, z: s.z, hp: p.hp });
      while (set.past.length && set.past[0].t < t - KEEP) set.past.shift();
    }
    const quick = set.quickUntil > t;
    for (const e of near(set, s.x, s.z, 50)) {
      if (e.dilatedUntil > t) dilate(e, dt, DILATE_ACT);
      if (quick && Math.hypot(e.x - s.x, e.z - s.z) < 40) {
        dilate(e, dt, 0.6);
        slow(e, 0.45, 0.2, t);
      }
    }
    if (quick && Math.random() < 0.5) set.fx.glow(s.x + (Math.random() - 0.5) * 2, s.y + Math.random() * 2.5, s.z + (Math.random() - 0.5) * 2, 0.6, TEAL, 0.4, 0.3);
  },

  meter(set) {
    const ready = glass(set) >= TURN_COST && time(set) >= (set.turnReady ?? 0);
    return { value: glass(set) / GLASS, color: ready ? PALE : TEAL, hot: ready, marks: [TURN_COST / GLASS], label: ready ? 'Borrowed Time ready' : `Hourglass ${Math.round(glass(set))}` };
  },

  // The chain's Finisher: the Clock Stop. It hangs in the air a moment, then all of it lands.
  finisher(melee, e) {
    const set = melee.player.powers, t = melee.monsters.time;
    e.frozenUntil = t + 0.5;
    set.fx.after(0.5, () => {
      if (e.dying) return;
      hit(set, 'stop', e, melee.player.body.might * 2, 'launch');
      set.fx.impact('time', e.x, ground(set, e.x, e.z), e.z, 3);
    });
    return 'knockdown';
  },
};
