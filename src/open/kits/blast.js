import { near, ground, time, world, blow, hit, raze, cone, shake, terror } from './common.js';

// The Cataclyst's kit (v0.55.x): everything is an explosion. Same shape as kits/ember.js.
//   Every power is built from boom(): a blast that craters the ground, throws foes, breaks what is built,
//   scorches the land, and leaves fire, smoke and a shaken screen behind.
//   Pressure (set.pressure, 0..100) rises with every blast and fades out of a fight. At 100 the next power
//   goes off at twice the size (force and crater x2, reach x1.6), and the Pressure is spent.
//   Chain Reaction: a foe that dies while scorched (e.scorchUntil, set on every foe a blast touches)
//   explodes too, a little later, and that can kill the next one. Capped per second.
// Hooks: killed (chain), tick (Pressure fades, the body glows), meter (the HUD bar).
// Foe field set: e.scorchUntil (seconds on the monsters clock).
const COL = '#ffb030', GLOW = '#ffd060', HOT = '#fff4c0', SMOKE = '#2e2a28';
const FAT = 1.25;                 // every blast is drawn and cut this much wider than its number
const MOST = 100, BIG_REACH = 1.6, BIG_FORCE = 2;
const FADE_AFTER = 8, FADE = 4;   // Pressure fades this fast (a second) once this long has passed since the last blast
const SCORCH = 3;                 // seconds a blast leaves a foe scorched
const CHAIN_CAP = 12, CHAIN_FORCE = 1.6, CHAIN_MIN = 3;
const WIND_SECS = 2.2, WIND_ROOT = 0.5;
const CHAIN_JOB = { pid: 'palm', color: COL };

export const pressureOf = (set) => set.pressure ?? 0;
const swell = (set, n) => {
  set.pressure = Math.min(MOST, pressureOf(set) + n);
  set.pressureAt = time(set);
};

// Full Pressure is spent on the power being cast: returns how much bigger it goes (1 or 2).
function spend(set) {
  if (pressureOf(set) < MOST) return 1;
  const p = set.player, s = p.state;
  set.pressure = 0;
  p.hud.message('Full Pressure! Twice the blast.', true);
  p.world.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 8, HOT, 0.4);
  return 2;
}
const bigJob = (job, big) => (big > 1 ? { ...job, force: job.force * BIG_FORCE } : job);
const widen = (r, big) => (big > 1 ? r * BIG_REACH : r);
const deepen = (c, big) => (big > 1 ? c * 2 : c);

// One explosion at (x, z). o: { force, reach, crater, react, gain, chain, razed, stones, column }
function boom(set, job, x, z, o) {
  const p = set.player, w = p.world, g = ground(set, x, z), t = time(set), house = !!p.rooms.house;
  const reach = o.reach * FAT, react = o.react ?? 'knockdown', crater = house ? 0 : (o.crater ?? 0);
  // Foes already scorched or lit take more from a Cataclyst who has trained the discipline (nature.edge).
  const edge = [];
  for (const e of near(set, x, z, reach)) {
    const k = p.nature.edge(e);
    if (k > 1) edge.push([e, k]);
    e.scorchUntil = t + SCORCH;
  }
  blow(set, job, x, z, o.force, reach, react, crater, null);
  for (const [e, k] of edge) hit(set, job.pid, e, o.force * (k - 1) * 0.5, null);
  if (o.razed) raze(set, x, z, reach * o.razed, o.force * 0.6);
  // Fire, smoke and light.
  set.fx.impact('blast', x, g, z, reach * 0.6);
  const fires = Math.min(8, 2 + Math.round(reach / 3));
  for (let i = 0; i < fires; i++) {
    const a = Math.random() * 6.283, d = Math.random() * reach * 0.5;
    set.fx.flame(x + Math.cos(a) * d, g, z + Math.sin(a) * d, 3 + reach * 0.35 + Math.random() * 2, 0.7, 0);
  }
  w.vfx.shock(x, g, z, reach * 1.3, o.chain ? COL : GLOW, 0.45);
  w.vfx.burst(x, g + 1, z, [COL, HOT, '#ff6a1a'], Math.min(40, Math.round(8 + reach * 1.5)), 9 + reach * 0.7);
  const sm = w.smoke;
  if (sm) {
    for (let i = 0; i < (reach > 8 ? 4 : 2); i++) {
      sm.puff(x + (Math.random() - 0.5) * reach * 0.4, g + 1, z + (Math.random() - 0.5) * reach * 0.4, { size: reach * 0.3 + 1, grow: 1.1, life: 4.5, tint: SMOKE, alpha: 0.55, heat: 0.9, lift: 3, spread: 1 });
    }
    sm.dust(x, g + 0.4, z, '#6a5a48', reach / 6, Math.min(8, reach * 0.35));
    if (reach >= 8 || o.column) sm.column(x, g, z, Math.min(3.5, o.column ?? reach / 9), 4 + reach * 0.3);
  }
  w.scars.mark('blast', x, z, reach * 0.8, p, 2, 0.6);
  if (o.stones) w.quake.throwStones(x, g, z, o.stones, 14 + reach * 0.5);
  // Shake and hit-stop grow with the blast; a chained one is quieter.
  shake(set, Math.min(1, (o.chain ? 0.06 : 0.14) + reach * 0.02));
  if (!o.chain) {
    w.work.impact = Math.max(w.work.impact ?? 0, 0.06);
    if (reach > 10) w.work.stop = Math.max(w.work.stop ?? 0, 0.06 + Math.min(0.1, reach * 0.003));
  }
  swell(set, o.gain ?? Math.min(16, 2 + reach * 0.8));
}

// A blast that does not interrupt anything: scorches, throws, and nothing else.
const quick = (set, job, x, z, force, reach, o = {}) => boom(set, job, x, z, { force, reach, ...o });

// A bright spot that must be redrawn each frame.
const spark = (set, x, y, z, size, color = HOT) => set.fx.glow(x, y, z, size, color, 0.12, 0.7);

export const BLAST = {
  meter(set) {
    const v = pressureOf(set) / MOST;
    return { value: v, color: COL, hot: v >= 1, label: 'Pressure' };
  },

  tick(set, dt) {
    const p = set.player, t = time(set);
    if (t - (set.pressureAt ?? -99) > FADE_AFTER) set.pressure = Math.max(0, pressureOf(set) - FADE * dt);
    // The body glows with the Pressure, unless a Surge is already lighting it.
    if (!(p.wrath?.surge > 0)) {
      const v = pressureOf(set) / MOST;
      p.hero.glow = v > 0.25 ? COL : null;
      p.hero.glowAmount = v * 0.3 + (v >= 1 ? Math.sin(t * 14) * 0.1 + 0.1 : 0);
    }
  },

  // A foe that dies scorched, by a blast of yours, blows up too (and the next one may follow).
  killed(set, e) {
    const p = set.player, t = time(set);
    if (!(e.scorchUntil > t)) return;
    e.scorchUntil = 0;
    if (t - (set.chainAt ?? -9) >= 1) {
      set.chainAt = t;
      set.chainN = 0;
    }
    if (set.chainN >= CHAIN_CAP) return;
    set.chainN++;
    const x = e.x, z = e.z, size = e.radius ?? 1;
    set.fx.after(0.1 + Math.random() * 0.15, () => {
      p.world.work.actor = p;
      boom(set, CHAIN_JOB, x, z, { force: p.body.might * CHAIN_FORCE * (0.8 + size * 0.3), reach: CHAIN_MIN + size * 1.6, crater: size > 1.5 ? 0.6 : 0, react: 'launch', chain: true, gain: 2 });
      p.nature.deed('pyrotechnics');
    });
  },

  // An explosion from the open hand: a cone of everything blown away, and you kicked back.
  palm(set, job, aim) {
    const big = spend(set), j = bigJob(job, big), { def, rank } = job, s = set.player.state;
    const reach = widen(def.reach * (1 + rank * 0.06), big), crater = deepen(def.crater, big);
    const hx = s.x + aim.dx * 1.4, hz = s.z + aim.dz * 1.4, hy = ground(set, s.x, s.z) + s.air + 1.5;
    set.fx.glow(hx, hy, hz, 4, HOT, 0.25, 1.6);
    set.fx.after(0.05, () => {
      quick(set, j, s.x + aim.dx * reach * 0.35, s.z + aim.dz * reach * 0.35, j.force * 0.7, reach * 0.4, { react: 'launch', crater: crater * 0.5, gain: 5 });
    });
    set.fx.after(0.12, () => {
      boom(set, j, s.x + aim.dx * reach * 0.8, s.z + aim.dz * reach * 0.8, { force: j.force, reach: reach * 0.7, crater, react: 'launch', razed: 0.8, stones: big > 1 ? 14 : 0, gain: 8 });
    });
    // The kick back; dash looks for walls so you are not thrown through them.
    set.dash({ ...j, def: { dist: 4, power: 0 } }, { dx: -aim.dx, dz: -aim.dz });
    set.player.nature.deed('pyrotechnics', 0.3);
  },

  // A charge that sticks to whatever it hits (the ground, if it hits nothing) and goes off.
  sticky(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state;
    const reach = widen(def.blast * (1 + rank * 0.06), big), crater = deepen(def.crater, big);
    const speed = 75, fuse = def.fuse;
    let x = s.x + aim.dx * 1.6, z = s.z + aim.dz * 1.6, flown = 0, stuck = null, left = fuse, beat = 0;
    const range = def.range * (1 + rank * 0.04);
    set.kit.push({
      update(dt) {
        if (flown < range && !stuck) {
          const step = speed * dt;
          x += aim.dx * step;
          z += aim.dz * step;
          flown += step;
          const y = ground(set, x, z) + 1.6;
          spark(set, x, y, z, 1.8, GLOW);
          set.fx.flame(x, y - 0.6, z, 2.6, 0.3, 0);
          for (const e of near(set, x, z, 1.8)) {
            stuck = e;
            hit(set, job.pid, e, j.force * 0.12, 'flinch');
            set.fx.glow(x, y, z, 4, HOT, 0.2, 1.6);
            break;
          }
          if (stuck) return true;
          if (flown < range) return true;
          set.fx.glow(x, y, z, 3, HOT, 0.2, 1.4);
        }
        if (stuck && !stuck.dying) {
          x = stuck.x;
          z = stuck.z;
        }
        left -= dt;
        // It blinks faster as it burns down.
        if ((beat -= dt) <= 0) {
          beat = 0.05 + Math.max(0, left) * 0.12;
          spark(set, x, ground(set, x, z) + (stuck ? stuck.group.position.y + 1.4 : 0.8), z, 2.4 + (1 - left / fuse) * 2, left < 0.4 ? '#ffffff' : COL);
        }
        if (left > 0) return true;
        boom(set, j, x, z, { force: j.force, reach, crater, react: 'launch', razed: 0.9, stones: big > 1 ? 10 : 6 });
        set.player.nature.deed('pyrotechnics', 0.3);
        return false;
      },
    });
  },

  // Glowing mines that drift after the nearest foes and burst on them.
  mines(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state;
    const n = def.count + Math.floor(rank / 2), reach = widen(def.blast * (1 + rank * 0.05), big);
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random() * 0.5;
      list.push({ x: s.x + Math.cos(a) * 2.5, z: s.z + Math.sin(a) * 2.5, y: 2.2 + Math.random(), a, prey: null, look: 0, life: 9, sh: set.fx.shell('blast', 0.45) });
    }
    set.fx.glow(s.x, ground(set, s.x, s.z) + 1.4, s.z, 5, GLOW, 0.3, 1.6);
    let t = 0;
    set.kit.push({
      update(dt) {
        t += dt;
        let alive = 0;
        for (const m of list) {
          if (m.dead) continue;
          m.life -= dt;
          // Choose the nearest foe now and then; with none, drift round the hero.
          if ((m.look -= dt) <= 0 || (m.prey && m.prey.dying)) {
            m.look = 0.35;
            m.prey = null;
            let best = 40;
            for (const e of near(set, m.x, m.z, 40)) {
              const d = Math.hypot(e.x - m.x, e.z - m.z);
              if (d < best) { best = d; m.prey = e; }
            }
          }
          const tx = m.prey ? m.prey.x : s.x + Math.cos(m.a + t) * 4, tz = m.prey ? m.prey.z : s.z + Math.sin(m.a + t) * 4;
          const d = Math.hypot(tx - m.x, tz - m.z) || 1, v = m.prey ? 9 + Math.min(11, (9 - m.life) * 3) : 6;
          m.x += (tx - m.x) / d * Math.min(d, v * dt);
          m.z += (tz - m.z) / d * Math.min(d, v * dt);
          const g = ground(set, m.x, m.z), want = m.prey ? m.prey.group.position.y + 1.4 : g + 2.4 + Math.sin(t * 3 + m.a);
          m.y += (want - m.y) * Math.min(1, dt * 5);
          const y = Math.max(g + 0.8, m.y);
          if (m.sh) m.sh.o.position.set(m.x, y, m.z);
          spark(set, m.x, y, m.z, 1.2 + Math.sin(t * 12 + m.a) * 0.3, GLOW);
          if (Math.random() < dt * 8) set.fx.flame(m.x, y - 0.3, m.z, 1.4, 0.3, 0);
          if ((m.prey && Math.hypot(m.prey.x - m.x, m.prey.z - m.z) < 1.8) || m.life <= 0) {
            m.dead = true;
            if (m.sh) m.sh.o.visible = false;
            boom(set, j, m.x, m.z, { force: j.force, reach, crater: def.crater ?? 0.6, react: 'launch', gain: 2.5 });
            continue;
          }
          alive++;
        }
        if (alive) return true;
        return false;
      },
    });
    p.nature.deed('pyrotechnics', 0.2);
  },

  // A line of explosions marching ahead, each bigger than the last.
  carpet(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state;
    const n = def.count + Math.floor(rank / 2), x0 = s.x, z0 = s.z;
    for (let i = 0; i < n; i++) {
      const d = 3.5 + i * def.step, k = i / Math.max(1, n - 1);
      const x = x0 + aim.dx * d, z = z0 + aim.dz * d;
      set.fx.after(0.08 + i * 0.1, () => {
        boom(set, j, x, z, {
          force: j.force * (0.45 + k * 0.7), reach: widen((3.4 + i * 0.55) * (1 + rank * 0.04), big), crater: deepen(def.crater * (0.5 + k), big),
          react: 'launch', razed: 0.8, gain: 3, column: i === n - 1 ? 3 : undefined, stones: i === n - 1 ? 8 : 0,
        });
      });
    }
    p.nature.deed('pyrotechnics', 0.3);
  },

  // An explosion under the feet throws you at the target; you land as a second one.
  rocket(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state;
    const reach = widen(def.reach * (1 + rank * 0.06), big), crater = deepen(def.crater, big);
    quick(set, j, s.x, s.z, j.force * 0.6, reach * 0.6, { react: 'launch', crater: crater * 0.6, gain: 5, stones: 6 });
    set.dash({ ...j, def: { ...def, power: 0 } }, aim);
    s.rise = Math.max(s.rise ?? 0, 12);
    s.air = Math.max(s.air, 0.05);
    let beat = 0;
    set.kit.push({
      busy: true,
      update(dt) {
        const y = ground(set, s.x, s.z) + s.air;
        if (set.dashing) {
          // A trail of small bursts behind the flight.
          if ((beat -= dt) <= 0) {
            beat = 0.07;
            set.fx.flame(s.x - aim.dx * 1.2, y + 0.4, s.z - aim.dz * 1.2, 4, 0.5, 0);
            set.player.world.vfx.burst(s.x, y + 1, s.z, [COL, HOT], 4, 8);
            if (Math.random() < 0.5) quick(set, j, s.x - aim.dx * 2, s.z - aim.dz * 2, j.force * 0.15, 2.8, { chain: true, gain: 0.5 });
          }
          return true;
        }
        // Landed: the second blast.
        boom(set, j, s.x, s.z, { force: j.force * 1.2, reach: reach * 1.3, crater, react: 'launch', razed: 0.9, stones: 12 });
        return false;
      },
    });
    p.nature.deed('pyrotechnics', 0.3);
  },

  // A clap: the air ahead bursts outward and flattens a cone, houses and trees with it.
  clap(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state;
    const reach = widen(def.reach * (1 + rank * 0.06), big), g = ground(set, s.x, s.z);
    const w = p.world;
    w.vfx.shock(s.x + aim.dx, g, s.z + aim.dz, reach * 0.5, '#ffffff', 0.25);
    w.vfx.shock(s.x + aim.dx * 2, g, s.z + aim.dz * 2, reach * 0.9, GLOW, 0.4);
    w.work.impact = Math.max(w.work.impact ?? 0, 0.06);
    // Everything in the cone is thrown off its feet at once.
    for (const e of cone(set, s.x, s.z, aim.dx, aim.dz, reach, def.cone)) {
      e.scorchUntil = time(set) + SCORCH;
      hit(set, job.pid, e, j.force * 0.5, 'launch');
    }
    // Then the blasts roll out along the cone and flatten what is built.
    for (let i = 0; i < 4; i++) {
      const d = reach * (0.2 + i * 0.22), x = s.x + aim.dx * d, z = s.z + aim.dz * d;
      set.fx.after(0.06 + i * 0.07, () => {
        boom(set, j, x, z, { force: j.force * (0.5 + i * 0.1), reach: 4 + i * 1.6, crater: i === 3 ? deepen(1, big) : 0, react: 'knockdown', razed: 1.4, gain: 4 });
      });
    }
    p.nature.deed('pyrotechnics', 0.3);
  },

  // One bomb high into the air: it splits and the pieces rain over the target.
  cluster(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state;
    const n = def.count + Math.floor(rank / 2) * 2, spread = widen(def.reach * (1 + rank * 0.04), big);
    const tx = aim.x, tz = aim.z, up = 34, rise = 0.55;
    let t = 0, split = false;
    const sh = set.fx.shell('blast', 0.9);
    set.kit.push({
      update(dt) {
        t += dt;
        const k = Math.min(1, t / rise);
        const x = s.x + (tx - s.x) * k * 0.5, z = s.z + (tz - s.z) * k * 0.5, y = ground(set, s.x, s.z) + 2 + up * k * (2 - k);
        if (sh && !split) sh.o.position.set(x, y, z);
        spark(set, x, y, z, 2.4, GLOW);
        set.fx.flame(x, y - 1, z, 3, 0.4, 0);
        if (t < rise) return true;
        if (split) return false;
        split = true;
        if (sh) sh.o.visible = false;
        set.fx.glow(x, y, z, 10, HOT, 0.4, 2);
        p.world.vfx.burst(x, y, z, [COL, HOT, '#ff6a1a'], 36, 18);
        p.world.smoke?.puff(x, y, z, { size: 4, grow: 2, life: 4, tint: '#4a4440', alpha: 0.5, heat: 0.6, lift: 0.5, spread: 3 });
        // The pieces: each falls on its own spot around the target.
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * spread, bx = tx + Math.cos(a) * d, bz = tz + Math.sin(a) * d;
          const fall = 0.55 + Math.random() * 0.6, gy = ground(set, bx, bz);
          set.fx.fall('blast', bx, gy, bz, fall, 0.7);
          set.fx.after(fall, () => {
            boom(set, j, bx, bz, { force: j.force * 0.75, reach: 3.6 * (1 + rank * 0.04), crater: deepen(def.crater, big), react: 'launch', razed: 0.8, gain: 1.5 });
          });
        }
        return false;
      },
    });
    p.nature.deed('pyrotechnics', 0.3);
  },

  // Gather everything for a breath, then one explosion where the town stood. It leaves you winded.
  grand(set, job, aim) {
    const p = set.player, big = spend(set), j = bigJob(job, big), { def, rank } = job, s = p.state, w = p.world;
    const reach = widen(def.reach * (1 + rank * 0.05), big), crater = deepen(def.crater, big), charge = def.charge;
    const x = s.x, z = s.z, g = ground(set, x, z);
    const orb = set.fx.glow(x, g + 3, z, 2, GLOW, -1, 1);
    orb.life = 99;
    let t = 0, whine = 0;
    w.vfx.tint('#ffe9b0', 0.35, charge + 0.2);
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / charge);
        set.casting = 0.2;
        set.pose = 'gather';
        p.guard = Math.max(p.guard, 0.2);
        // A light swelling over the hand, and fire drawn in from the land.
        orb.o.position.set(x, ground(set, x, z) + s.air + 3.2 + k * 2, z);
        orb.o.scale.setScalar(2 + k * k * 22);
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * 6.283, d = (1 - k * 0.7) * reach * 0.6 * (0.3 + Math.random() * 0.7);
          set.fx.flame(x + Math.cos(a) * d, g, z + Math.sin(a) * d, 2.5 + k * 3, 0.35, 0);
        }
        if (Math.random() < 0.6) w.vfx.burst(x, g + 3, z, [COL, HOT], 2, 4 + k * 8);
        shake(set, 0.08 + k * 0.4);
        // The rising whine.
        if ((whine -= dt) <= 0) {
          whine = 0.14;
          set.player.world.sfx?.('orb', x, z, 0.4 + k * 0.5, 0.6 + k * 1.8);
        }
        if (t < charge) return true;
        // Release.
        orb.age = orb.life;
        orb.o.visible = false;
        const force = j.force;
        w.vfx.tint('#ffffff', 0.95, 0.35);
        w.work.stop = Math.max(w.work.stop ?? 0, 0.2);
        w.work.impact = Math.max(w.work.impact ?? 0, 0.1);
        w.work.lines = Math.max(w.work.lines ?? 0, 0.4);
        p.hud.flash?.(0.7);
        boom(set, j, x, z, { force, reach, crater, react: 'launch', razed: 1.2, stones: 34, column: 3.5, gain: 20 });
        if (!p.rooms.house) p.melee.tear(x, z, crater * 1.3, 14);
        w.scars.mark('blast', x, z, reach, p, 6, 1);
        // Rings racing out, everything built in reach flattened as they pass, and a mushroom of smoke.
        for (let i = 1; i <= 3; i++) {
          set.fx.after(i * 0.12, () => {
            w.vfx.shock(x, g, z, reach * (0.5 + i * 0.4), i % 2 ? HOT : COL, 0.6);
            raze(set, x, z, reach * (0.55 + i * 0.25), force * 0.5);
          });
        }
        const sm = w.smoke;
        if (sm) {
          for (let i = 0; i < 9; i++) sm.puff(x + (Math.random() - 0.5) * 3, g + 2 + i * 3.2, z + (Math.random() - 0.5) * 3, { size: 3 + i * 0.3, grow: 1.4, life: 9, tint: i < 3 ? '#3a3430' : SMOKE, alpha: 0.6, heat: 0.8, lift: 5, spread: 0.6, drag: 0.1 });
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * 6.283;
            sm.puff(x + Math.cos(a) * 4, g + 32, z + Math.sin(a) * 4, { size: 7, grow: 2.2, life: 10, tint: '#4a4440', alpha: 0.55, heat: 0.3, lift: 1, spread: 5, drag: 0.15 });
          }
        }
        terror(set, x, z, reach * 2, 10);
        // Winded: slow for a couple of seconds and rooted for a moment.
        const now = time(set);
        p.slowUntil = Math.max(p.slowUntil ?? 0, now + WIND_SECS);
        p.rootUntil = Math.max(p.rootUntil ?? 0, now + WIND_ROOT);
        p.hud.message('Winded.');
        p.nature.deed('pyrotechnics', 2);
        return false;
      },
    });
  },
};

// The Wrath ultimate: Doomsday. The hero rises, a sun-bright core swells overhead, then falls and detonates.
const POWER = 30;             // an ultimate's blow at its heart, in the hero's might (same as ultimate.js)
export const BLAST_ULT = {
  name: 'Doomsday', secs: 4.4, color: '#ffb030', tint: '#ffe9b0', mood: 0.45, reach: 45,
  start(u) {
    const { state, powers } = u.p;
    // It feeds on Pressure and grows with Mastery.
    u.grow = Math.min(2, (1 + pressureOf(powers) / MOST * 0.5) * (1 + (powers.mastery ?? 0) * 0.01));
    powers.pressure = 0;
    u.reach = Math.min(75, 42 * u.grow);
    u.sun = u.world.fx.glow(state.x, state.y + 14, state.z, 2, GLOW, -1, 1);
    u.sun.life = 99;
    u.core = u.world.fx.shell('blast', 1);
    u.size = 1;
    u.tx = state.x;
    u.tz = state.z;
    u.pose('peak');
  },
  tick(u, t) {
    const { state, melee } = u.p, fx = u.world.fx, topY = state.y + 16;
    let ax = state.x, ay, az = state.z, size;
    if (t < 2) {
      // Up into the sky, and a sun swelling over the raised hand.
      melee.hover = 0.3;
      state.air = Math.min(14, state.air + 0.3);
      size = 1 + Math.min(1, t / 1.9) * 9 * Math.min(1.6, u.grow);
      ay = state.y + state.air + 5 + size;
      u.topY = ay;
      u.pose('peak');
      u.world.work.shake = Math.max(u.world.work.shake, 0.1 + t * 0.2);
      u.world.work.shakeAt = state;
    } else if (t < 2.9) {
      // It falls on the spot below, faster as it goes.
      const k = Math.min(1, (t - 2) / 0.9), gy = u.ground(u.tx, u.tz) + 1;
      size = u.size;
      ax = u.tx;
      az = u.tz;
      ay = u.topY * (1 - k * k) + gy * k * k;
      u.pose('slam');
    } else {
      return;
    }
    u.size = size;
    u.sun.o.position.set(ax, ay, az);
    u.sun.o.scale.setScalar(size * 5);
    if (u.core) {
      u.core.o.position.set(ax, ay, az);
      u.core.o.scale.setScalar(size * 0.9);
      u.core.o.rotation.y += 0.06;
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.283, b = Math.random() * 3.14;
      fx.flame(ax + Math.cos(a) * Math.sin(b) * size, ay + Math.cos(b) * size - size, az + Math.sin(a) * Math.sin(b) * size, size * 0.9, 0.35, 0);
    }
    u.world.vfx.burst(ax, ay, az, [HOT, COL, '#ff5a1a'], 3, size * 2, { fall: 0.1 });
    void topY;
  },
  beats: [
    [2.9, (u) => {
      const { state } = u.p, x = u.tx, z = u.tz, y = u.ground(x, z), reach = u.reach, w = u.world, p = u.p, set = p.powers;
      u.sun.age = u.sun.life;
      u.sun.o.visible = false;
      if (u.core) u.core.o.visible = false;
      w.vfx.tint('#ffffff', 1, 0.4);
      u.strike(x, z, POWER * u.grow, reach, 16, 'launch');
      for (const e of u.foes(reach, { x, z })) e.scorchUntil = u.time + SCORCH;
      raze(set, x, z, reach, p.body.might * POWER * u.grow);
      if (!p.rooms.house) p.melee.tear(x, z, reach * 0.35, 26);
      w.scars.mark('blast', x, z, reach * 0.9, p, 6, 1);
      w.quake.throwStones(x, y, z, 40, 30);
      set.fx.impact('blast', x, y, z, 18);
      for (let i = 1; i <= 4; i++) {
        set.fx.after(i * 0.15, () => {
          w.vfx.shock(x, y, z, reach * (0.4 + i * 0.3), i % 2 ? HOT : COL, 0.7);
          if (i < 4) raze(set, x, z, reach * (0.5 + i * 0.2), p.body.might * POWER * u.grow * 0.5);
        });
      }
      // The mushroom: a stem, a cap, and a column that keeps burning.
      const sm = w.smoke;
      if (sm) {
        sm.column(x, y, z, 4, 20);
        for (let i = 0; i < 12; i++) sm.puff(x + (Math.random() - 0.5) * 4, y + 2 + i * 3.4, z + (Math.random() - 0.5) * 4, { size: 3.5 + i * 0.35, grow: 1.5, life: 11, tint: i < 4 ? '#3a3430' : SMOKE, alpha: 0.6, heat: 0.8, lift: 5, spread: 0.6, drag: 0.1 });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * 6.283;
          sm.puff(x + Math.cos(a) * 5, y + 40, z + Math.sin(a) * 5, { size: 9, grow: 2.4, life: 12, tint: '#4a4440', alpha: 0.55, heat: 0.3, lift: 1, spread: 6, drag: 0.15 });
        }
        sm.dust(x, y + 0.5, z, '#6a5a48', 3, 8);
      }
      terror(set, x, z, reach * 2, 12);
      u.boom(1.3);
      p.nature.deed('pyrotechnics', 3);
      void state;
    }],
  ],
};
