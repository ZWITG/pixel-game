import * as THREE from 'three';
import { near, ground, time, world, blow, hit, raze, line, shake, terror } from './common.js';

// The Sanguinarch's kit (v0.56.0): the Bloodtide. Same shape as kits/titan.js: each power `kind` is called
// as kit[kind](set, job, aim); lasting effects go on set.kit as { update(dt) → false when done, busy }.
//   Bleed (e.bleedUntil): every blow and power opens a foe for BLEED_SECS. It loses a little every half
//   second, and when a Bleeding foe dies it bursts (killed hook): harm around it and more Bleeding.
//   Blood gauge (set.blood, 0..100): blows, kills and bursts fill it, it drains slowly. Every power grows
//   up to +60% with it (power hook), and Feast heals from it.
// Hooks: power, meter, blow, landed, afflicted, killed, tick.
const RED = '#e0203a', GLOW = '#ff2a3a', DARK = '#4a0008';
const SPLASH = [RED, GLOW, DARK, '#ffd0d0'];
const BLEED_SECS = 5, BLEED_EVERY = 0.5, BLEED_SHARE = 0.04;   // of the hero's might, per tick
const GAUGE_MOST = 100, GAUGE_DRAIN = 1.2, POWER_BONUS = 0.6;
const BURST_REACH = 6, MAX_DEPTH = 4, POWER = 30;

const v = new THREE.Vector3(), w = new THREE.Vector3();

const gain = (set, n) => { set.blood = Math.min(GAUGE_MOST, (set.blood ?? 0) + n); };
const bleeding = (e, t) => e.bleedUntil > t;

function bleed(set, e, secs = BLEED_SECS) {
  if (!e || e.dying) return;
  const t = time(set);
  if (!bleeding(e, t)) world(set).vfx.burst(e.x, e.group.position.y + 1.5, e.z, SPLASH, 4, 3, { up: 1, life: 0.5 });
  e.bleedUntil = Math.max(e.bleedUntil ?? 0, t + secs);
}

function splash(set, x, z, n = 12, speed = 9, up = 1) {
  world(set).vfx.burst(x, ground(set, x, z) + up, z, SPLASH, n, speed, { up: 0.8, life: 0.8, fall: 0.8 });
}

// The land torn where a power lands: a blow, the built things in reach, a shockwave and a shake.
function wreck(set, job, x, z, force, reach, react, crater = 0, shakeBy = 0.5) {
  const p = set.player, wd = world(set), y = ground(set, x, z);
  blow(set, job, x, z, force, reach, react, p.rooms.house ? 0 : crater);
  raze(set, x, z, reach * 1.2, force * 0.7);
  wd.vfx.shock(x, y, z, reach * 1.6, GLOW, 0.4);
  wd.smoke?.dust(x, y + 0.4, z, RED, 1, Math.min(4, reach * 0.5));
  splash(set, x, z, 14, 10);
  set.fx.impact('blood', x, y, z, Math.max(2, reach * 0.6));
  wd.scars.mark('blood', x, z, Math.min(14, reach * 1.3), p, 1);
  shake(set, shakeBy);
}

export const BLOOD = {
  // A thread of blood fired the length of the aim: pierces the line and cuts what stands behind it.
  bloodlance(set, job, aim) {
    const p = set.player, s = p.state, { def, rank, force } = job;
    const range = Math.min(110, (def.range ?? 60) + rank * 4), y = ground(set, s.x, s.z) + s.air + 1.6;
    const wd = world(set);
    set.casting = 0.3;
    set.pose = 'punch';
    s.dir = [aim.dx, aim.dz];
    v.set(s.x + aim.dx * 1.2, y, s.z + aim.dz * 1.2);
    w.set(s.x + aim.dx * range, y, s.z + aim.dz * range);
    wd.vfx.beam(v, w, 0.9 + rank * 0.12, RED, 0.45);
    wd.vfx.beam(v, w, 0.35, '#ffd0d0', 0.3);
    for (const e of line(set, s.x, s.z, aim.dx, aim.dz, range, 2 + rank * 0.15)) {
      bleed(set, e);
      hit(set, job.pid, e, force, 'knockdown');
      set.fx.impact('blood', e.x, ground(set, e.x, e.z), e.z, 2.4);
    }
    // The cut goes on past the foes, through trees, walls and houses, one step after another.
    const reach = 4 + rank * 0.5;
    for (let d = 5, i = 0; d < range; d += 7, i++) {
      const x = s.x + aim.dx * d, z = s.z + aim.dz * d;
      set.fx.after(0.03 * i, () => {
        raze(set, x, z, reach, force * 0.7);
        wd.vfx.shock(x, ground(set, x, z), z, 5, GLOW, 0.25);
        splash(set, x, z, 5, 7, 1.4);
        if (i % 2 === 0) wd.fx.pillar(x, ground(set, x, z), z, 1.4, GLOW, 0.3);
      });
    }
    wd.scars.mark('blood', s.x + aim.dx * range * 0.5, s.z + aim.dz * range * 0.5, Math.min(16, range * 0.3), p, 1);
    gain(set, 3);
    shake(set, 0.5);
    terror(set, s.x, s.z, 40, 3);
  },

  // A scythe of blood all the way round you.
  scythe(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job, wd = world(set);
    const r = (def.reach ?? 9) + rank * 0.6, spin = 0.45;
    let t = 0, b = null, struck = false;
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        set.casting = 0.2;
        set.pose = 'slam';
        const a = (t / spin) * Math.PI * 2, y = ground(set, s.x, s.z) + s.air + 1.2;
        v.set(s.x, y, s.z);
        w.set(s.x + Math.cos(a) * r, y, s.z + Math.sin(a) * r);
        if (!b) b = wd.vfx.beam(v, w, 1.4, RED, spin + 0.1);
        else wd.vfx.aim(b, v, w);
        splash(set, w.x, w.z, 3, 6, 1.2);
        if (!struck) {
          struck = true;
          for (const e of near(set, s.x, s.z, r)) bleed(set, e);
          wreck(set, job, s.x, s.z, force, r, 'knockdown', 0, 0.7);
          wd.vfx.shock(s.x, ground(set, s.x, s.z), s.z, r * 1.8, '#ffd0d0', 0.6);
          gain(set, 4);
        }
        return t < spin;
      },
    });
  },

  // Every foe in reach opens at once, and the burst cuts those around it.
  hemorrhage(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job, wd = world(set);
    const reach = (def.reach ?? 32) + rank * 2;
    const foes = near(set, s.x, s.z, reach).slice(0, 24);
    set.casting = 0.4;
    set.pose = 'gather';
    for (const e of foes) bleed(set, e, 2);
    wd.vfx.shock(s.x, ground(set, s.x, s.z), s.z, reach, RED, 0.5);
    shake(set, 0.4);
    foes.forEach((e, i) => {
      set.fx.after(0.45 + i * 0.05, () => {
        if (e.dying) return;
        const x = e.x, z = e.z, y = ground(set, x, z);
        for (const o of near(set, x, z, BURST_REACH)) if (o !== e) bleed(set, o);
        wreck(set, job, x, z, force, 4.5 + rank * 0.3, 'launch', 1, 0.3);
        wd.fx.pillar(x, y, z, 2.2, GLOW, 0.45);
        hit(set, job.pid, e, force * 1.2, 'launch');
        gain(set, 3);
        p.nature.deed('hemomancy');
      });
    });
    if (!foes.length) splash(set, s.x, s.z, 10, 8);
  },

  // Rows of hardened blood burst up toward the target through ground, trees and houses.
  thornfield(set, job, aim) {
    const p = set.player, s = p.state, { def, rank, force } = job, wd = world(set);
    const count = (def.count ?? 12) + rank, step = def.step ?? 3;
    const dx = aim.dx, dz = aim.dz;
    set.casting = 0.4;
    set.pose = 'slam';
    for (let i = 0; i < count; i++) {
      set.fx.after(0.07 * i, () => {
        const d = 4 + i * step * 0.55, side = [0, -2.2, 2.2][i % 3];
        const x = s.x + dx * d - dz * side, z = s.z + dz * d + dx * side, y = ground(set, x, z);
        const big = i % 3 === 0;
        wd.quake.pillar(x, z, 6 + rank + (big ? 3 : 0), 0);
        set.fx[big ? 'rock' : 'crystal'](x, y, z, (big ? 2.2 : 1.5) + rank * 0.15, 5);
        set.fx.rock(x + 1, y, z + 0.8, 1.1, 4.5);
        wd.fx.pillar(x, y, z, 1.6, GLOW, 0.5);
        wreck(set, job, x, z, force, 3.4 + rank * 0.3, 'launch', big ? 1 : 0, 0.25);
        for (const e of near(set, x, z, 3.5)) bleed(set, e);
        p.nature.deed('hemomancy');
      });
    }
    gain(set, 4);
  },

  // The sky opens over the target: needles of blood for a few seconds.
  bloodrain(set, job, aim) {
    const p = set.player, { def, rank, force } = job, wd = world(set);
    const reach = (def.reach ?? 12) + rank * 0.5, secs = (def.secs ?? 3) + rank * 0.4;
    const cx = aim.x ?? aim.target?.x ?? p.state.x + aim.dx * 18, cz = aim.z ?? aim.target?.z ?? p.state.z + aim.dz * 18;
    let t = 0, drop = 0, strike = 0;
    set.casting = 0.4;
    set.pose = 'peak';
    wd.vfx.tint('#a0101c', 0.3, secs + 1);
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        set.casting = Math.max(set.casting, 0.15);
        set.pose = 'peak';
        if ((drop -= dt) <= 0) {
          drop = 0.06;
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * reach, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = ground(set, x, z);
            v.set(x + 2, y + 34, z);
            w.set(x, y, z);
            wd.vfx.beam(v, w, 0.18, GLOW, 0.18);
            splash(set, x, z, 3, 5, 0.3);
          }
        }
        if ((strike -= dt) <= 0) {
          strike = 0.25;
          for (const e of near(set, cx, cz, reach)) bleed(set, e);
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * reach, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
            blow(set, job, x, z, force, 3.5, null, 0);
            wd.vfx.shock(x, ground(set, x, z), z, 3.5, GLOW, 0.3);
            set.fx.impact('blood', x, ground(set, x, z), z, 1.6);
          }
          const a = Math.random() * 6.283, d = Math.random() * reach;
          raze(set, cx + Math.cos(a) * d, cz + Math.sin(a) * d, 5, force * 0.8);
          wd.scars.mark('blood', cx, cz, reach, p, 1);
          shake(set, 0.25);
          gain(set, 0.6);
        }
        return t < secs;
      },
    });
  },

  // Drink every Bleeding foe in reach: they wither, you mend.
  feast(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job, wd = world(set);
    const reach = (def.reach ?? 26) + rank * 2, foes = near(set, s.x, s.z, reach).slice(0, 20);
    set.casting = 0.5;
    set.pose = 'gather';
    for (const e of foes) bleed(set, e, 2);
    wd.vfx.tint(DARK, 0.2, 1.5);
    set.fx.after(0.4, () => {
      let healed = 0, n = 0;
      for (const e of foes) {
        if (e.dying) continue;
        const y = ground(set, s.x, s.z) + s.air + 1.4;
        if (n++ < 8) {
          v.set(e.x, e.group.position.y + 1.4, e.z);
          w.set(s.x, y, s.z);
          wd.vfx.beam(v, w, 0.5, RED, 0.5);
        }
        hit(set, job.pid, e, force * Math.max(0.4, def.drain ?? 0.4) * 2, null);
        splash(set, e.x, e.z, 6, 6, 1.4);
        healed += p.body.maxHealth * 0.025 * (1 + rank * 0.1);
        gain(set, 3);
        p.nature.deed('hemomancy');
      }
      if (healed) {
        set.heal(Math.min(healed, p.body.maxHealth * 0.4) * (1 + (set.blood ?? 0) / GAUGE_MOST));
        wd.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 6, GLOW, 0.5);
        wd.fx.glow(s.x, ground(set, s.x, s.z) + 1.6, s.z, 4, GLOW, 0.6);
      }
    });
  },

  // A giant of blood at the target brings both fists down, twice.
  giant(set, job, aim) {
    const p = set.player, s = p.state, { def, rank, force } = job, wd = world(set);
    const reach = (def.reach ?? 9) + rank * 0.5, crater = def.crater ?? 3;
    const cx = aim.x ?? aim.target?.x ?? s.x + aim.dx * 14, cz = aim.z ?? aim.target?.z ?? s.z + aim.dz * 14;
    const nx = -(cz - s.z), nz = cx - s.x, nl = Math.hypot(nx, nz) || 1;
    const px = nx / nl * 3.2, pz = nz / nl * 3.2;
    set.casting = 0.5;
    set.pose = 'peak';
    // It rises: a column of light and a ring of dark blood.
    wd.fx.pillar(cx, ground(set, cx, cz), cz, 7, RED, 0.9);
    wd.fx.glow(cx, ground(set, cx, cz) + 4, cz, 10, GLOW, 0.9);
    wd.vfx.shock(cx, ground(set, cx, cz), cz, reach * 1.5, RED, 0.7);
    shake(set, 0.4);
    [[0.7, 1], [1.5, -1]].forEach(([at, side], i) => {
      set.fx.after(at, () => {
        const x = cx + px * side, z = cz + pz * side, y = ground(set, x, z);
        wd.fx.pillar(x, y, z, 5, GLOW, 0.6);
        wreck(set, job, x, z, force * (i ? 1.15 : 1), reach, i ? 'launch' : 'knockdown', crater, 1);
        if (!p.rooms.house) p.melee.tear(x, z, 3.5 + rank * 0.3, 3);
        wd.quake.pillar(x, z, 10 + rank, 0);
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * 6.283 + i;
          set.fx.rock(x + Math.cos(a) * reach * 0.7, ground(set, x, z), z + Math.sin(a) * reach * 0.7, 1.6, 4);
        }
        wd.vfx.shock(x, y, z, reach * 2.2, '#ffd0d0', 0.6);
        for (const e of near(set, x, z, reach)) bleed(set, e);
        gain(set, 5);
        p.nature.deed('hemomancy');
      });
    });
  },

  // The moon turns red for a minute: sky, panic, constant Bleeding, pillars under the foes.
  bloodmoon(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job, wd = world(set);
    const reach = (def.reach ?? 60) + rank * 3, secs = def.secs ?? 60;
    if (set.moon) set.moon.t = secs;   // cast again: the moon is renewed, not doubled
    else {
      const moon = set.moon = { t: secs, tint: 0, erupt: 0, panic: 0, bleed: 0 };
      set.kit.push({
        busy: false,
        update(dt) {
          moon.t -= dt;
          const t = time(set);
          if ((moon.tint -= dt) <= 0) { moon.tint = 1; wd.vfx.tint('#b0101c', 0.45, 2); }
          if ((moon.bleed -= dt) <= 0) {
            moon.bleed = 1;
            for (const e of near(set, s.x, s.z, reach)) if (!bleeding(e, t) || e.bleedUntil < t + 2) bleed(set, e, 3);
          }
          if ((moon.panic -= dt) <= 0) { moon.panic = 2; terror(set, s.x, s.z, reach * 3, 3); }
          if ((moon.erupt -= dt) <= 0) {
            moon.erupt = 1.4;
            const foes = near(set, s.x, s.z, reach);
            for (let k = 0; k < 3 && foes.length; k++) {
              const e = foes[Math.floor(Math.random() * foes.length)];
              if (e.dying) continue;
              const x = e.x, z = e.z, y = ground(set, x, z);
              wd.quake.pillar(x, z, 12 + rank, 0);
              wd.fx.pillar(x, y, z, 3, GLOW, 0.7);
              wreck(set, job, x, z, force, 5, 'launch', 1, 0.4);
              set.fx.crystal(x, y, z, 4, 2);
              gain(set, 1.5);
              p.nature.deed('hemomancy');
            }
          }
          if (moon.t > 0) return true;
          set.moon = null;
          return false;
        },
      });
    }
    set.casting = 0.6;
    set.pose = 'peak';
    wd.vfx.tint('#b0101c', 0.5, 3);
    wd.vfx.shock(s.x, ground(set, s.x, s.z), s.z, reach, RED, 1);
    wd.fx.glow(s.x, ground(set, s.x, s.z) + 40, s.z, 30, GLOW, 1.6);
    shake(set, 0.9);
    terror(set, s.x, s.z, reach * 3, 4);
    const r = world(set).realm;
    r?.say?.('The moon has turned red.', RED);
    gain(set, 15);
    // The first blow: a ring of pillars round the hero.
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.283, d = 14 + rank, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      set.fx.after(0.12 * k, () => {
        wd.quake.pillar(x, z, 10, 0);
        wreck(set, job, x, z, force, 5, 'launch', 1, 0.3);
      });
    }
  },

  // ---- hooks ----

  // Every power grows with the gauge.
  power(set) {
    return 1 + POWER_BONUS * (set.blood ?? 0) / GAUGE_MOST;
  },

  // A blow of the hero's on a foe: it bleeds, and the blow hits a little harder with a full gauge.
  blow(set, e) {
    bleed(set, e);
    gain(set, 0.8);
    return 1 + 0.2 * (set.blood ?? 0) / GAUGE_MOST;
  },

  landed(set) {
    gain(set, 0.6);
  },

  afflicted(set, e) {
    bleed(set, e);
    gain(set, 0.4);
  },

  // A Bleeding foe that dies bursts: harm around it and Bleeding on all it touches.
  killed(set, e) {
    const t = time(set);
    if (!bleeding(e, t)) return;
    const depth = set.bursting ?? 0;
    if (depth >= MAX_DEPTH) return;
    set.bursting = depth + 1;
    const p = set.player, wd = world(set), y = ground(set, e.x, e.z), x = e.x, z = e.z;
    for (const o of near(set, x, z, BURST_REACH)) {
      if (o === e || o.dying) continue;
      bleed(set, o);
      hit(set, null, o, p.body.might * 0.9);
    }
    splash(set, x, z, 18, 10, 1.2);
    wd.vfx.shock(x, y, z, BURST_REACH * 1.4, GLOW, 0.4);
    set.fx.impact('blood', x, y, z, 3);
    wd.scars.mark('blood', x, z, 4, p, 0);
    gain(set, 5);
    p.nature.deed('hemomancy');
    set.bursting = depth;
  },

  // Every frame: the gauge drains, Bleeding eats, the hero glows.
  tick(set, dt) {
    const p = set.player, s = p.state, t = time(set);
    set.blood = Math.max(0, (set.blood ?? 0) - GAUGE_DRAIN * dt);
    if ((set.bleedIn = (set.bleedIn ?? 0) - dt) <= 0) {
      set.bleedIn = BLEED_EVERY;
      let near25 = 0;
      for (const e of near(set, s.x, s.z, 90)) {
        if (!bleeding(e, t) || e.dying) continue;
        set.sting(e, p.body.might * BLEED_SHARE * p.nature.edge(e));
        if (Math.random() < 0.4) world(set).vfx.burst(e.x, e.group.position.y + 1.4, e.z, SPLASH, 2, 2, { up: 1, life: 0.5 });
        if (Math.hypot(e.x - s.x, e.z - s.z) < 25) near25++;
      }
      // Blood spilled near you fills the gauge.
      if (near25) gain(set, Math.min(2, near25 * 0.25));
    }
    if (!(p.wrath?.surge > 0)) {
      const k = (set.blood ?? 0) / GAUGE_MOST;
      p.hero.glow = k > 0.15 ? GLOW : null;
      p.hero.glowAmount = k * 0.35;
    }
  },

  meter(set) {
    const value = (set.blood ?? 0) / GAUGE_MOST;
    return { value, color: GLOW, hot: value > 0.8, label: 'Blood' };
  },
};

// The Red Sea (Wrath ultimate): blood rises round the hero, holds every foe in it Bleeding, then
// sets into a forest of spikes at once with one huge blow, and everything built in reach is broken.
export const BLOOD_ULT = {
  name: 'Red Sea', secs: 5, color: RED, tint: '#8a0a18', reach: 44,
  start(u) {
    const { state } = u.p;
    u.reach = Math.min(70, this.reach + u.p.powers.mastery);
    u.at = { x: state.x, z: state.z, y: u.ground(state.x, state.z) };
    u.lake = u.world.fx.lakes.find((l) => !l.o.visible) ?? null;
    u.was = null;
    if (u.lake) {
      u.lake.o.visible = true;
      // The pool's water is borrowed: it is made red now and put back at the end.
      const c = u.lake.o.material.color;
      if (c) { u.was = c.getHex(); c.set(RED); }
    }
    u.list = u.foes(u.reach);
    u.pose('peak');
  },
  tick(u, t) {
    const r = u.reach, rise = Math.min(1, t / 1.6) * (t > 4.4 ? Math.max(0, (5 - t) / 0.6) : 1);
    const set = u.p.powers, now = u.time;
    if (u.lake) {
      u.lake.o.position.set(u.at.x, u.at.y - 1 + rise * 4.5, u.at.z);
      u.lake.o.scale.set(r, 7, r);
    }
    for (const e of u.list) {
      if (e.dying) continue;
      if (t < 3.6) e.frozenUntil = now + 0.1;
      e.bleedUntil = now + 8;
      if (Math.random() < 0.08) u.world.vfx.burst(e.x, e.group.position.y + 2, e.z, SPLASH, 3, 2, { up: 2 });
    }
    if (Math.random() < 0.6) {
      const a = Math.random() * 6.283, d = Math.random() * r;
      u.world.vfx.shock(u.at.x + Math.cos(a) * d, u.at.y + rise * 3.5, u.at.z + Math.sin(a) * d, 4, GLOW, 0.8);
    }
    // Mist and pillars of light climb off the surface.
    if (t < 3.6 && Math.random() < 0.4) {
      const a = Math.random() * 6.283, d = Math.random() * r, x = u.at.x + Math.cos(a) * d, z = u.at.z + Math.sin(a) * d;
      u.world.fx.pillar(x, u.at.y + rise * 3, z, 1.8, GLOW, 0.6);
    }
    if (set.blood !== undefined) set.blood = Math.min(GAUGE_MOST, set.blood + 0.4);
    u.pose(t < 3.6 ? 'peak' : 'slam');
  },
  beats: [
    [0.1, (u) => { u.world.vfx.tint('#8a0a18', 0.55, 5); }],
    // It sets: spikes in every direction, one blow on the middle, one on every foe, all that is built broken.
    [3.6, (u) => {
      const wd = u.world, { x, z } = u.at, r = u.reach;
      for (const e of u.list) if (!e.dying) u.strike(e.x, e.z, POWER * 0.6, 4, 0, 'launch', e);
      u.strike(x, z, POWER, r * 0.55, 5, 'launch');
      for (let k = 0; k < 28; k++) {
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r * 0.9, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d, sy = u.ground(sx, sz);
        wd.fx[k % 3 === 0 ? 'rock' : 'crystal'](sx, sy, sz, 2 + Math.random() * 2, 6);
        if (k % 3 === 0) wd.quake.pillar(sx, sz, 14, 0);
        wd.fx.pillar(sx, sy, sz, 2.2, GLOW, 0.8);
      }
      u.world.vfx.burst(x, u.at.y + 2, z, SPLASH, 60, 24, { up: 1, life: 1.2 });
      wd.scars.mark('blood', x, z, Math.min(40, r * 0.7), u.p, 3);
      wd.vfx.shock(x, u.at.y + 2, z, r + 6, '#ffd0d0', 1);
      wd.vfx.tint('#ff1a2a', 0.7, 1);
      u.boom(1.2);
      u.p.nature.deed('hemomancy');
    }],
    [3.8, (u) => { raze(u.p.powers, u.at.x, u.at.z, u.reach * 0.5, u.p.body.might * POWER * 0.5); u.boom(0.6); }],
    [4.0, (u) => { raze(u.p.powers, u.at.x, u.at.z, u.reach * 0.85, u.p.body.might * POWER * 0.4); u.boom(0.6); }],
    [4.2, (u) => { raze(u.p.powers, u.at.x, u.at.z, u.reach * 1.2, u.p.body.might * POWER * 0.3); u.boom(0.5); }],
    [4.9, (u) => {
      if (u.lake) {
        u.lake.o.visible = false;
        if (u.was !== null) u.lake.o.material.color.setHex(u.was);
      }
    }],
  ],
};

export default BLOOD;
