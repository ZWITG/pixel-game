import * as THREE from 'three';
import { height as landHeight, dentAt, PLACES, TOWNS } from './terrain.js';
import { FEATURES } from '../config/features.js';

// Punching. Square throws a three-hit chain anywhere, at anything. The punch itself grows in
// stages: each needs both practice (`level` of the Punching skill) and Strength, so the hero
// has to use their fists and build their body to get the next one.
// `power` multiplies damageScale; `radius` and `crater` are in tiles; `stop` is hit-stop in seconds.
export const PUNCHES = [
  { name: 'Jab', level: 0, strength: 0, power: 1, radius: 0, crater: 0, shake: 0.06, stop: 0.03, chips: 6, color: '#f3ead8' },
  { name: 'Solid Punch', level: 1, strength: 12, power: 1.8, radius: 0, crater: 0, shake: 0.1, stop: 0.04, chips: 12, color: '#ffd98a' },
  { name: 'Heavy Blow', level: 2, strength: 18, power: 3.2, radius: 3, crater: 2, shake: 0.2, stop: 0.06, chips: 20, color: '#ffb547' },
  { name: 'Shockwave', level: 3, strength: 28, power: 6, radius: 8, crater: 4, shake: 0.35, stop: 0.08, chips: 30, color: '#ff8a4c' },
  { name: 'Earthsplitter', level: 4, strength: 40, power: 12, radius: 14, crater: 7, shake: 0.55, stop: 0.1, chips: 44, color: '#ff5a5a' },
  { name: 'Worldbreaker', level: 5, strength: 55, power: 25, radius: 24, crater: 12, shake: 0.9, stop: 0.14, chips: 60, color: '#9fe8ff' },
];

const CHAIN = [1, 1.25, 2];  // left, right, finisher
const FINISHER_REACH = 1.3;  // the finisher's wave goes this much further
const CHAIN_WINDOW = 0.5;    // seconds after a punch to keep the chain going
const HIT_AT = 0.4;          // how far through the punch the blow lands
const LUNGE = 3;             // tiles per second, stepping into the punch
const WAVE_SPEED = 45;       // tiles per second; things break as the wave reaches them
const AIR_PRACTICE = 0.1;
const RINGS = 4, CRATERS = 8, CRATER_GRID = 10, CRATER_LIFE = 40;
const CRATER_MARK = 34;      // largest crack mark, in tiles; past this the dent speaks for itself
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
  return PUNCHES.reduce((best, p, i) => (level >= p.level && body.strength >= p.strength ? i : best), 0);
}

// Thin cracks and scattered scorch: the crater's shape comes from the dented land under it.
function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 53;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#2a2024';
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
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
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
    const map = crackTexture();
    this.craters = Array.from({ length: CRATERS }, () => makeCrater(scene, map));
  }

  punch(state) {
    if (this.active) {
      this.queued = true; // remembered, so mashing Square keeps the chain going
      return;
    }
    const target = this.monsters.target(state) ?? (this.player.rooms.house ? null : this.work.target(state));
    if (target) state.dir = [target.x - state.x, target.z - state.z];
    const len = Math.hypot(...state.dir) || 1;
    this.chain = this.idle < CHAIN_WINDOW ? (this.chain + 1) % CHAIN.length : 0;
    this.active = { target, t: 0, time: this.body.punchTime * (this.chain === 2 ? 1.3 : 1), fx: state.dir[0] / len, fz: state.dir[1] / len, landed: false, chain: this.chain };
  }

  // A blow from this hero at their current punch, before the combo adds to it.
  get force() {
    return PUNCHES[this.stage].power * this.body.damageScale * this.body.massScale;
  }

  // For the sprite: null when not punching.
  get pose() {
    const a = this.active;
    return a && { t: a.t / a.time, chain: a.chain, stage: this.stage, color: PUNCHES[this.stage].color };
  }

  // Inside a cave the ground is the cave floor, whatever the land does above.
  height(x, z) {
    return this.player.rooms.house ? this.player.state.y : landHeight(x, z);
  }

  land(a, state) {
    const p = PUNCHES[this.stage], finisher = a.chain === 2, heavy = this.body.massScale, spread = Math.sqrt(heavy);
    const force = this.force * CHAIN[a.chain];
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
    if (!inside) this.player.world.sites.struck(x, z, reach, this.stage, this.player);
    if (crater) this.tear(x, z, crater);
    this.waves.push({ queue, x, z, t: 0, drops: {}, broke: false });
    return queue.length > 0;
  }

  // Tears the ground open, except right under the great landmarks.
  tear(x, z, size) {
    const safe = [PLACES.spire, { ...PLACES.ribs, r: 260 }, { x: PLACES.spirit.x, z: PLACES.spirit.z, r: 90 }, ...TOWNS];
    if (safe.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + size) || dentAt(x, z) > DEEPEST_PIT) return;
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
    const next = PUNCHES[this.stage + 1];
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
    const pos = c.mesh.geometry.attributes.position, n = CRATER_GRID + 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const px = x + (i / CRATER_GRID - 0.5) * size * 2, pz = z + (j / CRATER_GRID - 0.5) * size * 2;
      pos.setXYZ(j * n + i, px, landHeight(px, pz) + 0.08, pz);
    }
    pos.needsUpdate = true;
    c.age = 0;
    c.mesh.visible = true;
    c.mesh.material.opacity = 1;
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
      else if (h) w.broke = this.work.hitHouse(h, force) || w.broke;
      else if (!this.work.chunks.gone.has(o.id)) w.broke = this.work.hit(o, force, w.drops, at > 0) || w.broke;
    }
    if (w.queue.length) return;
    if (w.broke) {
      this.work.give(w.drops);
      this.work.saveGone();
    }
  }

  update(dt, state) {
    this.work.actor = this.player;
    const shook = this.work.shake;
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
      c.mesh.material.opacity = Math.min(1, (CRATER_LIFE - c.age) / 5);
      if (c.age > CRATER_LIFE) c.mesh.visible = false;
    }
  }
}
