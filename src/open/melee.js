import * as THREE from 'three';
import { height as landHeight, dentAt, PLACES, SPAWN, TOWNS } from './terrain.js';
import { SPAWN_CLEAR } from './work.js';
import { FEATURES } from '../config/features.js';
import { COMBAT, smashFor, clampSpirit } from './combat.js';

// Punching. Square throws a five-hit rush chain anywhere, at anything; Triangle branches it into a
// smash (see combat.js). The punch itself grows in
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

const FINISHER_REACH = 1.3;  // the finisher's wave goes this much further
const HIT_AT = 0.4;          // how far through the punch the blow lands
const SMASH_AT = 0.5;        // and through a smash
const HOMING_MOST = 34;      // tiles per second a blow can close in on its target
// What the body does for each smash, and for the last hit of a chain.
const SMASH_POSE = { breaker: 'punch', launcher: 'uppercut', sweep: 'sweep', driver: 'kick', slam: 'slam', finisher: 'punch', spike: 'slam', execute: 'kick' };
const PURSUE_TIME = 0.18;    // seconds to fly up to a launched foe
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
const GUARD_DOWN = 0.9;      // seconds a broken guard stays down
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
    this.idle = COMBAT.chainWindow; // the first punch starts a fresh chain
    // The string of blows being thrown: light hits so far, smashes used, Vanishes spent.
    this.hits = 0;
    this.airHits = 0;
    this.used = new Set();
    this.vanishes = 0;
    this.spirit = 1;           // pips, fractions included
    this.posture = 0;          // the hero's own Structure, 0..1; full is Broken
    this.postureAt = -9;
    this.broken = 0;           // seconds left Broken
    this.counterBy = 1;
    this.rollAt = -9;          // when Circle was last pressed, for a Vanish
    this.chase = null;         // a foe knocked flying, that a Vanish can catch up with
    this.pursuit = null;       // a launched foe that Cross flies up to
    this.pursuing = null;
    this.airFoe = null;
    this.hover = 0;            // seconds left hanging in the air mid-combo
    this.armored = false;
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

  // What a blow turns toward: the locked foe, the nearest one, or a tree or rock.
  pick(state) {
    const lock = this.lock && !this.lock.dying ? this.lock : null;
    return lock ?? this.monsters.target(state) ?? (this.player.rooms.house ? null : this.work.target(state));
  }

  get inAir() {
    return this.hover > 0 && this.player.state.air > 0.8;
  }

  // A new string of blows: the chain and the record of smashes start again.
  restart() {
    this.hits = 0;
    this.airHits = 0;
    this.used.clear();
    this.vanishes = 0;
  }

  // Square: the next light hit of the rush chain, on the ground or in the air.
  punch(state) {
    if (this.active) {
      this.queued = 'light'; // remembered, so mashing Square keeps the chain going
      return;
    }
    if (this.held) return this.pileDrive(state);
    if (this.broken > 0) return;
    const air = this.inAir, table = air ? COMBAT.airChain : COMBAT.chain;
    if (this.idle >= COMBAT.chainWindow && !air) this.restart();
    let n = air ? this.airHits : this.hits;
    if (n >= table.length) {
      if (air) return;
      this.restart();
      n = 0;
    }
    this.chain = n;
    this.start(state, { kind: 'light', air, chain: n, last: n === table.length - 1, time: this.body.punchTime * (air ? 0.8 : COMBAT.chainTime[n]), hitAt: HIT_AT });
  }

  // Triangle: a smash, which one depending on how far the chain has come; on a Broken foe, an Execute.
  heavy(state) {
    if (this.active) {
      this.queued = 'heavy';
      return;
    }
    if (this.held) return this.pileDrive(state);
    if (this.broken > 0) return;
    const air = this.inAir, target = this.pick(state), t = this.monsters.time;
    if (this.idle >= COMBAT.chainWindow && !air) this.restart();
    const close = target?.def && Math.hypot(target.x - state.x, target.z - state.z) - target.radius < COMBAT.homing;
    const name = !air && close && target.brokenUntil > t ? 'execute' : smashFor(this.hits, air);
    const def = COMBAT.smash[name];
    let power = def.power;
    if (this.used.has(name)) {
      power *= COMBAT.repeat;
      this.dropString = true;
    }
    this.used.add(name);
    this.start(state, { kind: 'smash', name, air, power, chain: 4, time: def.time * (this.body.punchTime / 0.34), hitAt: SMASH_AT }, target);
  }

  start(state, move, target = this.pick(state)) {
    if (target) state.dir = [target.x - state.x, target.z - state.z];
    const len = Math.hypot(...state.dir) || 1;
    this.guarding = false;
    this.armored = move.kind === 'smash' && !!COMBAT.smash[move.name].armored;
    this.active = { ...move, target, t: 0, fx: state.dir[0] / len, fz: state.dir[1] / len, landed: false };
  }

  spend(pips) {
    if (this.spirit < pips) return false;
    this.spirit = clampSpirit(this.spirit - pips);
    return true;
  }

  gain(pips) {
    this.spirit = clampSpirit(this.spirit + pips);
  }

  // The hero's own Structure moves; full, and they're Broken: open, with no guard, for a moment.
  wear(amount) {
    this.posture = Math.max(0, Math.min(1, this.posture + amount));
    if (amount > 0) this.postureAt = this.clock;
    if (this.posture < 1) return;
    const { hud, state } = this.player;
    hud.float('Broken!', state.x, state.y + 3.4, state.z, '#ff5a5a');
    this.broken = COMBAT.broken.hero;
    this.guarding = false;
    this.guardDown = COMBAT.broken.hero;
    this.posture = 0.6;
    this.active = null;
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

  // Circle: a Breakout when caught, a Vanish after a foe knocked flying, or a roll. Pressed just
  // before a blow lands, the roll becomes a defensive Vanish (see defend).
  dodge(state, x, z) {
    this.rollAt = this.clock;
    if ((this.player.flinch > 0 || this.broken > 0) && this.breakout(state)) return;
    if (this.chase && this.clock < this.chase.until && this.vanishes < COMBAT.vanish.most && this.comboVanish(state)) return;
    if (this.broken <= 0) this.roll(state, x, z);
  }

  // Blinks to (x, z): afterimages where the hero was and where they land, and the world slows.
  blink(state, x, z, face) {
    const ground = this.height(state.x, state.z);
    this.work.burst(state.x, ground + 1.6, state.z, [this.aura, '#ffffff'], 14, 5, true);
    state.x = x;
    state.z = z;
    state.dir = [face.x - x, face.z - z];
    this.work.burst(x, this.height(x, z) + 1.6, z, [this.aura, '#ffffff'], 14, 5, true);
    this.rolling = 0;
    this.work.slow = Math.max(this.work.slow ?? 0, COMBAT.slow.vanish);
    this.work.lines = Math.max(this.work.lines ?? 0, 0.25);
  }

  get aura() {
    return this.player.powers.def?.color ?? '#9fe8ff';
  }

  // Caught in a combo or Broken: burst free, throwing everything near back.
  breakout(state) {
    if (!this.spend(COMBAT.cost.breakout)) return false;
    const { reach, power, safe } = COMBAT.breakout;
    this.broken = 0;
    this.guardDown = 0;
    this.player.flinch = 0;
    this.player.guard = Math.max(this.player.guard, safe);
    this.work.actor = this.player;
    this.blast(state.x, state.z, this.force * power, reach, 0, this.aura, null, 'knockdown', true);
    this.work.burst(state.x, state.y + 1.4, state.z, [this.aura, '#ffffff'], 30, 10);
    this.work.shake = Math.max(this.work.shake, 0.3);
    this.work.shakeAt = state;
    this.player.hud.float('Breakout!', state.x, state.y + 3.4, state.z, this.aura);
    return true;
  }

  // After a blow that sends a foe flying: appear in its path and carry the string on.
  comboVanish(state) {
    const e = this.chase.e;
    if (e.dying || !this.monsters.list.includes(e) || !this.spend(COMBAT.cost.vanish)) return false;
    // Into its path; if it has already stopped, behind it.
    const v = Math.hypot(e.vel.x, e.vel.y), d = Math.hypot(e.x - state.x, e.z - state.z) || 1, ahead = 2.4 + e.radius;
    const [ux, uz] = v > 2 ? [e.vel.x / v, e.vel.y / v] : [(e.x - state.x) / d, (e.z - state.z) / d];
    this.blink(state, e.x + ux * ahead, e.z + uz * ahead, e);
    e.vel.set(0, 0);
    e.flungUntil = 0;
    this.chase = null;
    this.vanishes++;
    this.hits = 0;
    this.idle = 0;
    this.player.guard = Math.max(this.player.guard, 0.2);
    return true;
  }

  // An attack reaches this hero: does it land, and how hard? Vanish, roll past it, parry it, or block it.
  defend(amount, x, z, heavy, from = null) {
    const { hud, state } = this.player;
    const say = (text, color) => hud.float(text, state.x, state.y + 3.4, state.z, color);
    const { vanish, parry, hero, counter } = COMBAT;
    // Circle a breath before it lands, with Spirit to spend: gone, and behind them.
    if (from && this.clock - this.rollAt < vanish.window && this.broken <= 0 && this.spend(COMBAT.cost.vanish)) {
      const d = Math.hypot(from.x - state.x, from.z - state.z) || 1, back = vanish.behind + (from.radius ?? 1);
      this.blink(state, from.x + ((from.x - state.x) / d) * back, from.z + ((from.z - state.z) / d) * back, from);
      say('Vanish!', this.aura);
      this.wear(hero.vanish);
      this.countering = counter.secs;
      this.counterBy = counter.plain;
      return { avoided: true, vanished: true };
    }
    if (this.rolling > 0 && this.rollSafe) {
      say('Dodged!', '#9fe8ff');
      this.work.stop = 0.1;
      this.wear(hero.dodge);
      return { avoided: true };
    }
    const facing = Math.hypot(...state.dir) || 1, dx = x - state.x, dz = z - state.z, d = Math.hypot(dx, dz) || 1;
    const front = (dx * state.dir[0] + dz * state.dir[1]) / (d * facing) > 0;
    if (!this.guarding || !front) return { amount };
    const since = this.clock - this.guardAt, perfect = since < parry.perfect;
    // A Perfect parry turns anything; a plain one only what isn't heavy.
    if (perfect || (since < parry.plain && !heavy)) {
      say(perfect ? 'Perfect!' : 'Parry!', perfect ? '#ffffff' : '#ffd24a');
      this.work.stop = COMBAT.stop.perfect;
      this.work.shake = Math.max(this.work.shake, 0.2);
      this.work.burst(state.x, state.y + 1.6, state.z, perfect ? ['#ffffff', this.aura, '#ffd24a'] : ['#ffd24a', '#ffffff'], perfect ? 28 : 18, 7);
      if (perfect) this.work.impact = COMBAT.impact;
      this.countering = counter.secs;
      this.counterBy = perfect ? counter.perfect : counter.plain;
      this.gain(perfect ? COMBAT.spirit.perfect : COMBAT.spirit.parry);
      this.wear(perfect ? hero.perfect : hero.parry);
      if (from) this.monsters.wear(from, perfect ? COMBAT.parryPosture.perfect : COMBAT.parryPosture.plain);
      return { avoided: true, parried: true, perfect };
    }
    this.work.burst(state.x, state.y + 1.6, state.z, ['#c9d4e2', '#ffffff'], 8, 4);
    if (!heavy) {
      this.wear(hero.block);
      return { amount: amount * COMBAT.blocked };
    }
    say('Guard broken!', '#ff7a6a');
    this.guarding = false;
    this.guardDown = GUARD_DOWN;
    this.wear(hero.heavy);
    return { amount: amount * COMBAT.crushed };
  }

  setGuard(on) {
    const up = on && this.guardDown <= 0 && this.broken <= 0 && !this.active && !this.held && this.rolling <= 0 && !this.charging;
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

  // Cross after a Launcher: fly up to the foe and carry the fight into the air.
  pursue(state) {
    const p = this.pursuit;
    if (!p || this.clock > p.until || p.e.dying || !this.monsters.list.includes(p.e) || this.active) return false;
    this.pursuit = null;
    this.pursuing = { e: p.e, t: 0, x: state.x, z: state.z, air: state.air };
    this.airHits = 0;
    p.e.hang = this.monsters.time + PURSUE_TIME + 0.3;
    this.work.lines = Math.max(this.work.lines ?? 0, PURSUE_TIME + 0.15);
    this.work.burst(state.x, state.y + 0.3, state.z, [this.aura, '#ffffff'], 12, 5);
    return true;
  }

  // Each frame of a Pursuit, then hanging there mid-combo with the foe.
  updateAir(dt, state) {
    const q = this.pursuing;
    if (q) {
      q.t += dt;
      const e = q.e, k = Math.min(1, q.t / PURSUE_TIME), d = Math.hypot(e.x - q.x, e.z - q.z) || 1, off = e.radius + 1.3;
      const x = e.x - ((e.x - q.x) / d) * off, z = e.z - ((e.z - q.z) / d) * off;
      state.x = q.x + (x - q.x) * k;
      state.z = q.z + (z - q.z) * k;
      state.air = Math.max(0.9, q.air + (e.group.position.y - 0.4 - state.y - q.air) * k);
      state.rise = 0;
      state.dir = [e.x - state.x, e.z - state.z];
      this.hover = 0.3;
      if (k >= 1 || e.dying) {
        this.pursuing = null;
        this.airFoe = e.dying ? null : e;
        this.hover = COMBAT.hover;
        if (!e.dying) e.hang = this.monsters.time + COMBAT.hover;
      }
      return;
    }
    if (this.hover <= 0) {
      this.airFoe = null;
      return;
    }
    this.soft = true; // coming down from an air combo is no stomp
    this.hover -= dt;
    const e = this.airFoe;
    if (e && !e.dying && e.hang > this.monsters.time) {
      // Keep level with the foe, just in front of it.
      state.air += (e.group.position.y - 0.4 - state.y - state.air) * Math.min(1, dt * 12);
      state.rise = 0;
    }
  }

  // A spiked foe meets the ground: it craters, and everything near is knocked down.
  spikeLanded(e) {
    this.work.actor = this.player;
    this.blast(e.x, e.z, this.force * 1.2, 5 + this.stage, 2, PUNCHES[this.stage].color, null, 'knockdown', true);
    this.work.shake = Math.max(this.work.shake, 0.35);
    this.work.shakeAt = this.player.state;
    this.work.impact = COMBAT.impact;
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
    // Once the Blow is open a smash throws when Triangle comes up, so holding never smashes.
    if (!held && this.heldFor > 0 && !this.charging && this.blowReady && !state.air && (!house || house.hostile)) this.heavy(state);
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
    if (!a) return null;
    const arm = a.chain % 2, move = a.kind === 'smash' ? SMASH_POSE[a.name] : a.last && !a.air ? 'kick' : a.air && a.last ? 'uppercut' : 'punch';
    return { t: a.t / a.time, chain: a.chain, arm, move, stage: this.stage, color: PUNCHES[this.stage].color };
  }

  // Inside a cave the ground is the cave floor, whatever the land does above.
  height(x, z) {
    return this.player.rooms.house ? this.player.state.y : Math.max(landHeight(x, z), -0.5); // the surface, over water
  }

  land(a, state) {
    const p = PUNCHES[this.stage], smash = a.kind === 'smash' ? COMBAT.smash[a.name] : null, heavy = this.body.massScale, spread = Math.sqrt(heavy);
    // The end of a chain, and every smash, throws the punch's full wave; a light hit, its plain one.
    const finisher = a.kind === 'smash' || a.last;
    let force = this.force * (smash ? a.power : (a.air ? COMBAT.airChain : COMBAT.chain)[a.chain]);
    let posture = smash ? smash.posture : 1, react = smash ? smash.react : a.last && !a.air ? 'fly' : 'flinch';
    if (this.countering > 0) {
      force *= this.counterBy;
      posture += 1;
      this.countering = 0;
      this.hud.float('Counter!', state.x, state.y + 3.4, state.z, '#ffd24a');
    }
    const t = a.target && !a.target.dying && !this.work.chunks.gone.has(a.target.id) ? a.target : null;
    const r = t ? (t.r ?? t.radius) : 0;
    const x = t ? t.x - a.fx * r : state.x + a.fx * 1.2, z = t ? t.z - a.fz * r : state.z + a.fz * 1.2;
    if (a.name === 'execute' && t?.def) {
      force *= this.cornered(t, a.fx, a.fz) ? 1.5 : 1;
      t.brokenUntil = 0;
      t.posture = 0;
      posture = 0;
      this.gain(COMBAT.spirit.execute);
      this.hud.float('Execute!', t.x, t.group.position.y + 4, t.z, '#ff5a5a');
      this.work.slow = Math.max(this.work.slow ?? 0, COMBAT.slow.execute);
    }
    const reach = smash?.reach ?? p.radius * (finisher ? FINISHER_REACH : 1) * spread;
    const crater = !this.player.rooms.house && (finisher || this.stage >= 3) && !a.air ? p.crater * spread * (finisher ? FINISHER_REACH : 1) : 0;
    // A sweep or a finisher knocks down all it reaches; anything else throws only its target.
    const all = a.name === 'sweep' || a.name === 'finisher';
    const struck = this.blast(x, z, force, reach, crater, p.color, t, react, all, posture);
    this.skills.add('punching', struck ? 1 : AIR_PRACTICE);
    if (t && !t.def) this.skills.add(t.type === 'tree' ? 'woodcutting' : 'mining', 1);
    if (t?.def) {
      this.gain(smash ? COMBAT.spirit.smash : COMBAT.spirit.hit);
      if (a.air) {
        t.hang = this.monsters.time + COMBAT.hover;
        this.hover = COMBAT.hover;
        this.airFoe = t;
      }
      if (react === 'launch') this.pursuit = { e: t, until: this.clock + 0.9 };
      if (react === 'fly') this.chase = { e: t, until: this.clock + COMBAT.vanish.combo };
      if (react === 'spike') {
        t.hang = 0;
        this.hover = 0;
        state.rise = -30;
      }
    }
    if (a.kind === 'light') a.air ? this.airHits++ : this.hits++;
    else this.hits = 0;
    if (struck || reach) {
      this.work.burst(x, this.height(x, z) + 1.1 + (a.air ? state.air : 0), z, [p.color, '#fff8ea', '#94808a'], p.chips, 4 + this.stage * 1.5);
      this.work.stop = Math.max(p.stop * (finisher ? 1.6 : 1), a.name === 'execute' ? COMBAT.stop.execute : smash ? COMBAT.stop.smash : COMBAT.stop.light);
      if (smash && struck) this.work.impact = COMBAT.impact;
    }
    this.work.shake = Math.max(this.work.shake, (struck || reach ? Math.max(p.shake, smash ? 0.18 : 0.05) : 0) * (finisher ? 1.5 : 1));
    if (this.dropString) {
      this.dropString = false;
      this.restart();
      this.idle = COMBAT.chainWindow;
    }
    this.refreshStage();
  }

  // Up against a wall, a cliff or water: an Execute drives the foe into it, and hurts far more.
  cornered(e, fx, fz) {
    const x = e.x + fx * 4, z = e.z + fz * 4, here = landHeight(e.x, e.z), there = landHeight(x, z);
    return this.monsters.walled(x, z, e) || there < 0.5 || here - there > 5;
  }

  // Landing from a jump: mass alone is enough to shake the ground.
  stomp(state, fell) {
    if (this.soft) {
      this.soft = false;
      return;
    }
    const hard = fell > HARD_LANDING, reach = this.body.stompReach * (hard ? 1 : HOP_STOMP);
    if (!reach) return;
    this.blast(state.x, state.z, this.body.massScale * this.body.damageScale, reach, hard ? reach * 0.6 : 0, '#c9a0ff', null);
    this.work.shake = Math.max(this.work.shake, Math.min(0.6, reach * 0.06));
    this.work.shakeAt = state;
  }

  // One blow going out from a point. Returns true if it met anything.
  // `react` is how the target (or, with `all`, everything) is thrown; `posture`, the Structure it wears.
  blast(x, z, force, reach, crater, color, target, react = null, all = false, posture = 1) {
    const queue = [];
    if (target) queue.push(target.def ? { m: target, at: 0, force, react, posture } : { o: target, at: 0, force });
    const falloff = (d) => force * (1 - 0.6 * Math.min(1, d / Math.max(reach, 1)));
    for (const m of this.monsters.within(x, z, Math.max(reach, MONSTER_REACH))) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (m !== target) queue.push({ m, at: d / WAVE_SPEED, force: falloff(d), react: all ? react : null, posture: all ? 1 : 0.5 });
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
      const { o, m, h, foe, force, at, react, posture } = w.queue.shift();
      if (foe) this.hitHero(foe, force, w.x, w.z);
      else if (m) {
        // The health bar stays on the foe being fought, not whatever the wave reaches later.
        const keep = this.struck;
        this.monsters.hit(m, force, w.x, w.z, react, posture);
        if (at > 0) this.struck = keep ?? (this.barFor > 0 && this.barOn && !this.barOn.dying ? null : m);
      }
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
    this.broken = Math.max(0, this.broken - dt);
    if (this.clock - this.postureAt > COMBAT.hero.rest) this.posture = Math.max(0, this.posture - COMBAT.hero.back * dt);
    // Spirit fades back toward one pip once the fighting is over.
    if (this.player.calm > COMBAT.spirit.rest && this.spirit > 1) this.spirit = Math.max(1, this.spirit - COMBAT.spirit.drain * dt);
    if (this.chase && this.clock > this.chase.until) this.chase = null;
    this.updateAir(dt, state);
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
    this.hud.setFoe(foe && !foe.dying ? foe.def.name : '', foe ? Math.max(0, foe.hp) / (foe.maxHp || 1) : 0, foe?.postureMax ? (foe.posture ?? 0) / foe.postureMax : 0, foe?.brokenUntil > this.monsters.time);
    this.hud.setFight(this.spirit, this.posture, this.broken > 0);
    this.threats(state);
  }

  // Monsters coming for this hero from outside the view, as angles off the camera's forward.
  threats(state) {
    const yaw = this.player.world.viewYaw(this.player), fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), list = [];
    if (FEATURES.combatCore && !this.player.rooms.house) {
      for (const e of this.monsters.within(state.x, state.z, 32)) {
        const tell = e.mode === 'tell' || e.mode === 'strike';
        if ((!e.turn && !tell) || e.foe !== this.player) continue;
        const dx = e.x - state.x, dz = e.z - state.z, a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        if (Math.abs(a) > 1.05) list.push({ a, tell });
      }
    }
    this.hud.setThreats(list.slice(0, 6));
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
        // Steps in to meet the target, closing the gap by the moment the blow lands.
        const e = a.target?.def && !a.target.dying ? a.target : null;
        const gap = e ? Math.hypot(e.x - state.x, e.z - state.z) - e.radius - 1.3 : 0;
        const pace = e && gap > 0 && gap < COMBAT.homing + 2 ? Math.min(HOMING_MOST, gap / Math.max(0.03, a.time * a.hitAt - a.t)) : a.air ? 0 : LUNGE;
        state.x += a.fx * pace * dt;
        state.z += a.fz * pace * dt;
        if (a.t >= a.time * a.hitAt) {
          a.landed = true;
          this.land(a, state);
        }
      }
      if (a.t >= a.time) {
        this.active = null;
        this.armored = false;
        this.idle = 0;
        const next = this.queued;
        this.queued = false;
        if (next === 'light') this.punch(state);
        else if (next === 'heavy') this.heavy(state);
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
