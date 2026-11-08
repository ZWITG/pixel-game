import * as THREE from 'three';
import { near, ground, time, world, blow, hit, raze, slow, terror, nearestPlace, line, shake } from './common.js';

// The Tidebringer's kit (v0.54.0): the sea brought inland, and the weather with it.
//   Soaked (e.soakedUntil): what the tides touch is slowed and takes more from your blows.
//   High Water: on wet ground, Soaked land (scars.js `soak`) or in water, the Tidebringer surges.
//   Its powers douse fire (scars 'water'), rot fields (Monsoon), drown towns (Deluge) and flatten
//   what stands in a wave's way (Tsunami). Lakes and walls of sea are PowerFx `lakes` / `seawalls`.
// Hooks: blow, afflicted, tick, meter, finisher.
const SEA = '#20a8e0', FOAM = '#e0f6ff', DEEP = '#0a4a7a';
const SOAK_SECS = 6, SOAKED = 1.25;
const SURGE = 0.35;          // speed on wet ground
const RAIN_EVERY = 0.05, RAIN_MARK = 2;

const wetAt = (set, x, z) => {
  const c = world(set).scars.at(x, z);
  return !!c && (c.soak > 0 || c.wet);
};

function soak(set, e, secs = SOAK_SECS) {
  const t = time(set);
  e.soakedUntil = Math.max(e.soakedUntil ?? 0, t + secs);
  slow(e, 0.75, secs, t);
  set.player.nature.deed('tidecraft');
}

function spray(set, x, z, n = 10, speed = 8, up = 1.2) {
  world(set).vfx.burst(x, ground(set, x, z) + 0.6, z, [SEA, FOAM, '#7ad0f0'], n, speed, { up, life: 0.7 });
}

// A lake or a wall of sea from the PowerFx pool.
function take(list) {
  return list.find((w) => !w.o.visible) ?? null;
}

// A wall of water rolling along the ground: the Breaker, and at its biggest the Tsunami.
function roll(set, job, aim, { width, speed, range, height, force, react, razes }) {
  const p = set.player, s = p.state, hitSet = new Set(), dx = aim.dx, dz = aim.dz, wall = take(set.fx.seawalls);
  let d = 0, razed = 0, beat = 0;
  if (wall) {
    wall.o.visible = true;
    wall.o.rotation.set(0, Math.atan2(dx, dz), 0);
  }
  set.kit.push({
    update(dt) {
      d += speed * dt;
      const x = s.x + dx * d, z = s.z + dz * d, y = ground(set, x, z), grow = wetAt(set, x, z) ? 1.35 : 1, w = width * grow;
      if (wall) {
        const rise = Math.min(1, d / 6) * (d > range - 6 ? Math.max(0, (range - d) / 6) : 1);
        wall.o.position.set(x, y + (height * rise) / 2 - 0.4, z);
        wall.o.scale.set(w, Math.max(0.1, height * rise), 2.4);
      }
      for (const e of line(set, x - dx * 3, z - dz * 3, dx, dz, 5, w / 2)) {
        if (!hitSet.has(e)) {
          hitSet.add(e);
          hit(set, job.pid, e, force * grow, react);
          soak(set, e);
        }
        // Carried along with it.
        e.group.position.x += dx * speed * dt * 0.8;
        e.group.position.z += dz * speed * dt * 0.8;
      }
      if ((beat -= dt) <= 0) {
        beat = 0.06;
        for (let i = -2; i <= 2; i++) spray(set, x - dz * (w / 5) * i, z + dx * (w / 5) * i, 3, 6, 1.6);
      }
      if (d - razed > 4) {
        razed = d;
        set.scar(job, x, z, w / 2);
        if (razes) raze(set, x, z, w / 2, razes);
      }
      if (d < range) return true;
      if (wall) wall.o.visible = false;
      blow(set, job, x, z, force * 0.6, w / 2, 'knockdown');
      spray(set, x, z, 24, 14, 1.8);
      return false;
    },
  });
}

export const TIDE = {
  // Tide Lash: a whip of seawater; whatever it catches is hauled in.
  lash(set, job, aim) {
    const p = set.player, s = p.state, { def, force } = job, e = aim.target && Math.hypot(aim.target.x - s.x, aim.target.z - s.z) < def.range ? aim.target : null;
    const tx = e ? e.x : s.x + aim.dx * def.range * 0.6, tz = e ? e.z : s.z + aim.dz * def.range * 0.6;
    world(set).vfx.beam(new THREE.Vector3(s.x, s.y + 1.4, s.z), new THREE.Vector3(tx, ground(set, tx, tz) + 1.4, tz), 0.4, SEA, 0.3);
    spray(set, tx, tz, 14, 8);
    if (!e) return;
    hit(set, job.pid, e, force);
    soak(set, e);
    if (e.boss || e.watch) return;
    let k = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        const ddx = s.x - e.x, ddz = s.z - e.z, d = Math.hypot(ddx, ddz);
        if (e.dying || d < 3 || k > 0.4) return false;
        e.group.position.x += (ddx / d) * 50 * dt;
        e.group.position.z += (ddz / d) * 50 * dt;
        return true;
      },
    });
  },

  breaker(set, job, aim) {
    const { def, rank, force } = job;
    roll(set, job, aim, { width: def.width + rank, speed: def.speed, range: def.range + rank * 2, height: 3.2, force, react: 'knockdown', razes: force * 0.6 });
  },

  // Geyser: the ground under the target bursts.
  geyser(set, job, aim) {
    const { def, rank, force } = job, x = aim.x, z = aim.z, y = ground(set, x, z);
    set.fx.pillar(x, y, z, def.reach * 0.5, SEA, 0.6);
    set.fx.after(0.12, () => {
      blow(set, job, x, z, force, def.reach + rank * 0.3, 'launch', 0, aim.target);
      for (const e of near(set, x, z, def.reach + 1)) soak(set, e);
      world(set).vfx.burst(x, y + 1, z, [SEA, FOAM], 40, 16, { up: 2.4, life: 1 });
      set.scar(job, x, z, def.reach + 1);
    });
  },

  // Drowning Orb: a foe held in a sphere of water until it bursts.
  orb(set, job, aim) {
    const p = set.player, e = aim.target, { def, rank, force } = job, t = time(set);
    if (!e) return p.hud.message('Drowning Orb needs a target.');
    const secs = (def.secs + rank * 0.3) * (e.boss || e.watch ? 0.4 : 1), v = world(set).vfx, dome = v.dome(e.x, e.group.position.y + 1.5, e.z, SEA);
    e.frozenUntil = t + secs;
    soak(set, e, secs + 4);
    let k = 0, tick = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        dome.mesh.position.set(e.x, e.group.position.y + e.radius + 0.6, e.z);
        v.shape(dome, e.radius * 2 + 1.6, 0.45);
        if ((tick -= dt) <= 0) {
          tick = 0.5;
          set.sting(e, force * def.power);
          world(set).vfx.burst(e.x, e.group.position.y + 2, e.z, [FOAM], 4, 3, { up: 2 });
        }
        if (k < secs && !e.dying) return true;
        v.shape(dome, 0, 0);
        e.frozenUntil = 0;
        if (!e.dying) hit(set, job.pid, e, force * 1.5, 'knockdown');
        spray(set, e.x, e.z, 30, 12);
        return false;
      },
    });
  },

  // Maelstrom: round and down.
  maelstrom(set, job, aim) {
    const { def, rank, force } = job, x = aim.x, z = aim.z, r = def.reach + rank * 0.6, secs = def.secs + rank * 0.3;
    let k = 0, tick = 0, spin = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        spin += dt * 5;
        for (const e of near(set, x, z, r + 4)) {
          if (e.boss || e.watch) continue;
          const ex = e.x - x, ez = e.z - z, d = Math.hypot(ex, ez) || 1;
          e.group.position.x += (-ex / d * 6 - ez / d * 9) * dt;
          e.group.position.z += (-ez / d * 6 + ex / d * 9) * dt;
          soak(set, e, 2);
        }
        if ((tick -= dt) <= 0) {
          tick = 0.5;
          for (const e of near(set, x, z, r)) hit(set, job.pid, e, force);
          world(set).vfx.shock(x, ground(set, x, z), z, r, SEA, 0.5);
        }
        for (let i = 0; i < 3; i++) {
          const a = spin + i * 2.09, d = r * (0.3 + ((k * 0.7 + i * 0.3) % 1) * 0.7);
          set.fx.glow(x + Math.cos(a) * d, ground(set, x, z) + 0.6, z + Math.sin(a) * d, 1.6, i ? SEA : FOAM, 0.4, 0.6);
        }
        if (k < secs) return true;
        set.scar(job, x, z, r);
        blow(set, job, x, z, force * 2, r * 0.6, 'launch');
        spray(set, x, z, 30, 16, 2);
        return false;
      },
    });
  },

  // Monsoon: a minute of rain. Fires die, the land is Soaked, the fields rot.
  monsoon(set, job) {
    const p = set.player, s = p.state, w = world(set), { def, rank } = job, secs = def.secs + rank * 6, until = time(set) + secs;
    w.rainUntil = until;
    p.hud.herald?.('Monsoon', 'The rains have come', SEA);
    const hungry = (w.realm?.settlements ?? []).filter((t) => Math.hypot(t.x - s.x, t.z - s.z) < def.reach * 1.5);
    for (const t of hungry) t.prosperity = Math.max(0.05, (t.prosperity ?? 0.6) - 0.15);
    if (hungry.length) w.realm?.say(`The rains rot the fields of ${hungry.slice(0, 3).map((t) => t.name).join(', ')}${hungry.length > 3 ? ' and more' : ''}.`, SEA);
    let drop = 0, mark = 0, sky = 0;
    set.kit.push({
      update(dt) {
        if (time(set) > until) return false;
        if ((sky -= dt) <= 0) {
          sky = 2.4;
          w.vfx.tint('#3a4a5a', 0.35, 2.8, 0.45);
        }
        if ((drop -= dt) <= 0) {
          drop = RAIN_EVERY;
          for (let i = 0; i < 14; i++) {
            const x = s.x + (Math.random() - 0.5) * 70, z = s.z + (Math.random() - 0.5) * 70;
            w.vfx.burst(x, s.y + 22 + Math.random() * 8, z, ['#a8d8f0', '#e0f4ff'], 1, 1, { up: -3, life: 1.4, fall: 2.4 });
          }
        }
        if ((mark -= dt) <= 0) {
          mark = RAIN_MARK;
          w.scars.mark('water', s.x, s.z, 34, p, 0);
          // Fire in the buildings goes out under the rain.
          w.voxels?.douse?.(s.x, s.z, 60);
        }
        return true;
      },
    });
  },

  // Deluge: a lake rises over the land and stays. Houses flood and fall, people flee, foes drown.
  deluge(set, job, aim) {
    const p = set.player, w = world(set), { def, rank, force } = job, x = aim.x, z = aim.z, r = def.reach + rank, secs = def.secs + rank * 3;
    const lake = take(set.fx.lakes), y0 = ground(set, x, z);
    if (lake) lake.o.visible = true;
    p.hud.herald?.('Deluge', 'The sea comes inland', SEA);
    raze(set, x, z, r, p.body.might * 4);
    terror(set, x, z, r + 30, secs);
    const place = nearestPlace(set, x, z, r + 50);
    if (place) {
      place.pop = Math.max(2, place.pop * 0.85);
      w.realm?.houseLost(place.id);
      w.realm?.say(`${place.name} is under water.`, SEA, place.x, place.z);
    }
    let k = 0, tick = 0, mark = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        const rise = Math.min(1, k / 2) * (k > secs - 2 ? Math.max(0, (secs - k) / 2) : 1);
        if (lake) {
          lake.o.position.set(x, y0 - 2 + rise * 3.2, z);
          lake.o.scale.set(r * Math.min(1, k / 1.2 + 0.3), 4, r * Math.min(1, k / 1.2 + 0.3));
        }
        if ((tick -= dt) <= 0) {
          tick = 1;
          for (const e of near(set, x, z, r)) {
            soak(set, e, 2);
            slow(e, 0.4, 1.2, time(set));
            set.sting(e, force * def.power * (e.boss || e.watch ? 0.3 : 1));
          }
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * 6.283, d = Math.random() * r;
            world(set).vfx.shock(x + Math.cos(a) * d, y0 + rise * 1.2, z + Math.sin(a) * d, 3, FOAM, 0.8);
          }
        }
        if ((mark -= dt) <= 0) {
          mark = 3;
          w.scars.mark('water', x, z, r, p, 0);
          if (k > 4) raze(set, x, z, r * 0.8, p.body.might * 1.2);
        }
        if (k < secs) return true;
        if (lake) lake.o.visible = false;
        return false;
      },
    });
  },

  // Tsunami: the tallest wave, and nothing stands in its way.
  tsunami(set, job, aim) {
    const p = set.player, { def, rank, force } = job;
    p.hud.herald?.('Tsunami', '', SEA);
    shake(set, 0.6);
    roll(set, job, aim, { width: def.width + rank * 2, speed: def.speed, range: def.range + rank * 6, height: 14, force, react: 'knockdown', razes: p.body.might * 6 });
    terror(set, p.state.x + aim.dx * 50, p.state.z + aim.dz * 50, 70, 30);
  },

  // ---- hooks ----
  blow(set, e) {
    return e.soakedUntil > time(set) ? SOAKED : 1;
  },

  afflicted(set, e) {
    if (!e.dying) soak(set, e);
  },

  tick(set, dt) {
    const p = set.player, s = p.state, wet = p.swim?.inWater || wetAt(set, s.x, s.z) || (world(set).rainUntil ?? 0) > time(set);
    // High Water: a buff that lasts while the ground is wet.
    const b = set.buffs.find((x) => x.pid === '_tide');
    if (wet && !p.rooms.house) {
      if (b) b.left = 0.3;
      else set.buffs.push({ pid: '_tide', def: { speed: SURGE }, left: 0.3, color: SEA });
      if (s.moving && Math.random() < dt * 12) spray(set, s.x, s.z, 2, 4, 1);
    }
  },

  meter(set) {
    const p = set.player, s = p.state, wet = p.swim?.inWater || wetAt(set, s.x, s.z) || (world(set).rainUntil ?? 0) > time(set);
    return { value: wet ? 1 : 0.15, color: wet ? FOAM : DEEP, hot: wet, label: wet ? 'High Water' : 'Dry ground' };
  },

  // The chain's Finisher: the Undertow, a column of sea that throws it skyward.
  finisher(melee, e) {
    const set = melee.player.powers, y = ground(set, e.x, e.z);
    set.fx.pillar(e.x, y, e.z, 2, SEA, 0.5);
    world(set).vfx.burst(e.x, y + 1, e.z, [SEA, FOAM], 30, 14, { up: 2.4 });
    soak(set, e);
    return 'launch';
  },
};
