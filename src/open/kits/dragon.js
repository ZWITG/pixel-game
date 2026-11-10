import * as THREE from 'three';
import { stagger } from '../foes.js';
import { near, ground, time, world, blow, raze, shake, burst, terror, cone } from './common.js';

// The Wyrmsire's kit (v0.56.0): a dragon in a man's shape. Same shape as kits/titan.js.
//   Dragonscale (set.scales, 0..100): grows with blows landed and taken, fades slowly out of a fight.
//   The more Scales, the less every blow hurts (up to 40% off). At 100 the breath burns white,
//   goes through stone, melts the ground to magma and breaks what is built much harder.
//   Dragonfire burns jade: it sets e.dragonfireUntil on foes (nature.edge reads it) and burns them.
// Hooks: afflicted (dragonfire mark), absorb + landed (Scales), power (Scales make powers stronger),
// meter (the HUD bar), tick (fading, the body's glow, smouldering foes).
const MOST = 100, FADE = 1.5, FADE_AFTER = 6;   // Scales lost a second, seconds after the last blow
const PER_BLOW = 2.5, MAX_GUARD = 0.4;          // Scales from a landed blow; most harm turned aside
const FIRE_SECS = 4;                            // how long dragonfire marks a foe
const JADE = '#3aff9a', DEEP = '#2ad88a', PALE = '#e8ffd0', WHITE = '#f4fff0';
const JADES = [DEEP, JADE, PALE], WHITES = [WHITE, '#ffffff', PALE];
const STONE = ['#8a9a80', '#6a7a60', '#a8b898'];

export const scalesOf = (set) => set.scales ?? 0;
const hot = (set) => scalesOf(set) >= MOST;
const hue = (set) => (hot(set) ? WHITE : JADE);
const palette = (set) => (hot(set) ? WHITES : JADES);
const form = (set) => set.buffs.some((b) => b.pid === 'wyrmform');
const v = new THREE.Vector3(), w = new THREE.Vector3();

function grow(set, amount) {
  set.scales = Math.min(MOST, scalesOf(set) + amount);
  set.scalesAt = time(set);
}

// Fire on the land: burning ground (fire spreads by its own rules), and at full Scales stone driven
// through it, which comes up molten. Built things nearby catch too.
function scorch(set, x, z, reach, force = 0.6) {
  const p = set.player, wd = p.world;
  wd.scars.mark('fire', x, z, reach, p, 1, force);
  if (hot(set)) wd.scars.mark('earth', x, z, reach * 0.6, p, 1, force);
  wd.voxels?.ignite(x, ground(set, x, z) + 1, z, reach, p);
}

// One foe set alight with dragonfire (the kit's afflicted hook marks it).
function ignite(set, pid, e) {
  set.afflict(pid, e, { status: 'burn' }, set.rank(pid));
}

// Foes within `half` of the line from (x, z) along (dx, dz) for `len`.
function along(set, x, z, dx, dz, len, half) {
  return near(set, x + dx * len * 0.5, z + dz * len * 0.5, len * 0.5 + half).filter((e) => {
    const a = (e.x - x) * dx + (e.z - z) * dz, off = Math.abs((e.x - x) * dz - (e.z - z) * dx);
    return a > -1 && a < len && off < half + e.radius;
  });
}

// A line of ground torn open from (x, z) outwards: a trench every few steps, thrown stone, dust.
function rend(set, job, x, z, dx, dz, len, delay, force, crater) {
  const p = set.player;
  for (let d = 3, i = 0; d <= len; d += 3.2, i++) {
    const px = x + dx * d, pz = z + dz * d, big = i % 2 === 0;
    set.fx.after(delay + i * 0.035, () => {
      if (!p.rooms.house) p.melee.tear(px, pz, 2.1, 3);
      blow(set, job, px, pz, force, 3.4, 'knockdown', big ? crater : 0);
      set.fx.rock(px, ground(set, px, pz), pz, 0.7 + Math.random() * 0.6, 1.6);
      world(set).smoke?.dust(px, ground(set, px, pz) + 0.4, pz, STONE[0], 0.8, 2.5);
      if (hot(set)) scorch(set, px, pz, 2, 0.5);
    });
  }
}

export const DRAGON = {
  // Scales make every power stronger.
  power(set) {
    return 1 + scalesOf(set) / MOST * 0.3 + (hot(set) ? 0.2 : 0);
  },

  meter(set) {
    return { value: scalesOf(set) / MOST, color: JADE, hot: hot(set), label: 'Scales' };
  },

  // Dragonfire is what the Wyrmsire's burn is called.
  afflicted(set, e, def) {
    if (def?.status !== 'burn' || e.dying) return;
    e.dragonfireUntil = time(set) + FIRE_SECS;
  },

  // A blow reaching the hero: the Scales turn some of it aside, and grow.
  absorb(set, amount) {
    const k = scalesOf(set) / MOST, p = set.player;
    grow(set, 3 + Math.min(9, amount / Math.max(1, p.body.maxHealth) * 80));
    if (k > 0.3) world(set).vfx.burst(p.state.x, p.state.y + p.state.air + 1.4, p.state.z, JADES, 5, 7);
    return amount * (1 - MAX_GUARD * k);
  },

  // A blow of the hero's landed: Scales grow. In Wyrm Form every blow breathes fire too.
  landed(set) {
    grow(set, PER_BLOW);
    if (!form(set) || time(set) - (set.puffAt ?? -9) < 0.25) return;
    set.puffAt = time(set);
    const p = set.player, s = p.state, [rx, rz] = s.dir, len = Math.hypot(rx, rz) || 1, dx = rx / len, dz = rz / len;
    const job = { pid: 'breath', def: set.def.powers.breath, rank: set.rank('breath'), force: p.body.might * 0.5, color: DEEP };
    for (let d = 3; d <= 9; d += 3) {
      const x = s.x + dx * d, z = s.z + dz * d;
      blow(set, job, x, z, job.force, 3.2, 'stagger', 0);
      scorch(set, x, z, 2.2, 0.5);
      burst(set, x, z, palette(set), 6, 9);
      set.fx.glow(x, ground(set, x, z) + 1.2, z, 2.6, hue(set), 0.3, 1);
    }
    for (const e of cone(set, s.x, s.z, dx, dz, 10, 0.6)) ignite(set, 'breath', e);
  },

  // A stream of dragonfire: it follows your aim, burns the cone, scorches the ground, lights what is built.
  breath(set, job) {
    const p = set.player, { def, rank, force } = job;
    const secs = def.secs * (1 + rank * 0.1), reach = def.reach * (1 + rank * 0.05), wide = form(set) ? 2 : 1;
    let t = 0, beat = 0, b = null, deeds = false;
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        const s = p.state, a = set.aim(), white = hot(set);
        s.dir = [a.dx, a.dz];
        set.casting = 0.2;
        set.pose = 'punch';
        v.set(s.x + a.dx * 1.2, ground(set, s.x, s.z) + s.air + 1.7 * p.body.heroScale, s.z + a.dz * 1.2);
        w.set(v.x + a.dx * reach, v.y - 0.8, v.z + a.dz * reach);
        const width = (white ? 1.2 : 0.8) * wide, color = white ? WHITE : DEEP;
        if (!b) b = p.world.vfx.beam(v, w, width, color, secs);
        else p.world.vfx.aim(b, v, w);
        if ((beat -= dt) <= 0) {
          beat = 0.15;
          const k = white ? 1.7 : 1;
          for (let d = 3.5, i = 0; d <= reach; d += 4, i++) {
            const x = v.x + a.dx * d, z = v.z + a.dz * d;
            blow(set, job, x, z, force * 0.28 * k, 3.4 * wide, 'stagger', white && i % 2 === 0 && !p.rooms.house ? 1 : 0);
            scorch(set, x, z, 2.4 * wide, white ? 0.9 : 0.5);
            burst(set, x, z, palette(set), 3 * wide, 7);
            set.fx.glow(x, ground(set, x, z) + 1, z, 3 * wide, hue(set), 0.3, 1);
            if (white) set.fx.flame(x, ground(set, x, z), z, 3, 0.4, 3);
          }
          // White breath goes through stone: it breaks what is built far beyond a plain burn.
          if (white && (t < beat + 0.2 || Math.random() < 0.4)) raze(set, v.x + a.dx * reach * 0.6, v.z + a.dz * reach * 0.6, reach * 0.5, force * 0.5);
          const hit = cone(set, v.x, v.z, a.dx, a.dz, reach, wide > 1 ? 0.55 : 0.8);
          for (const e of hit) {
            ignite(set, job.pid, e);
            if (white) set.sting(e, p.body.might * 0.5);
          }
          if (hit.length >= 3 && !deeds) {
            deeds = true;
            p.nature.deed('wyrmcraft');
          }
          shake(set, 0.12);
        }
        if (t >= secs) return false;
        return true;
      },
    });
  },

  // Five great claws rake the ground ahead, one after another, tearing trenches.
  claws(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, range = def.range * (1 + rank * 0.05);
    const base = Math.atan2(aim.dx, aim.dz), caught = cone(set, s.x, s.z, aim.dx, aim.dz, range, 0.6);
    p.world.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 6, JADE, 0.3);
    for (let i = 0; i < 5; i++) {
      const a = base + (i - 2) * 0.24, dx = Math.sin(a), dz = Math.cos(a);
      rend(set, job, s.x, s.z, dx, dz, range, i * 0.04, force * 0.4, def.crater + rank * 0.15);
      set.fx.after(i * 0.04, () => {
        for (let d = 2; d < range; d += 2.2) set.fx.glow(s.x + dx * d, ground(set, s.x, s.z) + 1.2, s.z + dz * d, 1.6, hue(set), 0.35, 1);
        raze(set, s.x + dx * range * 0.5, s.z + dz * range * 0.5, range * 0.4, force * 0.35);
      });
    }
    set.fx.after(0.1, () => shake(set, 0.35));
    if (caught.length >= 3) p.nature.deed('wyrmcraft');
    grow(set, 4);
  },

  // A tail of light sweeps the full circle: everything standing is flattened.
  tailsweep(set, job) {
    const p = set.player, { def, rank, force } = job, s = p.state, r = def.reach * (1 + rank * 0.05), x = s.x, z = s.z;
    p.world.vfx.shock(x, ground(set, x, z), z, r * 1.4, JADE, 0.5);
    // The tail goes round in a quarter of a second, flattening a wedge at a time.
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283, px = x + Math.cos(a) * r * 0.6, pz = z + Math.sin(a) * r * 0.6;
      set.fx.after(i * 0.03, () => {
        blow(set, job, px, pz, force * 0.5, r * 0.5, 'knockdown', 0.5);
        raze(set, px, pz, r * 0.45, force * 0.6);
        set.fx.rock(px, ground(set, px, pz), pz, 0.8, 1.8);
        set.fx.glow(px, ground(set, px, pz) + 1.2, pz, 3, hue(set), 0.3, 1);
        burst(set, px, pz, palette(set), 8, 10);
        if (hot(set)) scorch(set, px, pz, 2.6, 0.6);
      });
    }
    set.fx.after(0.12, () => {
      blow(set, job, x, z, force, r, 'launch', 1.2 + rank * 0.2);
      for (const e of near(set, x, z, r)) if (!e.boss) e.vel.set(e.x - x, e.z - z).normalize().multiplyScalar(14);
      shake(set, 0.55);
      p.world.work.impact = 0.05;
    });
    if (near(set, x, z, r).length >= 3) p.nature.deed('wyrmcraft');
    grow(set, 4);
  },

  // Rise on the wings of light and beat them once: a gale throws everything ahead away.
  wingbeat(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, reach = def.reach * (1 + rank * 0.05), x = s.x, z = s.z;
    s.rise = Math.max(s.rise, 14);
    s.air = Math.max(s.air, 0.05);
    p.guard = Math.max(p.guard, 0.5);
    p.world.vfx.shock(x, ground(set, x, z), z, 10, PALE, 0.3);
    set.fx.after(0.3, () => {
      for (let d = 4; d <= reach; d += 5) {
        const px = x + aim.dx * d, pz = z + aim.dz * d;
        blow(set, job, px, pz, force * 0.5, 4 + d * def.cone * 0.4, 'launch', 0);
        raze(set, px, pz, 4 + d * def.cone * 0.3, force * 0.4);
        burst(set, px, pz, [PALE, JADE, '#ffffff'], 8, 16);
        set.fx.glow(px, ground(set, px, pz) + 1.5, pz, 4, PALE, 0.3, 1);
        world(set).smoke?.dust(px, ground(set, px, pz) + 0.5, pz, '#c8d8c0', 1.4, 4);
      }
      for (const e of cone(set, x, z, aim.dx, aim.dz, reach, 0.5)) {
        if (!e.boss) e.vel.set(aim.dx, aim.dz).multiplyScalar(30);
        e.knockUntil = time(set) + 0.4;
      }
      p.world.vfx.shock(x + aim.dx * 6, ground(set, x, z), z + aim.dz * 6, reach * 0.8, PALE, 0.45);
      shake(set, 0.4);
    });
    grow(set, 3);
  },

  // Climb into the sky, then fall on the target like a comet: a crater, and fire where it lands.
  dive(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, tx = aim.x, tz = aim.z, reach = def.reach * (1 + rank * 0.06);
    const top = 24;
    let t = 0, phase = 0, done = false;
    const sx = s.x, sz = s.z;
    p.guard = Math.max(p.guard, 5);
    p.world.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 8, JADE, 0.3);
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        set.casting = 0.2;
        set.pose = phase === 2 ? 'slam' : 'peak';
        p.guard = Math.max(p.guard, 0.5);
        if (phase === 0) {
          // Up.
          s.air = Math.min(top, s.air + 70 * dt);
          s.rise = 0;
          if (s.air >= top) { phase = 1; t = 0; }
        } else if (phase === 1) {
          // A breath held at the top, turning to the target.
          s.rise = 0;
          s.dir = [tx - s.x, tz - s.z];
          if (t > 0.22) { phase = 2; t = 0; }
        } else {
          // The fall: straight down the line to the target.
          const speed = 110, step = speed * dt, d = Math.hypot(tx - s.x, tz - s.z) || 1, move = Math.min(d, Math.max(step * (d / (s.air + d)), 0));
          s.x += (tx - s.x) / d * Math.min(move, d);
          s.z += (tz - s.z) / d * Math.min(move, d);
          s.air = Math.max(0, s.air - step);
          s.rise = 0;
          world(set).vfx.burst(s.x, ground(set, s.x, s.z) + s.air + 1, s.z, palette(set), 3, 10, { fall: 0.3 });
          set.fx.glow(s.x, ground(set, s.x, s.z) + s.air + 1.5, s.z, 3.5, hue(set), 0.2, 1);
          if (s.air <= 0 || t > 2.5) {
            s.air = 0;
            s.rise = 0;
            done = true;
          }
        }
        if (done) {
          const x = s.x, z = s.z, g = ground(set, x, z);
          blow(set, job, x, z, force, reach, 'launch', def.crater + rank * 0.5, aim.target);
          raze(set, x, z, reach * 1.6, force * 0.8);
          scorch(set, x, z, reach * 1.1, 1);
          p.world.vfx.shock(x, g, z, reach * 2.2, JADE, 0.5);
          p.world.vfx.shock(x, g, z, reach * 1.2, PALE, 0.3);
          set.fx.impact('dragon', x, g, z, reach * 0.8);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 6.283;
            set.fx.rock(x + Math.cos(a) * reach * 0.6, g, z + Math.sin(a) * reach * 0.6, 1 + Math.random(), 3);
          }
          world(set).smoke?.column(x, g, z, 2, 8);
          for (const e of near(set, x, z, reach * 1.2)) ignite(set, job.pid, e);
          shake(set, 0.8);
          p.world.work.impact = 0.07;
          if (near(set, x, z, reach).length >= 3) p.nature.deed('wyrmcraft');
          grow(set, 6);
          return false;
        }
        return !(sx === undefined && sz === undefined);
      },
    });
  },

  // A roar: walls and windows shatter, foes who hear it drop their weapons and run.
  roar(set, job) {
    const p = set.player, { def, rank, force } = job, s = p.state, r = def.reach * (1 + rank * 0.05), secs = def.secs * (1 + rank * 0.1), x = s.x, z = s.z, t = time(set);
    for (let i = 0; i < 3; i++) set.fx.after(i * 0.18, () => p.world.vfx.shock(x, ground(set, x, z) + 1, z, r * (0.5 + i * 0.3), PALE, 0.5));
    for (let i = 0; i < 2; i++) {
      set.fx.after(i * 0.3, () => {
        raze(set, x, z, r * (0.6 + i * 0.4), force * 2);
        blow(set, job, x, z, force * 0.6, r * (0.5 + i * 0.5), 'stagger', 0);
        shake(set, 0.5);
      });
    }
    let n = 0;
    for (const e of near(set, x, z, r)) {
      n++;
      if (e.boss) {
        p.melee.monsters.wear(e, 4);
        continue;
      }
      e.fleeUntil = t + secs;
      e.disarmedUntil = t + secs;
      stagger(e, 0.7, t, true);
    }
    terror(set, x, z, r * 1.2, secs);
    burst(set, x, z, [PALE, JADE, '#ffffff'], 30, 20, 1.6);
    p.world.work.impact = 0.05;
    if (n >= 3) p.nature.deed('wyrmcraft');
    grow(set, 5);
  },

  // Fly low along a line and breathe the whole way, leaving a burning road behind.
  skyfire(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, dist = def.dist * (1 + rank * 0.08);
    const hx = aim.dx, hz = aim.dz, speed = dist / 1.1, ox = s.x, oz = s.z;
    let run = 0, beat = 0, deeds = false;
    s.dir = [hx, hz];
    p.guard = Math.max(p.guard, 1.5);
    set.kit.push({
      busy: true,
      update(dt) {
        const g = ground(set, s.x, s.z);
        set.casting = 0.2;
        set.pose = 'dash';
        p.guard = Math.max(p.guard, 0.3);
        s.dir = [hx, hz];
        s.air += (5 - s.air) * Math.min(1, dt * 8);
        s.rise = 0;
        const nx = s.x + hx * speed * dt, nz = s.z + hz * speed * dt;
        s.x = nx;
        s.z = nz;
        run += speed * dt;
        if ((beat -= dt) <= 0) {
          beat = 0.05;
          const fx = s.x, fz = s.z, white = hot(set);
          blow(set, job, fx, fz, force * 0.3 * (white ? 1.5 : 1), 4, 'stagger', white ? 0.6 : 0);
          scorch(set, fx, fz, 3.2, white ? 0.9 : 0.6);
          if (white) raze(set, fx, fz, 4, force * 0.3);
          burst(set, fx, fz, palette(set), 5, 9);
          set.fx.glow(fx, g + 1.2, fz, 3.4, hue(set), 0.4, 1);
          set.fx.flame(fx, g, fz, 3, 0.5, white ? 3 : 0);
          const hit = near(set, fx, fz, 4.5);
          for (const e of hit) ignite(set, job.pid, e);
          if (hit.length >= 3 && !deeds) {
            deeds = true;
            p.nature.deed('wyrmcraft');
          }
          shake(set, 0.1);
        }
        if (run < dist) return true;
        p.world.vfx.shock(s.x, g, s.z, 8, JADE, 0.3);
        p.world.vfx.shock(ox, ground(set, ox, oz), oz, 6, JADE, 0.3);
        grow(set, 5);
        return false;
      },
    });
  },

  // The wyrm: far bigger and armoured; every blow breathes fire (the landed hook), and the breath is twice as wide.
  wyrmform(set, job) {
    set.buff(job);
    const p = set.player, s = p.state, g = ground(set, s.x, s.z);
    grow(set, 25);
    p.world.vfx.shock(s.x, g, s.z, 14, JADE, 0.5);
    p.world.vfx.shock(s.x, g, s.z, 8, PALE, 0.3);
    burst(set, s.x, s.z, palette(set), 30, 16, 1.4);
    set.fx.rock(s.x, g, s.z, 1.2, 3);
    world(set).smoke?.dust(s.x, g + 0.4, s.z, STONE[0], 2, 6);
    scorch(set, s.x, s.z, 5, 0.6);
    shake(set, 0.4);
    p.hud.message('You are the wyrm.', true);
  },

  tick(set, dt) {
    const p = set.player, t = time(set);
    // Scales fade once the fighting stops.
    if (t - (set.scalesAt ?? -99) > FADE_AFTER) set.scales = Math.max(0, scalesOf(set) - FADE * dt);
    if (hot(set) && !set.wasHot) p.hud.message('Full Scales! Your breath burns white.', true);
    set.wasHot = hot(set);
    // Foes still burning with dragonfire smoulder jade.
    if ((set.smoulder = (set.smoulder ?? 0) - dt) <= 0) {
      set.smoulder = 0.3;
      let n = 0;
      for (const e of near(set, p.state.x, p.state.z, 50)) {
        if (!(e.dragonfireUntil > t) || n++ > 8) continue;
        world(set).vfx.burst(e.x, e.group.position.y + 1, e.z, JADES, 2, 4);
      }
    }
    // The body glows with its Scales, unless a Surge is already lighting it.
    if (!(p.wrath?.surge > 0)) {
      const k = scalesOf(set) / MOST;
      p.hero.glow = k > 0.15 ? hue(set) : null;
      p.hero.glowAmount = k * 0.3 + (hot(set) ? Math.sin(t * 10) * 0.08 + 0.08 : 0);
    }
  },
};

const POWER = 30;

// Wyrmfall: a wyrm of jade fire comes down out of the sky, circles the hero breathing a ring of fire
// that sets the land alight, then crashes where the hero aims.
export const DRAGON_ULT = {
  name: 'Wyrmfall', secs: 4.2, color: DEEP, tint: '#0e4a2e', reach: 55,
  start(u) {
    const p = u.p, { state } = p, set = p.powers;
    u.boost = 1 + set.mastery * 0.01;
    const a = u.aim();
    u.tx = a.x;
    u.tz = a.z;
    u.cx = state.x;
    u.cz = state.z;
    u.cy = u.ground(state.x, state.z);
    u.R = 22 * u.boost;
    u.a0 = Math.atan2(state.z - u.cz - 1, state.x - u.cx - 1) + 2.4;
    u.head = new THREE.Vector3(u.cx + Math.cos(u.a0) * u.R * 2, u.cy + 90, u.cz + Math.sin(u.a0) * u.R * 2);
    u.from = new THREE.Vector3();
    u.breathe = 0;
    u.trail = u.world.vfx.trail((out) => out.copy(u.head), JADE, 4.5, this.secs);
    u.pose('peak');
  },
  tick(u, t, dt) {
    const { head } = u, fx = u.world.fx, set = u.p.powers;
    u.pose(t < 2.8 ? 'peak' : 'slam');
    if (t < 0.7) {
      // Down out of the clouds onto the circle.
      const k = t / 0.7, e = k * k * (3 - 2 * k), a = u.a0;
      head.set(u.cx + Math.cos(a) * u.R * (2 - e), u.cy + 90 - 76 * e, u.cz + Math.sin(a) * u.R * (2 - e));
    } else if (t < 2.8) {
      // Round and round the hero, breathing down.
      const a = u.a0 + (t - 0.7) * 2.4;
      head.set(u.cx + Math.cos(a) * u.R, u.cy + 14 + Math.sin(t * 3) * 3, u.cz + Math.sin(a) * u.R);
      u.from.copy(head);
      if ((u.breathe -= dt) <= 0) {
        u.breathe = 0.1;
        const gx = head.x, gz = head.z, g = u.ground(gx, gz), force = u.p.body.might * POWER * 0.25 * u.boost;
        u.strike(gx, gz, POWER * 0.2 * u.boost, 8, 1, 'knockdown');
        raze(set, gx, gz, 9, force);
        u.world.scars.mark('fire', gx, gz, 7, u.p, 2, 1);
        u.world.voxels?.ignite(gx, g + 1, gz, 7, u.p);
        for (const e of u.foes(8, head)) {
          set.afflict('breath', e, { status: 'burn' }, 3);
          e.dragonfireUntil = u.time + FIRE_SECS;
        }
        fx.flame(gx, g, gz, 5, 0.6, 3);
        u.world.vfx.shock(gx, g, gz, 8, JADE, 0.25);
        u.world.vfx.burst(gx, g + 1, gz, JADES, 8, 14);
        u.world.work.shake = Math.max(u.world.work.shake, 0.3);
        u.world.work.shakeAt = u.p.state;
      }
    } else if (t < 3.3) {
      // The fall onto the target.
      const k = (t - 2.8) / 0.5, e = k * k;
      head.set(u.from.x + (u.tx - u.from.x) * e, u.from.y + (u.ground(u.tx, u.tz) + 1 - u.from.y) * e, u.from.z + (u.tz - u.from.z) * e);
    } else {
      head.set(u.tx, u.ground(u.tx, u.tz) + 1, u.tz);
    }
    fx.glow(head.x, head.y, head.z, 6, hue(set), 0.2, 1);
    u.world.vfx.burst(head.x, head.y, head.z, JADES, 3, 14, { fall: 0.2 });
  },
  beats: [
    [0.1, (u) => {
      u.world.vfx.shock(u.cx, u.cy, u.cz, 30, PALE, 0.6);
      u.world.work.shake = Math.max(u.world.work.shake, 0.3);
      u.world.work.shakeAt = u.p.state;
    }],
    [3.3, (u) => {
      const { tx, tz } = u, g = u.ground(tx, tz), set = u.p.powers, big = 32 * u.boost;
      u.strike(tx, tz, POWER * u.boost, big, 6, 'knockdown');
      raze(set, tx, tz, big * 1.4, u.p.body.might * POWER * u.boost);
      u.world.scars.mark('fire', tx, tz, big * 0.8, u.p, 3, 1);
      u.world.scars.mark('earth', tx, tz, big * 0.4, u.p, 1, 1);
      u.world.voxels?.ignite(tx, g + 1, tz, big, u.p);
      if (!u.p.rooms.house) u.p.melee.tear(tx, tz, big * 0.5, 24);
      u.world.quake.throwStones(tx, g, tz, 28, 24);
      u.world.fx.impact('dragon', tx, g, tz, 14);
      u.world.vfx.shock(tx, g, tz, big + 8, JADE, 0.7);
      u.world.vfx.shock(tx, g, tz, big * 0.6, WHITE, 0.4);
      u.world.smoke?.column(tx, g, tz, 3, 14);
      for (const e of u.foes(big, { x: tx, z: tz })) {
        set.afflict('breath', e, { status: 'burn' }, 3);
        e.dragonfireUntil = u.time + FIRE_SECS;
      }
      terror(set, tx, tz, big * 2, 6);
      u.boom(1);
    }],
    [3.6, (u) => {
      const { tx, tz } = u, g = u.ground(tx, tz);
      u.world.vfx.shock(tx, g, tz, 50, PALE, 0.8);
      u.world.work.shake = Math.max(u.world.work.shake, 0.5);
    }],
  ],
};
