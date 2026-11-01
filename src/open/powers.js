import * as THREE from 'three';
import { CONQUERORS, MAX_RANK, svg } from './conquerors.js';
import { stagger } from './foes.js';
import { prompt } from '../ui/glyphs.js';

// What a power does when it's used, by `kind`, and the light it makes. Each hero has a PowerSet;
// the effects themselves are shared. Rank makes everything stronger and quicker.
const SLOTS = 4;
const AIM_FAR = 42;          // tiles a power will reach for a target
const AIM_CONE = 0.45;       // how far off dead ahead a target can be, as a dot product
const FLY_HEIGHT = 1.7;
const PRACTICE = 1, PRACTICE_HIT = 0.4;
const TICK = 0.5;            // seconds between hits from a zone, aura or burn
const BURN_SECS = 3.5, BURN_SHARE = 0.25;
const SHOCK_SECS = 0.5;
const CAST_TIME = 0.32;
const MOTE_EVERY = 0.11;     // seconds between sparks drifting off a Conqueror
const DASH_TIME = 0.16;
const SAFE_DASH = 0.35;      // seconds nothing can touch a hero who dashes
const CHAIN_REACH = 15;
const STRIKE_WAIT = 0.45;
const SHADE_REACH = 15, SHADE_EVERY = 0.8;
const TRAIL_EVERY = 3;       // tiles between patches of a fiery trail
const SOLID_STEP = 1.5;      // tiles between checks along a dash
const CAST_POSE = { bolt: 'punch', nova: 'slam', strike: 'peak', buff: 'gather', zone: 'peak', orbit: 'peak', wall: 'slam' };
const STATUS_COLORS = { burn: ['#ff9a3a', '#ff5a2a', '#ffd070'], freeze: ['#dff4ff', '#8fe0ff'], shock: ['#fff4b0', '#ffe25a'] };
const GLOWS = 160, PILLARS = 20, DISCS = 12, ZAPS = 14, CRYSTALS = 40;

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), f = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  f.addColorStop(0, '#ffffff');
  f.addColorStop(0.35, '#a0a0a0');
  f.addColorStop(1, '#000000');
  g.fillStyle = f;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Pools of light. Everything here adds to the picture, and nothing is created during play.
export class PowerFx {
  constructor(scene) {
    const map = softTexture();
    const pool = (n, make) => Array.from({ length: n }, () => {
      const o = make();
      o.visible = false;
      o.frustumCulled = false;
      scene.add(o);
      return { o, age: 9, life: 1 };
    });
    const add = { transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending };
    this.glows = pool(GLOWS, () => new THREE.Sprite(new THREE.SpriteMaterial({ map, ...add })));
    const pillar = new THREE.CylinderGeometry(1, 1, 90, 12, 1, true).translate(0, 45, 0);
    this.pillars = pool(PILLARS, () => new THREE.Mesh(pillar, new THREE.MeshBasicMaterial({ ...add, side: THREE.DoubleSide })));
    const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    this.discs = pool(DISCS, () => new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ map, ...add, side: THREE.DoubleSide, depthTest: false })));
    this.zaps = pool(ZAPS, () => {
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
      return new THREE.Line(g, new THREE.LineBasicMaterial({ ...add }));
    });
    const crystal = new THREE.ConeGeometry(1.5, 8, 5).translate(0, 3.2, 0);
    this.crystals = pool(CRYSTALS, () => {
      const m = new THREE.Mesh(crystal, new THREE.MeshLambertMaterial({ color: '#bfeaff', emissive: '#2a7aa8', emissiveIntensity: 0.7, flatShading: true, transparent: true, opacity: 0.92 }));
      m.castShadow = true;
      return m;
    });
    this.live = [this.glows, this.pillars, this.discs, this.zaps, this.crystals];
  }

  take(list) {
    return list.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
  }

  // grow: multiplies the size over its life. A negative life holds it until `free`.
  glow(x, y, z, size, color, life = 0.4, grow = 1.6) {
    const g = this.take(this.glows);
    Object.assign(g, { age: 0, life, size, grow });
    g.o.position.set(x, y, z);
    g.o.scale.setScalar(size);
    g.o.material.color.set(color);
    g.o.material.opacity = 1;
    g.o.visible = true;
    return g;
  }

  pillar(x, y, z, width, color, life = 0.35) {
    const p = this.take(this.pillars);
    Object.assign(p, { age: 0, life, width });
    p.o.position.set(x, y, z);
    p.o.material.color.set(color);
    p.o.visible = true;
  }

  disc(x, y, z, size, color, life) {
    const d = this.take(this.discs);
    Object.assign(d, { age: 0, life, size });
    d.o.position.set(x, y + 0.5, z);
    d.o.scale.setScalar(size);
    d.o.material.color.set(color);
    d.o.visible = true;
    return d;
  }

  zap(a, b, color, life = 0.16) {
    const z = this.take(this.zaps), p = z.o.geometry.attributes.position;
    Object.assign(z, { age: 0, life });
    for (let i = 0; i < 8; i++) {
      const t = i / 7, wild = i && i < 7 ? 0.9 : 0;
      p.setXYZ(i, a.x + (b.x - a.x) * t + (Math.random() - 0.5) * wild, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * wild, a.z + (b.z - a.z) * t + (Math.random() - 0.5) * wild);
    }
    p.needsUpdate = true;
    z.o.material.color.set(color);
    z.o.visible = true;
  }

  crystal(x, y, z, life) {
    const c = this.take(this.crystals);
    Object.assign(c, { age: 0, life });
    c.o.position.set(x, y, z);
    c.o.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 6, (Math.random() - 0.5) * 0.3);
    c.o.material.opacity = 0.92;
    c.o.visible = true;
    return c;
  }

  update(dt) {
    for (const list of this.live) for (const item of list) {
      if (!item.o.visible) continue;
      item.age += dt;
      const k = item.age / item.life;
      if (k >= 1) {
        item.age = item.life;
        item.o.visible = false;
      } else if (list === this.glows) {
        item.o.scale.setScalar(item.size * (1 + (item.grow - 1) * k));
        item.o.material.opacity = 1 - k * k;
      } else if (list === this.pillars) {
        item.o.scale.set(item.width * (1 - k), 1, item.width * (1 - k));
        item.o.material.opacity = 1 - k;
      } else if (list === this.discs) {
        item.o.material.opacity = Math.min(0.75, (1 - k) * 2.5) * (0.8 + Math.sin(item.age * 7) * 0.2);
      } else if (list === this.zaps) {
        item.o.material.opacity = 1 - k;
      } else {
        item.o.material.opacity = Math.min(0.92, (1 - k) * 8);
      }
    }
  }
}

const rankScale = (rank) => 1 + rank * 0.4;

export default class PowerSet {
  constructor(player, saveKey) {
    Object.assign(this, { player, saveKey });
    this.id = null;
    this.loadout = [];
    this.waits = {};
    this.casting = 0;
    this.pose = 'punch';
    this.bolts = [];
    this.strikes = [];
    this.zones = [];
    this.buffs = [];
    this.shades = [];
    this.walls = [];
    this.dashing = null;
    this.burns = new Map();
    this.tick = 0;
    this.trailed = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey));
      if (saved && CONQUERORS[saved.id]) {
        this.id = saved.id;
        this.loadout = saved.loadout ?? [];
      }
    } catch { /* no conqueror chosen yet */ }
  }

  get def() {
    return CONQUERORS[this.id] ?? null;
  }

  get fx() {
    return this.player.world.fx;
  }

  // Permanent: nothing in the game calls this once a conqueror is set.
  choose(id) {
    this.id = id;
    this.loadout = Object.keys(CONQUERORS[id].powers).slice(0, 2).concat([null, null]);
    this.save();
  }

  save() {
    try {
      localStorage.setItem(this.saveKey, JSON.stringify({ id: this.id, loadout: this.loadout }));
    } catch { /* it lasts for this visit */ }
  }

  skillOf(pid) {
    return `${this.id}.${pid}`;
  }

  rank(pid) {
    return this.player.skills.level(this.skillOf(pid));
  }

  // The sum of every rank: how far along the whole path a hero is. New powers open with it.
  get mastery() {
    return Object.keys(this.def?.powers ?? {}).reduce((sum, pid) => sum + this.rank(pid), 0);
  }

  open(pid) {
    return this.mastery >= this.def.powers[pid].mastery;
  }

  // Puts a power on a D-pad direction; if it's already worn, the two swap places.
  wear(pid, slot) {
    const was = this.loadout.indexOf(pid);
    if (was >= 0) this.loadout[was] = this.loadout[slot];
    this.loadout[slot] = pid;
    this.save();
  }

  bonus(name) {
    return this.buffs.reduce((sum, b) => sum + (b.def[name] ?? 0), 0);
  }

  // Where to send a power: at the locked enemy, or the nearest one roughly ahead.
  aim() {
    const { state, melee } = this.player, [dx, dz] = state.dir, len = Math.hypot(dx, dz) || 1, ax = dx / len, az = dz / len;
    let target = melee.lock && !melee.lock.dying ? melee.lock : null;
    if (!target) {
      let best = AIM_FAR;
      for (const e of melee.monsters.within(state.x, state.z, AIM_FAR)) {
        const d = Math.hypot(e.x - state.x, e.z - state.z) || 1;
        if (((e.x - state.x) * ax + (e.z - state.z) * az) / d > AIM_CONE && d < best) {
          best = d;
          target = e;
        }
      }
    }
    if (!target) return { x: state.x + ax * 16, z: state.z + az * 16, dx: ax, dz: az, target: null };
    const d = Math.hypot(target.x - state.x, target.z - state.z) || 1;
    return { x: target.x, z: target.z, dx: (target.x - state.x) / d, dz: (target.z - state.z) / d, target };
  }

  use(slot) {
    const pid = this.loadout[slot], { player } = this, { hud, rooms, state, melee } = player;
    if (!pid) return hud.message('Nothing on this button. Choose a power in the menu.');
    if ((this.waits[pid] ?? 0) > 0 || melee.held) return undefined;
    if (rooms.house && !rooms.house.dark) return hud.message('Not in here.');
    const def = this.def.powers[pid], rank = this.rank(pid), { kind } = def;
    const aim = this.aim(), force = melee.force * def.power * rankScale(rank) || 0;
    const job = { pid, def, rank, force, color: this.def.color };
    state.dir = [aim.dx, aim.dz];
    this.player.world.work.actor = player;
    this[kind](job, aim);
    this.waits[pid] = def.cool * (1 - rank * 0.07);
    this.casting = CAST_TIME;
    this.pose = CAST_POSE[kind] ?? 'punch';
    player.skills.add(this.skillOf(pid), PRACTICE);
    return undefined;
  }

  // ---- what each kind of power does ----
  bolt(job, aim) {
    const { def, rank, color } = job, { state } = this.player, n = (def.count ?? 1) + (def.count ? Math.floor(rank / 2) : 0), base = Math.atan2(aim.dx, aim.dz);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * (def.spread ?? 0), glow = this.fx.glow(state.x, 0, state.z, def.size ?? 0.8, color, 99, 1);
      this.bolts.push({ ...job, x: state.x, z: state.z, dx: Math.sin(a), dz: Math.cos(a), left: def.range, hit: new Set(), glow, chain: (def.chain ?? 0) + (def.chain ? rank : 0) });
    }
  }

  nova({ pid, def, rank, force, color }) {
    const { state, melee } = this.player, reach = def.reach * (1 + rank * 0.06), y = melee.height(state.x, state.z);
    const list = melee.monsters.within(state.x, state.z, reach);
    if (def.pull) for (const e of list) if (!e.boss) e.vel.set(state.x - e.x, state.z - e.z).multiplyScalar(2.2);
    if (!def.pull) melee.blast(state.x, state.z, force, reach, def.crater ? def.crater + rank * 0.6 : 0, color);
    else for (const e of list) this.harm(pid, e, force);
    for (const e of list) this.afflict(pid, e, def, rank);
    if (def.drain && list.length) this.heal(list.length * def.drain * rankScale(rank));
    this.fx.glow(state.x, y + 1.5, state.z, reach * 0.7, color, 0.5, 2.6);
    melee.ring(state.x, y, state.z, reach, color);
    this.player.world.work.burst(state.x, y + 0.5, state.z, STATUS_COLORS[def.status] ?? [color], 18, 7);
    this.player.world.work.shake = Math.max(this.player.world.work.shake ?? 0, Math.min(0.5, reach * 0.02));
    this.player.world.work.shakeAt = this.player.state;
    if (list.length) this.player.skills.add(this.skillOf(pid), PRACTICE_HIT * Math.min(4, list.length));
  }

  strike(job, aim) {
    const { def, rank } = job, { melee, state } = this.player, wait = def.wait ?? STRIKE_WAIT;
    const place = (x, z, at) => {
      this.strikes.push({ ...job, x, z, at });
      melee.ring(x, melee.height(x, z), z, def.reach, job.color);
    };
    if (def.each) {
      for (const e of melee.monsters.within(state.x, state.z, def.each)) place(e.x, e.z, wait);
    } else if (def.line) {
      const n = def.count + rank;
      for (let i = 1; i <= n; i++) place(state.x + aim.dx * def.line * i * 0.8, state.z + aim.dz * def.line * i * 0.8, 0.12 + i * 0.09);
    } else {
      const n = def.count + (def.scatter ? rank : 0);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, d = def.scatter ? Math.sqrt(Math.random()) * def.scatter : 0;
        place(aim.x + Math.cos(a) * d, aim.z + Math.sin(a) * d, wait + i * (def.scatter ? 0.14 : 0));
      }
    }
  }

  dash(job, aim) {
    const { def, rank } = job, { state, world } = this.player, solids = world.marks.solids, far = def.dist * (1 + rank * 0.08);
    let reach = far;
    for (let d = SOLID_STEP; d <= far; d += SOLID_STEP) {
      const x = state.x + aim.dx * d, z = state.z + aim.dz * d;
      if (solids.some((s) => !s.off && (s.r ? Math.hypot(x - s.x, z - s.z) < s.r + 1 : x > s.x0 - 1 && x < s.x1 + 1 && z > s.z0 - 1 && z < s.z1 + 1))) {
        reach = d - SOLID_STEP;
        break;
      }
    }
    this.player.guard = Math.max(this.player.guard, SAFE_DASH);
    this.dashing = { ...job, dx: aim.dx, dz: aim.dz, speed: reach / DASH_TIME, left: DASH_TIME, hit: new Set() };
    this.pose = 'dash';
  }

  buff(job) {
    const { def, rank, pid } = job;
    this.buffs = this.buffs.filter((b) => b.pid !== pid);
    this.buffs.push({ ...job, left: def.secs * (1 + rank * 0.1) });
  }

  zone(job, aim) {
    const { def, rank, color } = job, { state, melee } = this.player, at = def.at === 'target' ? aim : state;
    this.addZone(job, at.x, at.z, def.reach, def.secs * (1 + rank * 0.1), def.follow);
    melee.ring(at.x, melee.height(at.x, at.z), at.z, def.reach, color);
  }

  addZone(job, x, z, reach, left, follow = false) {
    const y = this.player.melee.height(x, z);
    this.zones.push({ ...job, x, z, reach, left, follow, disc: this.fx.disc(x, y, z, reach * 1.1, job.color, left) });
  }

  orbit(job) {
    const { def, rank } = job, n = def.count + Math.floor(rank / 2);
    this.shades = [];
    for (let i = 0; i < n; i++) this.shades.push({ ...job, turn: (i / n) * 6.28, left: def.secs, next: SHADE_EVERY * (i / n), glow: this.fx.glow(0, 0, 0, 1.1, job.color, def.secs, 1) });
  }

  wall(job, aim) {
    const { def, rank } = job, { state, melee, world } = this.player, n = def.count + rank, secs = def.secs;
    for (let i = 0; i < n; i++) {
      const side = (i - (n - 1) / 2) * 2.6, x = state.x + aim.dx * 8 - aim.dz * side, z = state.z + aim.dz * 8 + aim.dx * side;
      this.fx.crystal(x, melee.height(x, z), z, secs);
      const solid = { x, z, r: 1.6 };
      world.marks.solids.push(solid);
      this.walls.push({ solid, left: secs });
    }
  }

  // ---- what lasting effects do each frame ----
  harm(pid, e, force) {
    const { player } = this;
    player.world.work.actor = player;
    player.melee.monsters.hit(e, force, player.state.x, player.state.z);
    player.skills.add(this.skillOf(pid), PRACTICE_HIT);
  }

  // A small hurt with no knockback, for burns and fields.
  sting(e, amount) {
    if (e.dying) return;
    this.player.world.work.actor = this.player;
    e.takeHit(Math.round(Math.max(0.1, amount) * 10) / 10, e.x, e.z);
    e.vel.set(0, 0);
  }

  afflict(pid, e, def, rank) {
    const { melee: { monsters }, world: { work } } = this.player;
    if (e.dying) return;
    const y = e.group.position.y + 1.5;
    if (def.status === 'burn') {
      this.burns.set(e, { left: BURN_SECS * (1 + rank * 0.15), dps: this.player.melee.force * BURN_SHARE * rankScale(rank) });
    } else if (def.status === 'freeze' && !e.boss) {
      stagger(e, (def.chill ?? 1) * (1 + rank * 0.12), monsters.time, true);
      this.fx.glow(e.x, y, e.z, 2.4, '#bfeaff', 0.5);
    } else if (def.status === 'shock' && !e.boss) {
      stagger(e, SHOCK_SECS, monsters.time, true);
    }
    if (STATUS_COLORS[def.status]) work.burst(e.x, y, e.z, STATUS_COLORS[def.status], 3, 3);
  }

  heal(amount) {
    const { player } = this;
    player.hp = Math.min(player.body.maxHealth, player.hp + amount);
    player.hud.setHealth(player.hp / player.body.maxHealth);
  }

  explode(b, x, z) {
    const { melee } = this.player, { def, rank, force, color } = b, y = melee.height(x, z) + 1;
    if (def.blast) {
      melee.blast(x, z, force, def.blast * (1 + rank * 0.06), def.crater ?? 0, color);
      for (const e of melee.monsters.within(x, z, def.blast)) this.afflict(b.pid, e, def, rank);
    }
    this.fx.glow(x, y, z, (def.blast ?? 2) * 1.2, color, 0.45, 2);
  }

  updateBolts(dt) {
    const { melee } = this.player, { fx } = this;
    this.bolts = this.bolts.filter((b) => {
      const move = b.speed ?? b.def.speed;
      b.x += b.dx * move * dt;
      b.z += b.dz * move * dt;
      b.left -= move * dt;
      const y = melee.height(b.x, b.z) + FLY_HEIGHT;
      b.glow.o.position.set(b.x, y, b.z);
      fx.glow(b.x, y, b.z, (b.def.size ?? 0.8) * 0.7, b.color, 0.22, 0.4);
      let done = b.left <= 0;
      for (const e of melee.monsters.within(b.x, b.z, 1.2)) {
        if (b.hit.has(e)) continue;
        b.hit.add(e);
        this.harm(b.pid, e, b.force);
        this.afflict(b.pid, e, b.def, b.rank);
        if (b.chain > 0) this.leap(b, e);
        if (!b.def.pierce) done = true;
      }
      if (!done) return true;
      this.explode(b, b.x, b.z);
      b.glow.age = b.glow.life;
      b.glow.o.visible = false;
      return false;
    });
  }

  // Lightning jumps on to the nearest enemy it hasn't touched.
  leap(b, from) {
    const { melee } = this.player;
    let at = from;
    for (let n = b.chain; n > 0; n--) {
      const next = melee.monsters.within(at.x, at.z, CHAIN_REACH).filter((e) => !b.hit.has(e)).sort((p, q) => Math.hypot(p.x - at.x, p.z - at.z) - Math.hypot(q.x - at.x, q.z - at.z))[0];
      if (!next) break;
      b.hit.add(next);
      this.fx.zap({ x: at.x, y: at.group.position.y + 1.5, z: at.z }, { x: next.x, y: next.group.position.y + 1.5, z: next.z }, b.color);
      this.harm(b.pid, next, b.force * 0.8);
      this.afflict(b.pid, next, b.def, b.rank);
      at = next;
    }
  }

  updateStrikes(dt) {
    const { melee } = this.player;
    this.strikes = this.strikes.filter((s) => {
      if ((s.at -= dt) > 0) return true;
      const y = melee.height(s.x, s.z), reach = s.def.reach * (1 + s.rank * 0.06);
      melee.blast(s.x, s.z, s.force, reach, s.def.crater ?? 0, s.color);
      for (const e of melee.monsters.within(s.x, s.z, reach)) this.afflict(s.pid, e, s.def, s.rank);
      this.fx.pillar(s.x, y, s.z, Math.max(1.2, reach * 0.3), s.color);
      this.fx.glow(s.x, y + 1, s.z, reach * 1.1, s.color, 0.4, 2);
      this.player.world.work.burst(s.x, y + 0.5, s.z, STATUS_COLORS[s.def.status] ?? [s.color, '#a89a8c'], 8, 6);
      this.player.skills.add(this.skillOf(s.pid), PRACTICE_HIT * 0.5);
      return false;
    });
  }

  updateDash(dt) {
    const { dashing: d } = this, { state, melee } = this.player;
    if (!d) return;
    const step = Math.min(dt, d.left);
    state.x += d.dx * d.speed * step;
    state.z += d.dz * d.speed * step;
    d.left -= dt;
    this.casting = CAST_TIME;
    const y = melee.height(state.x, state.z) + 1.4;
    this.fx.glow(state.x, y, state.z, 2.2, d.color, 0.35, 0.5);
    if (d.def.power) {
      for (const e of melee.monsters.within(state.x, state.z, d.def.reach)) {
        if (d.hit.has(e)) continue;
        d.hit.add(e);
        this.harm(d.pid, e, d.force);
      }
    }
    if (d.left <= 0) this.dashing = null;
  }

  updateLasting(dt) {
    const { state, melee, world } = this.player;
    this.tick -= dt;
    const beat = this.tick <= 0;
    if (beat) this.tick = TICK;
    this.buffs = this.buffs.filter((b) => {
      b.left -= dt;
      if (beat) {
        world.work.burst(state.x, melee.height(state.x, state.z) + 1, state.z, [b.color], 2, 2);
        if (b.def.aura) for (const e of melee.monsters.within(state.x, state.z, b.def.aura)) {
          this.sting(e, melee.force * b.def.dps * rankScale(b.rank) * TICK);
          this.afflict(b.pid, e, b.def, b.rank);
        }
      }
      if (b.def.trail && Math.hypot(state.x - (this.trailX ?? 1e9), state.z - (this.trailZ ?? 1e9)) > TRAIL_EVERY) {
        this.trailX = state.x;
        this.trailZ = state.z;
        this.addZone({ ...b, def: { ...b.def, status: 'burn' } }, state.x, state.z, 2.4, 3);
      }
      return b.left > 0;
    });
    this.zones = this.zones.filter((z) => {
      z.left -= dt;
      if (z.follow) {
        z.x = state.x;
        z.z = state.z;
        z.disc.o.position.set(z.x, melee.height(z.x, z.z) + 0.5, z.z);
      }
      if (beat) for (const e of melee.monsters.within(z.x, z.z, z.reach)) {
        if (z.def.pull && !e.boss) e.vel.set(z.x - e.x, z.z - e.z).multiplyScalar(1.4);
        this.sting(e, melee.force * z.def.dps * rankScale(z.rank) * TICK);
        this.afflict(z.pid, e, z.def, z.rank);
      }
      return z.left > 0;
    });
    this.shades = this.shades.filter((s) => {
      s.left -= dt;
      s.turn += dt * 2.2;
      s.next -= dt;
      const r = 3 * this.player.body.heroScale, x = state.x + Math.cos(s.turn) * r, z = state.z + Math.sin(s.turn) * r, y = melee.height(state.x, state.z) + 2 + Math.sin(s.turn * 2) * 0.4;
      s.glow.o.position.set(x, y, z);
      if (s.next <= 0) {
        const e = melee.monsters.within(x, z, SHADE_REACH)[0];
        if (e) {
          s.next = SHADE_EVERY;
          this.fx.zap({ x, y, z }, { x: e.x, y: e.group.position.y + 1.5, z: e.z }, s.color);
          this.harm(s.pid, e, s.force);
        }
      }
      return s.left > 0;
    });
    this.walls = this.walls.filter((w) => {
      w.left -= dt;
      if (w.left > 0) return true;
      world.marks.solids.splice(world.marks.solids.indexOf(w.solid), 1);
      return false;
    });
    if (beat) for (const [e, burn] of this.burns) {
      burn.left -= TICK;
      if (e.dying || burn.left <= 0) {
        this.burns.delete(e);
        continue;
      }
      this.sting(e, burn.dps * TICK);
      world.work.burst(e.x, e.group.position.y + 1.2, e.z, STATUS_COLORS.burn, 2, 2);
    }
  }

  update(dt) {
    if (!this.id) return;
    for (const pid of Object.keys(this.waits)) this.waits[pid] = Math.max(0, this.waits[pid] - dt);
    this.casting = Math.max(0, this.casting - dt);
    // Sparks of the Conqueror's element drift up around them, always.
    if ((this.mote = (this.mote ?? 0) - dt) <= 0) {
      this.mote = MOTE_EVERY;
      const { state } = this.player, a = Math.random() * 6.28, d = 0.6 + Math.random() * 1.2;
      this.fx.glow(state.x + Math.cos(a) * d, Math.max(state.y, 0) + state.air + Math.random() * 2.4, state.z + Math.sin(a) * d, 0.34, this.def.color, 0.8, 0.15);
    }
    this.updateDash(dt);
    this.updateBolts(dt);
    this.updateStrikes(dt);
    this.updateLasting(dt);
  }
}

// The four worn powers, laid out like the D-pad they sit on.
export class PowerBar {
  constructor(prefix) {
    this.box = document.getElementById(`${prefix}powers`);
    this.box.innerHTML = Array.from({ length: SLOTS }, (_, i) => `<div class="pow s${i}"><i></i><u></u><b></b></div>`).join('');
    this.cells = [...this.box.children].map((el) => ({ el, icon: el.children[0], veil: el.children[1], key: el.children[2], pid: undefined }));
    this.device = null;
  }

  update(set, device) {
    this.box.hidden = !set.def;
    if (!set.def) return;
    this.cells.forEach((c, i) => {
      const pid = set.loadout[i];
      if (pid !== c.pid) {
        c.pid = pid;
        const def = pid ? set.def.powers[pid] : null;
        c.icon.innerHTML = def ? svg(def.kind, 22) : '';
        c.el.classList.toggle('empty', !def);
        c.el.style.color = def ? set.def.color : '';
        c.el.title = def?.name ?? '';
      }
      // On a pad the cross itself says which button is which.
      if (device !== this.device) c.key.innerHTML = device === 'pad' ? '' : prompt(`power${i}`, device);
      const wait = pid ? set.waits[pid] ?? 0 : 0, cool = pid ? set.def.powers[pid].cool * (1 - set.rank(pid) * 0.07) : 1;
      c.veil.style.height = `${(wait / cool) * 100}%`;
    });
    this.device = device;
  }
}

export { MAX_RANK, svg };
