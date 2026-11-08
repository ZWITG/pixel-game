import { stagger } from '../foes.js';
import { roleName } from '../evolve.js';
import { near, ground, time, world, hit, slow, terror, shake, isNight } from './common.js';

// The Nightbringer's kit (v0.54.0): the dark as a place to hunt from, and the power to bring it.
//   Unseen: in the dark (night, an Eclipse, Snuff, Nightfall) foes lose the hero beyond SEE tiles;
//   while Vanished, at any distance. monsters.update asks `lure`; a foe that has lost the hero roams.
//   Ambush: the first blow on a foe that had lost you (e.lostAt) is far harder, and kills the weak
//   outright. After it, that foe sees you for a while (e.spottedUntil).
//   Eclipse holds the world's clock at night (world.clockHold) and sets world.darkUntil.
// Hooks: lure, blow, tick, meter, finisher.
const INDIGO = '#6a6cff', MOON = '#d8dcff', BLACK = '#0c0a1e';
const SEE = 11, SEE_SPRINT = 16, SPOTTED = 4;
const AMBUSH = 2.5, CULL = 0.25;
const MEND = 0.005;          // of max health a second, in the dark

const dark = (set) => isNight(set) || set.vanishUntil > time(set) || (set.domeUntil > time(set) && set.dome && Math.hypot(set.player.state.x - set.dome.x, set.player.state.z - set.dome.z) < set.dome.r);

function shadow(set, x, z, n = 10, speed = 6) {
  world(set).vfx.burst(x, ground(set, x, z) + 1, z, [BLACK, INDIGO, MOON], n, speed, { up: 0.9, life: 0.7 });
}

// Out of the light, quietly.
function vanishFrom(set, x, z) {
  shadow(set, x, z, 18, 7);
  set.fx.hole(x, ground(set, x, z) + 1.2, z, 0.9, 0.35);
}

export const NIGHT = {
  knives(set, job, aim) {
    set.bolt(job, aim);
  },

  vanish(set, job) {
    const p = set.player, s = p.state, { def, rank } = job;
    set.vanishUntil = time(set) + def.secs + rank * 0.5;
    for (const e of near(set, s.x, s.z, 60)) e.spottedUntil = 0;
    vanishFrom(set, s.x, s.z);
    p.hud.float('Unseen', s.x, s.y + 3.4, s.z, MOON);
    p.nature.deed('shadowcraft');
  },

  // Shadowstep: out of one shadow and into the one behind your target.
  shadowstep(set, job, aim) {
    const p = set.player, s = p.state, e = aim.target;
    if (!e) return p.hud.message('Shadowstep needs a target.');
    vanishFrom(set, s.x, s.z);
    const dx = e.x - s.x, dz = e.z - s.z, d = Math.hypot(dx, dz) || 1, back = e.radius + 1.6;
    s.x = e.x + (dx / d) * back;
    s.z = e.z + (dz / d) * back;
    s.dir = [-dx / d, -dz / d];
    p.guard = Math.max(p.guard ?? 0, 0.35);
    e.lostAt = time(set);
    e.spottedUntil = 0;
    vanishFrom(set, s.x, s.z);
    hit(set, job.pid, e, job.force);
  },

  // Snuff: every light for a long way round dies.
  snuff(set, job) {
    const p = set.player, s = p.state, w = world(set), { def, rank } = job, reach = def.reach + rank * 4, secs = def.secs + rank * 3;
    w.darkUntil = Math.max(w.darkUntil ?? 0, time(set) + secs);
    let out = w.voxels?.douse?.(s.x, s.z, reach) ?? 0;
    for (const c of w.scars.cells?.values?.() ?? []) {
      if (c.burn > 0 && Math.hypot(c.x - s.x, c.z - s.z) < reach) {
        c.burn = 0;
        w.scars.burning--;
        out++;
      }
    }
    w.scars.dirty = true;
    w.vfx.tint(BLACK, 0.5, 2.5, 0.4);
    w.vfx.shock(s.x, ground(set, s.x, s.z), s.z, reach, INDIGO, 1);
    terror(set, s.x, s.z, reach, secs);
    for (const e of near(set, s.x, s.z, reach)) e.spottedUntil = 0;
    p.hud.herald?.('Snuff', out ? `${out} fires die` : 'The lights go out', INDIGO);
    let sky = 0;
    set.kit.push({
      update(dt) {
        if ((sky -= dt) <= 0) {
          sky = 2.5;
          if (w.darkUntil > time(set)) w.vfx.tint(BLACK, 0.35, 3, 0.35);
        }
        return w.darkUntil > time(set);
      },
    });
  },

  // Umbral Grasp: hands from the ground hold every foe in the ring.
  grasp(set, job, aim) {
    const { def, rank, force } = job, x = aim.x, z = aim.z, r = def.reach + rank * 0.5, t = time(set);
    for (const e of near(set, x, z, r)) {
      hit(set, job.pid, e, force);
      if (!e.boss) e.frozenUntil = t + def.hold + rank * 0.2;
      else slow(e, 0.3, 2, t);
      for (let i = 0; i < 4; i++) set.fx.after(i * 0.08, () => world(set).vfx.burst(e.x, e.group.position.y + 0.2, e.z, [BLACK, INDIGO], 6, 3, { up: 3, life: 0.7, fall: 0 }));
    }
    set.fx.hole(x, ground(set, x, z) + 0.3, z, r * 0.3, 0.6);
    world(set).vfx.shock(x, ground(set, x, z), z, r, INDIGO, 0.6);
  },

  // Death Mark: what it took since, again; and the weak die.
  deathmark(set, job, aim) {
    const p = set.player, e = aim.target, { def, rank, force } = job;
    if (!e) return p.hud.message('Death Mark needs a target.');
    const from = e.hp, secs = def.secs;
    e.markedUntil = time(set) + secs;
    p.hud.float('Marked', e.x, e.group.position.y + 4, e.z, INDIGO);
    let k = 0, ring = 0;
    set.kit.push({
      update(dt) {
        if (e.dying) return false;
        k += dt;
        if ((ring -= dt) <= 0) {
          ring = 0.4;
          set.fx.glow(e.x, e.group.position.y + e.radius * 2 + 2, e.z, 1.6 - (k / secs), INDIGO, 0.35, 0.6);
        }
        if (k < secs) return true;
        const lost = Math.max(0, from - e.hp);
        hit(set, job.pid, e, lost * (1 + rank * 0.1) + force * 0.4);
        if (!e.dying && !e.boss && !e.watch && e.hp < e.maxHp * (def.cull + rank * 0.01)) {
          hit(set, job.pid, e, e.hp * 10 + 50, 'knockdown');
          p.hud.float('Culled', e.x, e.group.position.y + 4, e.z, MOON);
        }
        shadow(set, e.x, e.z, 16, 6);
        return false;
      },
    });
  },

  // Eclipse: night across the whole world.
  eclipse(set, job) {
    const p = set.player, s = p.state, w = world(set), secs = job.def.secs + job.rank * 10;
    w.setTime?.('night');
    w.clockHold = secs;
    w.darkUntil = time(set) + secs;
    w.vfx.tint(BLACK, 0.6, 3, 0.5);
    w.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 80, MOON, 1.6);
    shake(set, 0.3);
    // Armies falter in a dark that should not be.
    for (const a of w.armies?.list ?? []) if (a.state !== 'done') w.armies.shake?.(a, 0.15);
    w.realm?.say('The moon has swallowed the sun. Doors are barred across the whole country.', MOON);
    p.hud.herald?.('Eclipse', 'The sun is gone', MOON);
    p.nature.deed('shadowcraft', 4);
  },

  // Nightfall: a dome of night. Inside it you are Unseen and quick; when it ends, it closes on them.
  nightfall(set, job) {
    const p = set.player, s = p.state, { def, rank, force } = job, r = def.reach + rank, secs = def.secs + rank * 0.5, v = world(set).vfx;
    const x = s.x, z = s.z, dome = v.dome(x, ground(set, x, z), z, BLACK);
    set.dome = { x, z, r };
    set.domeUntil = time(set) + secs;
    let k = 0;
    set.kit.push({
      update(dt) {
        k += dt;
        v.shape(dome, r * Math.min(1, k / 0.5), 0.55);
        const inside = Math.hypot(s.x - x, s.z - z) < r, b = set.buffs.find((q) => q.pid === '_nightfall');
        if (inside) {
          if (b) b.left = 0.3;
          else set.buffs.push({ pid: '_nightfall', def: { speed: 0.4 }, left: 0.3, color: INDIGO });
        }
        for (const e of near(set, x, z, r)) slow(e, 0.7, 0.3, time(set));
        if (k < secs) return true;
        v.shape(dome, 0, 0);
        set.dome = null;
        for (const e of near(set, x, z, r)) {
          hit(set, job.pid, e, force, 'knockdown');
          shadow(set, e.x, e.z, 8, 5);
        }
        v.shock(x, ground(set, x, z), z, r, INDIGO, 0.6);
        shake(set, 0.35);
        return false;
      },
    });
  },

  // ---- hooks ----
  lure(set, e) {
    const p = set.player, s = p.state, t = time(set);
    if (e.spottedUntil > t || !dark(set)) return null;
    const see = set.vanishUntil > t ? 0 : s.sprinting && !p.nature.has('silent') ? SEE_SPRINT : SEE;
    if (Math.hypot(e.x - s.x, e.z - s.z) < see + e.radius) return null;
    if (!(e.lostAt > 0) || e.lostAt < (e.seenAt ?? 0)) e.lostAt = t;
    return { lost: true };
  },

  blow(set, e) {
    const p = set.player, t = time(set);
    let k = 1;
    // An Ambush: it had lost you.
    if (e.lured?.lost || set.vanishUntil > t) {
      k = AMBUSH * (1 + p.nature.depth);
      if (!e.boss && !e.watch && (roleName(e) === 'fodder' || e.hp < e.maxHp * CULL)) k = 50;
      p.hud.float(k >= 50 ? 'Assassinated' : 'Ambush!', e.x, e.group.position.y + 4, e.z, MOON);
      shadow(set, e.x, e.z, 14, 7);
      stagger(e, 0.6, t, true);
      p.nature.deed('shadowcraft');
      set.vanishUntil = 0;
    }
    e.spottedUntil = t + SPOTTED;
    e.seenAt = t;
    if (e.markedUntil > t) k *= 1.15;
    return k;
  },

  tick(set, dt) {
    const p = set.player, s = p.state, t = time(set);
    set.unseen = dark(set);
    if (isNight(set) && p.hp < p.body.maxHealth && !p.rooms.house) set.heal(p.body.maxHealth * MEND * dt);
    if (set.vanishUntil > t && Math.random() < dt * 14) shadow(set, s.x + (Math.random() - 0.5) * 1.5, s.z + (Math.random() - 0.5) * 1.5, 2, 2);
  },

  meter(set) {
    const v = set.vanishUntil > time(set);
    return { value: v ? 1 : set.unseen ? 0.6 : 0.08, color: set.unseen ? MOON : '#3a3a5a', hot: v, label: v ? 'Vanished' : set.unseen ? 'Unseen in the dark' : 'In the light' };
  },

  // The chain's Finisher: the Shadow Execution, out of the dark behind it.
  finisher(melee, e) {
    const set = melee.player.powers;
    shadow(set, e.x, e.z, 20, 8);
    set.fx.hole(e.x, ground(set, e.x, e.z) + 1, e.z, 1, 0.4);
    return 'knockdown';
  },
};
