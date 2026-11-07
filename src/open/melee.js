import * as THREE from 'three';
import { height as landHeight, dentAt, PLACES, SPAWN, TOWNS } from './terrain.js';
import { SPAWN_CLEAR } from './work.js';
import { FEATURES } from '../config/features.js';

// Punching. Square throws a three-hit chain anywhere, at anything. The punch itself grows in
// stages: each needs both practice (`level` of the Punching skill) and Strength, so the hero
// has to use their fists and build their body to get the next one.
// `power` multiplies damageScale; `radius` and `crater` are in tiles; `stop` is hit-stop in seconds.
export const PUNCHES = [
  { name: 'Jab', level: 0, strength: 0, power: 1, radius: 0, crater: 0, shake: 0.06, stop: 0.03, chips: 6, color: '#f3ead8' },
  { name: 'Solid Punch', level: 1, strength: 12, power: 1.3, radius: 0, crater: 0, shake: 0.1, stop: 0.04, chips: 12, color: '#ffd98a' },
  { name: 'Heavy Blow', level: 2, strength: 18, power: 1.7, radius: 3, crater: 2, shake: 0.2, stop: 0.06, chips: 20, color: '#ffb547' },
  { name: 'Shockwave', level: 3, strength: 28, power: 2.2, radius: 8, crater: 4, shake: 0.35, stop: 0.08, chips: 30, color: '#ff8a4c' },
  { name: 'Earthsplitter', level: 4, strength: 40, power: 2.8, radius: 14, crater: 7, shake: 0.55, stop: 0.1, chips: 44, color: '#ff5a5a' },
  { name: 'Worldbreaker', level: 5, strength: 55, power: 3.6, radius: 24, crater: 12, shake: 0.9, stop: 0.14, chips: 60, color: '#9fe8ff' },
];

const CHAIN = [1, 1.25, 2];  // left, right, finisher
const FINISHER_REACH = 1.3;  // the finisher's wave goes this much further
const CHAIN_WINDOW = 0.5;    // seconds after a punch to keep the chain going
const HIT_AT = 0.4;          // how far through the punch the blow lands
const LUNGE = 3;             // tiles per second, stepping into the punch
const WAVE_SPEED = 45;       // tiles per second; things break as the wave reaches them
const AIR_PRACTICE = 0.1;
const RINGS = 4, CRATERS = 8, CRATER_GRID = 18, CRATER_LIFE = 40, CRATER_FADE = 0.7;
const CRATER_MARK = 34;      // largest crack mark, in tiles; past this the dent speaks for itself
// Destructive Blow, by its skill level: seconds to charge fully, force, and reach in tiles.
const BLOW_TIME = [2, 1.8, 1.6, 1.4, 1.2, 1];
const BLOW_POWER = [3, 4, 5.5, 7.5, 10, 14];
const BLOW_REACH = [14, 20, 28, 40, 58, 90];
const BLOW_MOST = 110;
const BLOW_PIT = 26;         // how deep the land can be driven by these
const BLOW_HOLD = 0.35;      // seconds of holding punch before it starts to charge
const BLOW_COLOR = '#ffb020';
const ROLL_TIME = 0.42;      // seconds of a dodge roll
const ROLL_SAFE = 0.3;       // of which nothing can touch you
const ROLL_GAP = 0.2;        // seconds before you can roll again
const PARRY = 0.22;          // seconds after raising your guard that a hit is turned aside
const BLOCKED = 0.2;         // share of a hit that gets past a guard
const CRUSHED = 0.6;         // share of a heavy one, which also knocks the guard down
const GUARD_DOWN = 0.9;      // seconds a broken guard stays down
const COUNTER = 1.8;         // seconds after a parry that your next punch is a counter
const COUNTER_FORCE = 3;
const GRAB_REACH = 4.5;
const GRAB_HOLD = 3.5;       // seconds before a held monster squirms free
const THROW = 34;            // tiles per second
const THROW_FORCE = 1.5;     // of a punch, where it lands
const SLAM_FORCE = 2.5;
const THROW_BLAST = 7;       // tiles
const DIVE = 46;             // tiles per second straight down
const LOCK_FAR = 70;
const BAR_TIME = 3;          // seconds an enemy's health bar stays up after a hit
const WHITE = new THREE.Color('#ffffff');
const HARD_LANDING = 10;      // tiles fallen before a stomp breaks the ground
const HOP_STOMP = 0.25;      // an ordinary jump's landing reaches this share of a hard one
const DEEPEST_PIT = 8;      // the land can't be pushed down further than this
const CRATER_DEPTH = 0.28;   // of its radius
const MONSTER_REACH = 2.5;   // a plain punch still clips what's in front of it
const HOUSE_REACH = 1.5;
const PVP_REACH = 3;         // a plain punch reaches the other hero this far
const PVP_SHARE = 0.25;      // the most one blow can take of the other hero's health

// Which punch the hero has right now.
export function punchStage(skills, body) {
  const level = skills.level('punching');
  return PUNCHES.reduce((best, p, i) => (i <= (body.conq?.punchCap ?? 1) && level >= p.level && body.strength >= p.strength ? i : best), 0);
}

// Thin cracks and scattered scorch: the crater's shape comes from the dented land under it.
function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 53;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#3c2e2a';
  for (let i = 0; i < 500; i++) {
    const a = r() * 6.28, d = r() * r() * 46;
    g.fillRect(Math.floor(64 + Math.cos(a) * d), Math.floor(64 + Math.sin(a) * d), 2, 2);
  }
  for (let k = 0; k < 16; k++) {
    let a = (k / 16) * 6.28, x = 64, y = 64;
    const reach = 34 + r() * 26;
    for (let i = 0; i < reach; i++) {
      a += (r() - 0.5) * 0.6;
      x += Math.cos(a);
      y += Math.sin(a);
      g.fillRect(Math.floor(x), Math.floor(y), i < reach * 0.4 ? 2 : 1, i < reach * 0.4 ? 2 : 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Marks draped over the ground, so they follow hills. Heights are filled in when one is made.
function makeCrater(scene, map) {
  const n = CRATER_GRID + 1, pos = new Float32Array(n * n * 3), uv = [], idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) uv.push(i / CRATER_GRID, j / CRATER_GRID);
  for (let j = 0; j < CRATER_GRID; j++) for (let i = 0; i < CRATER_GRID; i++) {
    const a = j * n + i;
    idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, age: 0 };
}

export default class Melee {
  constructor(scene, player, work) {
    Object.assign(this, { player, work, skills: player.skills, body: player.body, hud: player.hud });
    this.active = null;
    this.queued = false;
    this.chain = 0;
    this.idle = CHAIN_WINDOW; // the first punch starts a fresh chain
    this.waves = [];
    this.monsters = null;
    this.stage = punchStage(this.skills, this.body);
    this.promised = this.stage; // the stage we've already said is waiting on Strength
    this.rings = Array.from({ length: RINGS }, () => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
      ring.frustumCulled = false;
      ring.visible = false;
      scene.add(ring);
      return { ring, age: 9, size: 0 };
    });
    this.charging = false;
    this.charge = 0;
    this.heldFor = 0;
    this.slam = 0;
    this.lift = 0;
    this.rolling = 0;
    this.rollWait = 0;
    this.rollDir = [0, 1];
    this.guarding = false;
    this.guardAt = -9;
    this.guardDown = 0;
    this.countering = 0;
    this.held = null;
    this.heldFor2 = 0;
    this.lock = null;
    this.struck = null;
    this.barFor = 0;
    this.clock = 0;
    this.lockRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }));
    this.lockRing.visible = false;
    scene.add(this.lockRing);
    this.orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: BLOW_COLOR, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.orb.visible = false;
    this.orbAge = 9;
    this.orbSize = 1;
    scene.add(this.orb);
    work.chunks.watchers.push((x, z, r) => this.settle(x, z, r));
    const map = crackTexture();
    this.craters = Array.from({ length: CRATERS }, () => makeCrater(scene, map));
  }

  punch(state) {
    if (this.active) {
      this.queued = true; // remembered, so mashing Square keeps the chain going
      return;
    }
    if (this.held) return this.pileDrive(state);
    const target = this.lock ?? this.monsters.target(state) ?? (this.player.rooms.house ? null : this.work.target(state));
    if (target) state.dir = [target.x - state.x, target.z - state.z];
    const len = Math.hypot(...state.dir) || 1;
    this.chain = this.idle < CHAIN_WINDOW ? (this.chain + 1) % CHAIN.length : 0;
    this.guarding = false;
    this.active = { target, t: 0, time: this.body.punchTime * (this.chain === 2 ? 1.3 : 1), fx: state.dir[0] / len, fz: state.dir[1] / len, landed: false, chain: this.chain };
  }

  // A blow from this hero at their current punch, before the combo adds to it.
  get force() {
    return PUNCHES[this.stage].power * this.body.damageScale * this.body.massScale;
  }

  // Rolls toward (x, z) in world terms, or the way the hero is facing.
  roll(state, x, z) {
    if (this.rolling > 0 || this.rollWait > 0 || state.air || this.active || this.held || this.charging) return;
    const len = Math.hypot(x, z);
    this.rollDir = len > 0.05 ? [x / len, z / len] : (() => {
      const f = Math.hypot(...state.dir) || 1;
      return [state.dir[0] / f, state.dir[1] / f];
    })();
    state.dir = [...this.rollDir];
    this.rolling = ROLL_TIME;
    this.work.burst(state.x, state.y + 0.2, state.z, ['#c9bcc4', '#a89a8c'], 6, 3);
  }

  get rollSafe() {
    return this.rolling > ROLL_TIME - ROLL_SAFE;
  }

  // An attack reaches this hero: does it land, and how hard? Roll past it, parry it, or block it.
  defend(amount, x, z, heavy) {
    const { hud, state } = this.player;
    const say = (text, color) => hud.float(text, state.x, state.y + 3.4, state.z, color);
    if (this.rolling > 0 && this.rollSafe) {
      say('Dodged!', '#9fe8ff');
      this.work.stop = 0.1;
      return { avoided: true };
    }
    const facing = Math.hypot(...state.dir) || 1, dx = x - state.x, dz = z - state.z, d = Math.hypot(dx, dz) || 1;
    const front = (dx * state.dir[0] + dz * state.dir[1]) / (d * facing) > 0;
    if (!this.guarding || !front) return { amount };
    if (this.clock - this.guardAt < PARRY) {
      say('Parry!', '#ffd24a');
      this.work.stop = 0.14;
      this.work.shake = Math.max(this.work.shake, 0.2);
      this.work.burst(state.x, state.y + 1.6, state.z, ['#ffd24a', '#ffffff'], 18, 7);
      this.countering = COUNTER;
      return { avoided: true, parried: true };
    }
    this.work.burst(state.x, state.y + 1.6, state.z, ['#c9d4e2', '#ffffff'], 8, 4);
    if (!heavy) return { amount: amount * BLOCKED };
    say('Guard broken!', '#ff7a6a');
    this.guarding = false;
    this.guardDown = GUARD_DOWN;
    return { amount: amount * CRUSHED };
  }

  setGuard(on) {
    const up = on && this.guardDown <= 0 && !this.active && !this.held && this.rolling <= 0 && !this.charging;
    if (up && !this.guarding) this.guardAt = this.clock;
    this.guarding = up;
  }

  // The grab button: takes hold of what's in front, or throws what's held.
  grab(state) {
    if (this.held) return this.toss(state);
    if ((this.active && !this.active.landed) || this.rolling > 0 || state.air) return undefined; // the follow-through can be cut short
    const e = this.monsters.within(state.x, state.z, GRAB_REACH).sort((a, b) => Math.hypot(a.x - state.x, a.z - state.z) - Math.hypot(b.x - state.x, b.z - state.z))[0];
    if (!e) return undefined;
    // Big ones must be dazed first, unless you outweigh them.
    if (e.boss || ((e.def.name.startsWith('Elder') || e.tier >= 4) && e.mode !== 'reeling' && this.body.massScale < 4)) {
      this.hud.float('Too heavy!', e.x, e.group.position.y + 4, e.z, '#ff7a6a');
      return undefined;
    }
    this.active = null;
    this.held = e;
    this.heldFor2 = GRAB_HOLD;
    e.heldBy = this.player;
    e.mode = 'held';
    e.turn = false;
    e.vel.set(0, 0);
    this.skills.add('fighting', 0.5);
    this.work.shake = Math.max(this.work.shake, 0.12);
    return undefined;
  }

  // Lets go, for when a held monster dies, wriggles free or is hit.
  drop() {
    const e = this.held;
    if (!e) return;
    this.held = null;
    e.heldBy = null;
    e.mode = 'reeling';
    e.until = this.monsters.time + 0.4;
  }

  carry(e) {
    const s = this.player.state, len = Math.hypot(...s.dir) || 1;
    e.group.position.set(s.x + (s.dir[0] / len) * 0.8, s.y + s.air + 3.1, s.z + (s.dir[1] / len) * 0.8);
    e.vel.set(0, 0);
    e.knockUntil = this.monsters.time + 0.1;
  }

  toss(state) {
    const e = this.held, len = Math.hypot(...state.dir) || 1;
    this.drop();
    if (!e) return;
    e.vel.set(state.dir[0] / len, state.dir[1] / len).multiplyScalar(THROW);
    e.knockUntil = this.monsters.time + 1.2;
    e.rise = 12;
    e.air = 3;
    e.thrown = this.player;
    e.until = this.monsters.time + 1.4;
    this.slam = 0.25;
  }

  // Slams what's held into the ground in front of you.
  pileDrive(state) {
    const e = this.held;
    this.drop();
    if (!e) return;
    this.slam = 0.3;
    e.air = 0;
    this.blast(e.x, e.z, this.force * SLAM_FORCE, THROW_BLAST, 0, '#ff8a4c', e);
    this.work.shake = Math.max(this.work.shake, 0.35);
    this.work.stop = 0.08;
  }

  landed(e) {
    this.work.actor = this.player;
    this.blast(e.x, e.z, this.force * THROW_FORCE, THROW_BLAST, 0, '#ff8a4c', e);
    this.work.shakeAt = this.player.state;
    this.work.shake = Math.max(this.work.shake, 0.2);
  }

  // Square in the air: straight down, and whatever's under you pays for it.
  dive(state) {
    if (state.dive || state.air < 0.8) return;
    state.dive = true;
    state.rise = -DIVE;
  }

  landDive(state) {
    this.blast(state.x, state.z, this.force * 1.5, 6 + this.stage, 0, '#ffb547', null);
    this.work.shake = Math.max(this.work.shake, 0.25);
    this.work.shakeAt = state;
    this.slam = 0.22;
  }

  // Locks on to the nearest enemy, or lets go if already locked.
  aim(state) {
    if (this.lock) {
      this.lock = null;
      return;
    }
    let best = null, d = LOCK_FAR;
    for (const e of this.monsters.within(state.x, state.z, LOCK_FAR)) {
      const k = Math.hypot(e.x - state.x, e.z - state.z);
      if (k < d) { d = k; best = e; }
    }
    this.lock = best;
  }

  // Moves the lock to the next enemy over.
  shiftAim(state, way) {
    const list = this.monsters.within(state.x, state.z, LOCK_FAR).sort((a, b) => Math.atan2(a.x - state.x, a.z - state.z) - Math.atan2(b.x - state.x, b.z - state.z));
    if (list.length) this.lock = list[(list.indexOf(this.lock) + way + list.length) % list.length];
  }

  get blowReady() {
    return FEATURES.blow && !!this.body.conq?.blow && this.skills.level('punching') >= PUNCHES.length - 1;
  }

  // How big this blow is shaping up to be, 0..1: its charge and how far the skill has come.
  get might() {
    return this.charge * (0.35 + 0.65 * (this.skills.level('blow') / (BLOW_POWER.length - 1)));
  }

  // Holding punch gathers a Destructive Blow; letting go sets it off.
  updateCharge(dt, state, held, free) {
    const { house } = this.player.rooms, { quake } = this.player.world;
    if (!free) {
      // A menu opened: drop what was gathered, and don't count it as a punch.
      this.heldFor = 0;
      this.charging = false;
      this.charge = 0;
      this.orb.visible = this.orbAge < 9;
      return;
    }
    // Once the Blow is open a punch throws when the button comes up, so holding never punches.
    if (!held && this.heldFor > 0 && !this.charging && this.blowReady && !state.air && (!house || house.hostile)) this.punch(state);
    this.heldFor = held ? this.heldFor + dt : 0;
    this.slam = Math.max(0, this.slam - dt);
    if (!this.charging) {
      this.lift = Math.max(0, this.lift - dt * 18);
      if (this.blowReady && this.heldFor >= BLOW_HOLD && !this.active && (!house || house.hostile)) {
        this.charging = true;
        this.charge = 0;
        this.stamp = 0;
        this.pulse = 0;
      }
      return;
    }
    if (!held) {
      this.release(state);
      return;
    }
    this.charge = Math.min(1, this.charge + dt / BLOW_TIME[this.skills.level('blow')]);
    const m = this.might, ground = this.height(state.x, state.z);
    this.work.shake = Math.max(this.work.shake, m * 0.22);
    this.work.shakeAt = state;
    // The hero climbs into the air as it nears its peak, more the stronger it is.
    this.lift += (Math.max(0, this.charge - 0.6) * m * 9 - this.lift) * Math.min(1, dt * 5);
    // A brighter, faster glow as it builds, burning white at the top.
    this.orb.visible = true;
    this.orb.position.set(state.x, ground + state.air + this.lift + 1.4, state.z);
    this.orb.scale.setScalar(0.8 + this.charge * (2 + m * 3) + Math.sin(this.heldFor * (20 + this.charge * 30)) * 0.2 * this.charge);
    this.orb.material.opacity = 0.2 + this.charge * 0.4;
    this.orb.material.color.set(BLOW_COLOR).lerp(WHITE, this.charge * this.charge * m);
    if (Math.random() < dt * (20 + m * 50)) this.work.burst(state.x, ground + 0.5, state.z, [BLOW_COLOR, '#ffffff'], 2, 3 + m * 9);
    // Rings run out through the ground in time with it.
    if ((this.pulse -= dt) <= 0) {
      this.pulse = 0.55 - this.charge * 0.35;
      this.ring(state.x, ground, state.z, 5 + m * 22, BLOW_COLOR);
    }
    if (house) return;
    if (m > 0.15) quake.gather(dt, state.x, ground, state.z, m);
    // At each third of the charge the ground under them cracks further.
    const step = Math.floor(this.charge * 3);
    if (step > this.stamp && m > 0.1) {
      this.stamp = step;
      this.crater(state.x, state.z, Math.min(CRATER_MARK, 5 + step * m * 10));
      this.work.shake = Math.max(this.work.shake, 0.2 + m * 0.3);
    }
  }

  release(state) {
    const level = this.skills.level('blow'), c = this.charge, m = this.might;
    const force = this.force * BLOW_POWER[level] * (0.4 + 0.6 * c), { quake } = this.player.world, inside = !!this.player.rooms.house;
    // Reach is the skill's to grow; Mass adds a little, and force does the rest.
    const reach = Math.min(BLOW_MOST, BLOW_REACH[level] * (0.5 + 0.5 * c) * (1 + Math.sqrt(this.body.massScale) * 0.08));
    const ground = this.height(state.x, state.z);
    this.charging = false;
    this.charge = 0;
    this.slam = 0.2 + m * 0.35;
    this.work.actor = this.player;
    this.blast(state.x, state.z, force, reach, 0, BLOW_COLOR, null);
    if (!inside) this.tear(state.x, state.z, reach * 0.45, BLOW_PIT);
    this.ring(state.x, ground, state.z, reach * 0.6, '#ffffff');
    this.work.burst(state.x, ground + 1.5, state.z, [BLOW_COLOR, '#fff0b0', '#ff5a3d'], Math.round(40 + m * 120), 10 + m * 14);
    this.work.shake = Math.max(this.work.shake, 0.3 + m * 0.5);
    this.work.shakeAt = state;
    this.work.stop = 0.1 + m * 0.3;
    this.work.rumble = m > 0.45 ? m * m * 3.5 : 0;
    this.orbAge = 0;
    this.orbSize = reach;
    this.orb.material.color.set(BLOW_COLOR);
    this.orb.position.set(state.x, ground + 1.4, state.z);
    this.orb.visible = true;
    this.skills.add('blow', 1 + c * 2);
    quake.fling(state.x, state.z, 18 + m * 45);
    if (m > 0.25) this.hud.flash(0.25 + m * 0.7);
    if (inside) return;
    quake.throwStones(state.x, ground, state.z, Math.round(m * m * 34), 14 + m * 34);
    // Past the first shock, the land itself gives way.
    if (m > 0.4) {
      for (const [at, k] of [[0.18, 0.75], [0.4, 1.15], [0.75, 1.6]]) {
        if (m > k * 0.4) quake.after(at, () => this.ring(state.x, ground, state.z, reach * k, k > 1 ? '#ff5a3d' : BLOW_COLOR));
      }
      quake.shatter(state.x, state.z, reach, m, (x, z, size) => this.canTear(x, z, size), () => this.work.saveGone());
    }
  }

  // For the sprite: null when not punching.
  get pose() {
    const a = this.active;
    return a && { t: a.t / a.time, chain: a.chain, stage: this.stage, color: PUNCHES[this.stage].color };
  }

  // Inside a cave the ground is the cave floor, whatever the land does above.
  height(x, z) {
    return this.player.rooms.house ? this.player.state.y : Math.max(landHeight(x, z), -0.5); // the surface, over water
  }

  land(a, state) {
    const p = PUNCHES[this.stage], finisher = a.chain === 2, heavy = this.body.massScale, spread = Math.sqrt(heavy);
    let force = this.force * CHAIN[a.chain];
    if (this.countering > 0) {
      force *= COUNTER_FORCE;
      this.countering = 0;
      this.hud.float('Counter!', state.x, state.y + 3.4, state.z, '#ffd24a');
    }
    const t = a.target && !a.target.dying && !this.work.chunks.gone.has(a.target.id) ? a.target : null;
    const r = t ? (t.r ?? t.radius) : 0;
    const x = t ? t.x - a.fx * r : state.x + a.fx * 1.2, z = t ? t.z - a.fz * r : state.z + a.fz * 1.2;
    const reach = p.radius * (finisher ? FINISHER_REACH : 1) * spread;
    const crater = !this.player.rooms.house && (finisher || this.stage >= 3) ? p.crater * spread * (finisher ? FINISHER_REACH : 1) : 0;

    const struck = this.blast(x, z, force, reach, crater, p.color, t);
    this.skills.add('punching', struck ? 1 : AIR_PRACTICE);
    if (t && !t.def) this.skills.add(t.type === 'tree' ? 'woodcutting' : 'mining', 1);
    if (struck || reach) {
      this.work.burst(x, this.height(x, z) + 1.1, z, [p.color, '#fff8ea', '#94808a'], p.chips, 4 + this.stage * 1.5);
      this.work.stop = p.stop * (finisher ? 1.6 : 1);
    }
    this.work.shake = Math.max(this.work.shake, (struck || reach ? p.shake : 0) * (finisher ? 1.5 : 1));
    this.refreshStage();
  }

  // Landing from a jump: mass alone is enough to shake the ground.
  stomp(state, fell) {
    const hard = fell > HARD_LANDING, reach = this.body.stompReach * (hard ? 1 : HOP_STOMP);
    if (!reach) return;
    this.blast(state.x, state.z, this.body.massScale * this.body.damageScale, reach, hard ? reach * 0.6 : 0, '#c9a0ff', null);
    this.work.shake = Math.max(this.work.shake, Math.min(0.6, reach * 0.06));
    this.work.shakeAt = state;
  }

  // One blow going out from a point. Returns true if it met anything.
  blast(x, z, force, reach, crater, color, target) {
    const queue = [];
    if (target) queue.push(target.def ? { m: target, at: 0, force } : { o: target, at: 0, force });
    const falloff = (d) => force * (1 - 0.6 * Math.min(1, d / Math.max(reach, 1)));
    for (const m of this.monsters.within(x, z, Math.max(reach, MONSTER_REACH))) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (m !== target) queue.push({ m, at: d / WAVE_SPEED, force: falloff(d) });
    }
    const inside = !!this.player.rooms.house;
    if (reach) {
      for (const o of inside ? [] : this.work.chunks.near(x, z, reach)) {
        const d = Math.hypot(o.x - x, o.z - z);
        if (o !== target && d < reach) queue.push({ o, at: d / WAVE_SPEED, force: falloff(d) });
      }
      this.ring(x, this.height(x, z), z, reach, color);
    }
    for (const h of inside ? [] : this.work.housesAt(x, z, Math.max(reach, HOUSE_REACH))) queue.push({ h, at: Math.hypot(h.x - x, h.z - z) / WAVE_SPEED, force: falloff(0) });
    if (FEATURES.friendlyFire) {
      for (const foe of this.player.world.players) {
        const d = Math.hypot(foe.state.x - x, foe.state.z - z);
        if (foe !== this.player && !foe.rooms.house && d < Math.max(reach, PVP_REACH)) queue.push({ foe, at: d / WAVE_SPEED, force: falloff(d) });
      }
    }
    queue.sort((m, n) => m.at - n.at);
    if (!inside) {
      this.player.world.sites.struck(x, z, reach, this.stage, this.player, force);
      this.player.world.caravans.struck(x, z, reach, force, this.player);
      this.player.world.estates.struck(x, z, reach, force, this.player);
      this.player.world.roadside?.struck(x, z, reach, force, this.player);
      this.player.world.fairs?.struck(x, z, reach, force, this.player);
      this.player.world.events?.struck(x, z, reach, force, this.player);
      this.player.world.animals?.struck(x, z, reach, force, this.player);
      this.player.world.voxels?.blast(x, this.player.state.y + 0.8, z, this.work.cut(force, this.player, reach), this.player);
      this.dug = this.player.world.digs?.blast(x, this.player.state.y + this.player.state.air + 1.4, z, this.work.cut(force, this.player, reach), this.player, crater) ?? false;
    }
    if (crater && !this.dug) this.tear(x, z, crater);
    this.waves.push({ queue, x, z, reach, t: 0, drops: {}, broke: false });
    return queue.length > 0;
  }

  // Tears the ground open, except right under the great landmarks.
  canTear(x, z, size, deepest = DEEPEST_PIT) {
    const safe = [PLACES.spire, { ...PLACES.ribs, r: 260 }, { x: PLACES.spirit.x, z: PLACES.spirit.z, r: 90 }, PLACES.hollow, ...TOWNS];
    return !safe.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + size) && Math.hypot(x - SPAWN.x, z - SPAWN.z) > SPAWN_CLEAR + size && dentAt(x, z) <= deepest;
  }

  tear(x, z, size, deepest) {
    if (!this.canTear(x, z, size, deepest)) return;
    this.work.chunks.deform(x, z, size, size * CRATER_DEPTH);
    this.crater(x, z, Math.min(CRATER_MARK, size * 1.1));
  }

  refreshStage() {
    const now = punchStage(this.skills, this.body);
    if (now > this.stage) {
      this.stage = now;
      this.promised = now;
      this.hud.message(`New punch: ${PUNCHES[now].name}!`, true);
      return;
    }
    // Practised enough for the next punch, but the arms aren't there yet.
    const next = this.stage < (this.body.conq?.punchCap ?? 1) ? PUNCHES[this.stage + 1] : null;
    if (next && this.promised <= this.stage && this.skills.level('punching') >= next.level) {
      this.promised = this.stage + 1;
      this.hud.message(`Your form is ready for ${next.name}. It needs Strength ${next.strength}.`);
    }
  }

  ring(x, y, z, size, color) {
    const r = this.rings.reduce((a, b) => (a.age > b.age ? a : b));
    r.age = 0;
    r.size = size;
    r.ring.position.set(x, y + 0.4, z);
    r.ring.material.color.set(color);
    r.ring.visible = true;
  }

  crater(x, z, size) {
    const c = this.craters.find((k) => !k.mesh.visible) ?? this.craters.reduce((a, b) => (a.age > b.age ? a : b));
    Object.assign(c, { x, z, size });
    this.drape(c);
    c.age = 0;
    c.mesh.visible = true;
    c.mesh.material.opacity = CRATER_FADE;
  }

  // Lays a mark over the ground as it is now.
  drape(c) {
    const { x, z, size } = c, pos = c.mesh.geometry.attributes.position, n = CRATER_GRID + 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const px = x + (i / CRATER_GRID - 0.5) * size * 2, pz = z + (j / CRATER_GRID - 0.5) * size * 2;
      pos.setXYZ(j * n + i, px, landHeight(px, pz) + 0.08, pz);
    }
    pos.needsUpdate = true;
  }

  // The land moved: any mark on it moves too, instead of hanging in the air.
  settle(x, z, r) {
    for (const c of this.craters) if (c.mesh.visible && Math.hypot(c.x - x, c.z - z) < c.size * 1.5 + r) this.drape(c);
  }

  // Heroes can hurt each other. One blow is capped, so a strong hero can't flatten a new one
  // instantly, but it still sends them flying.
  hitHero(foe, force, x, z) {
    if (foe.guard > 0) return;
    const before = foe.hp, cap = foe.body.maxHealth * PVP_SHARE;
    this.monsters.hurt(foe, Math.min(cap / (1 - foe.body.guard) * Math.sqrt(foe.body.massScale), force), x, z);
    foe.state.rise = Math.min(14, 4 + force * 0.3);
    foe.state.air = 0.01;
    this.skills.add('fighting', 1);
    if (foe.hp > before) this.hud.message('Knocked out!', true); // down() refilled them
  }

  updateWave(w, dt) {
    w.t += dt;
    while (w.queue.length && w.queue[0].at <= w.t) {
      const { o, m, h, foe, force, at } = w.queue.shift();
      if (foe) this.hitHero(foe, force, w.x, w.z);
      else if (m) this.monsters.hit(m, force, w.x, w.z);
      else if (h) w.broke = this.work.hitHouse(h, force, { x: w.x, z: w.z, reach: w.reach ?? 0, y: this.player.state.y + 1.3 }) || w.broke;
      else if (!this.work.chunks.gone.has(o.id)) w.broke = this.work.hit(o, force, w.drops, at > 0) || w.broke;
    }
    if (w.queue.length) return;
    if (w.broke) {
      this.work.give(w.drops);
      this.work.saveGone();
    }
  }

  // Timers, the lock, and the enemy's health bar.
  updateMoves(dt, state) {
    this.clock += dt;
    this.guardDown = Math.max(0, this.guardDown - dt);
    this.countering = Math.max(0, this.countering - dt);
    this.rollWait = Math.max(0, this.rollWait - dt);
    if (this.rolling > 0) {
      this.rolling -= dt;
      if (this.rolling <= 0) this.rollWait = ROLL_GAP;
    }
    if (this.held && (this.heldFor2 -= dt) <= 0) this.drop();
    if (this.lock && (this.lock.dying || !this.monsters.list.includes(this.lock) || Math.hypot(this.lock.x - state.x, this.lock.z - state.z) > LOCK_FAR)) this.lock = null;
    this.lockRing.visible = !!this.lock;
    if (this.lock) {
      this.lockRing.position.set(this.lock.x, this.lock.group.position.y + 0.3, this.lock.z);
      this.lockRing.scale.setScalar(this.lock.radius + 1 + Math.sin(this.clock * 6) * 0.15);
    }
    if (this.struck) {
      this.barOn = this.struck;
      this.barFor = BAR_TIME;
      this.struck = null;
    }
    this.barFor -= dt;
    const foe = this.lock ?? (this.barFor > 0 ? this.barOn : null);
    this.hud.setFoe(foe && !foe.dying ? foe.def.name : '', foe ? Math.max(0, foe.hp) / (foe.maxHp || 1) : 0);
  }

  update(dt, state) {
    this.work.actor = this.player;
    const shook = this.work.shake;
    if (this.orbAge < 9) {
      this.orbAge += dt;
      const k = Math.min(1, this.orbAge / 0.45);
      this.orb.scale.setScalar(Math.max(1, this.orbSize * Math.sqrt(k)));
      this.orb.material.opacity = (1 - k) * 0.35;
      if (k === 1) {
        this.orbAge = 9;
        this.orb.visible = false;
      }
    }
    this.idle += dt;
    const a = this.active;
    if (a) {
      a.t += dt;
      if (!a.landed) {
        state.x += a.fx * LUNGE * dt;
        state.z += a.fz * LUNGE * dt;
        if (a.t >= a.time * HIT_AT) {
          a.landed = true;
          this.land(a, state);
        }
      }
      if (a.t >= a.time) {
        this.active = null;
        this.idle = 0;
        if (this.queued) this.punch(state);
        this.queued = false;
      }
    }
    for (const w of this.waves) this.updateWave(w, dt);
    this.waves = this.waves.filter((w) => w.queue.length);
    if (this.work.shake > shook) this.work.shakeAt = state;
    for (const r of this.rings) {
      if (!r.ring.visible) continue;
      r.age += dt;
      const k = Math.min(1, r.age / (r.size / WAVE_SPEED + 0.15));
      r.ring.scale.setScalar(Math.max(0.1, r.size * k));
      r.ring.material.opacity = (1 - k) * 0.9;
      if (k === 1) r.ring.visible = false;
    }
    for (const c of this.craters) {
      if (!c.mesh.visible) continue;
      c.age += dt;
      c.mesh.material.opacity = Math.min(CRATER_FADE, (CRATER_LIFE - c.age) / 5);
      if (c.age > CRATER_LIFE) c.mesh.visible = false;
    }
  }
}
