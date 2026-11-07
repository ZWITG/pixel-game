import { stagger } from '../foes.js';

// The Titan's kit (v0.33.0): earth as a material you move. Each power `kind` here is called by
// PowerSet.use(set, job, aim) instead of the shared kinds in powers.js; lasting effects go on
// `set.kit` as { update(dt) → false when done, busy }. Hooks the rest of the game calls:
//   tick(set, dt)        every frame: Seismic Sense
//   absorb(set, amount)  a blow reaching the hero: Stone Mail takes it
//   onPunch(set)         Square pressed: a Slab in flight bursts instead of a punch
//   landed(set)          a blow of the hero's landed: Stone Mail plates set back
//   finisher(melee, e)   the chain's Finisher: the Pillar Uppercut
const ARMOURED = ['soldier', 'legionary', 'iceGuard', 'chief', 'marshal', 'bandit'];
const SENSE_STILL = 0.6, SENSE_EVERY = 0.9, SENSE_REACH = 45, SENSE_MASTERY = 5;
const MAIL_RESET = 3;        // landed blows to set a lost plate back
const STONE = ['#a89070', '#8a7460', '#c9a87a'];

const near = (set, x, z, r) => set.player.melee.monsters.within(x, z, r);
const ground = (set, x, z) => set.player.melee.height(x, z);
const time = (set) => set.player.melee.monsters.time;

// A blow from the power at (x, z): everything in `reach`, thrown as `react`.
function blow(set, job, x, z, force, reach, react, crater = 0, target = null) {
  const p = set.player;
  p.world.work.actor = p;
  p.melee.blast(x, z, force, reach, crater, job.color, target, react, true, 2);
}

function dust(set, x, z, amount = 1, reach = 3) {
  set.player.world.smoke?.dust(x, ground(set, x, z) + 0.4, z, STONE[0], amount, reach);
  set.player.world.vfx.burst(x, ground(set, x, z) + 0.6, z, STONE, Math.round(6 * amount), 8);
}

export const TITAN = {
  // A column under the target throws it up; Cross then flies after it, as after a Launcher.
  pillar(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim;
    p.world.quake.pillar(x, z, 9 + rank * 1.5, 0);
    set.fx.after(0.1, () => {
      blow(set, job, x, z, force, def.reach + rank * 0.3, 'launch', 0, aim.target);
      p.world.vfx.shock(x, ground(set, x, z), z, 7, '#e8b070', 0.3);
      dust(set, x, z, 1.2, 3);
      const t = aim.target;
      if (t && Math.hypot(t.x - p.state.x, t.z - p.state.z) < 24) p.melee.pursuit = { e: t, until: p.melee.clock + 1 };
    });
  },

  // A slab torn out of the ground in front of you (it leaves a real dent) and thrown.
  slab(set, job, aim) {
    const p = set.player, s = p.state;
    if (!p.rooms.house) p.melee.tear(s.x + aim.dx * 3, s.z + aim.dz * 3, 2.4, 3);
    dust(set, s.x + aim.dx * 3, s.z + aim.dz * 3, 1.5, 3);
    set.bolt(job, aim);
    set.bolts[set.bolts.length - 1].slab = true;
  },

  // Square while a slab is in the air near you: it bursts into a spray of stone.
  onPunch(set) {
    const { state } = set.player, b = set.bolts.find((x) => x.slab && Math.hypot(x.x - state.x, x.z - state.z) < 18);
    if (!b) return false;
    b.slab = false;
    const n = b.def.shards + Math.floor(b.rank / 2), base = Math.atan2(b.dx, b.dz);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16, shell = set.fx.shell('earth', 0.45);
      set.bolts.push({ ...b, def: { ...b.def, blast: 2.4, crater: 0, size: 0.5, range: 34 }, force: b.force * 0.45, dx: Math.sin(a), dz: Math.cos(a), left: 34, hit: new Set(), shell, glow: null, chain: 0, slab: false });
    }
    b.left = -1; // it bursts where it is
    set.player.world.vfx.burst(b.x, ground(set, b.x, b.z) + 1.7, b.z, STONE, 24, 18);
    set.player.world.work.shake = Math.max(set.player.world.work.shake, 0.2);
    set.casting = 0.2;
    set.pose = 'punch';
    return true;
  },

  // Riding a rolling wave of earth: it tramples what it meets and tears the ground behind.
  surf(set, job, aim) {
    const p = set.player, { def, rank, force } = job, hit = new Set();
    let t = 0, beat = 0, tore = 0, dx = aim.dx, dz = aim.dz;
    const secs = def.secs * (1 + rank * 0.08);
    set.kit.push({
      busy: true,
      update(dt) {
        const s = p.state, c = p.controls, m = c.move(false), yaw = p.world.viewYaw(p), sy = Math.sin(yaw), cy = Math.cos(yaw);
        // The stick steers the wave.
        const wx = cy * m.x + sy * m.y, wz = -sy * m.x + cy * m.y;
        if (Math.hypot(wx, wz) > 0.2) {
          const want = Math.atan2(wx, wz), now = Math.atan2(dx, dz), turn = Math.max(-dt * 3, Math.min(dt * 3, Math.atan2(Math.sin(want - now), Math.cos(want - now))));
          dx = Math.sin(now + turn);
          dz = Math.cos(now + turn);
        }
        t += dt;
        s.x += dx * def.speed * dt;
        s.z += dz * def.speed * dt;
        s.dir = [dx, dz];
        p.guard = Math.max(p.guard, 0.15);
        set.casting = 0.15;
        set.pose = 'dash';
        if ((beat -= dt) <= 0) {
          beat = 0.08;
          for (const e of near(set, s.x, s.z, def.reach)) {
            if (hit.has(e)) continue;
            hit.add(e);
            p.world.work.actor = p;
            p.melee.monsters.hit(e, force, s.x - dx, s.z - dz, 'knockdown', 1);
          }
          set.fx.rock(s.x - dx * 2.5 + (Math.random() - 0.5) * 3, ground(set, s.x, s.z), s.z - dz * 2.5 + (Math.random() - 0.5) * 3, 0.6 + Math.random() * 0.5, 1.4);
          dust(set, s.x - dx * 2, s.z - dz * 2, 0.6, 2);
        }
        if ((tore += def.speed * dt) > 5 && !p.rooms.house) {
          tore = 0;
          p.melee.tear(s.x - dx * 3, s.z - dz * 3, 1.6, 2);
        }
        return t < secs;
      },
    });
  },

  // Stone plates rise and lock on; each takes half a blow and breaks off. Landed blows set them back.
  mail(set, job) {
    const { def, rank } = job;
    set.buff(job);
    const max = def.plates + rank;
    set.mail = { plates: max, max, each: def.each, landed: 0, left: def.secs * (1 + rank * 0.1), shells: [] };
    set.kit.push({
      update(dt) {
        const m = set.mail;
        if (!m) return false;
        m.left -= dt;
        const s = set.player.state, y = ground(set, s.x, s.z) + s.air + 1.4 * set.player.body.heroScale, r = 0.95 * set.player.body.heroScale;
        while (m.shells.length < m.plates) {
          const sh = set.fx.shell('earth', 0.42);
          if (!sh) break;
          m.shells.push(sh);
        }
        while (m.shells.length > m.plates) m.shells.pop().o.visible = false;
        m.shells.forEach((sh, i) => {
          const a = (i / m.max) * 6.283 + time(set) * 0.6;
          sh.o.position.set(s.x + Math.cos(a) * r, y + Math.sin(i * 2.1) * 0.5, s.z + Math.sin(a) * r);
          sh.o.rotation.set(i, a, 0);
        });
        if (m.left > 0) return true;
        for (const sh of m.shells) sh.o.visible = false;
        set.mail = null;
        return false;
      },
    });
  },

  absorb(set, amount) {
    const m = set.mail;
    if (!m || m.plates <= 0) return amount;
    m.plates--;
    const s = set.player.state;
    set.player.world.vfx.burst(s.x, s.y + s.air + 1.5, s.z, STONE, 12, 9);
    set.player.hud.float(m.plates ? `Plates ${m.plates}` : 'Mail broken!', s.x, s.y + 3.6, s.z, '#d8b07a');
    return amount * (1 - m.each);
  },

  landed(set) {
    const m = set.mail;
    if (!m || m.plates >= m.max || ++m.landed < MAIL_RESET) return;
    m.landed = 0;
    m.plates++;
  },

  // A ring of spears around the target pins everything inside it.
  garden(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim, r = def.reach + rank * 0.4, n = def.count + rank;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      set.fx.after(i * 0.025, () => set.fx.rock(px, ground(set, px, pz), pz, 1.1 + Math.random() * 0.4, 3 + rank * 0.3));
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.283, d = Math.random() * r * 0.6;
      set.fx.after(0.2, () => set.fx.rock(x + Math.cos(a) * d, ground(set, x, z), z + Math.sin(a) * d, 0.9, 2.5));
    }
    set.fx.after(0.2, () => {
      for (const e of near(set, x, z, r + 1)) {
        if (!e.boss) stagger(e, def.pin + rank * 0.15, time(set), true);
        e.vel.set(0, 0);
        set.harm(job.pid, e, force);
      }
      p.world.vfx.shock(x, ground(set, x, z), z, r + 2, '#e8b070', 0.35);
      dust(set, x, z, 1, r);
    });
  },

  // The ground turns to sand: foes sink, can barely move, and smashes hit them twice as hard.
  sand(set, job, aim) {
    const { def, rank } = job, { x, z } = aim, r = def.reach + rank * 0.5;
    let left = def.secs * (1 + rank * 0.1), beat = 0;
    set.fx.disc(x, ground(set, x, z), z, r * 1.05, '#c8a060', left);
    set.kit.push({
      update(dt) {
        left -= dt;
        if ((beat -= dt) <= 0) {
          beat = 0.25;
          for (const e of near(set, x, z, r)) {
            e.sunkUntil = time(set) + 0.4;
            e.sinkTo = e.boss ? 0.4 : 1;
            set.sting(e, set.player.body.might * def.dps * 0.25);
          }
          const a = Math.random() * 6.283, d = Math.random() * r;
          set.player.world.smoke?.puff(x + Math.cos(a) * d, ground(set, x, z) + 0.3, z + Math.sin(a) * d, { size: 2, life: 1.5, tint: '#c8a060', alpha: 0.4, lift: 0.5 });
        }
        return left > 0;
      },
    });
  },

  // The ground opens under a crowd, swallows it, and slams shut. Big ones stay half-buried, Broken.
  rift(set, job, aim) {
    const p = set.player, { def, rank, force } = job, { x, z } = aim, r = def.reach + rank * 0.5, hold = def.hold;
    const t = time(set), across = Math.atan2(aim.dx, aim.dz) + Math.PI / 2, ax = Math.sin(across), az = Math.cos(across);
    const caught = near(set, x, z, r);
    for (const e of caught) {
      e.sunkUntil = t + hold + 0.2;
      e.sinkTo = 2.6;
      stagger(e, hold + 0.4, t, true);
      e.vel.set(0, 0);
    }
    // Walls of stone rise on both sides of the gap.
    for (let i = -4; i <= 4; i++) {
      for (const side of [-1, 1]) {
        const px = x + ax * i * (r / 4) + Math.sin(across - Math.PI / 2) * side * 3.5, pz = z + az * i * (r / 4) + Math.cos(across - Math.PI / 2) * side * 3.5;
        p.world.quake.pillar(px, pz, 4 + Math.random() * 3, Math.abs(i) * 0.03);
      }
    }
    if (!p.rooms.house) for (let i = -2; i <= 2; i++) p.melee.tear(x + ax * i * (r / 2.5), z + az * i * (r / 2.5), 2.2, 4);
    dust(set, x, z, 2, r);
    set.fx.after(hold, () => {
      const big = caught.filter((e) => !e.dying && (e.boss || e.elder || e.def.name.includes('Golem') || (e.tier ?? 0) >= 5));
      for (const e of big) {
        p.melee.monsters.wear(e, (e.postureMax ?? 20) * 2);
        e.sunkUntil = time(set) + 3;
        e.sinkTo = 1.4;
      }
      blow(set, job, x, z, force, r, 'launch', 2 + rank * 0.4);
      p.world.vfx.shock(x, ground(set, x, z), z, r + 4, '#ffb070', 0.45);
      set.fx.impact('earth', x, ground(set, x, z), z, r * 0.8);
      p.world.work.shake = Math.max(p.world.work.shake, 0.45);
      p.world.work.shakeAt = p.state;
      p.world.work.impact = 0.05;
    });
  },

  // A mountain: far bigger, slower, armoured, and every blow lands like a landslide (a buff with size and reach).
  mountain(set, job) {
    set.buff(job);
    const p = set.player;
    p.world.vfx.shock(p.state.x, ground(set, p.state.x, p.state.z), p.state.z, 12, '#e8964a', 0.5);
    dust(set, p.state.x, p.state.z, 2, 6);
    p.world.work.shake = Math.max(p.world.work.shake, 0.35);
    p.world.work.shakeAt = p.state;
  },

  // The iron in armour and war machines answers: soldiers lose their grip, machines crumple.
  ironbend(set, job) {
    const p = set.player, { def, rank, force } = job, s = p.state, t = time(set), y = ground(set, s.x, s.z) + 1.6;
    let any = false;
    for (const e of near(set, s.x, s.z, def.reach + rank)) {
      const machine = !!e.def.machine, armoured = ARMOURED.includes(e.kind);
      if (!machine && !armoured) continue;
      any = true;
      set.fx.lightning({ x: s.x, y, z: s.z }, { x: e.x, y: e.group.position.y + 1.5, z: e.z }, '#c8d0dc', 0.12, 0.35);
      p.world.vfx.burst(e.x, e.group.position.y + 1.5, e.z, ['#c8d0dc', '#ffffff', '#8a94a4'], 10, 9);
      if (machine) {
        set.harm(job.pid, e, force * def.machine);
        p.hud.float('Crumpled!', e.x, e.group.position.y + 4, e.z, '#c8d0dc');
      } else {
        e.disarmedUntil = t + def.disarm + rank;
        set.harm(job.pid, e, force);
        p.melee.monsters.wear(e, 2);
        if (!e.boss) e.vel.set(s.x - e.x, s.z - e.z).normalize().multiplyScalar(10);
        p.hud.float('Disarmed!', e.x, e.group.position.y + 4, e.z, '#c8d0dc');
      }
    }
    if (!any) p.hud.message('No iron near enough to bend.');
  },

  // Veins of magma race ahead through the ground and burst up one after another.
  magma(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, n = def.count + rank, scale = 1 + rank * 0.2;
    for (let i = 1; i <= n; i++) {
      const x = s.x + aim.dx * def.line * i, z = s.z + aim.dz * def.line * i;
      set.fx.after(0.12 + i * 0.09, () => {
        // Fire first, then stone driven up through it: the land itself makes magma (scars.js).
        p.world.scars.mark('fire', x, z, 2.5, p, 1, scale * 0.5);
        p.world.scars.mark('earth', x, z, 2.5, p, 1, scale * 0.5);
        blow(set, job, x, z, force, 3.5, 'stagger', 1);
        for (const e of near(set, x, z, 3.5)) set.afflict(job.pid, e, { status: 'burn' }, rank);
        set.fx.impact('fire', x, ground(set, x, z), z, 3);
        set.fx.rock(x, ground(set, x, z), z, 0.8, 1.6);
      });
    }
  },

  // Standing still on the ground, the Titan feels every foot on it: rings through walls, red for a blow coming.
  tick(set, dt) {
    const p = set.player, s = p.state;
    if (set.mastery < SENSE_MASTERY || s.moving || s.air > 0.2 || p.swim.inWater) {
      set.still = 0;
      return;
    }
    set.still = (set.still ?? 0) + dt;
    if (set.still < SENSE_STILL || (set.sensed = (set.sensed ?? 0) - dt) > 0) return;
    set.sensed = SENSE_EVERY;
    const list = near(set, s.x, s.z, SENSE_REACH).slice(0, 10);
    for (const e of list) p.world.vfx.shock(e.x, ground(set, e.x, e.z), e.z, e.radius + 2, e.mode === 'tell' ? '#ff4a4a' : '#e8b070', 0.6);
  },

  // The end of the rush chain: the foe is driven onto a column bursting up under it.
  finisher(melee, e) {
    melee.player.world.quake.pillar(e.x, e.z, 10, 0);
    return 'launch';
  },
};
