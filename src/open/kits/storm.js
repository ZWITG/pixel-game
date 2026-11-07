import * as THREE from 'three';
import { stagger } from '../foes.js';

// The Stormcaller's kit (v0.34.0): lightning is speed first, and power in the build-up. Same shape as
// kits/titan.js: power kinds called as kind(set, job, aim), lasting effects on `set.kit`, and hooks:
//   afflicted(set, e)    a storm power touched a foe: it's Charged; a Charged foe struck again
//                        throws lightning to every other Charged foe near it
//   autoVanish(set)      Living Current: the hero blinks out of a blow that would land
//   tick(set, dt)        the clouds overhead, sparks on Charged foes, Thunderstep's chain
//   finisher(melee, e)   Flashpoint: struck from four sides at once
// Stormclouds (Gather Storm) hang over an area: under them sky powers strike at once and harder.
const CHARGE_SECS = 6, ARC_REACH = 30, ARC_SHARE = 0.5;
const STEP_CHAIN = 3, STEP_WINDOW = 1.2;
const CLOUD_Y = 42, CLOUD_PUFFS = 26, CLOUD_BOOST = 1.35;
const YELLOW = '#fff48a', WHITE = '#ffffff', BLUE = '#a8c8ff';
const v = new THREE.Vector3(), w = new THREE.Vector3();

const near = (set, x, z, r) => set.player.melee.monsters.within(x, z, r);
const ground = (set, x, z) => set.player.melee.height(x, z);
const time = (set) => set.player.melee.monsters.time;
const top = (e) => ({ x: e.x, y: e.group.position.y + 1.6, z: e.z });

export function underClouds(set, x, z) {
  const c = set.clouds;
  return !!c && c.until > time(set) && Math.hypot(x - c.x, z - c.z) < c.r;
}

// A blow of lightning on one foe, through the shared path (so it Charges and arcs too).
function zap(set, pid, e, force) {
  set.player.world.work.actor = set.player;
  set.harm(pid, e, force);
  set.afflict(pid, e, { status: 'shock' }, 0);
}

// Everything within `half` tiles of the line from (x, z) along (dx, dz) for `len` tiles.
function along(set, x, z, dx, dz, len, half) {
  return near(set, x + dx * len * 0.5, z + dz * len * 0.5, len * 0.5 + half).filter((e) => {
    const a = (e.x - x) * dx + (e.z - z) * dz, off = Math.abs((e.x - x) * dz - (e.z - z) * dx);
    return a > -1 && a < len && off < half + e.radius;
  });
}

export const STORM = {
  afflicted(set, e) {
    const t = time(set);
    if (set.discharging || e.dying) return;
    if (e.chargedUntil > t) {
      // Struck while Charged: the lightning in it leaps to every other Charged foe near.
      set.discharging = true;
      const force = set.player.body.might * ARC_SHARE * (1 + set.mastery * 0.02);
      for (const o of near(set, e.x, e.z, ARC_REACH)) {
        if (o === e || !(o.chargedUntil > t)) continue;
        set.fx.lightning(top(e), top(o), YELLOW, 0.2, 0.25);
        set.player.world.work.actor = set.player;
        set.player.melee.monsters.hit(o, force, e.x, e.z, 'flinch', 1);
        o.chargedUntil = 0;
      }
      set.discharging = false;
    }
    e.chargedUntil = t + CHARGE_SECS;
  },

  // Raise stormclouds over where you aim (or where you stand) for half a minute.
  gather(set, job, aim) {
    const { def, rank } = job, p = set.player, at = aim.target ? aim : p.state;
    set.clouds = { x: at.x, z: at.z, r: def.reach + rank * 3, until: time(set) + def.secs + rank * 3, puff: 0 };
    set.gathered = time(set);
    p.hud.message('The sky darkens.');
    set.fx.lightning({ x: at.x, y: ground(set, at.x, at.z) + CLOUD_Y, z: at.z }, { x: p.state.x, y: ground(set, p.state.x, p.state.z) + 2, z: p.state.z }, WHITE, 0.4, 0.3);
  },

  // Lightning on the target; under the clouds it falls at once, three times, and harder.
  thunder(set, job, aim) {
    const clouded = underClouds(set, aim.x, aim.z);
    const def = clouded ? { ...job.def, wait: 0.04, count: 3, scatter: 5 } : job.def;
    set.strike({ ...job, def, force: job.force * (clouded ? CLOUD_BOOST : 1) }, aim);
  },

  // A flash-step through everything on the way; up to three in a row before the wait.
  step(set, job, aim) {
    set.dash(job, aim);
    set.steps = (set.steps ?? 0) + 1;
    set.stepAt = time(set);
    if (set.steps < STEP_CHAIN) set.keepReady = job.pid;
    else set.steps = 0;
    const s = set.player.state;
    set.player.world.vfx.burst(s.x, s.y + 1.5, s.z, [YELLOW, WHITE], 16, 10);
    set.player.world.work.lines = Math.max(set.player.world.work.lines, 0.2);
  },

  // A javelin of lightning: it pins what it hits, then goes off.
  spear(set, job, aim) {
    const { def, rank, force } = job, p = set.player, s = p.state;
    const spear = { x: s.x, z: s.z, dx: aim.dx, dz: aim.dz, left: def.range, stuck: null, fuse: def.fuse, glow: set.fx.glow(s.x, 0, s.z, 1.6, YELLOW, 99, 1) };
    set.kit.push({
      update(dt) {
        const y = (spear.stuck ? spear.stuck.group.position.y + 1.5 : ground(set, spear.x, spear.z) + 1.7);
        if (!spear.stuck) {
          const step = def.speed * dt;
          spear.x += spear.dx * step;
          spear.z += spear.dz * step;
          spear.left -= step;
          set.fx.lightning({ x: spear.x, y, z: spear.z }, { x: spear.x - spear.dx * 6, y, z: spear.z - spear.dz * 6 }, YELLOW, 0.22, 0.08);
          const e = near(set, spear.x, spear.z, 1.4)[0];
          if (e) {
            spear.stuck = e;
            zap(set, job.pid, e, force * 0.4);
            if (!e.boss) stagger(e, def.fuse + 0.4, time(set), true);
            e.vel.set(0, 0);
          } else if (spear.left <= 0) spear.fuse = 0;
        } else {
          spear.x = spear.stuck.x;
          spear.z = spear.stuck.z;
          spear.fuse -= dt;
          if (Math.random() < 0.5) set.fx.zap({ x: spear.x, y: y + 1, z: spear.z }, { x: spear.x + (Math.random() - 0.5) * 3, y: y - 1, z: spear.z + (Math.random() - 0.5) * 3 }, YELLOW);
        }
        spear.glow.o.position.set(spear.x, y, spear.z);
        if (spear.fuse > 0) return true;
        // It goes off: everything near is thrown down, and Charged foes pass it on.
        p.world.work.actor = p;
        p.melee.blast(spear.x, spear.z, force, def.blast + rank * 0.4, 0, YELLOW, null, 'knockdown', true, 2);
        for (const e of near(set, spear.x, spear.z, def.blast)) set.afflict(job.pid, e, { status: 'shock' }, rank);
        set.fx.impact('storm', spear.x, ground(set, spear.x, spear.z), spear.z, def.blast);
        p.world.vfx.shock(spear.x, ground(set, spear.x, spear.z), spear.z, def.blast + 3, YELLOW, 0.35);
        spear.glow.age = spear.glow.life;
        spear.glow.o.visible = false;
        return false;
      },
    });
  },

  // Charge a straight beam, then fire it through everything in line.
  railgun(set, job, aim) {
    const { def, rank, force } = job, p = set.player;
    let t = 0, fired = false;
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        const s = p.state, a = set.aim();
        s.dir = [a.dx, a.dz];
        v.set(s.x + a.dx * 1.2, ground(set, s.x, s.z) + s.air + 1.6, s.z + a.dz * 1.2);
        set.casting = 0.2;
        if (t < def.charge) {
          set.pose = 'gather';
          p.world.vfx.burst(v.x + (Math.random() - 0.5) * 4, v.y + (Math.random() - 0.5) * 3, v.z + (Math.random() - 0.5) * 4, [YELLOW, WHITE], 1, 1, { fall: 0, life: 0.2 });
          set.fx.glow(v.x, v.y, v.z, 0.5 + t * 4, YELLOW, 0.08, 1);
          return true;
        }
        set.pose = 'punch';
        if (!fired) {
          fired = true;
          const len = def.range;
          w.set(v.x + a.dx * len, v.y, v.z + a.dz * len);
          p.world.vfx.beam(v, w, 0.9 + rank * 0.1, YELLOW, 0.3);
          const mult = underClouds(set, s.x, s.z) ? CLOUD_BOOST : 1;
          for (const e of along(set, v.x, v.z, a.dx, a.dz, len, 1.6)) zap(set, job.pid, e, force * mult);
          p.world.work.actor = p;
          p.melee.blast(w.x, w.z, force, 4, 1, YELLOW, null);
          p.world.work.shake = Math.max(p.world.work.shake, 0.3);
          p.world.work.shakeAt = s;
          p.world.work.impact = 0.04;
        }
        return t < def.charge + 0.3;
      },
    });
  },

  // The body turns to lightning: faster, and it blinks out of the first blow that would land.
  current(set, job) {
    set.buff(job);
    set.current = time(set) + job.def.secs * (1 + job.rank * 0.1);
  },

  autoVanish(set) {
    return set.current > time(set);
  },

  // A funnel of wind and lightning that lifts foes, spins them, and drops them.
  cyclone(set, job, aim) {
    const { def, rank } = job, p = set.player, x = aim.x, z = aim.z;
    const clouded = underClouds(set, x, z), r = (def.reach + rank * 0.5) * (clouded ? 1.3 : 1);
    let left = def.secs * (1 + rank * 0.1), beat = 0;
    const caught = new Set();
    set.kit.push({
      update(dt) {
        left -= dt;
        const g = ground(set, x, z);
        for (const e of near(set, x, z, r)) {
          caught.add(e);
          if (e.boss) continue;
          const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
          e.vel.set(-dz / d * 14 - dx / d * 4, dx / d * 14 - dz / d * 4);
          e.knockUntil = time(set) + 0.1;
          e.air = Math.max(e.air, Math.min(7, e.air + dt * 10));
          e.rise = 0;
          e.hang = time(set) + 0.1;
        }
        if ((beat -= dt) <= 0) {
          beat = 0.3;
          for (const e of caught) if (!e.dying && Math.hypot(e.x - x, e.z - z) < r + 2) zap(set, job.pid, e, p.body.might * def.dps * 0.3 * (clouded ? CLOUD_BOOST : 1));
          const a = Math.random() * 6.283;
          set.fx.lightning({ x: x + Math.cos(a) * r * 0.4, y: g + 14, z: z + Math.sin(a) * r * 0.4 }, { x: x + Math.cos(a + 1) * r * 0.7, y: g + 1, z: z + Math.sin(a + 1) * r * 0.7 }, YELLOW, 0.2, 0.2);
        }
        // A spiral of wind made visible.
        for (let i = 0; i < 3; i++) {
          const h = Math.random(), a = time(set) * 6 + h * 12 + i * 2.1, rr = r * (0.25 + h * 0.75);
          p.world.vfx.burst(x + Math.cos(a) * rr, g + h * 16, z + Math.sin(a) * rr, ['#d8e0ec', BLUE], 1, 2, { fall: -0.2, life: 0.4 });
        }
        if (left > 0) return true;
        for (const e of caught) if (!e.dying) Object.assign(e, { hang: 0, rise: -30 });
        return false;
      },
    });
  },

  // Draw the iron in: armoured foes, war machines and their shots slide toward the field, Charged.
  magnet(set, job, aim) {
    const { def, rank } = job, p = set.player, x = aim.x, z = aim.z, r = def.reach + rank;
    let left = def.secs, beat = 0;
    set.kit.push({
      update(dt) {
        left -= dt;
        for (const e of near(set, x, z, r)) {
          if (e.boss || !(e.def.machine || ['soldier', 'legionary', 'iceGuard', 'chief', 'marshal', 'bandit'].includes(e.kind))) continue;
          e.vel.set(x - e.x, z - e.z).normalize().multiplyScalar(e.def.machine ? 3 : 9);
          e.knockUntil = time(set) + 0.1;
          e.chargedUntil = time(set) + 6;
        }
        for (const o of p.world.monsters.orbs) {
          const dx = x - o.orb.position.x, dz = z - o.orb.position.z, d = Math.hypot(dx, dz);
          if (d < r && d > 1) {
            o.dx += (dx / d - o.dx) * Math.min(1, dt * 4);
            o.dz += (dz / d - o.dz) * Math.min(1, dt * 4);
          }
        }
        if ((beat -= dt) <= 0) {
          beat = 0.5;
          p.world.vfx.shock(x, ground(set, x, z), z, r, '#9ab0d0', 0.45);
        }
        return left > 0;
      },
    });
  },

  // A melting beam that cuts through stone, walls and all.
  plasma(set, job) {
    const { def, rank, force } = job, p = set.player;
    let t = 0, beat = 0, beam = null;
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        const s = p.state, a = set.aim();
        s.dir = [a.dx, a.dz];
        set.casting = 0.2;
        set.pose = 'punch';
        v.set(s.x + a.dx * 1.2, ground(set, s.x, s.z) + s.air + 1.6, s.z + a.dz * 1.2);
        w.set(v.x + a.dx * def.range, v.y, v.z + a.dz * def.range);
        if (!beam) beam = p.world.vfx.beam(v, w, 0.6, '#d8a8ff', def.secs);
        else p.world.vfx.aim(beam, v, w);
        if ((beat -= dt) <= 0) {
          beat = 0.1;
          for (const e of along(set, v.x, v.z, a.dx, a.dz, def.range, 1.2)) zap(set, job.pid, e, force * 0.3);
          // It cuts: blows along the line carve whatever is built there.
          p.world.work.actor = p;
          for (let d = 6; d < def.range; d += 7) p.melee.blast(v.x + a.dx * d, v.z + a.dz * d, force * (1 + rank * 0.1), 1.8, 0, '#d8a8ff', null);
        }
        p.world.vfx.burst(w.x, ground(set, w.x, w.z) + 1, w.z, ['#d8a8ff', WHITE], 2, 8);
        return t < def.secs;
      },
    });
  },

  tick(set, dt) {
    const p = set.player, t = time(set), c = set.clouds;
    // Thunderstep's chain runs out.
    if (set.steps && t - set.stepAt > STEP_WINDOW) {
      set.steps = 0;
      const pid = 'surge';
      set.waits[pid] = set.def.powers[pid].cool * (1 - set.rank(pid) * 0.07);
    }
    // The clouds: dark puffs high overhead, flashes inside them, and the light dims beneath.
    if (c && c.until > t) {
      if ((c.puff -= dt) <= 0) {
        c.puff = 1.2;
        for (let i = 0; i < CLOUD_PUFFS / 4; i++) {
          const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * c.r;
          p.world.smoke?.puff(c.x + Math.cos(a) * d, ground(set, c.x, c.z) + CLOUD_Y + Math.random() * 6, c.z + Math.sin(a) * d, { size: 14, grow: 1.4, life: 6, tint: '#3c4252', alpha: 0.55, lift: 0.1, spread: 2 });
        }
      }
      if (Math.random() < dt * 0.8) {
        const a = Math.random() * 6.283, d = Math.random() * c.r, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = ground(set, x, z) + CLOUD_Y;
        set.fx.lightning({ x, y, z }, { x: x + (Math.random() - 0.5) * 20, y: y - 4, z: z + (Math.random() - 0.5) * 20 }, BLUE, 0.3, 0.2);
      }
      if (underClouds(set, p.state.x, p.state.z)) p.world.vfx.tint('#6a7a9a', 0.3, 0.3, 0.2);
    }
    // Charged foes crackle.
    if ((set.crackle = (set.crackle ?? 0) - dt) <= 0) {
      set.crackle = 0.15;
      for (const e of near(set, p.state.x, p.state.z, 60)) if (e.chargedUntil > t && Math.random() < 0.4) p.world.vfx.burst(e.x, e.group.position.y + 2, e.z, [YELLOW], 1, 4, { fall: 0, life: 0.25 });
    }
    // Living Current: the body is lightning.
    if (set.current > t && Math.random() < 0.6) {
      const s = p.state, y = ground(set, s.x, s.z) + s.air + 1.4;
      set.fx.zap({ x: s.x, y: y + 0.8, z: s.z }, { x: s.x + (Math.random() - 0.5) * 2.4, y: y - 1, z: s.z + (Math.random() - 0.5) * 2.4 }, YELLOW);
    }
  },

  // Flashpoint: four strikes from four sides in the same instant, then the world goes white.
  finisher(melee, e) {
    const p = melee.player, y = e.group.position.y + 1.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283 + 0.4, x = e.x + Math.cos(a) * 3, z = e.z + Math.sin(a) * 3;
      p.world.fx.lightning({ x, y: y + 1, z }, { x: e.x, y, z: e.z }, YELLOW, 0.3, 0.25);
      p.world.vfx.burst(x, y, z, [YELLOW, WHITE], 6, 6);
      p.world.work.actor = p;
      melee.monsters.hit(e, melee.force * 0.5, x, z, 'flinch', 1);
    }
    e.chargedUntil = melee.monsters.time + CHARGE_SECS;
    p.hud.flash(0.35);
    p.world.work.impact = 0.06;
    return 'fly';
  },
};
