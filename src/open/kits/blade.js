// The Skycleaver's powers (v0.56.0): edges that go through everything, foes, trees, walls, the land itself.
// Same shape as the other kits: each power `kind` is called as kit[kind](set, job, aim); lasting effects
// go on set.kit as { update(dt) → false when done, busy }.
// The passive "Edge": every third blow in a row throws a small Crescent; a foe you cut is Opened (e.openUntil)
// and your next blow on it does half again; cuts go through anything built.
import * as THREE from 'three';
import { stagger } from '../foes.js';
import { near, ground, time, world, hit, raze, line, shake, burst } from './common.js';

const EDGE = '#bfe4ff', GLOW = '#7fe8ff', LIGHT = '#e8f4ff';
const OPEN = 1.5;          // seconds a cut foe stays Opened
const OPEN_BONUS = 1.5;    // the next blow on it does half again
const THIRD = 3;           // blows in a row for a small Crescent
const POWER = 30;          // the heart blow of the ultimate, times might (not imported: ultimate.js imports this file)

// Shared vectors for the pooled effects (never new THREE objects while playing).
const A = new THREE.Vector3(), B = new THREE.Vector3();

// A jagged bright cut between two points.
function bolt(set, x1, y1, z1, x2, y2, z2, color = LIGHT, width = 0.14, life = 0.2) {
  A.set(x1, y1, z1);
  B.set(x2, y2, z2);
  set.fx.lightning(A, B, color, width, life);
}

// A long thin beam (only four exist, so use them for the big lines). Returns the handle.
function beam(set, x1, y1, z1, x2, y2, z2, width, color, secs) {
  A.set(x1, y1, z1);
  B.set(x2, y2, z2);
  return world(set).vfx.beam(A, B, width, color, secs);
}

// Is anything built or grown within `r` of the spot (houses, chunks of trees and walls)?
function built(set, x, z, r) {
  const w = world(set).work;
  return w.chunks.near(x, z, r).length > 0 || w.housesAt(x, z, r).length > 0;
}

function deed(set) {
  set.player.nature?.deed?.('swordcraft');
}

// Cuts that go through anything: razes the built and grown along a line, the nearer first, rolling out.
// Returns true if something built was in the way.
function carve(set, x, z, dx, dz, len, half, force, gap = 0.035) {
  const p = set.player;
  if (p.rooms.house) return false;
  const stride = Math.max(4, half * 1.4);
  let found = false;
  for (let d = 0, i = 0; d <= len; d += stride, i++) {
    const px = x + dx * d, pz = z + dz * d;
    if (built(set, px, pz, half + 1.5)) found = true;
    set.fx.after(i * gap, () => raze(set, px, pz, half + 1.5, force));
  }
  return found;
}

// Sparks and a scored trench along a line (the land is cut too).
function score(set, x, z, dx, dz, len, size, deep = 2) {
  const p = set.player;
  if (p.rooms.house) return;
  const w = world(set);
  for (let d = 3; d <= len; d += size * 2.4) {
    const px = x + dx * d, pz = z + dz * d;
    p.melee.tear(px, pz, size, deep);
    w.vfx.burst(px, ground(set, px, pz) + 0.8, pz, [LIGHT, GLOW, EDGE], 5, 9);
  }
}

// Foes along a line, each cut through the shared path (so Edge opens them). Returns how many.
function cutFoes(set, job, x, z, dx, dz, len, half, force, react = 'knockdown') {
  let n = 0;
  for (const e of line(set, x, z, dx, dz, len, half)) {
    if (e.dying) continue;
    hit(set, job.pid, e, force, react);
    n++;
  }
  return n;
}

// A slash drawn in the air: a handful of cut-lines flashing along (x, z) to (x + dx * len, z + dz * len).
function flash(set, x, z, dx, dz, len, up = 1.4, jag = 1) {
  const y0 = ground(set, x, z) + up, y1 = ground(set, x + dx * len, z + dz * len) + up;
  for (let i = 0; i < 3; i++) {
    const o = (Math.random() - 0.5) * jag;
    bolt(set, x - dz * o, y0, z + dx * o, x + dx * len - dz * o, y1, z + dz * len + dx * o, i ? GLOW : LIGHT, i ? 0.12 : 0.22, 0.28);
  }
}

// A crescent of edge flying out: cuts every foe in line, and every tree and wall it passes.
// o: { x, z, dx, dz, force, range, width, speed, size, big }
function fly(set, job, o) {
  const w = world(set), p = set.player, seen = new Set();
  const shells = [];
  const count = o.big ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const s = set.fx.shell('blade', o.size * (i === 1 ? 1 : 0.7));
    if (s) shells.push(s);
  }
  const yaw = Math.atan2(o.dx, o.dz);
  let { x, z } = o, go = 0, since = 99, foes = 0, razed = false;
  let handle = null;
  if (o.big) handle = beam(set, x, ground(set, x, z) + 1.3, z, x, ground(set, x, z) + 1.3, z, o.width * 0.5, LIGHT, 0.3);
  set.kit.push({
    update(dt) {
      const step = o.speed * dt;
      go += step;
      since += step;
      x += o.dx * step;
      z += o.dz * step;
      const y = ground(set, x, z) + 1.3;
      for (let i = 0; i < shells.length; i++) {
        const side = (i - (shells.length - 1) / 2) * o.width * 0.9, s = shells[i].o;
        s.position.set(x - o.dz * side, y, z + o.dx * side);
        s.rotation.set(Math.PI / 2 * 0.35, yaw, 0);
      }
      if (handle) {
        A.set(x - o.dx * 3 - o.dz * o.width, y, z - o.dz * 3 + o.dx * o.width);
        B.set(x - o.dx * 3 + o.dz * o.width, y, z - o.dz * 3 - o.dx * o.width);
        handle.left = handle.life;
        w.vfx.aim(handle, A, B);
      }
      // A bright tail of cuts behind it.
      bolt(set, x - o.dx * 5, y, z - o.dz * 5, x, y, z, GLOW, 0.1, 0.16);
      for (const e of near(set, x, z, o.width + 2)) {
        if (e.dying || seen.has(e)) continue;
        if (Math.abs((e.x - x) * o.dz - (e.z - z) * o.dx) > o.width + e.radius) continue;
        seen.add(e);
        hit(set, job.pid, e, o.force, 'knockdown');
        foes++;
        burst(set, e.x, e.z, [LIGHT, GLOW], 8, 9, 1.4);
      }
      // Trees and walls fall along its line.
      if (since > 4.5) {
        since = 0;
        if (built(set, x, z, o.width + 1.5)) razed = true;
        raze(set, x, z, o.width + 1.5, o.force * 0.55);
        if (!p.rooms.house) w.vfx.burst(x, y - 0.5, z, [LIGHT, EDGE], 4, 7);
      }
      const done = go >= o.range;
      if (done) {
        for (const s of shells) s.o.visible = false;
        if (handle) w.vfx.stopBeam(handle);
        if (foes >= 3 || razed) deed(set);
      }
      return !done;
    },
  });
}

// The point a power is aimed at: the target, or `d` ahead of the hero.
function mark(set, aim, d) {
  const s = set.player.state;
  return aim.target ? { x: aim.target.x, z: aim.target.z } : { x: s.x + aim.dx * d, z: s.z + aim.dz * d };
}

export const BLADE = {
  // ---- The passive: Edge ----

  // Every third blow in a row throws a small Crescent ahead.
  landed(set) {
    const t = time(set);
    set.edgeRun = t - (set.edgeAt ?? -9) < 1.4 ? (set.edgeRun ?? 0) + 1 : 1;
    set.edgeAt = t;
    if (set.edgeRun < THIRD) return;
    set.edgeRun = 0;
    const p = set.player, s = p.state, d = s.dir ?? [0, 1], len = Math.hypot(d[0], d[1]) || 1;
    fly(set, { pid: null, color: EDGE }, {
      x: s.x, z: s.z, dx: d[0] / len, dz: d[1] / len, force: p.body.might * 0.9, range: 16, width: 1.4, speed: 42, size: 0.8, big: false,
    });
    world(set).vfx.burst(s.x + d[0] / len * 1.5, s.y + 1.4, s.z + d[1] / len * 1.5, [LIGHT, GLOW], 8, 8);
  },

  // A cut foe is Opened; the next blow on it does half again.
  afflicted(set, e) {
    if (!e || e.dying) return;
    e.openUntil = time(set) + OPEN;
  },

  // Any blow on an Opened foe: half again, and it closes.
  blow(set, e) {
    if (!(e.openUntil > time(set))) return 1;
    e.openUntil = 0;
    world(set).vfx.burst(e.x, ground(set, e.x, e.z) + 1.5, e.z, [LIGHT, GLOW], 10, 10);
    return OPEN_BONUS;
  },

  // ---- The powers ----

  // A flying crescent of edge that cuts through every foe in line, and every tree and wall it passes.
  crescent(set, job, aim) {
    const { def, force } = job, s = set.player.state;
    fly(set, job, { x: s.x, z: s.z, dx: aim.dx, dz: aim.dz, force, range: def.range, width: def.width, speed: 62, size: 1.6, big: true });
    world(set).vfx.shock(s.x, ground(set, s.x, s.z), s.z, 6, LIGHT, 0.3);
    shake(set, 0.2 + job.rank * 0.05);
  },

  // Two great slashes cross at the target. Where they meet, the land bursts.
  cross(set, job, aim) {
    const { def, force, rank } = job, p = set.player, w = world(set);
    const at = mark(set, aim, 14), r = def.reach, len = r * 3.2;
    const c = Math.SQRT1_2, lines = [];
    for (const side of [1, -1]) {
      // Each slash runs through the mark at 45 degrees to the aim.
      const dx = aim.dx * c - aim.dz * c * side, dz = aim.dz * c + aim.dx * c * side;
      lines.push({ x: at.x - dx * len / 2, z: at.z - dz * len / 2, dx, dz });
    }
    // The lines show first, then a beat, then they land.
    const handles = lines.map((l) => beam(set, l.x, ground(set, l.x, l.z) + 2, l.z, l.x + l.dx * len, ground(set, l.x + l.dx * len, l.z + l.dz * len) + 2, 0.25, LIGHT, 0.5));
    shake(set, 0.2);
    set.fx.after(0.3, () => {
      for (const h of handles) w.vfx.stopBeam(h);
      let foes = 0, any = false;
      for (const l of lines) {
        foes += cutFoes(set, job, l.x, l.z, l.dx, l.dz, len, 2.2 + rank * 0.2, force * 0.7);
        if (carve(set, l.x, l.z, l.dx, l.dz, len, 2.5, force * 0.6, 0.02)) any = true;
        flash(set, l.x, l.z, l.dx, l.dz, len, 1.5, 2);
        score(set, l.x, l.z, l.dx, l.dz, len, 1.1, 1);
      }
      // Where they meet the land bursts.
      const y = ground(set, at.x, at.z);
      set.fx.after(0.12, () => {
        raze(set, at.x, at.z, r, force * 1.2);
        p.world.work.actor = p;
        p.melee.blast(at.x, at.z, force, r, def.crater + rank * 0.3, job.color, null, 'launch', true, 2);
        set.fx.impact('blade', at.x, y, at.z, r);
        w.vfx.shock(at.x, y, at.z, r * 2, LIGHT, 0.5);
        w.smoke?.column(at.x, y, at.z, 2.2, r);
        set.scar(job, at.x, at.z, r * 1.2);
        shake(set, 0.6 + rank * 0.1);
        if (foes >= 2 || any) deed(set);
      });
    });
  },

  // Vanish through a line of foes. A heartbeat later everything you passed falls apart.
  draw(set, job, aim) {
    const { def, rank, force } = job, p = set.player, s = p.state, w = world(set);
    const far = def.dist * (1 + rank * 0.08), solids = w.marks.solids;
    // Stop short of anything solid, like a dash.
    let reach = far;
    for (let d = 1.5; d <= far; d += 1.5) {
      const x = s.x + aim.dx * d, z = s.z + aim.dz * d;
      if (solids.some((o) => !o.off && (o.r ? Math.hypot(x - o.x, z - o.z) < o.r + 1 : x > o.x0 - 1 && x < o.x1 + 1 && z > o.z0 - 1 && z < o.z1 + 1))) {
        reach = d - 1.5;
        break;
      }
    }
    const x0 = s.x, z0 = s.z, dx = aim.dx, dz = aim.dz, time0 = 0.16, speed = reach / time0;
    // The line you pass is marked now and falls a heartbeat after.
    const found = line(set, x0, z0, dx, dz, reach + 2, def.reach);
    let t = 0;
    p.guard = Math.max(p.guard, time0 + 0.5);
    set.pose = 'dash';
    burst(set, x0, z0, [LIGHT, GLOW], 14, 12, 1.4);
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        const step = Math.min(dt, Math.max(0, time0 - (t - dt))) * speed;
        s.x += dx * step;
        s.z += dz * step;
        s.dir = [dx, dz];
        set.casting = 0.15;
        set.pose = 'dash';
        p.guard = Math.max(p.guard, 0.3);
        const y = ground(set, s.x, s.z) + 1.2;
        bolt(set, s.x - dx * 4, y, s.z - dz * 4, s.x, y, s.z, LIGHT, 0.18, 0.3);
        if (t < time0) return true;
        // The sword was never seen. Now the cuts show, and everything along the line falls.
        if (t - time0 < 0.35) return true;
        const n = found.length;
        flash(set, x0, z0, dx, dz, reach, 1.2, 2.5);
        flash(set, x0, z0, dx, dz, reach, 2.4, 2);
        const any = carve(set, x0, z0, dx, dz, reach, def.reach + 1.5, force * 0.7);
        for (const e of found) {
          if (e.dying) continue;
          hit(set, job.pid, e, force, 'launch');
          burst(set, e.x, e.z, [LIGHT, GLOW, EDGE], 12, 11, 1.4);
        }
        score(set, x0, z0, dx, dz, reach, 1.2, 1);
        shake(set, 0.4 + rank * 0.08);
        if (n >= 2 || any) deed(set);
        return false;
      },
    });
  },

  // A sphere of unseen cuts shreds whatever is inside: foes, trees, walls.
  cuts(set, job, aim) {
    const { def, rank, force } = job, p = set.player, w = world(set);
    const at = mark(set, aim, 12), r = def.reach * (1 + rank * 0.06), secs = def.secs * (1 + rank * 0.1);
    let t = 0, beat = 0, built0 = false, foes = 0;
    const y = ground(set, at.x, at.z);
    const dome = w.vfx.dome(at.x, y + r * 0.4, at.z, EDGE);
    set.kit.push({
      busy: true,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / 0.3);
        w.vfx.shape(dome, r * k * 0.9, t < secs ? 0.35 : Math.max(0, 1 - (t - secs) * 4));
        // Cuts flash everywhere inside.
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * 6.283, b = Math.random() * 6.283, d1 = Math.random() * r, d2 = Math.random() * r;
          const ax = at.x + Math.cos(a) * d1, az = at.z + Math.sin(a) * d1, bx = at.x + Math.cos(b) * d2, bz = at.z + Math.sin(b) * d2;
          bolt(set, ax, ground(set, ax, az) + 0.4 + Math.random() * 3.5, az, bx, ground(set, bx, bz) + 0.4 + Math.random() * 3.5, bz, i % 2 ? GLOW : LIGHT, 0.1, 0.14);
        }
        if ((beat -= dt) <= 0) {
          beat = 0.2;
          // Each beat cuts every foe inside, and what is built.
          for (const e of near(set, at.x, at.z, r)) {
            if (e.dying) continue;
            hit(set, job.pid, e, force * 0.4, 'flinch');
            e.frozenUntil = Math.max(e.frozenUntil ?? 0, time(set) + 0.25);
            foes++;
          }
          if (built(set, at.x, at.z, r)) built0 = true;
          raze(set, at.x, at.z, r, force * 0.35);
          if (!p.rooms.house && Math.random() < 0.5) p.melee.tear(at.x + (Math.random() - 0.5) * r, at.z + (Math.random() - 0.5) * r, 1.4, 1);
          set.fx.rock(at.x + (Math.random() - 0.5) * r, y, at.z + (Math.random() - 0.5) * r, 0.5 + Math.random() * 0.5, 1.2);
          shake(set, 0.18);
        }
        if (t < secs) return true;
        // The last cut, all at once.
        w.vfx.shock(at.x, y, at.z, r * 1.6, LIGHT, 0.5);
        p.world.work.actor = p;
        p.melee.blast(at.x, at.z, force, r, 0, job.color, null, 'launch', true, 2);
        shake(set, 0.5);
        if (foes >= 3 || built0) deed(set);
        return false;
      },
    });
  },

  // Swords rain out of the sky over the target, pinning every foe they strike.
  swordrain(set, job, aim) {
    const { def, rank, force } = job, p = set.player, w = world(set);
    const at = mark(set, aim, 14), r = def.reach, n = Math.round(def.count * (1 + rank * 0.1));
    let foes = 0, any = false;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r, x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
      set.fx.after(i * 0.07, () => {
        const y = ground(set, x, z);
        set.fx.fall('blade', x, y, z, 0.35, 1.1 + Math.random() * 0.5);
        set.fx.after(0.35, () => {
          set.fx.impact('blade', x, y, z, 3);
          burst(set, x, z, [LIGHT, GLOW], 6, 9, 0.8);
          if (built(set, x, z, 3)) any = true;
          raze(set, x, z, 3.2, force * 0.7);
          p.world.work.actor = p;
          p.melee.blast(x, z, force, 3.2, 0.3, job.color, null, 'flinch', true, 2);
          // Pinned: a struck foe is held where the sword went in.
          for (const e of near(set, x, z, 3.2)) {
            if (e.dying) continue;
            e.frozenUntil = Math.max(e.frozenUntil ?? 0, time(set) + 2.5);
            e.openUntil = time(set) + OPEN;
            if (!e.boss) e.vel.set(0, 0);
            foes++;
          }
          if (i % 3 === 0) shake(set, 0.2);
        });
      });
    }
    set.fx.after(n * 0.07 + 0.5, () => {
      w.vfx.shock(at.x, ground(set, at.x, at.z), at.z, r * 1.6, LIGHT, 0.5);
      if (foes >= 3 || any) deed(set);
    });
  },

  // A ring of swords turns around you. Each flies at the first foe that comes close, then returns.
  halo(set, job) {
    const { def, rank, force } = job, p = set.player, w = world(set);
    const n = def.count + Math.floor(rank / 2), secs = def.secs * (1 + rank * 0.1), swords = [];
    for (let i = 0; i < n; i++) {
      const s = set.fx.shell('blade', 0.9);
      if (s) swords.push({ s, ang: (i / n) * 6.283, foe: null, flown: 0, back: false, x: 0, z: 0 });
    }
    let t = 0, cut = 0, razed = false;
    set.kit.push({
      busy: false,
      update(dt) {
        const st = p.state;
        t += dt;
        const ending = t >= secs;
        for (const k of swords) {
          const o = k.s.o;
          if (!ending && !k.foe && !k.back) {
            k.ang += dt * 3.2;
            const hx = st.x + Math.cos(k.ang) * 3.2, hz = st.z + Math.sin(k.ang) * 3.2;
            k.x = hx;
            k.z = hz;
            o.position.set(hx, ground(set, hx, hz) + 1.4, hz);
            o.rotation.set(Math.PI / 2 * 0.2, -k.ang + Math.PI / 2, 0);
            // The first foe that comes close.
            for (const e of near(set, st.x, st.z, def.reach)) {
              if (e.dying || e.sworded > time(set)) continue;
              k.foe = e;
              e.sworded = time(set) + 0.5;
              break;
            }
          } else if (k.foe) {
            // Flies at the foe, goes through it and comes back.
            const e = k.foe, tx = e.x, tz = e.z, d = Math.hypot(tx - k.x, tz - k.z) || 1;
            const step = Math.min(d, 45 * dt);
            const dx = (tx - k.x) / d, dz = (tz - k.z) / d;
            k.x += dx * step;
            k.z += dz * step;
            const y = ground(set, k.x, k.z) + 1.4;
            o.position.set(k.x, y, k.z);
            o.rotation.set(Math.PI / 2 * 0.2, Math.atan2(dx, dz), 0);
            if (d < 1.4 || e.dying) {
              if (!e.dying) {
                hit(set, job.pid, e, force, 'knockdown');
                if (built(set, k.x, k.z, 3)) razed = true;
                raze(set, k.x, k.z, 3, force * 0.5);
                burst(set, k.x, k.z, [LIGHT, GLOW], 9, 10, 1.4);
                cut++;
              }
              k.foe = null;
              k.back = true;
            }
          } else {
            // Back to its place on the ring.
            const hx = st.x + Math.cos(k.ang) * 3.2, hz = st.z + Math.sin(k.ang) * 3.2, d = Math.hypot(hx - k.x, hz - k.z) || 1;
            const step = Math.min(d, 40 * dt);
            k.x += (hx - k.x) / d * step;
            k.z += (hz - k.z) / d * step;
            o.position.set(k.x, ground(set, k.x, k.z) + 1.4, k.z);
            if (d < 0.8) k.back = false;
          }
          if (Math.random() < 0.1) bolt(set, k.x, o.position.y, k.z, k.x + (Math.random() - 0.5) * 2, o.position.y + (Math.random() - 0.5), k.z + (Math.random() - 0.5) * 2, GLOW, 0.06, 0.12);
        }
        if (!ending) return true;
        for (const k of swords) k.s.o.visible = false;
        if (cut >= 3 || razed) deed(set);
        return false;
      },
    });
    w.vfx.shock(p.state.x, ground(set, p.state.x, p.state.z), p.state.z, 8, GLOW, 0.4);
  },

  // One downward cut splits the land ahead into a chasm. Foes in it fall in, and are thrown out.
  cleave(set, job, aim) {
    const { def, rank, force } = job, p = set.player, s = p.state, w = world(set);
    const dx = aim.dx, dz = aim.dz, len = def.range * (1 + rank * 0.08), x0 = s.x + dx * 2, z0 = s.z + dz * 2;
    const half = 3 + rank * 0.3;
    // The line shows, a beat of silence, then the ground opens in a rolling wave.
    const h = beam(set, x0, ground(set, x0, z0) + 1, z0, x0 + dx * len, ground(set, x0 + dx * len, z0 + dz * len) + 1, 0.5, LIGHT, 0.6);
    shake(set, 0.15);
    set.fx.after(0.4, () => {
      w.vfx.stopBeam(h);
      const found = line(set, x0, z0, dx, dz, len, half);
      let razed = false;
      const stride = 3.2;
      for (let d = 0, i = 0; d <= len; d += stride, i++) {
        const px = x0 + dx * d, pz = z0 + dz * d;
        set.fx.after(i * 0.03, () => {
          if (built(set, px, pz, half + 1)) razed = true;
          raze(set, px, pz, half + 1, force * 0.8);
          if (!p.rooms.house) {
            p.melee.tear(px, pz, 2.4 + rank * 0.2, 3);
            p.melee.tear(px + dz * 1.5, pz - dx * 1.5, 2, 3);
            p.melee.tear(px - dz * 1.5, pz + dx * 1.5, 2, 3);
          }
          w.vfx.burst(px, ground(set, px, pz) + 0.8, pz, [LIGHT, GLOW, '#a89070'], 5, 10);
          set.fx.rock(px + (Math.random() - 0.5) * 3, ground(set, px, pz), pz + (Math.random() - 0.5) * 3, 0.8 + Math.random() * 0.8, 1.6);
          if (i % 4 === 0) {
            set.fx.pillar(px, ground(set, px, pz), pz, 1.4, LIGHT, 0.4);
            w.smoke?.column(px, ground(set, px, pz), pz, 1.2, 4);
            shake(set, 0.3 + rank * 0.05);
          }
        });
      }
      // Foes in it fall in, and are thrown out.
      for (const e of found) {
        if (e.dying) continue;
        const d = Math.max(0, Math.min(len, (e.x - x0) * dx + (e.z - z0) * dz));
        set.fx.after(d / len * len * 0.03 + 0.1, () => {
          if (e.dying) return;
          stagger(e, 0.8, time(set));
          hit(set, job.pid, e, force, 'launch');
          set.fx.impact('blade', e.x, ground(set, e.x, e.z), e.z, 4);
        });
      }
      set.scar(job, x0 + dx * len * 0.5, z0 + dz * len * 0.5, half * 2);
      if (found.length >= 2 || razed) deed(set);
    });
  },

  // One cut to the edge of sight. Everything along it, armies, houses, walls, is cut in two.
  horizon(set, job, aim) {
    const { def, rank, force } = job, p = set.player, s = p.state, w = world(set);
    const dx = aim.dx, dz = aim.dz, len = def.range * (1 + rank * 0.06), x0 = s.x + dx * 2, z0 = s.z + dz * 2;
    const half = 2.2 + rank * 0.25, wait = def.wait;
    const y1 = ground(set, x0 + dx * len, z0 + dz * len) + 2;
    set.pose = 'punch';
    // The line: one long bright cut, and then nothing happens.
    const h = beam(set, x0, ground(set, x0, z0) + 2, z0, x0 + dx * len, y1, z0 + dz * len, 0.4, LIGHT, wait + 0.5);
    flash(set, x0, z0, dx, dz, len, 2, 0.3);
    w.vfx.shock(s.x, ground(set, s.x, s.z), s.z, 10, LIGHT, 0.4);
    shake(set, 0.2);
    // A beat of silence, then the world along it falls apart in a rolling wave.
    set.fx.after(wait, () => {
      w.vfx.stopBeam(h);
      const found = line(set, x0, z0, dx, dz, len, half + 1.5);
      let razed = false;
      const stride = 5, rate = 0.012;
      for (let d = 0, i = 0; d <= len; d += stride, i++) {
        const px = x0 + dx * d, pz = z0 + dz * d;
        set.fx.after(i * rate, () => {
          const y = ground(set, px, pz);
          if (built(set, px, pz, half + 2)) razed = true;
          raze(set, px, pz, half + 3, force * 0.9);
          if (!p.rooms.house) p.melee.tear(px, pz, 1.8 + rank * 0.15, 2);
          w.vfx.burst(px, y + 1, pz, [LIGHT, GLOW, EDGE], 6, 12, { up: 1.2 });
          bolt(set, px - dz * 4, y + 6, pz + dx * 4, px + dz * 4, y + 0.5, pz - dx * 4, LIGHT, 0.2, 0.3);
          set.fx.rock(px + (Math.random() - 0.5) * 4, y, pz + (Math.random() - 0.5) * 4, 0.7 + Math.random(), 1.6);
          if (i % 3 === 0) {
            set.fx.pillar(px, y, pz, 1.2, LIGHT, 0.45);
            w.smoke?.column(px, y, pz, 1.6, 5);
            shake(set, 0.35 + rank * 0.05);
          }
        });
      }
      // Every foe on the line is cut as the wave reaches it.
      for (const e of found) {
        const d = Math.max(0, (e.x - x0) * dx + (e.z - z0) * dz);
        set.fx.after(d / stride * rate, () => {
          if (e.dying) return;
          hit(set, job.pid, e, force, 'launch');
          set.fx.impact('blade', e.x, ground(set, e.x, e.z), e.z, 5);
        });
      }
      set.scar(job, x0 + dx * len * 0.5, z0 + dz * len * 0.5, half * 2);
      shake(set, 1);
      if (found.length >= 2 || razed) deed(set);
    });
  },
};

// ---- The Wrath ultimate: Domain of Edges ----
// A dome of cut-lines flashes without end and everything inside is held still. At the last beat every cut
// lands at once: all foes struck, all built things razed, the ground scored.
export const BLADE_ULT = {
  name: 'Domain of Edges', secs: 5.6, color: EDGE, tint: '#dff4ff', reach: 40, gray: 0.5,
  start(u) {
    const { state } = u.p;
    u.reach = Math.min(70, this.reach + u.p.powers.mastery * 0.5);
    u.dome = u.world.vfx.dome(state.x, u.ground(state.x, state.z), state.z, LIGHT);
    u.cx = state.x;
    u.cz = state.z;
    u.still = u.foes(u.reach);
    u.pose('slam');
  },
  tick(u, t) {
    const r = u.reach ?? this.reach, grow = Math.min(1, t / 0.5), fx = u.world.fx;
    u.world.vfx.shape(u.dome, r * (1 - (1 - grow) ** 3), t < 4.8 ? 0.55 : Math.max(0, 1 - (t - 4.8) * 2));
    // Everything inside is held still.
    for (const e of u.foes(r, { x: u.cx, z: u.cz })) {
      if (!u.still.includes(e)) u.still.push(e);
      if (t < 4.8) e.frozenUntil = u.time + 0.1;
    }
    // Cut-lines flash faster and faster, then a beat of silence before the last cut.
    if (t < 4.3) {
      const n = 3 + Math.floor(t * 2);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, b = Math.random() * 6.283, d1 = Math.sqrt(Math.random()) * r, d2 = Math.sqrt(Math.random()) * r;
        const ax = u.cx + Math.cos(a) * d1, az = u.cz + Math.sin(a) * d1, bx = u.cx + Math.cos(b) * d2, bz = u.cz + Math.sin(b) * d2;
        A.set(ax, u.ground(ax, az) + 0.5 + Math.random() * 8, az);
        B.set(bx, u.ground(bx, bz) + 0.5 + Math.random() * 8, bz);
        fx.lightning(A, B, i % 3 ? LIGHT : GLOW, 0.1 + Math.random() * 0.1, 0.12 + Math.random() * 0.1);
      }
      // A few long cuts through the sky with the beams.
      if (Math.random() < 0.15) {
        const a = Math.random() * 6.283, d = r * (0.3 + Math.random() * 0.7);
        const x = u.cx + Math.cos(a) * d, z = u.cz + Math.sin(a) * d;
        A.set(x, u.ground(x, z) + 1 + Math.random() * 6, z);
        B.set(u.cx - (x - u.cx), u.ground(u.cx, u.cz) + 2 + Math.random() * 6, u.cz - (z - u.cz));
        u.world.vfx.beam(A, B, 0.2, LIGHT, 0.18);
      }
      if (Math.random() < 0.3) {
        const a = Math.random() * 6.283, d = Math.random() * r;
        u.world.vfx.burst(u.cx + Math.cos(a) * d, u.ground(u.cx, u.cz) + 1, u.cz + Math.sin(a) * d, [LIGHT, GLOW], 3, 8);
      }
      if (Math.random() < 0.1) {
        u.world.work.shake = Math.max(u.world.work.shake, 0.15 + t * 0.05);
        u.world.work.shakeAt = u.p.state;
      }
    }
    if (t < 0.6) u.pose('slam');
  },
  beats: [
    [4.8, (u) => {
      const set = u.p.powers, w = u.world, r = u.reach ?? 40, might = u.p.body.might;
      const y = u.ground(u.cx, u.cz);
      // Every cut lands at once: each foe struck, with the heart blow.
      for (const e of u.still) {
        if (e.dying) continue;
        e.frozenUntil = 0;
        e.openUntil = 0;
        u.strike(e.x, e.z, POWER, 3, 0, 'launch', e);
        u.world.fx.impact('blade', e.x, u.ground(e.x, e.z), e.z, 4);
      }
      // All built things razed: the whole dome, then rings and spokes so it rolls out from the middle.
      u.strike(u.cx, u.cz, POWER * 0.5, r, 10, 'fly');
      raze(set, u.cx, u.cz, r, might * POWER * 0.6);
      for (let k = 1; k <= 4; k++) {
        const ring = r * k / 4, n = 6 + k * 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.283 + k, x = u.cx + Math.cos(a) * ring, z = u.cz + Math.sin(a) * ring;
          set.fx.after(k * 0.08, () => raze(set, x, z, 9, might * POWER * 0.5));
        }
      }
      // The ground scored: spokes of cut trenches out from the middle.
      if (!u.p.rooms.house) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * 6.283, dx = Math.cos(a), dz = Math.sin(a);
          for (let d = 4; d < r; d += 5) {
            const x = u.cx + dx * d, z = u.cz + dz * d;
            set.fx.after(d * 0.006, () => {
              u.p.melee.tear(x, z, 1.8, 3);
              w.vfx.burst(x, u.ground(x, z) + 0.8, z, [LIGHT, GLOW], 3, 10);
            });
          }
          A.set(u.cx, y + 1.5, u.cz);
          B.set(u.cx + dx * r, u.ground(u.cx + dx * r, u.cz + dz * r) + 1.5, u.cz + dz * r);
          fx_line(u, A, B);
        }
      }
      u.p.powers.scar({ rank: 4 }, u.cx, u.cz, r * 0.8, 5);
      w.vfx.shock(u.cx, y, u.cz, r + 2, '#ffffff', 0.7);
      w.smoke?.column(u.cx, y, u.cz, 3, 14);
      u.boom(1);
    }],
  ],
};

// A bright cut across the dome (a lightning bolt, since the beam pool is small).
function fx_line(u, a, b) {
  u.world.fx.lightning(a, b, LIGHT, 0.35, 0.5);
}
