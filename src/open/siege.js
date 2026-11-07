import * as THREE from 'three';
import { DOCTRINES } from './doctrines.js';

// Siege machines that matter (v0.38.0). Every machine has its own shot (SIEGE): it aims a moment
// (a red line, or a red circle on the ground where it will land), leads a moving hero, and hits
// hard enough to fear: `hit` is a share of the hero's health; `heavy` breaks a guard, so roll or
// Vanish it. A machine needs its crew: kill them and it falls silent. Trebuchets flatten what they
// land on. `world.siege`; Monsters.fireOrb hands machines' shots here.
export const SIEGE = {
  ballista: { shot: 'bolt', aim: 0.7, range: 45, speed: 70, hit: 0.2, heavy: true, pin: 0.6, color: '#e8c050' },
  trebuchet: { shot: 'arc', aim: 0.4, range: 75, flight: 1.4, radius: 6, hit: 0.35, heavy: true, crater: 3, houses: true, color: '#c8b89c' },
  thornTurret: { shot: 'fan', aim: 0.5, range: 30, speed: 40, count: 5, spread: 0.18, hit: 0.06, poison: 0.01, color: '#5fae62' },
  frostCannon: { shot: 'arc', aim: 0.5, range: 40, flight: 1, radius: 5, hit: 0.15, chill: 3, color: '#8fe0ff' },
  flameCannon: { shot: 'cone', aim: 0.5, range: 16, secs: 1.2, hit: 0.08, burn: true, color: '#ff7a2a' },
  plagueEngine: { shot: 'arc', aim: 0.5, range: 45, flight: 1.2, radius: 6, hit: 0.05, cloud: 5, raise: 2, color: '#a8d84a' },
  boneEngine: { shot: 'burrow', aim: 0.4, range: 35, delay: 1, radius: 3, hit: 0.22, heavy: true, color: '#e8dcc0' },
};
const CREW = 2, CREW_REACH = 3.5;
const POOL = 24;

export default class Siege {
  constructor(world) {
    this.world = world;
    this.shots = [];
    this.dots = [];
    this.clouds = [];
    this.last = new Map();       // a hero's last position, to lead the shot
    const scene = world.scene;
    const pool = (geo, mat) => Array.from({ length: POOL }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.castShadow = true;
      scene.add(m);
      return m;
    });
    this.bolts = pool(new THREE.CylinderGeometry(0.12, 0.12, 3, 6).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7a5230' }));
    this.balls = pool(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#8a8070', flatShading: true }));
  }

  get monsters() {
    return this.world.monsters;
  }

  // A crew of the nation's troops stands by each machine; kill them and it falls silent.
  crew(e) {
    const kind = e.def.machine, owner = Object.entries(DOCTRINES).find(([, d]) => d.machine === kind || (kind === 'trebuchet' && d.machine === 'ballista'));
    const troop = owner?.[1].troops[owner[1].troops.length - 1] ?? 'soldier', m = this.monsters;
    e.crew = [];
    for (let i = 0; i < CREW; i++) {
      const a = (i / CREW) * 6.283 + 1, c = m.add(troop, e.x + Math.cos(a) * CREW_REACH, e.z + Math.sin(a) * CREW_REACH, m.danger(e.x, e.z), false, null, true);
      c.machine = e;
      if (e.nation) c.nation = e.nation;
      e.crew.push(c);
    }
  }

  manned(e) {
    if (!e.crew) return true;
    const alive = e.crew.some((c) => !c.dying && this.monsters.list.includes(c));
    if (!alive && !e.silent) {
      e.silent = true;
      const p = this.world.players[0];
      p?.hud.float('Silenced!', e.x, e.group.position.y + 4, e.z, '#c9c2b4');
    }
    return alive;
  }

  // Where a hero will be in `secs`, if they keep going as they are.
  lead(p, secs) {
    const v = this.last.get(p)?.v ?? { x: 0, z: 0 }, s = p.state;
    return { x: s.x + v.x * secs, z: s.z + v.z * secs };
  }

  // A machine's turn to shoot at the hero it's facing.
  fire(e) {
    const def = SIEGE[e.def.machine], p = e.foe ?? this.world.players[0];
    if (!def || !p || !this.manned(e)) return;
    const s = p.state, d = Math.hypot(s.x - e.x, s.z - e.z);
    if (d > def.range || p.rooms.house) return;
    const ground = (x, z) => p.melee.height(x, z), fx = this.world.fx, vfx = this.world.vfx;
    const from = { x: e.x, y: e.group.position.y + 2.4, z: e.z };
    const flight = def.flight ?? def.delay ?? (def.speed ? d / def.speed : 0.3);
    const at = this.lead(p, def.aim + flight);
    // The warning: a red line along the aim for bolts and spray, a red circle where the rest will land.
    if (def.shot === 'bolt' || def.shot === 'fan' || def.shot === 'cone') {
      const to = new THREE.Vector3(at.x, ground(at.x, at.z) + 1.6, at.z);
      vfx.beam(new THREE.Vector3(from.x, from.y, from.z), to, 0.08, '#ff3a2a', def.aim);
    } else fx.disc(at.x, ground(at.x, at.z), at.z, def.radius, '#ff3a2a', def.aim + flight);
    e.state = 'windup';
    e.stateUntil = this.monsters.time + def.aim;
    this.shots.push({ e, def, p, from, at, wait: def.aim, t: 0, flight, mesh: null, hit: false });
  }

  hurt(p, share, x, z, heavy, from) {
    this.monsters.hurt(p, p.body.maxHealth * share, x, z, { heavy, from });
  }

  update(dt) {
    const { players } = this.world, fx = this.world.fx, vfx = this.world.vfx;
    // How fast each hero is moving, smoothed, for leading shots.
    for (const p of players) {
      const was = this.last.get(p), s = p.state;
      const v = was ? { x: (s.x - was.x) / Math.max(dt, 1e-3), z: (s.z - was.z) / Math.max(dt, 1e-3) } : { x: 0, z: 0 };
      const k = Math.min(1, dt * 4), old = was?.v ?? v;
      this.last.set(p, { x: s.x, z: s.z, v: Math.hypot(v.x, v.z) > 80 ? old : { x: old.x + (v.x - old.x) * k, z: old.z + (v.z - old.z) * k } });
    }
    this.shots = this.shots.filter((sh) => {
      if (sh.wait > 0) {
        sh.wait -= dt;
        if (sh.wait > 0) return true;
        sh.mesh = sh.def.shot === 'bolt' ? this.take(this.bolts) : sh.def.shot === 'arc' ? this.take(this.balls) : null;
        if (sh.mesh) {
          sh.mesh.material.color?.set(sh.def.shot === 'arc' ? sh.def.color : '#7a5230');
          sh.mesh.scale.setScalar(sh.def.shot === 'arc' ? 0.9 : 1);
        }
        if (sh.def.shot === 'fan') this.fan(sh);
        if (sh.def.shot === 'cone') this.cone(sh);
        if (sh.def.shot === 'fan' || sh.def.shot === 'cone') return false;
      }
      sh.t += dt;
      const k = Math.min(1, sh.t / Math.max(0.05, sh.flight));
      const g = sh.p.melee.height(sh.at.x, sh.at.z);
      if (sh.def.shot === 'bolt') {
        // Straight and fast: whatever it meets on the way is hit, the hero pinned.
        const x = sh.from.x + (sh.at.x - sh.from.x) * k, z = sh.from.z + (sh.at.z - sh.from.z) * k, y = sh.from.y + (g + 1.6 - sh.from.y) * k;
        sh.mesh?.position.set(x, y, z);
        sh.mesh?.lookAt(sh.at.x, g + 1.6, sh.at.z);
        const s = sh.p.state;
        if (!sh.hit && Math.hypot(s.x - x, s.z - z) < 1.6 && s.air < 3) {
          sh.hit = true;
          const before = sh.p.hp;
          this.hurt(sh.p, sh.def.hit, sh.from.x, sh.from.z, true, sh.e);
          if (sh.p.hp < before) sh.p.melee.broken = Math.max(sh.p.melee.broken, sh.def.pin);
        }
      } else if (sh.def.shot === 'arc') {
        const x = sh.from.x + (sh.at.x - sh.from.x) * k, z = sh.from.z + (sh.at.z - sh.from.z) * k;
        sh.mesh?.position.set(x, sh.from.y + (g - sh.from.y) * k + Math.sin(k * Math.PI) * (10 + sh.flight * 6), z);
        if (sh.mesh) sh.mesh.rotation.x += dt * 6;
      }
      if (k < 1) return true;
      if (sh.mesh) sh.mesh.visible = false;
      if (sh.def.shot !== 'bolt') this.land(sh, g);
      return false;
    });
    // Lingering harm: poison, freezing fields, plague clouds.
    const t = this.monsters.time;
    this.dots = this.dots.filter((d) => {
      d.left -= dt;
      if (!d.p.rooms.house && d.p.guard <= 0) {
        d.p.hp = Math.max(0, d.p.hp - d.p.body.maxHealth * d.dps * dt);
        d.p.hud.setHealth(d.p.hp / d.p.body.maxHealth);
        if (d.p.hp <= 0) {
          d.p.down();
          return false;
        }
      }
      return d.left > 0;
    });
    this.clouds = this.clouds.filter((c) => {
      c.left -= dt;
      if (Math.random() < 0.5) this.world.smoke?.puff(c.x + (Math.random() - 0.5) * c.r, c.y + 0.5, c.z + (Math.random() - 0.5) * c.r, { size: 4, grow: 1.5, life: 2, tint: c.color, alpha: 0.4, lift: 0.6 });
      for (const p of players) {
        if (Math.hypot(p.state.x - c.x, p.state.z - c.z) < c.r && !p.rooms.house) this.dots.push({ p, dps: c.dps, left: dt * 1.01 });
        if (c.chill && Math.hypot(p.state.x - c.x, p.state.z - c.z) < c.r) p.slowUntil = t + 0.3;
      }
      return c.left > 0;
    });
    void fx;
    void vfx;
  }

  take(list) {
    const m = list.find((x) => !x.visible) ?? list[0];
    m.visible = true;
    return m;
  }

  // Where an arcing shot or a burrowing one comes down.
  land(sh, g) {
    const { def, at, p } = sh, fx = this.world.fx;
    const d = Math.hypot(p.state.x - at.x, p.state.z - at.z);
    if (d < def.radius && p.state.air < 3) this.hurt(p, def.hit * (1 - 0.5 * d / def.radius), at.x, at.z, !!def.heavy, sh.e);
    this.world.vfx.shock(at.x, g, at.z, def.radius + 2, def.color, 0.35);
    this.world.work.shake = Math.max(this.world.work.shake, def.heavy ? 0.3 : 0.15);
    this.world.work.shakeAt = p.state;
    if (def.shot === 'burrow') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 6.283;
        fx.rock(at.x + Math.cos(a) * def.radius * 0.6, g, at.z + Math.sin(a) * def.radius * 0.6, 0.8, 1.6);
      }
      fx.rock(at.x, g, at.z, 1.4, 2);
    } else fx.impact(def.chill ? 'ice' : def.cloud ? 'void' : 'earth', at.x, g, at.z, def.radius * 0.6);
    // A trebuchet's stone flattens what it lands on and leaves a crater.
    if (def.houses) {
      const w = this.world.work;
      for (const h of w.housesAt(at.x, at.z, def.radius)) w.hitHouse(h, p.body.might * 30, { x: at.x, z: at.z, reach: def.radius, y: g + 1.3 });
      if (p.melee.canTear(at.x, at.z, def.crater)) p.melee.tear(at.x, at.z, def.crater);
      this.world.smoke?.dust(at.x, g + 0.5, at.z, '#a89070', 2, def.radius);
    }
    if (def.chill) this.clouds.push({ x: at.x, y: g, z: at.z, r: def.radius, left: def.chill, dps: 0, chill: true, color: '#dff4ff' });
    if (def.cloud) {
      this.clouds.push({ x: at.x, y: g, z: at.z, r: def.radius, left: def.cloud, dps: def.hit, color: '#8aa848' });
      // The plague raises the dead on its own side.
      for (let i = 0; i < def.raise; i++) {
        const e = this.monsters.add('drowned', at.x + (Math.random() - 0.5) * 6, at.z + (Math.random() - 0.5) * 6, this.monsters.danger(at.x, at.z), false);
        if (sh.e.nation) e.nation = sh.e.nation;
      }
    }
  }

  // Thorn spitter: a fan of thorns, each one poisoning.
  fan(sh) {
    const { def, from, at, p } = sh, base = Math.atan2(at.x - from.x, at.z - from.z), s = p.state;
    for (let i = 0; i < def.count; i++) {
      const a = base + (i - (def.count - 1) / 2) * def.spread, len = Math.hypot(at.x - from.x, at.z - from.z) + 6;
      const tx = from.x + Math.sin(a) * len, tz = from.z + Math.cos(a) * len;
      this.world.fx.lightning(from, { x: tx, y: p.melee.height(tx, tz) + 1.4, z: tz }, def.color, 0.06, 0.25);
      // Close enough to the line of this thorn: it strikes.
      const along = (s.x - from.x) * Math.sin(a) + (s.z - from.z) * Math.cos(a), off = Math.abs((s.x - from.x) * Math.cos(a) - (s.z - from.z) * Math.sin(a));
      if (along > 0 && along < len && off < 1.4 && s.air < 3) {
        this.hurt(p, def.hit, from.x, from.z, false, sh.e);
        this.dots.push({ p, dps: def.poison, left: 3 });
      }
    }
  }

  // Flame cannon: a cone of sticky fire that keeps burning the ground.
  cone(sh) {
    const { def, from, at, p } = sh, s = p.state, base = Math.atan2(at.x - from.x, at.z - from.z);
    for (let i = 0; i < 8; i++) {
      const a = base + (Math.random() - 0.5) * 0.6, r = 4 + Math.random() * (def.range - 4), x = from.x + Math.sin(a) * r, z = from.z + Math.cos(a) * r;
      this.world.fx.flame(x, p.melee.height(x, z), z, 3.5, 0.8, 0);
      this.world.scars.mark('fire', x, z, 1.6, null, 1, 0.4);
    }
    const d = Math.hypot(s.x - from.x, s.z - from.z), ang = Math.atan2(s.x - from.x, s.z - from.z), off = Math.abs(Math.atan2(Math.sin(ang - base), Math.cos(ang - base)));
    if (d < def.range && off < 0.35 && s.air < 3) {
      this.hurt(p, def.hit, from.x, from.z, false, sh.e);
      this.dots.push({ p, dps: def.hit * 0.5, left: def.secs });
    }
  }
}
