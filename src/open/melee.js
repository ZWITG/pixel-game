import * as THREE from 'three';
import { height } from './terrain.js';

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

// Which punch the hero has right now.
export function punchStage(skills, body) {
  const level = skills.level('punching');
  return PUNCHES.reduce((best, p, i) => (level >= p.level && body.strength >= p.strength ? i : best), 0);
}

function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  let seed = 53;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#1b1620';
  for (let i = 0; i < 700; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 13;
    g.fillRect(Math.floor(32 + Math.cos(a) * d), Math.floor(32 + Math.sin(a) * d), 2, 2);
  }
  for (let k = 0; k < 11; k++) {
    let a = (k / 11) * 6.28, x = 32, y = 32;
    for (let i = 0; i < 26; i++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a) * 1.05;
      y += Math.sin(a) * 1.05;
      g.fillRect(Math.floor(x), Math.floor(y), i < 12 ? 2 : 1, i < 12 ? 2 : 1);
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
  constructor(scene, work, skills, body, hud) {
    Object.assign(this, { work, skills, body, hud });
    this.active = null;
    this.queued = false;
    this.chain = 0;
    this.idle = CHAIN_WINDOW; // the first punch starts a fresh chain
    this.wave = null;
    this.stage = punchStage(skills, body);
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
    const target = this.work.target(state);
    if (target) state.dir = [target.x - state.x, target.z - state.z];
    const len = Math.hypot(...state.dir) || 1;
    this.chain = this.idle < CHAIN_WINDOW ? (this.chain + 1) % CHAIN.length : 0;
    this.active = { target, t: 0, time: this.body.punchTime * (this.chain === 2 ? 1.3 : 1), fx: state.dir[0] / len, fz: state.dir[1] / len, landed: false, chain: this.chain };
  }

  // For the sprite: null when not punching.
  get pose() {
    const a = this.active;
    return a && { t: a.t / a.time, chain: a.chain, stage: this.stage, color: PUNCHES[this.stage].color };
  }

  land(a, state) {
    const p = PUNCHES[this.stage], finisher = a.chain === 2;
    const force = p.power * CHAIN[a.chain] * this.body.damageScale;
    const t = a.target && !this.work.chunks.gone.has(a.target.id) ? a.target : null;
    const x = t ? t.x - a.fx * t.r : state.x + a.fx * 1.2, z = t ? t.z - a.fz * t.r : state.z + a.fz * 1.2;
    const ground = height(x, z);
    const reach = p.radius * (finisher ? FINISHER_REACH : 1);

    const queue = t ? [{ o: t, at: 0, force }] : [];
    if (reach) {
      for (const o of this.work.chunks.near(x, z, reach)) {
        const d = Math.hypot(o.x - x, o.z - z);
        if (o !== t && d < reach) queue.push({ o, at: d / WAVE_SPEED, force: force * (1 - 0.6 * (d / reach)) });
      }
      queue.sort((m, n) => m.at - n.at);
      this.ring(x, ground, z, reach, p.color);
      if (finisher) this.ring(x, ground, z, reach * 0.6, '#ffffff');
      this.crater(x, z, p.crater * (finisher ? 1.3 : 1));
    }
    this.wave = { queue, t: 0, drops: {}, broke: false };

    this.skills.add('punching', t ? 1 : AIR_PRACTICE);
    if (t) this.skills.add(t.type === 'tree' ? 'woodcutting' : 'mining', 1);
    if (t || reach) {
      this.work.burst(x, ground + 1.1, z, [p.color, '#fff8ea', '#94808a'], p.chips, 4 + this.stage * 1.5);
      this.work.stop = p.stop * (finisher ? 1.6 : 1);
    }
    this.work.shake = Math.max(this.work.shake, (t || reach ? p.shake : 0) * (finisher ? 1.5 : 1));
    this.refreshStage();
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
      pos.setXYZ(j * n + i, px, height(px, pz) + 0.08, pz);
    }
    pos.needsUpdate = true;
    c.age = 0;
    c.mesh.visible = true;
    c.mesh.material.opacity = 1;
  }

  updateWave(dt) {
    const w = this.wave;
    w.t += dt;
    while (w.queue.length && w.queue[0].at <= w.t) {
      const { o, force, at } = w.queue.shift();
      if (this.work.chunks.gone.has(o.id)) continue;
      const broke = this.work.hit(o, force, w.drops, at > 0);
      w.broke = w.broke || broke;
    }
    if (w.queue.length) return;
    if (w.broke) {
      this.work.give(w.drops);
      this.work.saveGone();
    }
    this.wave = null;
  }

  update(dt, state) {
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
    if (this.wave) this.updateWave(dt);
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
