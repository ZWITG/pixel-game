import { near, ground, time, world, blow, hit, slow, terror, nearestPlace, shake } from './common.js';

// The Blightmother's kit (v0.54.0): sickness as a weapon that keeps fighting after you leave.
//   Infection (e.infect, 0..5): every blow and power adds to it. It eats at a foe every half second,
//   leaps to foes standing beside it, fades if not fed, and bursts out of the dead (killed hook).
//   Plague: Infection loosed near a town gives it Plague (realm.js `sicken`): the town loses people
//   every day, its nation loses soldiers, and it travels down the roads to the next town.
// Hooks: blow, afflicted, killed, tick, meter, finisher.
const GREEN = '#9ad13a', BILE = '#c8e85a', ROT = '#3e5a10', SPECK = '#2a2a10';
const MOST = 5, EAT_EVERY = 0.5, EAT = 0.05;        // of the hero's might, per stack, per tick
const LEAP_EVERY = 2, LEAP_REACH = 4.5, FADE_AFTER = 8;
const TOWN_REACH = 150, TOWN_EVERY = 60;               // tiles from a town where a death seeds Plague; seconds between seedings of one town

function infect(set, e, n = 1) {
  if (!e || e.dying) return;
  e.infect = Math.min(MOST, (e.infect ?? 0) + n);
  e.infectAt = time(set);
  set.player.nature.deed('pestilence', 0.5);
}

function spores(set, x, z, n = 10, r = 3) {
  world(set).vfx.burst(x, ground(set, x, z) + 1.2, z, [GREEN, BILE, ROT], n, r * 2, { up: 0.8, life: 1.2, fall: 0.3 });
}

// A town near (x, z) catches it.
function seed(set, x, z, amount) {
  const place = nearestPlace(set, x, z, TOWN_REACH), w = world(set), t = time(set);
  if (!place) return;
  const was = place.plague ?? 0;
  place.plague = Math.min(1, Math.max(was, amount));
  if (!was && t - (place.plaguedAt ?? -1e9) > TOWN_EVERY) {
    place.plaguedAt = t;
    w.realm?.say(`Plague breaks out in ${place.name}.`, GREEN);
  }
}

export const BLIGHT = {
  // Bile: the shared bolt (it bursts with `blast`), Infecting through `afflicted`.
  bile(set, job, aim) {
    set.bolt(job, aim);
  },

  // Miasma: a cloud that feeds Infection every second.
  miasma(set, job, aim) {
    const { def, rank } = job, x = aim.x, z = aim.z, r = def.reach + rank * 0.5, secs = def.secs + rank;
    let k = 0, beat = 0;
    set.scar(job, x, z, r);
    set.kit.push({
      update(dt) {
        k += dt;
        if ((beat -= dt) <= 0) {
          beat = 1;
          for (const e of near(set, x, z, r)) {
            infect(set, e, def.infect);
            slow(e, 0.7, 1.2, time(set));
          }
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * 6.283, d = Math.random() * r * 0.8;
            world(set).smoke?.puff(x + Math.cos(a) * d, ground(set, x, z) + 0.8, z + Math.sin(a) * d, { size: 3, grow: 1.6, life: 2.4, tint: '#7a9a2a', alpha: 0.45, lift: 0.4, spread: 1 });
          }
        }
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * 6.283, d = Math.random() * r;
          set.fx.glow(x + Math.cos(a) * d, ground(set, x, z) + 0.5 + Math.random() * 2.5, z + Math.sin(a) * d, 2.6 + Math.random() * 2, i ? GREEN : ROT, 0.9, 1.3);
        }
        return k < secs;
      },
    });
  },

  // Locust Swarm: clouds that hunt foes, and strip the fields.
  locusts(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job, n = def.count + Math.floor(rank / 2), secs = def.secs + rank * 0.5;
    const swarms = Array.from({ length: n }, (_, i) => ({ x: s.x + Math.cos(i * 2.1) * 2, z: s.z + Math.sin(i * 2.1) * 2, bite: 0, target: null }));
    const fields = (world(set).realm?.settlements ?? []).filter((t) => Math.hypot(t.x - s.x, t.z - s.z) < 160);
    for (const t of fields) t.prosperity = Math.max(0.05, (t.prosperity ?? 0.6) - 0.1);
    if (fields.length) world(set).realm?.say(`Locusts strip the fields of ${fields[0].name}.`, BILE);
    let k = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        for (const w of swarms) {
          if (!w.target || w.target.dying) w.target = near(set, w.x, w.z, 30).sort((a, b) => (a.infect ?? 0) - (b.infect ?? 0))[0] ?? null;
          const tx = w.target?.x ?? s.x, tz = w.target?.z ?? s.z, dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz) || 1;
          w.x += (dx / d) * Math.min(d, 20 * dt);
          w.z += (dz / d) * Math.min(d, 20 * dt);
          if (w.target && d < 2.5 && (w.bite -= dt) <= 0) {
            w.bite = 0.4;
            hit(set, job.pid, w.target, force);
            infect(set, w.target, 1);
          }
          world(set).vfx.burst(w.x, ground(set, w.x, w.z) + 1.5 + Math.random(), w.z, [SPECK, SPECK, GREEN], 3, 4, { up: 0.2, life: 0.5, fall: 0 });
        }
        return k < secs;
      },
    });
  },

  // Burst: every Infected foe goes off.
  pustule(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job;
    const sick = near(set, s.x, s.z, def.reach + rank).filter((e) => e.infect > 0);
    if (!sick.length) return p.hud.message('Nothing Infected in reach.');
    sick.forEach((e, i) => set.fx.after(i * 0.05, () => {
      if (e.dying && !e.infect) return;
      const n = e.infect ?? 1, x = e.x, z = e.z;
      e.infect = 0;
      blow(set, job, x, z, force * (0.6 + n * 0.35), 2.5 + n * 0.8, n >= 4 ? 'knockdown' : null, 0, e);
      for (const o of near(set, x, z, 5)) if (o !== e) infect(set, o, Math.ceil(n / 2));
      set.fx.impact('blight', x, ground(set, x, z), z, 2 + n * 0.5);
      spores(set, x, z, 8 + n * 3, 3);
    }));
    shake(set, 0.2);
  },

  // Rotting Ground: a ring of rot around you; trees wither, fields die, foes sicken.
  rotland(set, job) {
    const p = set.player, s = p.state, { def, rank } = job, r = def.reach + rank, secs = def.secs + rank, x = s.x, z = s.z, w = world(set);
    set.scar(job, x, z, r, 3);
    // Trees inside rot and fall (only what grows; buildings stand).
    w.work.actor = p;
    p.melee.waves.push({ queue: w.work.chunks.near(x, z, r).filter((o) => o.type === 'tree').map((o) => ({ o, at: Math.hypot(o.x - x, o.z - z) / 20, force: p.body.might * 6 })), x, z, reach: r, t: 0, drops: {}, broke: false });
    const place = nearestPlace(set, x, z, r + 60);
    if (place) place.prosperity = Math.max(0.05, (place.prosperity ?? 0.6) - 0.1);
    w.vfx.shock(x, ground(set, x, z), z, r, ROT, 0.8);
    let k = 0, beat = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        if ((beat -= dt) <= 0) {
          beat = 1.5;
          for (const e of near(set, x, z, r)) {
            infect(set, e, def.infect);
            slow(e, 0.6, 1.6, time(set));
          }
        }
        return k < secs;
      },
    });
  },

  // Plague Host: one foe runs back to its own, sickening all it passes, then bursts among them.
  host(set, job, aim) {
    const p = set.player, e = aim.target, { def, rank, force } = job, t = time(set), secs = def.secs + rank * 0.4;
    if (!e) return p.hud.message('Plague Host needs a target.');
    if (e.boss || e.watch) return p.hud.message('Its will is too strong to carry it.');
    infect(set, e, MOST);
    e.fleeUntil = t + secs;
    p.hud.float('Carrier', e.x, e.group.position.y + 4, e.z, GREEN);
    let k = 0, beat = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        if ((beat -= dt) <= 0 && !e.dying) {
          beat = 0.5;
          for (const o of near(set, e.x, e.z, 6)) if (o !== e) infect(set, o, 1);
          spores(set, e.x, e.z, 6, 2);
        }
        if (k < secs && !e.dying) return true;
        e.fleeUntil = 0;
        blow(set, job, e.x, e.z, force, 7, 'knockdown', 0, e.dying ? null : e);
        for (const o of near(set, e.x, e.z, 9)) infect(set, o, 3);
        set.fx.impact('blight', e.x, ground(set, e.x, e.z), e.z, 6);
        seed(set, e.x, e.z, 0.35);
        return false;
      },
    });
  },

  // Pestilence: the plague, seeded in the nearest town.
  pestilence(set, job) {
    const p = set.player, s = p.state, w = world(set), { def, rank } = job, place = nearestPlace(set, s.x, s.z, def.reach);
    if (!place) return p.hud.message('No town near enough to sicken.');
    place.plague = Math.min(1, Math.max(place.plague ?? 0, def.plague + rank * 0.02));
    place.plaguedAt = time(set);
    w.realm?.say(`Pestilence takes ${place.name}. It will spread.`, GREEN);
    p.hud.herald?.('Pestilence', place.name, GREEN);
    terror(set, place.x, place.z, 70, 120);
    w.vfx.tint(ROT, 0.4, 2, 0.4);
    set.fx.pillar(s.x, ground(set, s.x, s.z), s.z, 1.5, GREEN, 1.2);
    spores(set, s.x, s.z, 40, 6);
    p.nature.deed('pestilence', 4);
  },

  // Death Bloom: Infection to the full, and you drink from all of it.
  deathbloom(set, job, aim) {
    const p = set.player, { def, rank, force } = job, x = aim.x, z = aim.z, r = def.reach + rank, y = ground(set, x, z);
    set.fx.pillar(x, y, z, 3, GREEN, 0.8);
    set.fx.after(0.25, () => {
      const list = near(set, x, z, r);
      blow(set, job, x, z, force, r * 0.5, 'launch');
      for (const e of list) infect(set, e, MOST);
      set.heal(list.length * p.body.maxHealth * 0.03);
      set.scar(job, x, z, r, 3);
      set.fx.impact('blight', x, y, z, r * 0.5);
      world(set).vfx.shock(x, y, z, r, GREEN, 0.8);
      for (let i = 0; i < 6; i++) set.fx.after(i * 0.15, () => spores(set, x + (Math.random() - 0.5) * r, z + (Math.random() - 0.5) * r, 18, 5));
      seed(set, x, z, 0.3);
    });
  },

  // ---- hooks ----
  blow(set, e) {
    infect(set, e, 1);
    return 1;
  },

  afflicted(set, e, def) {
    infect(set, e, def?.infect ?? 1);
  },

  // A death with Infection in it bursts, and a town nearby catches it.
  killed(set, e) {
    const n = e.infect ?? 0;
    if (!n) return;
    for (const o of near(set, e.x, e.z, 6)) if (o !== e) infect(set, o, Math.ceil(n / 2) + 1);
    spores(set, e.x, e.z, 10 + n * 4, 3);
    set.fx.impact('blight', e.x, ground(set, e.x, e.z), e.z, 2 + n * 0.4);
    seed(set, e.x, e.z, 0.08 + n * 0.04);
  },

  tick(set, dt) {
    const p = set.player, s = p.state, t = time(set);
    if ((set.eatIn = (set.eatIn ?? 0) - dt) > 0) return;
    set.eatIn = EAT_EVERY;
    const leap = (set.leapIn = (set.leapIn ?? LEAP_EVERY) - EAT_EVERY) <= 0;
    if (leap) set.leapIn = LEAP_EVERY;
    let sick = 0;
    for (const e of near(set, s.x, s.z, 90)) {
      if (!(e.infect > 0)) continue;
      sick++;
      set.sting(e, p.body.might * EAT * e.infect * p.nature.edge(e));
      if (Math.random() < 0.5) world(set).vfx.burst(e.x, e.group.position.y + 1.5, e.z, [GREEN, ROT], 2, 2, { up: 1, life: 0.6 });
      if (leap) for (const o of near(set, e.x, e.z, LEAP_REACH)) if (o !== e && (o.infect ?? 0) < e.infect - 1) infect(set, o, 1);
      if (t - e.infectAt > FADE_AFTER) {
        e.infect--;
        e.infectAt = t - FADE_AFTER + 2;
      }
    }
    set.sick = sick;
  },

  meter(set) {
    const n = set.sick ?? 0;
    return { value: Math.min(1, n / 12), color: GREEN, hot: n >= 8, label: n ? `Contagion ${n}` : 'Contagion' };
  },

  // The chain's Finisher: the Rupture. All its Infection goes off at once.
  finisher(melee, e) {
    const set = melee.player.powers, n = e.infect ?? 0;
    if (n) {
      hit(set, 'pustule', e, melee.player.body.might * n * 0.6);
      for (const o of near(set, e.x, e.z, 6)) if (o !== e) infect(set, o, n);
      spores(set, e.x, e.z, 20, 4);
    }
    infect(set, e, 2);
    return 'knockdown';
  },
};
