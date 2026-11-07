import * as THREE from 'three';
import { stagger } from '../foes.js';

// The Emberlord's kit (v0.35.0): fire is heat that builds until it is a sun. Same shape as kits/titan.js.
//   Heat (set.heat, 0..100) rises with every fire power and every blow, and fades out of a fight.
//   At 40 the flames burn white-gold, at 80 blue, and fire powers grow with it. At 100 the Emberlord
//   Overheats: strongest of all, but the body burns a little each second. Supernova spends it all.
//   Brands: fire that touches a foe brands it (up to five); Ignite sets every Brand off at once.
// Hooks: afflicted (brands), landed (heat), power (heat makes powers stronger), meter (the HUD bar),
// tick (cooling, overheating, the body's colour), finisher (Pyre Break).
const MOST = 100, WHITE_AT = 40, BLUE_AT = 80, COOL_FROM = 85;
const COOL = 5, COOL_AFTER = 3;          // heat lost a second, seconds after the last blow
const PER_BLOW = 1.5, BURN = 0.012;      // heat from a landed blow; health a second burnt away overheated
const BRANDS = 5, BRAND_SECS = 12;
const ORANGE = '#ff7a2a', GOLD = '#ffd27a', BLUE = '#6ab8ff';
const v = new THREE.Vector3(), w = new THREE.Vector3();

const near = (set, x, z, r) => set.player.melee.monsters.within(x, z, r);
const ground = (set, x, z) => set.player.melee.height(x, z);
const time = (set) => set.player.melee.monsters.time;

export const heatOf = (set) => set.heat ?? 0;
const hue = (set) => (heatOf(set) >= BLUE_AT ? BLUE : heatOf(set) >= WHITE_AT ? GOLD : ORANGE);
// Flames: 0 orange, 3 white-gold, 2 blue (elementFx.js).
const flameKind = (set) => (heatOf(set) >= BLUE_AT ? 2 : heatOf(set) >= WHITE_AT ? 3 : 0);

function warm(set, amount) {
  set.heat = Math.min(MOST, heatOf(set) + amount);
  set.heatAt = time(set);
}

// Burns one foe through the shared path, so it's branded and set alight.
function burn(set, pid, e, force) {
  set.player.world.work.actor = set.player;
  set.harm(pid, e, force);
  set.afflict(pid, e, { status: 'burn' }, set.rank(pid));
}

function along(set, x, z, dx, dz, len, half) {
  return near(set, x + dx * len * 0.5, z + dz * len * 0.5, len * 0.5 + half).filter((e) => {
    const a = (e.x - x) * dx + (e.z - z) * dz, off = Math.abs((e.x - x) * dz - (e.z - z) * dx);
    return a > -1 && a < len && off < half + e.radius;
  });
}

// A burning beam along the aim for `secs`: what it cuts, what it hits, and what colour.
function beam(set, job, { range, secs, width, color, tick, share, cut, every }) {
  const p = set.player;
  let t = 0, beat = 0, b = null;
  set.kit.push({
    busy: true,
    update(dt) {
      t += dt;
      const s = p.state, a = set.aim();
      s.dir = [a.dx, a.dz];
      set.casting = 0.2;
      set.pose = 'punch';
      v.set(s.x + a.dx * 1.2, ground(set, s.x, s.z) + s.air + 1.6, s.z + a.dz * 1.2);
      w.set(v.x + a.dx * range, v.y, v.z + a.dz * range);
      if (!b) b = p.world.vfx.beam(v, w, width, color, secs);
      else p.world.vfx.aim(b, v, w);
      if ((beat -= dt) <= 0) {
        beat = tick;
        for (const e of along(set, v.x, v.z, a.dx, a.dz, range, width + 0.6)) burn(set, job.pid, e, job.force * share);
        p.world.work.actor = p;
        for (let d = every; d < range; d += every) {
          p.world.scars.mark('fire', v.x + a.dx * d, v.z + a.dz * d, 1.6, p, 1, 0.5);
          if (cut) p.melee.blast(v.x + a.dx * d, v.z + a.dz * d, job.force * cut, 1.6, 0, color, null);
        }
      }
      p.world.vfx.burst(w.x, ground(set, w.x, w.z) + 1, w.z, [color, '#ffffff'], 2, 8);
      return t < secs;
    },
  });
}

export const EMBER = {
  // Heat makes every fire power stronger; Overheated, stronger still.
  power(set) {
    return 1 + heatOf(set) / MOST * 0.5 + (set.overheat ? 0.25 : 0);
  },

  meter(set) {
    return { value: heatOf(set) / MOST, color: hue(set), hot: !!set.overheat, label: set.overheat ? 'Overheat' : 'Heat' };
  },

  afflicted(set, e, def) {
    if (def?.status !== 'burn' || e.dying) return;
    e.brands = Math.min(BRANDS, (e.brandedUntil > time(set) ? e.brands ?? 0 : 0) + 1);
    e.brandedUntil = time(set) + BRAND_SECS;
  },

  landed(set) {
    warm(set, PER_BLOW);
  },

  // A giant fist of flame that bursts through the first foe and keeps going.
  fist(set, job, aim) {
    const h = heatOf(set);
    set.bolt({ ...job, def: { ...job.def, size: job.def.size * (1 + h / 200) } }, aim);
    warm(set, job.def.heat);
  },

  // Every Brand in reach goes off at once; the more Heat, the bigger.
  ignite(set, job) {
    const p = set.player, { def, force } = job, t = time(set), s = p.state;
    let n = 0;
    for (const e of near(set, s.x, s.z, def.reach)) {
      if (!(e.brandedUntil > t) || !e.brands) continue;
      const stacks = e.brands, x = e.x, z = e.z;
      e.brands = 0;
      e.brandedUntil = 0;
      n++;
      set.fx.after(n * 0.04, () => {
        p.world.work.actor = p;
        p.melee.blast(x, z, force * (0.6 + stacks * 0.4), 3 + stacks * 0.6, 0, hue(set), e, 'stagger', true, 1 + stacks * 0.5);
        set.fx.impact('fire', x, ground(set, x, z), z, 2 + stacks);
        p.world.vfx.shock(x, ground(set, x, z), z, 4 + stacks, hue(set), 0.3);
      });
    }
    if (!n) p.hud.message('Nothing is branded. Burn them first.');
    warm(set, job.def.heat + n * 2);
  },

  // Fire jets from the feet: a burst forward and up, leaving fire behind.
  jet(set, job, aim) {
    const p = set.player, s = p.state;
    set.dash(job, aim);
    s.rise = Math.max(s.rise, job.def.lift);
    s.air = Math.max(s.air, 0.05);
    const from = { x: s.x, z: s.z };
    set.fx.after(0.18, () => {
      for (let i = 0; i < 6; i++) {
        const k = i / 5;
        p.world.scars.mark('fire', from.x + (s.x - from.x) * k, from.z + (s.z - from.z) * k, 1.8, p, 1, 0.5);
      }
    });
    for (let i = 0; i < 8; i++) set.fx.flame(s.x + (Math.random() - 0.5), ground(set, s.x, s.z) + s.air, s.z + (Math.random() - 0.5), 3, 0.4, flameKind(set));
    warm(set, job.def.heat);
  },

  // A serpent of flame that hunts the nearest foes, burning everything it passes.
  serpent(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state;
    const head = new THREE.Vector3(s.x + aim.dx * 2, ground(set, s.x, s.z) + 2, s.z + aim.dz * 2), body = [];
    let t = 0, beat = 0, dx = aim.dx, dz = aim.dz;
    const trail = p.world.vfx.trail((out) => out.copy(head), hue(set), 1.4, def.secs + rank * 0.3);
    set.kit.push({
      update(dt) {
        t += dt;
        const prey = near(set, head.x, head.z, 30).sort((a, b) => Math.hypot(a.x - head.x, a.z - head.z) - Math.hypot(b.x - head.x, b.z - head.z))[0];
        if (prey) {
          // Close in, then coil round it.
          const d = Math.hypot(prey.x - head.x, prey.z - head.z) || 1, coil = d < 3;
          const tx = coil ? -(prey.z - head.z) / d : (prey.x - head.x) / d, tz = coil ? (prey.x - head.x) / d : (prey.z - head.z) / d;
          dx += (tx - dx) * Math.min(1, dt * 5);
          dz += (tz - dz) * Math.min(1, dt * 5);
          const len = Math.hypot(dx, dz) || 1;
          dx /= len;
          dz /= len;
        }
        head.x += dx * def.speed * dt;
        head.z += dz * def.speed * dt;
        head.y += (ground(set, head.x, head.z) + 1.8 + Math.sin(t * 8) * 0.6 - head.y) * Math.min(1, dt * 8);
        body.unshift(head.clone());
        body.length = Math.min(body.length, 12);
        for (let i = 0; i < body.length; i += 3) set.fx.flame(body[i].x, body[i].y - 1.2, body[i].z, 3.2 - i * 0.15, 0.3, flameKind(set));
        if ((beat -= dt) <= 0) {
          beat = 0.2;
          for (const e of near(set, head.x, head.z, 2.6)) burn(set, job.pid, e, force * 0.35);
        }
        if (t < def.secs + rank * 0.3) return true;
        trail.left = Math.min(trail.left, 0.2);
        return false;
      },
    });
    warm(set, def.heat);
  },

  // A wall of fire that rises in front of you and rolls forward, pushing what it meets.
  flare(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, hit = new Set();
    const sx = -aim.dz, sz = aim.dx, half = def.width + rank;
    let d = 3, beat = 0;
    set.kit.push({
      update(dt) {
        d += def.speed * dt;
        const cx = s.x + aim.dx * d, cz = s.z + aim.dz * d;
        if ((beat -= dt) <= 0) {
          beat = 0.07;
          for (let k = -half; k <= half; k += 2) set.fx.flame(cx + sx * k, ground(set, cx + sx * k, cz + sz * k), cz + sz * k, 4.5, 0.4, flameKind(set));
          p.world.scars.mark('fire', cx, cz, 2.2, p, 1, 0.5);
        }
        for (const e of near(set, cx, cz, half + 1)) {
          const across = Math.abs((e.x - cx) * aim.dx + (e.z - cz) * aim.dz);
          if (across > 2.5) continue;
          if (!e.boss) e.vel.set(aim.dx, aim.dz).multiplyScalar(def.speed);
          e.knockUntil = time(set) + 0.1;
          if (!hit.has(e)) {
            hit.add(e);
            burn(set, job.pid, e, force);
          }
        }
        return d < def.range;
      },
    });
    warm(set, def.heat);
  },

  // A column of fire straight up out of the ground at the target, lifting all in it.
  inferno(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim, r = def.reach + rank * 0.4;
    let t = 0, beat = 0;
    p.world.vfx.shock(x, ground(set, x, z), z, r + 2, hue(set), 0.4);
    set.kit.push({
      update(dt) {
        t += dt;
        const g = ground(set, x, z);
        for (let i = 0; i < 4; i++) set.fx.flame(x + (Math.random() - 0.5) * r, g + Math.random() * 18, z + (Math.random() - 0.5) * r, 4 + Math.random() * 3, 0.45, flameKind(set));
        if ((beat -= dt) <= 0) {
          beat = 0.25;
          for (const e of near(set, x, z, r)) {
            burn(set, job.pid, e, force * 0.35);
            if (!e.boss) Object.assign(e, { air: Math.max(e.air, 0.05), rise: Math.max(e.rise ?? 0, 9), hang: 0 });
          }
        }
        return t < def.secs;
      },
    });
    p.world.scars.mark('fire', x, z, r, p, 2, 0.6);
    warm(set, def.heat);
  },

  // A falling star: the sky reddens, its trail lights the land, and it leaves a molten crater.
  meteor(set, job, aim) {
    const p = set.player, { def } = job, { x, z } = aim;
    set.strike(job, aim);
    p.world.vfx.tint('#ff6a3a', 0.25, (def.wait ?? 1) + 0.5);
    set.fx.after(def.wait ?? 1, () => {
      p.world.scars.mark('fire', x, z, def.reach * 0.7, p, 2, 0.6);
      p.world.scars.mark('earth', x, z, def.reach * 0.5, p, 1, 0.6); // stone through fire: magma
      p.world.vfx.shock(x, ground(set, x, z), z, def.reach * 1.6, '#ffb070', 0.5);
      p.world.smoke?.column(x, ground(set, x, z), z, 2, 10);
    });
    warm(set, def.heat);
  },

  // Burn it all out at once: the more Heat spent, the wider and harder.
  supernova(set, job) {
    const h = heatOf(set), k = 0.5 + h / MOST;
    set.nova({ ...job, force: job.force * k, def: { ...job.def, reach: job.def.reach * k, crater: job.def.crater * k } });
    set.player.world.vfx.shock(set.player.state.x, ground(set, set.player.state.x, set.player.state.z), set.player.state.z, job.def.reach * k * 1.2, hue(set), 0.6);
    set.player.world.work.impact = 0.06;
    set.heat = 0;
    set.overheat = false;
  },

  // Only at 80 Heat or more: a thin blue flame that cuts through anything built.
  blue(set, job) {
    if (heatOf(set) < BLUE_AT) {
      set.player.hud.message('Blue Inferno needs 80 Heat.');
      set.keepReady = job.pid;
      return;
    }
    beam(set, job, { range: job.def.range, secs: job.def.secs, width: 0.45, color: BLUE, tick: 0.1, share: 0.4, cut: 1.2, every: 5 });
    warm(set, job.def.heat);
  },

  // A beam of sunlight-fire, scorching a line across the land.
  sunlance(set, job) {
    beam(set, job, { range: job.def.range, secs: job.def.secs, width: 1, color: '#fff0b0', tick: 0.12, share: 0.5, cut: 0, every: 4 });
    warm(set, job.def.heat);
  },

  tick(set, dt) {
    const p = set.player, t = time(set);
    // Heat fades once the fighting stops.
    if (t - (set.heatAt ?? -9) > COOL_AFTER) set.heat = Math.max(0, heatOf(set) - COOL * dt);
    if (heatOf(set) >= MOST && !set.overheat) {
      set.overheat = true;
      p.hud.message('Overheat! Every power at its strongest, and you burn.', true);
    }
    if (set.overheat && heatOf(set) < COOL_FROM) set.overheat = false;
    if (set.overheat) {
      // Burning from within: no resting it off while it lasts.
      p.hp = Math.max(1, p.hp - p.body.maxHealth * BURN * dt);
      p.calm = 0;
      p.hud.setHealth(p.hp / p.body.maxHealth);
    }
    // The fire of the world takes the colour of the Emberlord's heat.
    p.world.fx.fireKind = flameKind(set);
    // Brands smoulder.
    if ((set.smoulder = (set.smoulder ?? 0) - dt) <= 0) {
      set.smoulder = 0.25;
      for (const e of near(set, p.state.x, p.state.z, 60)) if (e.brandedUntil > t && e.brands) set.fx.flame(e.x, e.group.position.y + 0.5, e.z, 1 + e.brands * 0.5, 0.4, flameKind(set));
    }
    // The body glows with it, unless a Surge is already lighting it.
    if (!(p.wrath?.surge > 0)) {
      const h = heatOf(set) / MOST;
      p.hero.glow = h > 0.15 ? hue(set) : null;
      p.hero.glowAmount = h * 0.35 + (set.overheat ? Math.sin(t * 12) * 0.1 + 0.1 : 0);
    }
  },

  // Pyre Break: a palm that sets off every Brand on the foe and sends it off as a rocket of flame.
  finisher(melee, e) {
    const p = melee.player, set = p.powers, stacks = e.brandedUntil > melee.monsters.time ? e.brands ?? 0 : 0;
    if (stacks) {
      p.world.work.actor = p;
      melee.monsters.hit(e, melee.force * stacks * 0.6, p.state.x, p.state.z, 'flinch', stacks);
      e.brands = 0;
      e.brandedUntil = 0;
    }
    set.fx.impact('fire', e.x, ground(set, e.x, e.z), e.z, 3 + stacks);
    p.world.vfx.trail((out) => out.set(e.x, e.group.position.y + 1.5, e.z), hue(set), 1.6, 0.8);
    set.afflict('fireball', e, { status: 'burn' }, 0);
    warm(set, 6);
    return 'fly';
  },
};
