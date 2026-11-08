import * as THREE from 'three';
import { CONQUERORS, MAX_RANK, svg } from './conquerors.js';
import { stagger } from './foes.js';
import { prompt } from '../ui/glyphs.js';
import { COMBAT } from './combat.js';
import { TITAN } from './kits/titan.js';
import { STORM } from './kits/storm.js';
import { EMBER } from './kits/ember.js';
import { FROST, iceMat } from './kits/frost.js';
import { VOID } from './kits/void.js';
import { TIME } from './kits/time.js';
import { TIDE } from './kits/tide.js';
import { BLIGHT } from './kits/blight.js';
import { MIND } from './kits/mind.js';
import { NIGHT } from './kits/night.js';

// Conquerors whose kits have their own power kinds and hooks (kits/*.js).
const KITS = { titan: TITAN, storm: STORM, ember: EMBER, frost: FROST, void: VOID, time: TIME, tide: TIDE, blight: BLIGHT, mind: MIND, night: NIGHT };
// The second five's elements have no shell or flame of their own: light, rings and motes in two colours.
export const LOOKS = { time: ['#7af0d0', '#f4ffe0'], water: ['#3ab8ff', '#e0f6ff'], blight: ['#9ad13a', '#3e5a10'], mind: ['#ff4ad0', '#ffd8f4'], night: ['#6a6cff', '#0c0a1e'] };
import { Flames, makeBolt, shapeBolt } from './elementFx.js';

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
const CAST_POSE = {
  // The second five (v0.54.0).
  stop: 'gather', rewind: 'gather', wither: 'punch', echo: 'gather', quicken: 'gather', loop: 'peak', epoch: 'peak', entropy: 'slam',
  lash: 'throw', breaker: 'slam', geyser: 'peak', orb: 'punch', maelstrom: 'peak', monsoon: 'peak', deluge: 'slam', tsunami: 'slam',
  bile: 'throw', miasma: 'slam', locusts: 'peak', pustule: 'peak', rotland: 'slam', host: 'punch', pestilence: 'gather', deathbloom: 'slam',
  psylance: 'punch', enthrall: 'peak', kinesis: 'throw', dread: 'peak', crush: 'punch', discord: 'peak', usurp: 'gather', sowwar: 'gather',
  knives: 'throw', vanish: 'gather', shadowstep: 'dash', snuff: 'peak', grasp: 'slam', deathmark: 'punch', eclipse: 'peak', nightfall: 'slam',
  bolt: 'punch', nova: 'slam', strike: 'peak', buff: 'gather', zone: 'peak', orbit: 'peak', wall: 'slam', pillar: 'slam', slab: 'throw', surf: 'dash', mail: 'gather', garden: 'slam', sand: 'slam', rift: 'slam', mountain: 'gather', ironbend: 'peak', magma: 'slam', gather: 'peak', thunder: 'peak', step: 'dash', spear: 'throw', railgun: 'gather', current: 'gather', cyclone: 'peak', magnet: 'peak', plasma: 'punch', fist: 'punch', ignite: 'peak', jet: 'dash', flare: 'slam', serpent: 'punch', inferno: 'peak', blue: 'punch', meteor: 'peak', sunlance: 'punch', supernova: 'slam', forge: 'gather', armor: 'gather', hail: 'peak', prison: 'punch', rime: 'slam', mirror: 'gather', glacier: 'slam', sea: 'slam', rise: 'gather', command: 'peak', swap: 'dash', lance: 'punch', tide: 'punch', burst: 'slam', gate: 'gather', amalgam: 'gather', reap: 'peak' };
const STATUS_COLORS = { burn: ['#ff9a3a', '#ff5a2a', '#ffd070'], freeze: ['#dff4ff', '#8fe0ff'], shock: ['#fff4b0', '#ffe25a'] };
const GLOWS = 160, PILLARS = 20, DISCS = 12, BOLTS = 18, CRYSTALS = 60, ROCKS = 60, SHELLS = 16, HOLES = 6;
const SKY = 46;              // tiles up that falling things start
const GROW = 0.14;           // seconds for stone and ice to burst out of the ground
const SINK = 0.5;            // seconds to go back down

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
    this.bolts = pool(BOLTS, () => makeBolt(scene));
    this.flames = new Flames(scene);
    this.later = [];
    this.falling = [];
    const crystal = new THREE.ConeGeometry(1.5, 8, 5).translate(0, 3.2, 0);
    this.crystals = pool(CRYSTALS, () => {
      const m = new THREE.Mesh(crystal, new THREE.MeshLambertMaterial({ color: '#bfeaff', emissive: '#2a7aa8', emissiveIntensity: 0.7, flatShading: true, transparent: true, opacity: 0.92 }));
      m.castShadow = true;
      return m;
    });
    const stone = new THREE.MeshLambertMaterial({ color: '#6e6258', flatShading: true });
    const spike = new THREE.ConeGeometry(1.6, 6.5, 6).translate(0, 2.6, 0);
    this.rocks = pool(ROCKS, () => {
      const m = new THREE.Mesh(spike, stone);
      m.castShadow = true;
      return m;
    });
    const lump = new THREE.DodecahedronGeometry(1, 0), shard = new THREE.ConeGeometry(0.34, 2.4, 5).rotateX(Math.PI / 2), ball = new THREE.SphereGeometry(1, 16, 12);
    const ice = new THREE.MeshLambertMaterial({ color: '#d8f4ff', emissive: '#4ac0f0', emissiveIntensity: 0.9, flatShading: true });
    const black = new THREE.MeshBasicMaterial({ color: '#000000', fog: false });
    this.shells = { earth: pool(SHELLS, () => new THREE.Mesh(lump, stone)), ice: pool(SHELLS, () => new THREE.Mesh(shard, ice)), void: pool(SHELLS, () => new THREE.Mesh(ball, black)), fire: pool(SHELLS, () => new THREE.Mesh(lump, new THREE.MeshBasicMaterial({ color: '#ffb040', fog: false }))) };
    // The second five's thrown cores (v0.54.0).
    const solid = (color) => new THREE.MeshBasicMaterial({ color, fog: false });
    Object.assign(this.shells, {
      time: pool(SHELLS, () => new THREE.Mesh(shard, solid('#bffff0'))),
      water: pool(SHELLS, () => new THREE.Mesh(ball, solid('#9ae6ff'))),
      blight: pool(SHELLS, () => new THREE.Mesh(lump, solid('#a8d83a'))),
      mind: pool(SHELLS, () => new THREE.Mesh(shard, solid('#ff9ae8'))),
      night: pool(SHELLS, () => new THREE.Mesh(shard, solid('#14142a'))),
    });
    // The Tidebringer's water (kits/tide.js): lakes that rise over the land, and walls of sea. Built
    // now and kept hidden, so they never compile a shader mid-fight.
    const sea = new THREE.MeshLambertMaterial({ color: '#2a8ac8', emissive: '#0a3050', transparent: true, opacity: 0.74, depthWrite: false });
    const crest = new THREE.MeshLambertMaterial({ color: '#7ad0f0', emissive: '#1a5070', transparent: true, opacity: 0.82, depthWrite: false });
    this.lakes = pool(3, () => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 56, 1), sea));
    this.seawalls = pool(2, () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 8, 1, 1), crest));
    this.holes = pool(HOLES, () => new THREE.Mesh(ball, black));
    // Materials kits make on demand (the Frostwarden's ice weapons): a hidden stand-in each, so the
    // shader warm-up in main.js builds them before they're first needed.
    for (const m of [iceMat]) {
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), m);
      o.visible = false;
      o.castShadow = true;
      scene.add(o);
    }
    this.live = [this.glows, this.pillars, this.discs, this.bolts, this.crystals, this.rocks, this.holes];
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

  // Plain fire (kind 0) takes the colour of an Emberlord's Heat: `fireKind` 0 orange, 3 white-gold, 2 blue.
  flame(x, y, z, size, life, kind) {
    this.flames.add(x, y, z, size, life, kind === 0 ? this.fireKind ?? 0 : kind);
  }

  lightning(a, b, color, width = 0.16, life = 0.18) {
    const z = this.take(this.bolts);
    Object.assign(z, { age: 0, life });
    shapeBolt(z.o, a, b, width);
    z.o.material.color.set(color).multiplyScalar(3);
    z.o.visible = true;
  }

  zap(a, b, color) {
    this.lightning(a, b, color, 0.12);
  }

  // Stone and ice punch up out of the ground and sink back at the end of their time.
  spike(list, x, y, z, size, life) {
    const c = this.take(list);
    Object.assign(c, { age: 0, life, size });
    c.o.position.set(x, y - 0.4, z);
    c.o.rotation.set((Math.random() - 0.5) * 0.45, Math.random() * 6, (Math.random() - 0.5) * 0.45);
    c.o.scale.set(size, 0.01, size);
    c.o.visible = true;
    return c;
  }

  crystal(x, y, z, life, size = 1) {
    const c = this.spike(this.crystals, x, y, z, size, life);
    c.o.material.opacity = 0.92;
    return c;
  }

  rock(x, y, z, size, life) {
    return this.spike(this.rocks, x, y, z, size, life);
  }

  // A hole in the picture that swells and then collapses to nothing.
  hole(x, y, z, size, life) {
    const h = this.take(this.holes);
    Object.assign(h, { age: 0, life, size });
    h.o.position.set(x, y, z);
    h.o.visible = true;
    this.glow(x, y, z, size * 3.4, '#8a3aff', life, 1);
    return h;
  }

  // A solid thing to throw: a stone, a shard, a ball of nothing, a core of fire.
  shell(element, size) {
    const list = this.shells[element];
    if (!list) return null;
    const s = list.find((x) => !x.o.visible);
    if (!s) return null;
    s.o.scale.setScalar(size);
    s.o.visible = true;
    return s;
  }

  // Something coming down out of the sky onto a spot, due in `secs`.
  fall(element, x, y, z, secs, size) {
    const s = this.shell(element, size);
    if (s) this.falling.push({ s, element, x, y, z, secs, left: secs, size });
  }

  after(secs, fn) {
    this.later.push({ left: secs, fn });
  }

  // The moment an element lands.
  impact(element, x, y, z, r) {
    const n = Math.min(12, 4 + Math.round(r));
    const around = (fn) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + Math.random(), d = r * (0.25 + Math.random() * 0.75);
        fn(x + Math.cos(a) * d, z + Math.sin(a) * d, a);
      }
    };
    if (element === 'fire') {
      around((px, pz) => this.flame(px, y, pz, 3 + r * 0.5 + Math.random() * 3, 0.75, 0));
      this.flame(x, y, z, 5 + r, 0.6, 0);
      this.glow(x, y + 1.5, z, r * 1.5, '#ff7a2a', 0.4, 1.8);
    } else if (element === 'ice') {
      around((px, pz) => this.crystal(px, y, pz, 3 + Math.random() * 3, 0.45 + Math.random() * 0.6));
      this.glow(x, y + 1, z, r * 1.2, '#bfeaff', 0.4, 1.6);
    } else if (element === 'storm') {
      const top = { x: x + (Math.random() - 0.5) * 6, y: y + SKY, z: z + (Math.random() - 0.5) * 6 }, foot = { x, y, z };
      this.lightning(top, foot, '#fff6a8', 0.5, 0.24);
      this.lightning(top, foot, '#a8c8ff', 0.22, 0.3);
      around((px, pz) => this.lightning(foot, { x: px, y, z: pz }, '#fff48a', 0.12, 0.22));
      this.glow(x, y + 2, z, r * 1.6, '#fff6c0', 0.3, 1.5);
    } else if (LOOKS[element]) {
      const [a, b] = LOOKS[element];
      this.glow(x, y + 1.2, z, r * 1.6, a, 0.45, 1.8);
      this.glow(x, y + 1.2, z, r * 0.8, b, 0.3, 1.4);
      this.disc(x, y, z, r * 1.2, a, 0.5);
      around((px, pz) => this.glow(px, y + 0.6 + Math.random() * 1.5, pz, 0.9 + Math.random(), Math.random() < 0.5 ? a : b, 0.5, 0.4));
      if (element === 'night' || element === 'blight') this.hole(x, y + r * 0.15, z, Math.max(0.6, r * 0.3), 0.45);
    } else if (element === 'void') {
      this.hole(x, y + r * 0.2, z, Math.max(0.8, r * 0.4), 0.55);
      around((px, pz) => this.lightning({ x, y: y + 1, z }, { x: px, y, z: pz }, '#9a3aff', 0.1, 0.3));
      around((px, pz) => this.flame(px, y, pz, 2.4 + Math.random() * 2, 0.8, 1));
    } else {
      around((px, pz) => this.rock(px, y, pz, 0.6 + Math.random() * 0.9, 2.5 + Math.random() * 2));
      this.glow(x, y + 0.6, z, r * 1.1, '#a89070', 0.45, 1.5);
    }
  }

  // A ring of the element rolling outward.
  wave(element, x, y, z, r) {
    const rings = Math.max(2, Math.min(5, Math.round(r / 4)));
    for (let k = 1; k <= rings; k++) {
      const radius = (r * k) / rings, n = Math.min(14, 5 + Math.round(radius));
      this.after(k * 0.07, () => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.283, px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
          if (element === 'fire') this.flame(px, y, pz, 3.6, 0.55, 0);
          else if (LOOKS[element]) this.glow(px, y + 0.8, pz, 1.6, LOOKS[element][i % 2], 0.45, 0.6);
          else if (element === 'void') this.flame(px, y, pz, 3, 0.6, 1);
          else if (element === 'ice') this.crystal(px, y, pz, 2.4 + Math.random() * 2, 0.34 + Math.random() * 0.3);
          else if (element === 'earth') this.rock(px, y, pz, 0.45 + Math.random() * 0.4, 1.6);
          else if (i % 2) this.lightning({ x: x + Math.cos(a) * (radius * 0.6), y: y + 1, z: z + Math.sin(a) * (radius * 0.6) }, { x: px, y, z: pz }, '#fff48a', 0.12, 0.16);
        }
      });
    }
  }

  // A beat of a power worn around the body.
  aura(element, x, y, z, r) {
    const a = Math.random() * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (element === 'fire') this.flame(px, y, pz, 2.4, 0.55, 0);
    else if (LOOKS[element]) this.glow(px, y + 1 + Math.random() * 1.5, pz, 0.6, LOOKS[element][Math.random() < 0.7 ? 0 : 1], 0.5, 0.4);
    else if (element === 'void') this.flame(px, y, pz, 2.2, 0.6, 1);
    else if (element === 'storm') this.lightning({ x, y: y + 1.6, z }, { x: px, y: y + Math.random() * 2, z: pz }, '#fff48a', 0.08, 0.14);
    else this.glow(px, y + 1 + Math.random() * 1.5, pz, 0.5, element === 'ice' ? '#bfeaff' : '#a89070', 0.5, 0.4);
  }

  update(dt) {
    this.flames.update(dt);
    this.later = this.later.filter((l) => {
      if ((l.left -= dt) > 0) return true;
      l.fn();
      return false;
    });
    this.falling = this.falling.filter((f) => {
      f.left -= dt;
      const k = Math.max(0, f.left / f.secs), y = f.y + k * SKY;
      f.s.o.position.set(f.x + k * 14, y, f.z - k * 9);
      f.s.o.rotation.x += dt * 5;
      if (f.element === 'fire') this.flame(f.x + k * 14, y - f.size, f.z - k * 9, f.size * 3.2, 0.3, 0);
      if (k > 0) return true;
      f.s.o.visible = false;
      return false;
    });
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
      } else if (list === this.bolts) {
        item.o.material.opacity = 1 - k;
      } else if (list === this.holes) {
        item.o.scale.setScalar(item.size * Math.sin(Math.min(1, k * 1.05) * Math.PI) ** 0.6);
      } else {
        // Up fast, and sinking back down at the end of its time.
        const up = Math.min(1, item.age / GROW), down = Math.min(1, (item.life - item.age) / SINK);
        item.o.scale.y = item.size * up * down;
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
    this.kit = [];             // lasting effects of a Conqueror's own powers
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

  get element() {
    return this.def.element;
  }

  // Leaves the element on the land, to go on spreading by its own rules.
  scar(job, x, z, reach, gen = 2 + job.rank) {
    this.player.world.scars.mark(this.element, x, z, reach, this.player, gen, rankScale(job.rank) * 0.5);
  }

  // Permanent: nothing in the game calls this once a conqueror is set.
  choose(id) {
    this.id = id;
    this.kit = [];
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

  get kitDef() {
    return KITS[this.id] ?? null;
  }

  // While a power like Earth Surf is carrying the hero, the stick steers it instead of walking.
  get busy() {
    return this.kit.some((k) => k.busy);
  }

  // A blow reaching the hero: the kit may take some of it (Stone Mail).
  absorb(amount, from = null) {
    return this.kitDef?.absorb?.(this, amount, from) ?? amount;
  }

  // Square pressed: true if the kit used it (a Slab bursting).
  onPunch() {
    return !!this.kitDef?.onPunch?.(this);
  }

  landed() {
    this.kitDef?.landed?.(this);
  }

  // Puts a power on a D-pad direction (4 to 7: the L1 page); if it's already worn, the two swap places.
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
    // A Titan on natural ground hits harder (Grounded).
    const aim = this.aim(), force = player.body.might * def.power * rankScale(rank) * (player.melee.grounded ? COMBAT.grounded.power : 1) * (this.kitDef?.power?.(this, def) ?? 1) || 0;
    const job = { pid, def, rank, force, color: this.def.color };
    state.dir = [aim.dx, aim.dz];
    this.player.world.work.actor = player;
    const own = this.kitDef?.[kind];
    player.world.watchers?.saw(player, 'power', pid);
    if (own) own(this, job, aim);
    else this[kind](job, aim);
    this.waits[pid] = def.cool * (1 - rank * 0.07);
    // A power whose kit lets it go again at once (Thunderstep's chain) waits only a moment.
    if (this.keepReady === pid) this.waits[pid] = 0.25;
    this.keepReady = null;
    this.casting = CAST_TIME;
    this.pose = CAST_POSE[kind] ?? 'punch';
    player.skills.add(this.skillOf(pid), PRACTICE);
    return undefined;
  }

  // ---- what each kind of power does ----
  bolt(job, aim) {
    const { def, rank, color } = job, { state } = this.player, n = (def.count ?? 1) + (def.count ? Math.floor(rank / 2) : 0), base = Math.atan2(aim.dx, aim.dz);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * (def.spread ?? 0), size = def.size ?? 0.8;
      const shell = this.fx.shell(this.element, this.element === 'ice' ? size * 1.2 : this.element === 'fire' ? size * 0.5 : size * 0.7);
      const glow = this.element === 'earth' || this.element === 'ice' ? null : this.fx.glow(state.x, 0, state.z, size * (this.element === 'void' ? 2.6 : 1.8), color, 99, 1);
      this.bolts.push({ ...job, x: state.x, z: state.z, dx: Math.sin(a), dz: Math.cos(a), left: def.range, hit: new Set(), glow, shell, chain: (def.chain ?? 0) + (def.chain ? rank + this.player.nature.chains : 0) });
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
    this.fx.wave(this.element, state.x, y, state.z, reach);
    this.fx.impact(this.element, state.x, y, state.z, reach * 0.45);
    melee.ring(state.x, y, state.z, reach, color);
    this.player.world.work.burst(state.x, y + 0.5, state.z, STATUS_COLORS[def.status] ?? [color], 18, 7);
    if (!def.pull) this.scar({ rank }, state.x, state.z, reach * 0.8);
    this.player.world.work.shake = Math.max(this.player.world.work.shake ?? 0, Math.min(0.5, reach * 0.02));
    this.player.world.work.shakeAt = this.player.state;
    if (list.length) this.player.skills.add(this.skillOf(pid), PRACTICE_HIT * Math.min(4, list.length));
  }

  strike(job, aim) {
    const { def, rank } = job, { melee, state } = this.player, wait = def.wait ?? STRIKE_WAIT;
    const place = (x, z, at) => {
      this.strikes.push({ ...job, x, z, at });
      const y = melee.height(x, z);
      melee.ring(x, y, z, def.reach, job.color);
      // Fire and ice come down from the sky; lightning needs no warning, stone comes from below.
      if (at > 0.3 && (this.element === 'fire' || this.element === 'ice')) this.fx.fall(this.element, x, y, z, at, Math.min(5, def.reach * 0.3));
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
    this.kitDef?.afflicted?.(this, e); // a Stormcaller's dash and bolts Charge what they touch
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
    this.kitDef?.afflicted?.(this, e, def, rank);
    const y = e.group.position.y + 1.5, { nature } = this.player;
    if (def.status === 'burn') {
      this.burns.set(e, { left: BURN_SECS * (1 + rank * 0.15), dps: this.player.body.might * BURN_SHARE * rankScale(rank) * nature.pyromancy });
      nature.deed('pyromancy');
    } else if (def.status === 'freeze' && !e.boss) {
      stagger(e, (def.chill ?? 1) * (1 + rank * 0.12), monsters.time, true);
      this.fx.glow(e.x, y, e.z, 2.4, '#bfeaff', 0.5);
      nature.deed('stillness');
    } else if (def.status === 'shock' && !e.boss) {
      stagger(e, SHOCK_SECS, monsters.time, true);
      nature.deed('conductance');
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
    this.fx.impact(this.element, x, y - 1, z, def.blast ?? 2);
    if (!def.blast) this.player.world.sites.struck(x, z, 2, 0, this.player, b.force);
    this.scar(b, x, z, Math.max(3, (def.blast ?? 2) * 0.8), 1 + rank);
    if (!def.blast) this.fx.glow(x, y, z, 2.4, color, 0.3, 1.6);
  }

  updateBolts(dt) {
    const { melee } = this.player, { fx } = this, el = this.element;
    this.bolts = this.bolts.filter((b) => {
      const move = b.speed ?? b.def.speed;
      b.x += b.dx * move * dt;
      b.z += b.dz * move * dt;
      b.left -= move * dt;
      const y = melee.height(b.x, b.z) + FLY_HEIGHT;
      const size = b.def.size ?? 0.8;
      if (b.glow) b.glow.o.position.set(b.x, y, b.z);
      if (b.shell) {
        b.shell.o.position.set(b.x, y, b.z);
        if (el === 'ice') b.shell.o.rotation.y = Math.atan2(b.dx, b.dz);
        else b.shell.o.rotation.x += dt * 9;
      }
      if (el === 'fire') fx.flame(b.x, y - size * 1.4, b.z, 3 + size * 2.4, 0.3, 0);
      else if (el === 'void') fx.flame(b.x, y - size, b.z, 2 + size * 1.6, 0.3, 1);
      else if (el === 'ice') fx.glow(b.x, y, b.z, 0.7, '#bfeaff', 0.25, 0.3);
      else if (el === 'earth') fx.glow(b.x, y - 0.4, b.z, size, '#a89070', 0.3, 1.2);
      else {
        fx.lightning({ x: b.x, y, z: b.z }, { x: b.x - b.dx * 11, y: y + (Math.random() - 0.5), z: b.z - b.dz * 11 }, b.color, 0.16, 0.1);
      }
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
      if (b.glow) {
        b.glow.age = b.glow.life;
        b.glow.o.visible = false;
      }
      if (b.shell) b.shell.o.visible = false;
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
      this.fx.impact(this.element, s.x, y, s.z, reach);
      this.scar(s, s.x, s.z, reach * 0.8);
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
    if (this.element === 'fire') this.fx.flame(state.x, y - 1.2, state.z, 4, 0.5, 0);
    else if (this.element === 'void') this.fx.flame(state.x, y - 1.2, state.z, 3.4, 0.5, 1);
    else if (this.element === 'storm') this.fx.lightning({ x: state.x, y, z: state.z }, { x: state.x - d.dx * 5, y, z: state.z - d.dz * 5 }, d.color, 0.2, 0.16);
    else if (this.element === 'earth') this.fx.rock(state.x - d.dx * 2, y - 1.4, state.z - d.dz * 2, 0.7, 2);
    else this.fx.crystal(state.x - d.dx * 2, y - 1.4, state.z - d.dz * 2, 2, 0.5);
    if (d.def.power) {
      for (const e of melee.monsters.within(state.x, state.z, d.def.reach)) {
        if (d.hit.has(e)) continue;
        d.hit.add(e);
        this.harm(d.pid, e, d.force);
      }
    }
    if (d.left <= 0) {
      this.dashing = null;
      if (d.def.power) this.scar(d, state.x, state.z, 4, 1);
    }
  }

  updateLasting(dt) {
    const { state, melee, world } = this.player;
    this.tick -= dt;
    const beat = this.tick <= 0;
    if (beat) this.tick = TICK;
    this.buffs = this.buffs.filter((b) => {
      b.left -= dt;
      if (beat) {
        const ground = melee.height(state.x, state.z);
        for (let i = 0; i < 3; i++) this.fx.aura(this.element, state.x, ground, state.z, b.def.aura ? b.def.aura * 0.6 : 1.4);
        if (b.def.aura) this.scar(b, state.x, state.z, b.def.aura * 0.6, 0);
        if (b.def.aura) for (const e of melee.monsters.within(state.x, state.z, b.def.aura)) {
          this.sting(e, this.player.body.might * b.def.dps * rankScale(b.rank) * TICK);
          this.afflict(b.pid, e, b.def, b.rank);
        }
      }
      if (b.def.trail && Math.hypot(state.x - (this.trailX ?? 1e9), state.z - (this.trailZ ?? 1e9)) > TRAIL_EVERY) {
        this.trailX = state.x;
        this.trailZ = state.z;
        this.scar(b, state.x, state.z, 2.6, 1);
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
      if (beat) {
        this.scar(z, z.x, z.z, z.reach * 0.75, 1);
        const a = Math.random() * 6.283, d = Math.random() * z.reach, px = z.x + Math.cos(a) * d, pz = z.z + Math.sin(a) * d, ground = melee.height(px, pz);
        if (this.element === 'storm') this.fx.impact('storm', px, ground, pz, 3);
        else if (this.element === 'void') this.fx.hole(z.x, melee.height(z.x, z.z) + 2, z.z, z.reach * 0.22, TICK * 1.6);
      }
      if (beat) for (const e of melee.monsters.within(z.x, z.z, z.reach)) {
        if (z.def.pull && !e.boss) e.vel.set(z.x - e.x, z.z - e.z).multiplyScalar(1.4);
        this.sting(e, this.player.body.might * z.def.dps * rankScale(z.rank) * TICK);
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
      this.fx.flame(x, y - 1.3, z, 2.2, 0.28, 1);
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
    const cool = this.player.wrath?.surge > 0 ? COMBAT.surge.cool : 1; // a Surge cools powers faster
    for (const pid of Object.keys(this.waits)) this.waits[pid] = Math.max(0, this.waits[pid] - dt * cool);
    this.casting = Math.max(0, this.casting - dt);
    // Sparks of the Conqueror's element drift up around them, always.
    if ((this.mote = (this.mote ?? 0) - dt) <= 0) {
      this.mote = MOTE_EVERY;
      const { state } = this.player, a = Math.random() * 6.28, d = 0.6 + Math.random() * 1.2;
      this.fx.glow(state.x + Math.cos(a) * d, Math.max(state.y, 0) + state.air + Math.random() * 2.4, state.z + Math.sin(a) * d, 0.2, this.def.color, 0.8, 0.15);
    }
    this.kit = this.kit.filter((k) => k.update(dt) !== false);
    this.kitDef?.tick?.(this, dt);
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

  // `page` 1 while L1 is held: the cross shows the second page of worn powers.
  update(set, device, page = 0) {
    this.box.hidden = !set.def;
    if (!set.def) return;
    this.box.classList.toggle('page2', page === 1);
    this.cells.forEach((c, k) => {
      const i = k + page * SLOTS, pid = set.loadout[i] ?? null;
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
