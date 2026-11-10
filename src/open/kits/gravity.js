import { stagger } from '../foes.js';
import { near, ground, time, world, blow, raze, slow, shake } from './common.js';

// The Starcrusher's kit (v0.56.0): the weight of the sky, given a will. Each power `kind` is called
// as GRAVITY[kind](set, job, aim); lasting effects go on set.kit as { update(dt) → false when done, busy }.
// Hooks the rest of the game calls:
//   blow(set, e, a)   any blow of the hero's on a foe: it gets Heavier (e.weight, 0 to 5) and the blow lands harder
//   tick(set, dt)     every frame: Weight slows heavy foes, fades, and crushes a foe at 5
// Foe fields set here: e.weight, e.weightAt (nature.edge reads weight), e.sunkUntil / e.sinkTo, e.rise / e.hang / e.air.
const COLOR = '#8a7aff';
const DARK = ['#8a7aff', '#c8beff', '#3a2e8a'];
const MAX_WEIGHT = 5;
const WEIGHT_HOLD = 3;       // seconds after a blow before Weight starts to fade
const WEIGHT_FADE = 0.5;     // Weight lost per second after that
const grow = (rank, k) => 1 + rank * k;

const heavy = (e) => !!(e.boss || e.def?.watcher);    // bosses and Watchers resist pins and lifts

// A dent in the land, never indoors.
function dent(set, x, z, size, deepest) {
  if (!set.player.rooms.house) set.player.melee.tear(x, z, size, deepest);
}

function dust(set, x, z, amount = 1, reach = 3) {
  const w = world(set), y = ground(set, x, z);
  w.smoke?.dust(x, y + 0.4, z, '#8a8294', amount, reach);
  w.vfx.burst(x, y + 0.6, z, DARK, Math.round(6 * amount), 8);
}

// Rubble and stones flung up around a spot.
function debris(set, x, z, count, speed, rocks = 4, spread = 4) {
  const w = world(set), y = ground(set, x, z);
  w.quake.throwStones(x, y, z, count, speed);
  for (let i = 0; i < rocks; i++) {
    const a = Math.random() * 6.283, d = Math.random() * spread;
    set.fx.rock(x + Math.cos(a) * d, y, z + Math.sin(a) * d, 0.7 + Math.random() * 0.8, 1.6 + Math.random());
  }
}

// A big weight lands: ring, glow, hole in the picture, shake.
function slam(set, x, z, r, shakeAmount = 0.4) {
  const w = world(set), y = ground(set, x, z);
  set.fx.impact('gravity', x, y, z, r);
  w.vfx.shock(x, y, z, r + 2, '#c8beff', 0.4);
  shake(set, shakeAmount);
  w.work.impact = Math.max(w.work.impact ?? 0, 0.04);
}

// Pins a foe for a moment. Bosses and Watchers are only slowed.
function pin(e, secs, t) {
  if (e.dying) return;
  if (heavy(e)) slow(e, 0.5, secs, t);
  else {
    stagger(e, secs, t, true);
    e.vel.set(0, 0);
  }
}

// Weight on a foe: every blow adds one, a power can add more.
function addWeight(set, e, n = 1) {
  if (e.dying) return;
  const t = time(set);
  e.weight = Math.min(MAX_WEIGHT, (e.weight ?? 0) + n);
  e.weightAt = t;
  (set.weighted ??= new Set()).add(e);
}

// Full Weight: the foe is crushed into the ground, Broken, half-buried, and a small crater opens.
function crush(set, e) {
  const p = set.player, m = p.melee, t = time(set), y = ground(set, e.x, e.z), x = e.x, z = e.z;
  e.weight = 0;
  set.weighted?.delete(e);
  if (e.dying) return;
  if (!heavy(e)) {
    e.sunkUntil = t + 2.2;
    e.sinkTo = 1.6;
    stagger(e, 2.4, t, true);
  }
  m.monsters.wear(e, m.monsters.structure(e) * (heavy(e) ? 0.5 : 2));
  dent(set, x, z, 2.4, 4);
  blow(set, { color: COLOR }, x, z, p.body.might * 0.9, 3.5, 'knockdown');
  dust(set, x, z, 1.4, 3);
  debris(set, x, z, 6, 10, 3, 2);
  slam(set, x, z, 3, 0.28);
  p.hud.float('Crushed!', x, y + 4, z, '#c8beff');
  p.nature.deed('crushing');
}

// Foes dragged by a point, one step.
function drag(e, x, z, speed) {
  const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
  if (d < 1) e.vel.set(0, 0);
  else e.vel.set((dx / d) * speed, (dz / d) * speed);
}

export const GRAVITY = {
  // A column of weight slams down on the target: the ground caves in.
  press(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim, r = def.reach + rank * 0.4, y = ground(set, x, z), t = time(set);
    set.fx.disc(x, y, z, r, COLOR, 0.5);
    set.fx.pillar(x, y + 10, z, r * 0.9, '#c8beff', 0.5);
    set.fx.glow(x, y + 14, z, r * 1.5, COLOR, 0.35, 0.6);
    for (const e of near(set, x, z, r)) pin(e, 0.5, t);
    set.fx.after(0.2, () => {
      blow(set, job, x, z, force, r, 'knockdown', p.rooms.house ? 0 : def.crater + rank * 0.3, aim.target);
      raze(set, x, z, r * 0.8, force * 0.6);
      for (const e of near(set, x, z, r)) {
        addWeight(set, e, 2);
        pin(e, 0.9 + rank * 0.1, time(set));
      }
      p.world.quake.pillar(x + 1.5, z, 4, 0);
      slam(set, x, z, r + 1, 0.5);
      dust(set, x, z, 1.6, r);
      debris(set, x, z, 14 + rank * 2, 16, 5, r);
    });
  },

  // Everything around the hero is thrown away at once; the ground under the hero caves in.
  repulse(set, job) {
    const p = set.player, { def, rank, force } = job, s = p.state, r = def.reach + rank * 0.8, y = ground(set, s.x, s.z);
    set.fx.wave('gravity', s.x, y, s.z, r);
    blow(set, job, s.x, s.z, force, r, 'launch', p.rooms.house ? 0 : def.crater + rank * 0.4);
    raze(set, s.x, s.z, r * 0.9, force * 0.6);
    for (const e of near(set, s.x, s.z, r)) addWeight(set, e, 1);
    // A ring of rubble hurled outward.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283, d = r * 0.5;
      set.fx.after(0.04 * i, () => set.fx.rock(s.x + Math.cos(a) * d, y, s.z + Math.sin(a) * d, 1 + Math.random() * 0.6, 2));
    }
    slam(set, s.x, s.z, r, 0.55);
    dust(set, s.x, s.z, 2, r * 0.6);
    debris(set, s.x, s.z, 20, 22, 0);
  },

  // Every foe in reach is dragged to one point; they crash together and it bursts.
  pull(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, { x, z } = aim, r = def.reach + rank * 1.5, t = time(set);
    const caught = near(set, s.x, s.z, r).filter((e) => !heavy(e));
    for (const e of caught) stagger(e, 0.9, t, true);
    const y = ground(set, x, z);
    set.fx.hole(x, y + 3, z, 2.4, 0.75);
    let left = 0.55, beat = 0;
    set.kit.push({
      busy: true,
      update(dt) {
        left -= dt;
        for (const e of caught) if (!e.dying) drag(e, x, z, 38);
        if ((beat -= dt) <= 0) {
          beat = 0.08;
          const e = caught[Math.floor(Math.random() * caught.length)];
          if (e && !e.dying) set.fx.glow(e.x, e.group.position.y + 1.5, e.z, 1.2, '#c8beff', 0.3, 0.4);
          set.fx.rock(x + (Math.random() - 0.5) * 4, y, z + (Math.random() - 0.5) * 4, 0.6, 1);
        }
        if (left > 0) return true;
        // The point bursts: they crash together.
        for (const e of caught) addWeight(set, e, 2);
        blow(set, job, x, z, force, 6 + rank * 0.5, 'knockdown', p.rooms.house ? 0 : 2);
        raze(set, x, z, 7, force * 0.5);
        slam(set, x, z, 7, 0.5);
        dust(set, x, z, 1.8, 6);
        debris(set, x, z, 16, 18, 4, 3);
        return false;
      },
    });
  },

  // The foes around the target float up with stones torn from the ground, then all of it falls at three times its weight.
  lift(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim, r = def.reach + rank * 0.5, secs = def.secs * grow(rank, 0.08), t = time(set);
    const caught = near(set, x, z, r).filter((e) => !heavy(e));
    for (const e of caught) {
      stagger(e, secs + 1, t, true);
      e.air = Math.max(e.air, 0.01);
      e.rise = 14 + Math.random() * 4;
      addWeight(set, e, 1);
    }
    // Stones torn out of the ground, and dents where they were.
    const stones = [];
    for (let i = 0; i < 8 + rank; i++) {
      const sh = set.fx.shell('gravity', 0.8 + Math.random() * 0.8);
      if (!sh) break;
      const a = Math.random() * 6.283, d = Math.random() * r, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
      if (i % 2 === 0) dent(set, sx, sz, 1.5, 3);
      stones.push({ sh, x: sx, z: sz, base: ground(set, sx, sz), up: 4 + Math.random() * 6, drift: Math.random() * 6, v: 0 });
    }
    set.fx.disc(x, ground(set, x, z), z, r, COLOR, secs + 0.4);
    dust(set, x, z, 1.4, r);
    shake(set, 0.2);
    let age = 0, landed = false;
    set.kit.push({
      update(dt) {
        age += dt;
        const now = time(set);
        for (const e of caught) if (!e.dying && age < secs) {
          if (e.air > 5) {
            e.hang = now + 0.15;
            e.rise = 0;
          }
          e.vel.set(0, 0);
        }
        if (age < secs) {
          const k = Math.min(1, age / 0.6);
          for (const s of stones) {
            s.sh.o.position.set(s.x + Math.sin(age * 1.3 + s.drift) * 0.4, s.base + 0.5 + s.up * k + Math.sin(age * 2 + s.drift) * 0.3, s.z);
            s.sh.o.rotation.x += dt * 1.2;
            s.sh.o.rotation.y += dt * 0.9;
          }
          return true;
        }
        // Released: three times the weight.
        if (!landed && age - dt < secs) for (const e of caught) if (!e.dying) Object.assign(e, { hang: 0, rise: -75 });
        let down = 0;
        for (const s of stones) {
          s.v += 70 * dt;
          const y = s.sh.o.position.y - s.v * dt;
          if (y <= s.base + 0.3) {
            if (s.sh.o.visible) {
              s.sh.o.visible = false;
              set.fx.rock(s.x, s.base, s.z, 0.9, 1.6);
            }
            down++;
          } else s.sh.o.position.y = y;
        }
        if (!landed && (down === stones.length || age > secs + 0.45)) {
          landed = true;
          blow(set, job, x, z, force, r + 1, 'knockdown', p.rooms.house ? 0 : def.reach * 0.25);
          raze(set, x, z, r, force * 0.7);
          for (const e of caught) addWeight(set, e, 2);
          slam(set, x, z, r + 2, 0.6);
          dust(set, x, z, 2, r);
          debris(set, x, z, 22, 20, 5, r);
        }
        return !landed;
      },
      end() { for (const s of stones) s.sh.o.visible = false; },
    });
    // Whatever is left afloat is put away once the blow has come.
    set.fx.after(secs + 0.9, () => { for (const s of stones) s.sh.o.visible = false; });
  },

  // Stones torn out of the ground circle the hero; each flies at the nearest foe that comes close.
  orbit(set, job) {
    const p = set.player, { def, rank, force } = job, n = def.count + rank, secs = def.secs * grow(rank, 0.1), reach = def.reach + rank;
    const stones = [];
    let left = secs, age = 0, cool = 0;
    // One stone out of the ground at a time, so each one takes a dent with it.
    const spawn = () => {
      const sh = set.fx.shell('gravity', 0.7 + Math.random() * 0.5);
      if (!sh) return null;
      const s = p.state, a = Math.random() * 6.283, sx = s.x + Math.cos(a) * 3, sz = s.z + Math.sin(a) * 3;
      if (Math.random() < 0.5) dent(set, sx, sz, 1.3, 3);
      set.fx.rock(sx, ground(set, sx, sz), sz, 0.8, 1.2);
      return { sh, mode: 'orbit', ang: a, foe: null, x: sx, y: ground(set, sx, sz), z: sz, back: 0 };
    };
    for (let i = 0; i < n; i++) {
      const st = spawn();
      if (st) stones.push(st);
    }
    dust(set, p.state.x, p.state.z, 1, 4);
    set.kit.push({
      update(dt) {
        left -= dt;
        age += dt;
        cool -= dt;
        const s = p.state, cy = ground(set, s.x, s.z) + s.air + 1.6 * p.body.heroScale, rad = 3.2 * p.body.heroScale;
        const ending = left <= 0;
        for (let i = 0; i < stones.length; i++) {
          const st = stones[i];
          if (st.mode === 'orbit') {
            st.ang += dt * 3;
            st.x = s.x + Math.cos(st.ang + i * 0.5) * rad;
            st.z = s.z + Math.sin(st.ang + i * 0.5) * rad;
            st.y = cy + Math.sin(age * 2 + i * 2) * 0.6;
            // The nearest foe that comes close: throw.
            if (!ending && cool <= 0) {
              const list = near(set, s.x, s.z, reach);
              let best = null, bd = 1e9;
              for (const e of list) {
                const d = Math.hypot(e.x - s.x, e.z - s.z);
                if (!e.dying && d < bd) { bd = d; best = e; }
              }
              if (best) {
                st.mode = 'fly';
                st.foe = best;
                st.fly = 0;
                cool = 0.18;
              }
            }
          } else if (st.mode === 'fly') {
            const e = st.foe, ty = e.dying ? st.y : e.group.position.y + 1.4, dx = e.x - st.x, dz = e.z - st.z, dy = ty - st.y, d = Math.hypot(dx, dz, dy) || 1;
            st.fly += dt;
            const step = 60 * dt;
            if (d <= step + e.radius || st.fly > 1.5) {
              blow(set, job, st.x, st.z, force * 0.8, 3.2, 'stagger', p.rooms.house ? 0 : 0.9, e.dying ? null : e);
              addWeight(set, e, 1);
              set.fx.impact('gravity', st.x, ground(set, st.x, st.z), st.z, 2);
              debris(set, st.x, st.z, 3, 8, 1, 1.5);
              st.mode = 'wait';
              st.back = 1.1;
              st.sh.o.visible = false;
            } else {
              st.x += (dx / d) * step;
              st.z += (dz / d) * step;
              st.y += (dy / d) * step;
            }
          } else if (st.mode === 'wait') {
            // A new stone is torn out after a moment.
            if (!ending && (st.back -= dt) <= 0) {
              const fresh = spawn();
              if (fresh) Object.assign(st, fresh);
              else st.back = 0.5;
            }
          }
          if (st.mode !== 'wait') {
            st.sh.o.position.set(st.x, st.y, st.z);
            st.sh.o.rotation.x += dt * 4;
            st.sh.o.rotation.y += dt * 3;
          }
          if (ending && st.mode === 'orbit') st.sh.o.visible = false;
        }
        if (!ending) return true;
        // The ones still in flight are let go.
        for (const st of stones) st.sh.o.visible = false;
        return false;
      },
    });
  },

  // A zone of crushing weight: foes pinned and sinking with their Structure ground down, houses fold, the land sinks.
  hundred(set, job, aim) {
    const p = set.player, { def, rank } = job, { x, z } = aim, r = def.reach + rank * 0.6, secs = def.secs * grow(rank, 0.1), y0 = ground(set, x, z);
    const f = p.body.might * 1.4 * grow(rank, 0.12);
    const m = p.melee.monsters, seen = new Set();
    let left = secs, beat = 0, tick = 0, second = 0;
    set.fx.disc(x, y0, z, r * 1.05, COLOR, secs);
    set.fx.hole(x, y0 + 6, z, 3, secs);
    slam(set, x, z, r, 0.45);
    dust(set, x, z, 2, r);
    set.kit.push({
      update(dt) {
        left -= dt;
        const t = time(set);
        if ((beat -= dt) <= 0) {
          beat = 0.25;
          tick++;
          const crowd = (second += 0.25) >= 1;
          if (crowd) second = 0;
          for (const e of near(set, x, z, r)) {
            if (e.dying) continue;
            if (!seen.has(e)) {
              seen.add(e);
              if (!heavy(e)) stagger(e, left + 0.6, t, true);
            }
            e.vel.set(0, 0);
            slow(e, 0.2, 0.5, t);
            e.sunkUntil = t + 0.4;
            e.sinkTo = heavy(e) ? 0.3 : 1.1;
            set.sting(e, p.body.might * def.dps * 0.25 * grow(rank, 0.1));
            m.wear(e, m.structure(e) * 0.08);
            if (crowd) addWeight(set, e, 1);
          }
          // Houses and trees fold, the ground caves in.
          const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r;
          const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
          raze(set, px, pz, 5, f);
          if (tick % 2 === 0) dent(set, px, pz, 2.6, 7);
          set.fx.rock(px, ground(set, px, pz), pz, 0.7 + Math.random() * 0.6, 1.5);
          dust(set, px, pz, 0.8, 2.5);
          set.fx.impact('gravity', px, ground(set, px, pz), pz, 2.2);
        }
        shake(set, 0.16);
        if (left > 0) return true;
        // Released: the last of it comes down.
        blow(set, job, x, z, f * 1.3, r, 'knockdown', p.rooms.house ? 0 : 3);
        raze(set, x, z, r, f);
        slam(set, x, z, r, 0.6);
        dust(set, x, z, 2, r);
        debris(set, x, z, 18, 18, 4, r * 0.6);
        return false;
      },
    });
  },

  // A hill is torn out of the land and brought down on the target.
  skyfall(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, { x, z } = aim, r = def.reach + rank * 0.8, y = ground(set, x, z);
    // Where the hill comes from: a hole behind the hero, and rock pillars heaving up.
    const sx = s.x - aim.dx * 9, sz = s.z - aim.dz * 9;
    dent(set, sx, sz, 5 + rank * 0.3, 7);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283;
      p.world.quake.pillar(sx + Math.cos(a) * 4, sz + Math.sin(a) * 4, 6 + Math.random() * 4, i * 0.05);
    }
    dust(set, sx, sz, 2, 5);
    shake(set, 0.4);
    // It is shown coming, and the place it will fall is marked.
    set.fx.disc(x, y, z, r, '#c8beff', def.wait + 0.3);
    set.fx.fall('gravity', x, y, z, def.wait, 6 + rank * 0.4);
    set.fx.after(def.wait, () => {
      const here = ground(set, x, z), big = r * 1.3;
      blow(set, job, x, z, force, r, 'fly', p.rooms.house ? 0 : def.crater + rank * 0.5, aim.target);
      raze(set, x, z, big, force * 0.8);
      for (const e of near(set, x, z, r * 0.5)) {
        addWeight(set, e, MAX_WEIGHT);
        if (!heavy(e)) {
          e.sunkUntil = time(set) + 1.5;
          e.sinkTo = 1.4;
        }
      }
      // The hill breaks up where it lands.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283 + Math.random();
        dent(set, x + Math.cos(a) * r * 0.55, z + Math.sin(a) * r * 0.55, 2.8, 6);
      }
      if (!p.rooms.house) p.world.quake.shatter(x, z, r * 1.5, 0.8, (cx, cz, size) => p.melee.canTear(cx, cz, size), () => p.world.work.saveGone());
      set.fx.impact('gravity', x, here, z, r * 1.2);
      set.fx.wave('gravity', x, here, z, r * 1.8);
      p.world.vfx.shock(x, here, z, r * 2.4, '#c8beff', 0.6);
      p.world.smoke?.column(x, here, z, 2, 10);
      dust(set, x, z, 3, r);
      debris(set, x, z, 40, 28, 8, r);
      shake(set, 0.9);
      p.world.work.stop = 0.1;
      p.world.work.impact = 0.08;
    });
  },

  // A black star: it drags in foes, trees and houses and crushes them, then collapses in one blast.
  singularity(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim, r = def.reach + rank * 1.2, secs = def.secs + rank * 0.15, y = ground(set, x, z);
    const f = force * 0.35;
    set.fx.hole(x, y + 5, z, 4 + rank * 0.3, secs + 0.1);
    set.fx.disc(x, y, z, r, COLOR, secs);
    shake(set, 0.3);
    let age = 0, beat = 0, spin = 0;
    set.kit.push({
      busy: true,
      update(dt) {
        age += dt;
        spin += dt * 4;
        const t = time(set), k = Math.min(1, age / secs);
        // Foes are dragged in harder as it grows.
        for (const e of near(set, x, z, r)) {
          if (e.dying) continue;
          if (!heavy(e)) {
            if (e.mode !== 'reeling') stagger(e, 0.5, t, true);
            drag(e, x, z, 14 + k * 26);
          } else slow(e, 0.4, 0.4, t);
        }
        if ((beat -= dt) <= 0) {
          beat = 0.35;
          // The pull widens: everything built in a closing ring is torn apart, and the land sinks.
          const reach = r * (0.35 + 0.65 * k);
          raze(set, x, z, reach, f);
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * 6.283, d = Math.random() * reach;
            dent(set, x + Math.cos(a) * d, z + Math.sin(a) * d, 2.6, 8);
          }
          for (const e of near(set, x, z, r)) {
            set.sting(e, p.body.might * 0.3);
            addWeight(set, e, 1);
          }
          set.fx.glow(x, y + 5, z, 6 + k * 6, '#3a2e8a', 0.4, 1.4);
          shake(set, 0.2 + k * 0.3);
        }
        // Debris spirals in.
        for (let i = 0; i < 2; i++) {
          const a = spin + i * 3.14 + Math.random(), d = r * (0.3 + Math.random() * 0.7);
          const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
          p.world.vfx.burst(px, ground(set, px, pz) + 1 + Math.random() * 3, pz, DARK, 2, -3 - k * 4);
        }
        if (Math.random() < 0.3) {
          const a = Math.random() * 6.283, d = r * Math.random();
          set.fx.rock(x + Math.cos(a) * d, ground(set, x, z), z + Math.sin(a) * d, 0.8, 1.2);
        }
        if (age < secs) return true;
        // It collapses.
        const near4 = near(set, x, z, 4);
        blow(set, job, x, z, force, r * 0.75, 'fly', p.rooms.house ? 0 : def.crater + rank * 0.5);
        raze(set, x, z, r * 0.8, force);
        for (const e of near4) if (!e.dying) crush(set, e);
        dent(set, x, z, 7 + rank * 0.4, 10);
        set.fx.impact('gravity', x, y, z, r * 0.6);
        set.fx.wave('gravity', x, y, z, r);
        p.world.vfx.shock(x, y, z, r * 1.3, '#c8beff', 0.6);
        p.world.smoke?.column(x, y, z, 3, 12);
        dust(set, x, z, 3, r * 0.5);
        debris(set, x, z, 40, 30, 8, r * 0.4);
        shake(set, 1);
        p.world.work.stop = 0.12;
        p.world.work.impact = 0.1;
        return false;
      },
    });
  },

  // Every blow the hero lands makes the foe Heavier; heavy foes take a little more from the next blow.
  blow(set, e) {
    if (!e || e.dying) return 1;
    const t = time(set);
    if (e.weightAt !== undefined && t - e.weightAt > WEIGHT_HOLD + (e.weight ?? 0) / WEIGHT_FADE) e.weight = 0;
    const before = e.weight ?? 0;
    addWeight(set, e, 1);
    if (e.weight > before && e.weight < MAX_WEIGHT && e.weight >= 3) {
      set.player.world.vfx.burst(e.x, e.group.position.y + 2.2, e.z, DARK, 5, 4);
    }
    return 1 + before * 0.05;
  },

  // Weight: heavy foes are slower; it fades slowly; at full Weight the foe is crushed.
  tick(set, dt) {
    const list = set.weighted;
    if (!list?.size) return;
    const t = time(set);
    for (const e of list) {
      if (e.dying || !(e.weight > 0)) {
        e.weight = 0;
        list.delete(e);
        continue;
      }
      if (e.weight >= MAX_WEIGHT) {
        crush(set, e);
        continue;
      }
      if (e.weight >= 1) slow(e, 1 - e.weight * (heavy(e) ? 0.05 : 0.1), 0.3, t);
      if (t - e.weightAt > WEIGHT_HOLD) e.weight = Math.max(0, e.weight - WEIGHT_FADE * dt);
    }
  },
};

// Collapse: the sky's weight comes down. Everything in reach is lifted and held, then pressed flat at once.
const POWER = 30;
export const GRAVITY_ULT = {
  name: 'Collapse', secs: 3.6, color: COLOR, tint: '#3a2e8a', reach: 40,
  start(u) {
    const { state } = u.p;
    // It grows with the Starcrusher: wider and harder as Mastery rises.
    u.reach = Math.min(70, 34 + u.p.powers.mastery * 1.2);
    u.might = 1 + u.p.powers.mastery * 0.015;
    u.lift = u.foes(u.reach).filter((e) => !e.boss);
    for (const e of u.lift) Object.assign(e, { rise: 16 + Math.random() * 6, air: Math.max(e.air, 0.01), hang: 0 });
    u.world.fx.disc(state.x, u.ground(state.x, state.z), state.z, u.reach, COLOR, this.secs - 0.5);
    u.world.fx.hole(state.x, u.ground(state.x, state.z) + 22, state.z, 8, 2.1);
    u.pose('gather');
  },
  tick(u, t) {
    const { state } = u.p, fx = u.world.fx;
    u.pose(t < 1.6 ? 'peak' : 'slam');
    u.world.work.shake = Math.max(u.world.work.shake, 0.15 + Math.min(1, t) * 0.4);
    u.world.work.shakeAt = state;
    // Stones torn up and held in the air while the weight builds.
    if (t < 1.6 && Math.random() < 0.9) {
      const a = Math.random() * 6.283, d = 5 + Math.random() * u.reach * 0.8, x = state.x + Math.cos(a) * d, z = state.z + Math.sin(a) * d;
      fx.rock(x, u.ground(x, z), z, 0.9 + Math.random() * 1.4, 2.2);
      u.world.smoke?.dust(x, u.ground(x, z) + 0.5, z, '#8a8294', 1.5, 4);
    }
    // Held up: they stay where they float until the weight comes down.
    if (t > 0.4 && t < 1.6) for (const e of u.lift) if (!e.dying && e.air > 6) Object.assign(e, { hang: u.time + 0.1, rise: 0 });
  },
  beats: [
    [1.6, (u) => {
      for (const e of u.lift) if (!e.dying) Object.assign(e, { hang: 0, rise: -90 });
    }],
    [1.9, (u) => {
      const { state, melee } = u.p, x = state.x, z = state.z, y = u.ground(x, z), r = u.reach;
      u.strike(x, z, POWER * u.might, r, u.p.rooms.house ? 0 : 8, 'knockdown');
      raze({ player: u.p }, x, z, r, POWER * u.might * u.p.body.might);
      if (!u.p.rooms.house) {
        melee.tear(x, z, r * 0.4, 30);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * 6.283 + Math.random() * 0.4, d = r * (0.45 + Math.random() * 0.4);
          melee.tear(x + Math.cos(a) * d, z + Math.sin(a) * d, r * 0.16, 14);
        }
      }
      for (const e of u.lift) {
        if (e.dying) continue;
        u.p.melee.monsters.wear(e, u.p.melee.monsters.structure(e));
        e.sunkUntil = u.time + 2;
        e.sinkTo = 1.4;
      }
      u.world.quake.throwStones(x, y, z, 40, 28);
      u.world.fx.impact('gravity', x, y, z, r * 0.5);
      u.world.fx.wave('gravity', x, y, z, r);
      u.world.vfx.shock(x, y, z, r + 2, '#c8beff', 0.8);
      u.world.smoke?.column(x, y, z, 3, 12);
      u.boom(1);
    }],
    [2.3, (u) => {
      // The aftershock.
      const { state } = u.p, y = u.ground(state.x, state.z);
      u.world.vfx.shock(state.x, y, state.z, u.reach * 1.4, '#8a7aff', 0.9);
      u.world.quake.throwStones(state.x, y, state.z, 24, 20);
      u.boom(0.6);
    }],
  ],
};
