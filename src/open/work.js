import * as THREE from 'three';
import { height } from './terrain.js';

// Hands on the world: trees and rocks stand in the way, and can be chopped and mined for
// materials. What is gone stays gone until it regrows, so the world remembers you were there.
export const ITEMS = {
  wood: { name: 'Wood', weight: 1, color: '#c98f5a' },
  stone: { name: 'Stone', weight: 2, color: '#b7a9b4' },
  iron: { name: 'Iron', weight: 3, color: '#e8a06a' },
};

// `need`: Strength needed before a strike does anything.
export const ROCKS = [
  { hp: 3, drops: { stone: 2 } },
  { hp: 8, drops: { stone: 5 } },
  { hp: 16, drops: { stone: 8, iron: 2 }, need: 14 },
];

const REACH = 1.9;          // tiles past the object's edge
const HERO_RADIUS = 0.4;
const HIT_AT = 0.4;         // how far through the swing the blow lands
const REGROW = 15 * 60000;  // ms
const TREE_HP = 6;          // per unit of tree size
const WOOD = 3;             // per unit of tree size
const LEAVES = [['#2a7a55', '#46a06a'], ['#b81f2e', '#ff7a56'], ['#cf8f1e', '#ffe27a']];
const BARK = ['#8a5236', '#c9a070'], DUST = ['#94808a', '#c9bcc4', '#6f6068'];
const MAX_CHIPS = 240;
const BAG_KEY = 'lumen.bag', WORLD_KEY = 'lumen.world';

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private window: lasts this session only */ }
}

// What the hero carries, limited by Strength, and what they keep in house chests.
export class Bag {
  constructor(body) {
    this.body = body;
    const saved = load(BAG_KEY);
    this.items = saved?.items ?? {};
    this.stored = saved?.stored ?? {};
  }

  get weight() {
    return Object.entries(this.items).reduce((sum, [id, n]) => sum + n * ITEMS[id].weight, 0);
  }

  // Takes as many as fit; returns how many that was.
  add(id, count) {
    const room = Math.floor((this.body.carry - this.weight) / ITEMS[id].weight);
    const taken = Math.min(count, Math.max(0, room));
    if (taken) this.items[id] = (this.items[id] ?? 0) + taken;
    this.save();
    return taken;
  }

  // Empties the bag into the chest; returns what was moved.
  store() {
    const moved = this.items;
    for (const [id, n] of Object.entries(moved)) this.stored[id] = (this.stored[id] ?? 0) + n;
    this.items = {};
    this.save();
    return moved;
  }

  save() {
    save(BAG_KEY, { items: this.items, stored: this.stored });
  }
}

export default class Work {
  constructor(scene, chunks, skills, body, bag, hud, marks) {
    Object.assign(this, { scene, chunks, skills, body, bag, hud, marks });
    this.swinging = null;
    this.hurt = new Map();
    this.shaking = null;
    this.falling = [];
    this.shake = 0;
    this.deniedAt = 0;
    const gone = load(WORLD_KEY) ?? {};
    for (const [id, at] of Object.entries(gone)) chunks.gone.set(id, at);

    // Flying wood chips, stone dust and leaves.
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial(), MAX_CHIPS);
    mesh.frustumCulled = false;
    mesh.setColorAt(0, new THREE.Color());
    scene.add(mesh);
    this.chips = Array.from({ length: MAX_CHIPS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, slow: false }));
    this.chipMesh = mesh;
    this.color = new THREE.Color();
    this.d = new THREE.Object3D();
  }

  // Stops the hero at trees, rocks, houses and landmarks; they slide around the edge.
  collide(state) {
    for (const o of this.chunks.near(state.x, state.z, 6)) {
      if (o.type === 'tree' || state.air < o.sc) this.pushCircle(state, o.x, o.z, o.r); // rocks can be jumped
    }
    for (const s of this.marks.solids) {
      if (s.r) this.pushCircle(state, s.x, s.z, s.r);
      else this.pushRect(state, s);
    }
  }

  pushCircle(state, x, z, radius) {
    const r = radius + HERO_RADIUS, dx = state.x - x, dz = state.z - z, d = Math.hypot(dx, dz);
    if (d >= r || d < 1e-3) return;
    state.x = x + (dx / d) * r;
    state.z = z + (dz / d) * r;
  }

  pushRect(state, s) {
    const px = Math.min(state.x - s.x0, s.x1 - state.x) + HERO_RADIUS;
    const pz = Math.min(state.z - s.z0, s.z1 - state.z) + HERO_RADIUS;
    if (px <= 0 || pz <= 0) return;
    if (px < pz) state.x += state.x < (s.x0 + s.x1) / 2 ? -px : px;
    else state.z += state.z < (s.z0 + s.z1) / 2 ? -pz : pz;
  }

  // The closest thing the hero is facing and can reach.
  target(state) {
    const len = Math.hypot(...state.dir) || 1, fx = state.dir[0] / len, fz = state.dir[1] / len;
    let best = null, score = 1e9;
    for (const o of this.chunks.near(state.x, state.z, 8)) {
      const dx = o.x - state.x, dz = o.z - state.z, d = Math.hypot(dx, dz) - o.r;
      if (d > REACH) continue;
      const facing = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
      if (facing < -0.2) continue;
      const s = d - facing;
      if (s < score) { score = s; best = o; }
    }
    return best;
  }

  door(state) {
    return this.marks.houses.find((h) => Math.hypot(state.x - h.door.x, state.z - h.door.z) < 2.4);
  }

  swing(target, state) {
    if (this.swinging) return;
    state.dir = [target.x - state.x, target.z - state.z];
    this.swinging = { target, t: 0, time: this.body.swingTime, landed: false };
  }

  // Swing progress for the sprite: null when idle.
  get tool() {
    if (!this.swinging) return null;
    return { kind: this.swinging.target.type === 'tree' ? 'axe' : 'pick', t: this.swinging.t / this.swinging.time };
  }

  land(o) {
    const y = o.y + (o.type === 'tree' ? 1.2 : o.sc * 0.6);
    if (o.type === 'rock' && ROCKS[o.size].need > this.body.strength) {
      // Too tough for now, but the effort still counts.
      this.skills.add('mining', 0.3);
      this.burst(o.x, y, o.z, DUST, 4, 3);
      this.shakeOff(o, 0.12);
      if (performance.now() - this.deniedAt > 4000) this.hud.message(`It won't crack. You need Strength ${ROCKS[o.size].need}.`);
      this.deniedAt = performance.now();
      return;
    }
    const hp = o.type === 'tree' ? TREE_HP * o.sc : ROCKS[o.size].hp;
    const done = (this.hurt.get(o.id) ?? 0) + this.body.damageScale;
    this.skills.add(o.type === 'tree' ? 'woodcutting' : 'mining', 1);
    this.burst(o.x, y, o.z, o.type === 'tree' ? BARK : DUST, 8, 5);
    this.shake = 0.1;
    if (done < hp) {
      this.hurt.set(o.id, done);
      this.shakeOff(o, o.type === 'tree' ? 0.05 : 0.02);
      return;
    }
    this.hurt.delete(o.id);
    this.chunks.remove(o, Date.now() + REGROW);
    save(WORLD_KEY, Object.fromEntries(this.chunks.gone));
    if (o.type === 'tree') this.fell(o);
    else {
      this.burst(o.x, y, o.z, DUST, 30, 7);
      this.shake = 0.25;
      this.give(ROCKS[o.size].drops);
    }
  }

  shakeOff(o, amount) {
    if (this.shaking) this.chunks.pose(this.shaking.o);
    this.shaking = { o, t: 0, amount };
  }

  give(drops) {
    for (const [id, n] of Object.entries(drops)) {
      const taken = this.bag.add(id, n);
      if (taken) this.hud.gain(ITEMS[id], `+${taken}`);
      if (taken < n) this.hud.message('Your bag is full. Store it in a house, or grow stronger.');
    }
    this.hud.setBag(this.bag);
  }

  // The tree comes down away from the hero, on its own copy so the forest needn't change.
  fell(o) {
    const away = Math.atan2(o.x - this.heroX, o.z - this.heroZ);
    const parts = ['crown', 'trunk'].map((name) => {
      const src = this.chunks.trees[o.kind][name];
      const m = new THREE.InstancedMesh(src.geometry, src.material, 1);
      m.customDepthMaterial = src.customDepthMaterial;
      m.castShadow = true;
      m.frustumCulled = false;
      this.scene.add(m);
      return m;
    });
    this.falling.push({ o, parts, age: 0, away, landed: false });
    this.skills.add('woodcutting', 3);
  }

  updateFalling(dt) {
    const d = this.d;
    for (const f of this.falling) {
      f.age += dt;
      const { o } = f, drop = Math.min(1, f.age / 1.3);
      const tilt = drop * drop * Math.PI * 0.49;
      if (drop === 1 && !f.landed) {
        f.landed = true;
        const reach = 9 * o.sc, x = o.x + Math.sin(f.away) * reach, z = o.z + Math.cos(f.away) * reach;
        this.burst(x, height(x, z) + 1, z, LEAVES[o.kind], 40, 6, true);
        this.shake = 0.3;
        this.give({ wood: Math.round(WOOD * o.sc) });
      }
      const sink = Math.max(0, f.age - 2) * 3, s = Math.max(0.01, 1 - Math.max(0, f.age - 2));
      d.position.set(o.x, o.y - 0.2 - sink, o.z);
      d.quaternion.setFromAxisAngle(new THREE.Vector3(Math.cos(f.away), 0, -Math.sin(f.away)), tilt);
      d.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot));
      d.scale.set(o.sc * s, o.sc * 1.25, o.sc * s);
      d.updateMatrix();
      for (const m of f.parts) {
        m.setMatrixAt(0, d.matrix);
        m.instanceMatrix.needsUpdate = true;
      }
    }
    this.falling = this.falling.filter((f) => {
      if (f.age < 3) return true;
      for (const m of f.parts) {
        this.scene.remove(m);
        m.dispose();
      }
      return false;
    });
  }

  burst(x, y, z, colors, count, power, slow = false) {
    for (let i = 0, made = 0; i < MAX_CHIPS && made < count; i++) {
      const c = this.chips[i];
      if (c.life > 0) continue;
      const a = Math.random() * 6.28, v = power * (0.4 + Math.random() * 0.6);
      Object.assign(c, { life: 0.7 + Math.random() * (slow ? 1.4 : 0.5), x, y, z, vx: Math.cos(a) * v, vy: power * (0.4 + Math.random() * 0.6), vz: Math.sin(a) * v, spin: Math.random() * 6, slow });
      this.chipMesh.setColorAt(i, this.color.set(colors[made % colors.length]));
      made++;
    }
    this.chipMesh.instanceColor.needsUpdate = true;
  }

  updateChips(dt) {
    const d = this.d;
    d.quaternion.identity();
    let live = false;
    this.chips.forEach((c, i) => {
      if (c.life <= 0) return;
      c.life -= dt;
      c.vy -= (c.slow ? 5 : 18) * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.spin += dt * 9;
      d.position.set(c.x, c.y, c.z);
      d.rotation.set(c.spin, c.spin * 0.7, 0);
      d.scale.setScalar(c.life > 0 ? 1 : 0);
      d.updateMatrix();
      this.chipMesh.setMatrixAt(i, d.matrix);
      live = true;
    });
    if (live || this.chipsLive) this.chipMesh.instanceMatrix.needsUpdate = true;
    this.chipsLive = live;
  }

  update(dt, state) {
    this.heroX = state.x;
    this.heroZ = state.z;
    this.shake = Math.max(0, this.shake - dt * 0.8);
    if (this.swinging) {
      const s = this.swinging;
      s.t += dt;
      if (!s.landed && s.t >= s.time * HIT_AT) {
        s.landed = true;
        this.land(s.target);
      }
      if (s.t >= s.time) this.swinging = null;
    }
    if (this.shaking) {
      const s = this.shaking;
      s.t += dt;
      const lean = s.t < 0.35 ? Math.sin(s.t * 40) * s.amount * (1 - s.t / 0.35) : 0;
      this.chunks.pose(s.o, lean);
      if (s.t >= 0.35) this.shaking = null;
    }
    this.updateFalling(dt);
    this.updateChips(dt);
  }
}
