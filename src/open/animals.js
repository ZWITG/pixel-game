import * as THREE from 'three';
import { TOWNS, PLACES, WORLD, height, biome, forest } from './terrain.js';
import { toon, paint, ball, limb, block, skin } from './kit.js';
import { roadsidePlaces } from './roadsidePlan.js';
import { nearSolids } from './solidGrid.js';
import { ITEMS } from './items.js';

// Animals (phase 7): wild horses running in the meadows, cows and sheep on the pastures round the
// villages with a dog to mind them, hens scratching in the yards. Herds move as Reynolds' boids do
// (keep apart, keep together, head the same way), pulled back to their pasture, and they bolt from
// a hero who comes at them. A wild horse can be calmed and kept, or a saddled one bought at an inn;
// your horse comes when you whistle, carries you at a gallop that tires it, and waits where you
// leave it (saved, like the rest of the world).
const NEAR = 260, FAR = 360;      // tiles: herds come into being, and go
const SCALE = 1.3, HORSE = 1.55;  // animal models are built in "horse units"; horses a little bigger, to carry a hero
const SEP = 3, LOOK = 14;         // tiles: personal space, and how far a beast heeds its herd
const BOLT = 16;                  // tiles: a hero this close to a skittish animal makes it run
const SAVE_KEY = 'lumen.horse';
export const SADDLE = 2.75;       // tiles the rider sits above the ground
export const RIDE = { walk: 7, canter: 15, gallop: 30, climb: 1.1, tire: 1 / 7, rest: 1 / 12 };
const PRICE = 120;
const COATS = [['#7a5232', '#3a2418'], ['#d8cbb8', '#8a7a68'], ['#2e2624', '#141010'], ['#b07840', '#5a3820'], ['#9a9490', '#4a4440'], ['#e8e0d4', '#c4b8a8']];
const NAMES = ['Ash', 'Bramble', 'Cinder', 'Dusk', 'Ember', 'Fable', 'Gale', 'Hollow', 'Ivy', 'Juniper', 'Kestrel', 'Lark', 'Moss', 'Nettle', 'Onyx', 'Pike', 'Quill', 'Rook', 'Sorrel', 'Thistle'];

// What each kind is: how fast, how skittish, how tough, what it leaves, and its shape.
export const KINDS = {
  horse: { speed: 4, run: 16, flee: 1, hp: 4, drops: { hide: 2, meat: 2 }, herd: [4, 7], roam: 60 },
  cow: { speed: 1.6, run: 7, flee: 0.5, hp: 4, drops: { meat: 3, hide: 2 }, herd: [4, 6], roam: 34 },
  sheep: { speed: 1.8, run: 8, flee: 1, hp: 2, drops: { meat: 1, hide: 1 }, herd: [6, 10], roam: 30 },
  chicken: { speed: 1.4, run: 6, flee: 1, hp: 1, drops: { meat: 1 }, herd: [3, 6], roam: 12 },
  dog: { speed: 3, run: 12, flee: 0, hp: 3, drops: {}, herd: [1, 1], roam: 40 },
};

// ---- the models: a body, neck, head and legs on the shared toon kit ----
function animal(kind, coat = '#7a5232', dark = '#3a2418', saddle = false) {
  const mat = toon(), group = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(), parts = [], headParts = [];
  let legs = [], legLen = 1.4, spots = [[0.32, 0.7], [-0.32, 0.7], [0.32, -0.7], [-0.32, -0.7]], neckAt = [0, 2.2, 1], headAt = [0, 2.9, 1.5];
  if (kind === 'horse') {
    parts.push(paint(ball(0.6, 1, 0.95, 1.8).translate(0, 1.85, 0), coat), paint(limb(0.27, 0.36, 1.25).rotateX(-0.6).translate(0, 2.5, 0.95), coat));
    parts.push(paint(block(0.12, 0.45, 1.2).rotateX(-0.6).translate(0, 2.75, 0.8), dark), paint(limb(0.08, 0.18, 1.2).rotateX(0.45).translate(0, 2.05, -1.05), dark));
    headParts.push(paint(ball(0.28, 0.85, 0.9, 1.9), coat), paint(block(0.1, 0.22, 0.12).translate(0.12, 0.35, -0.2), coat), paint(block(0.1, 0.22, 0.12).translate(-0.12, 0.35, -0.2), coat), paint(ball(0.06).translate(0.18, 0.08, 0.15), '#100c0c'), paint(ball(0.06).translate(-0.18, 0.08, 0.15), '#100c0c'));
    if (saddle) parts.push(paint(block(0.95, 0.22, 1.1).translate(0, 2.45, 0.05), '#5a2c1c'), paint(block(1.15, 0.1, 1.3).translate(0, 2.36, 0.05), '#b13e53'), paint(block(0.1, 0.9, 0.08).translate(0.62, 1.95, 0.1), '#2a1a12'), paint(block(0.1, 0.9, 0.08).translate(-0.62, 1.95, 0.1), '#2a1a12'));
    neckAt = [0, 2.6, 1.15];
    headAt = [0, 3.1, 1.6];
    legLen = 1.55;
  } else if (kind === 'cow') {
    parts.push(paint(ball(0.72, 1.05, 0.95, 1.55).translate(0, 1.5, 0), coat), paint(ball(0.4, 1.2, 0.9, 1.4).translate(0.35, 1.7, -0.3), dark), paint(limb(0.05, 0.1, 0.9).rotateX(0.3).translate(0, 1.7, -1.15), dark));
    headParts.push(paint(ball(0.33, 1, 0.95, 1.4), coat), paint(block(0.4, 0.2, 0.16).translate(0, -0.12, 0.42), '#e8b8a8'), paint(limb(0.04, 0.07, 0.45).rotateZ(1.3).translate(0.35, 0.3, -0.05), '#e8dcc8'), paint(limb(0.04, 0.07, 0.45).rotateZ(-1.3).translate(-0.35, 0.3, -0.05), '#e8dcc8'));
    neckAt = [0, 1.75, 1];
    headAt = [0, 1.85, 1.35];
    legLen = 1.1;
    spots = [[0.38, 0.65], [-0.38, 0.65], [0.38, -0.65], [-0.38, -0.65]];
  } else if (kind === 'sheep') {
    for (let i = 0; i < 7; i++) parts.push(paint(ball(0.42).translate(Math.cos(i * 1.7) * 0.32, 1.15 + Math.sin(i * 2.3) * 0.15, -0.4 + i * 0.14), '#f2ece0'));
    headParts.push(paint(ball(0.22, 0.85, 1, 1.3), '#2e2624'), paint(block(0.3, 0.08, 0.12).translate(0, 0.12, -0.12), '#2e2624'));
    neckAt = [0, 1.25, 0.6];
    headAt = [0, 1.35, 0.85];
    legLen = 0.8;
    coat = '#2e2624';
    spots = [[0.25, 0.45], [-0.25, 0.45], [0.25, -0.45], [-0.25, -0.45]];
  } else if (kind === 'chicken') {
    parts.push(paint(ball(0.28, 1, 0.95, 1.25).translate(0, 0.62, 0), coat), paint(block(0.05, 0.28, 0.26).rotateX(-0.5).translate(0, 0.78, -0.32), dark));
    headParts.push(paint(ball(0.14), coat), paint(block(0.04, 0.12, 0.14).translate(0, 0.14, 0), '#d0344a'), paint(block(0.06, 0.05, 0.1).translate(0, -0.02, 0.15), '#e8a33a'));
    neckAt = [0, 0.85, 0.2];
    headAt = [0, 0.95, 0.3];
    legLen = 0.38;
    spots = [[0.1, 0.02], [-0.1, 0.02]];
  } else {
    // A dog: lean, ears up, tail high.
    parts.push(paint(ball(0.32, 0.95, 0.95, 1.7).translate(0, 0.95, 0), coat), paint(limb(0.04, 0.08, 0.6).rotateX(-0.8).translate(0, 1.15, -0.5), coat));
    headParts.push(paint(ball(0.2, 0.9, 0.95, 1.4), coat), paint(block(0.1, 0.18, 0.06).translate(0.1, 0.2, -0.05), dark), paint(block(0.1, 0.18, 0.06).translate(-0.1, 0.2, -0.05), dark), paint(ball(0.05).translate(0, 0, 0.27), '#100c0c'));
    neckAt = [0, 1.15, 0.4];
    headAt = [0, 1.3, 0.62];
    legLen = 0.75;
    spots = [[0.18, 0.4], [-0.18, 0.4], [0.18, -0.4], [-0.18, -0.4]];
  }
  skin(body, parts, mat, 0.035);
  skin(head, headParts, mat, 0.03);
  head.position.set(...headAt);
  body.add(head);
  legs = spots.map(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, legLen, z);
    skin(leg, [paint(limb(kind === 'chicken' ? 0.03 : 0.12, kind === 'chicken' ? 0.03 : 0.09, legLen), kind === 'chicken' ? '#e8a33a' : kind === 'sheep' ? '#2e2624' : coat), paint(block(kind === 'chicken' ? 0.14 : 0.2, 0.14, kind === 'chicken' ? 0.18 : 0.24).translate(0, -legLen, 0.03), kind === 'chicken' ? '#e8a33a' : dark)], mat, 0.025);
    body.add(leg);
    return leg;
  });
  group.add(body);
  group.scale.setScalar(kind === 'horse' ? HORSE : SCALE);
  void neckAt;
  return { group, body, head, legs, headY: headAt[1] };
}

// Legs swing with the stride (a gallop moves the pairs together), the head bobs, and a grazing
// beast puts its head down.
function animate(m, phase, speed, graze, run) {
  const swing = Math.min(1, speed / 3) * (run ? 0.85 : 0.55);
  m.legs.forEach((leg, i) => {
    const pair = run ? (i < 2 ? 0 : Math.PI * 0.8) : [0, Math.PI, Math.PI, 0][i] ?? 0;
    leg.rotation.x = Math.sin(phase + pair + (run && i % 2 ? 0.35 : 0)) * swing;
  });
  m.body.position.y = run ? Math.abs(Math.sin(phase)) * 0.18 : 0;
  m.body.rotation.x = run ? Math.sin(phase) * 0.06 : 0;
  m.head.rotation.x = graze ? 0.9 : Math.sin(phase * 2) * 0.05 * swing;
  m.head.position.y = m.headY - (graze ? 0.55 : 0);
}

// ---- where the animals live ----
let seed = 4421;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function herdSpots() {
  seed = 4421;
  const out = [];
  // Wild horses on open meadow, away from towns.
  for (let n = 0, t = 0; n < 14 && t < 6000; t++) {
    const x = 400 + rand() * (WORLD - 800), z = 400 + rand() * (WORLD - 800), y = height(x, z);
    if (y < 8 || y > 160 || biome(x, z)[0] < 0.5 || forest(x, z) > 0.3) continue;
    if (TOWNS.some((T) => Math.hypot(x - T.x, z - T.z) < T.r + 200) || out.some((h) => Math.hypot(h.x - x, h.z - z) < 500)) continue;
    out.push({ kind: 'horse', wild: true, x, z, id: `horse${n}` });
    n++;
  }
  // Pastures round the villages and cities: cows and sheep (with a dog), hens in the middle.
  for (const T of TOWNS) {
    if (T.kind !== 'village' && T.kind !== 'city') continue;
    for (const [k, kind] of ['cow', 'sheep', 'sheep'].entries()) {
      const a = rand() * 6.283, d = T.r + 50 + k * 30, x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
      if (height(x, z) < 2) continue;
      out.push({ kind, x, z, id: `${T.name}${kind}${k}`, dog: kind === 'sheep' });
    }
    out.push({ kind: 'chicken', x: T.x + 18, z: T.z - 14, id: `${T.name}hens`, tame: true });
  }
  // Hens in every inn yard.
  for (const p of roadsidePlaces()) if (p.kind === 'inn') out.push({ kind: 'chicken', x: p.x + Math.sin(p.face) * 9, z: p.z + Math.cos(p.face) * 9, id: `${p.name}hens`, tame: true });
  void PLACES;
  return out;
}

export default class Animals {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.herds = herdSpots().map((h) => ({ ...h, live: false, beasts: [], gone: 0 }));
    this.t = 0;
    this.steed = null;
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (saved) this.own(saved);
    } catch { /* no horse yet */ }
  }

  // ---- herds ----
  spawn(h) {
    const k = KINDS[h.kind], [lo, hi] = k.herd, n = lo + Math.floor(rand() * (hi - lo + 1)) - h.gone;
    h.live = true;
    for (let i = 0; i < Math.max(0, n); i++) {
      const [coat, dark] = h.kind === 'horse' ? COATS[Math.floor(rand() * COATS.length)] : h.kind === 'cow' ? (rand() < 0.5 ? ['#e8e0d4', '#2e2624'] : ['#8a5a3a', '#e8e0d4']) : h.kind === 'chicken' ? (rand() < 0.5 ? ['#e8dcc8', '#b0a080'] : ['#a0522d', '#5a2c1c']) : ['#c9b89e', '#2e2624'];
      this.beast(h, h.kind, coat, dark, h.x + (rand() - 0.5) * 16, h.z + (rand() - 0.5) * 16);
    }
    if (h.dog) this.beast(h, 'dog', '#5a4030', '#2e2016', h.x + 10, h.z);
  }

  beast(h, kind, coat, dark, x, z) {
    const model = animal(kind, coat, dark);
    model.group.position.set(x, height(x, z), z);
    this.scene.add(model.group);
    h.beasts.push({ kind, model, x, z, vx: 0, vz: 0, dir: rand() * 6.283, phase: rand() * 6, graze: 0, wait: rand() * 4, hp: KINDS[kind].hp, scared: 0, dead: 0, coat, dark });
  }

  despawn(h) {
    h.live = false;
    for (const b of h.beasts) this.scene.remove(b.model.group);
    h.beasts = [];
  }

  blocked(x, z) {
    return nearSolids(this.world.marks, x, z).some((s) => !s.off && (s.r ? Math.hypot(x - s.x, z - s.z) < s.r + 0.6 : x > s.x0 - 0.6 && x < s.x1 + 0.6 && z > s.z0 - 0.6 && z < s.z1 + 0.6));
  }

  update(dt) {
    this.t += dt;
    const { players } = this.world;
    for (const h of this.herds) {
      const d = players.reduce((m, p) => Math.min(m, Math.hypot(p.state.x - h.x, p.state.z - h.z)), 1e9);
      if (!h.live && d < NEAR) this.spawn(h);
      else if (h.live && d > FAR) this.despawn(h);
      if (h.live) this.move(h, dt, players);
    }
    this.ride(dt);
  }

  // One herd's step: the boid rules, home, grazing, and bolting from heroes.
  move(h, dt, players) {
    const k = KINDS[h.kind], alive = h.beasts.filter((b) => !b.dead);
    let cx = 0, cz = 0, ax = 0, az = 0;
    for (const b of alive) {
      cx += b.x;
      cz += b.z;
      ax += b.vx;
      az += b.vz;
    }
    const n = Math.max(1, alive.length);
    cx /= n;
    cz /= n;
    for (const b of h.beasts) {
      if (b.dead) {
        // Lies where it fell, then is gone.
        b.dead += dt;
        b.model.group.rotation.z = Math.min(Math.PI / 2, b.dead * 4);
        if (b.dead > 12) b.model.group.visible = false;
        continue;
      }
      const kk = KINDS[b.kind];
      // The nearest hero: is it coming at us?
      let threat = null, td = 1e9;
      for (const p of players) {
        const dd = Math.hypot(p.state.x - b.x, p.state.z - b.z);
        if (dd < td) {
          threat = p;
          td = dd;
        }
      }
      const pushy = threat && !h.tame && kk.flee > 0 && !threat.state.riding && (threat.state.sprinting || threat.melee.active || td < BOLT * 0.4);
      if (pushy && td < BOLT) b.scared = 3;
      b.scared = Math.max(0, b.scared - dt);
      let tx = 0, tz = 0, speed = kk.speed;
      if (b.scared > 0 && threat) {
        tx = b.x - threat.state.x;
        tz = b.z - threat.state.z;
        speed = kk.run;
        b.graze = 0;
      } else if (b.kind === 'dog') {
        // The dog circles the flock.
        const a = this.t * 0.4 + h.x;
        tx = cx + Math.cos(a) * 14 - b.x;
        tz = cz + Math.sin(a) * 14 - b.z;
        speed = Math.hypot(tx, tz) > 4 ? kk.run * 0.6 : kk.speed;
      } else {
        // Wander a little, graze a lot; keep with the herd and near home.
        if ((b.wait -= dt) <= 0) {
          b.wait = 3 + rand() * 6;
          b.graze = rand() < 0.55 ? b.wait : 0;
          b.dir = rand() * 6.283;
        }
        if (b.graze > 0) {
          b.graze -= dt;
          speed = 0;
        }
        tx = Math.sin(b.dir) * 0.6 + (cx - b.x) * 0.04 + (ax / n) * 0.3;
        tz = Math.cos(b.dir) * 0.6 + (cz - b.z) * 0.04 + (az / n) * 0.3;
        const home = Math.hypot(h.x - b.x, h.z - b.z);
        if (home > k.roam) {
          tx += (h.x - b.x) / home;
          tz += (h.z - b.z) / home;
        }
      }
      // Personal space.
      for (const o of alive) {
        if (o === b) continue;
        const dx = b.x - o.x, dz = b.z - o.z, dd = Math.hypot(dx, dz);
        if (dd < SEP && dd > 0.01) {
          tx += (dx / dd) * (SEP - dd) * 0.8;
          tz += (dz / dd) * (SEP - dd) * 0.8;
        }
      }
      const len = Math.hypot(tx, tz);
      const want = len > 0.01 && speed > 0 ? speed : 0;
      const vx = len > 0.01 ? (tx / len) * want : 0, vz = len > 0.01 ? (tz / len) * want : 0;
      b.vx += (vx - b.vx) * Math.min(1, dt * 3);
      b.vz += (vz - b.vz) * Math.min(1, dt * 3);
      const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt, v = Math.hypot(b.vx, b.vz);
      if (height(nx, nz) > 0.5 && !this.blocked(nx, nz)) {
        b.x = nx;
        b.z = nz;
      } else {
        b.vx *= -0.5;
        b.vz *= -0.5;
      }
      if (v > 0.2) b.model.group.rotation.y = Math.atan2(b.vx, b.vz);
      b.phase += dt * (2 + v * (b.kind === 'chicken' ? 4 : 1.6));
      b.model.group.position.set(b.x, height(b.x, b.z), b.z);
      if (b.model.group.visible) animate(b.model, b.phase, v, b.graze > 0, v > kk.run * 0.6);
    }
  }

  // A blow among the animals: they're hurt, and what dies leaves meat and hide.
  struck(x, z, reach, force, hero) {
    for (const h of this.herds) {
      if (!h.live || Math.hypot(h.x - x, h.z - z) > KINDS[h.kind].roam + reach + 30) continue;
      for (const b of h.beasts) {
        if (b.dead || Math.hypot(b.x - x, b.z - z) > reach + 1.5) continue;
        b.hp -= Math.max(1, force);
        b.scared = 4;
        for (const o of h.beasts) o.scared = 4;
        if (b.hp > 0) continue;
        b.dead = 0.01;
        h.gone++;
        const got = [];
        for (const [id, n] of Object.entries(KINDS[b.kind].drops)) {
          if (hero?.bag.add(id, n)) got.push(`${ITEMS[id].name} ${n}`);
        }
        if (got.length) hero.hud.message(`You take ${got.join(', ')}.`);
        hero?.bag.save();
      }
    }
    if (this.steed && !this.steed.ridden && Math.hypot(this.steed.x - x, this.steed.z - z) < reach + 2) this.steed.scared = 2;
  }

  // ---- your horse ----
  own(data, at) {
    this.steed?.model && this.scene.remove(this.steed.model.group);
    const model = animal('horse', data.coat[0], data.coat[1], true);
    const s = { ...data, model, x: at?.x ?? data.x, z: at?.z ?? data.z, vx: 0, vz: 0, phase: 0, stamina: 1, ridden: false, coming: false, scared: 0 };
    model.group.position.set(s.x, height(s.x, s.z), s.z);
    this.scene.add(model.group);
    this.steed = s;
    this.save();
  }

  save() {
    const s = this.steed;
    if (!s) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ name: s.name, coat: s.coat, x: Math.round(s.x), z: Math.round(s.z) }));
    } catch { /* lasts this visit */ }
  }

  buy(hero) {
    if (hero.bag.gold < PRICE) return hero.hud.message(`A good saddled horse is ${PRICE} gold.`);
    hero.bag.gold -= PRICE;
    hero.bag.save();
    const coat = COATS[Math.floor(Math.random() * COATS.length)], name = NAMES[Math.floor(Math.random() * NAMES.length)];
    this.own({ name, coat }, { x: hero.state.x + 4, z: hero.state.z + 2 });
    hero.hud.message(`${name} is yours. Whistle (L3, or H on the keyboard) and she'll come.`, true);
    return undefined;
  }

  get price() {
    return PRICE;
  }

  // Calls your horse: it runs to you, or, if it's far off, comes over the nearest rise.
  whistle(hero) {
    const s = this.steed;
    if (!s) return hero.hud.message('You whistle, but you have no horse to come.');
    if (s.ridden) return undefined;
    const d = Math.hypot(s.x - hero.state.x, s.z - hero.state.z);
    if (d > 200) {
      const a = Math.random() * 6.283;
      s.x = hero.state.x + Math.cos(a) * 90;
      s.z = hero.state.z + Math.sin(a) * 90;
    }
    s.coming = hero;
    hero.hud.message(`You whistle for ${s.name}.`);
    return undefined;
  }

  mount(hero) {
    const s = this.steed;
    s.ridden = hero;
    s.coming = false;
    hero.state.riding = s;
    hero.state.x = s.x;
    hero.state.z = s.z;
    hero.hud.message(`You swing up onto ${s.name}. Gallop with sprint; jump with Cross; get down with Circle.`);
  }

  dismount(hero) {
    const s = this.steed;
    if (!s?.ridden) return;
    s.ridden = false;
    hero.state.riding = null;
    const side = (hero.state.dir?.[0] ?? 0) >= 0 ? 1 : -1, len = Math.hypot(...(hero.state.dir ?? [0, 1])) || 1, [dx, dz] = (hero.state.dir ?? [0, 1]).map((v) => v / len);
    hero.state.x = s.x + dz * 2.2 * side;
    hero.state.z = s.z - dx * 2.2 * side;
    this.save();
  }

  // How fast the hero goes on horseback: walk, canter, or a gallop that tires the horse.
  speed(hero, sprint, dt) {
    const s = this.steed, gallop = sprint && s.stamina > 0.02;
    s.stamina = Math.max(0, Math.min(1, s.stamina + (gallop ? -RIDE.tire : RIDE.rest) * dt));
    s.galloping = gallop;
    if (!gallop && sprint && s.stamina < 0.05 && !s.blown) {
      s.blown = true;
      hero.hud.message(`${s.name} is blown. Let her walk a while.`);
    }
    if (s.stamina > 0.4) s.blown = false;
    return gallop ? RIDE.gallop : sprint ? RIDE.canter : RIDE.canter * 0.75;
  }

  ride(dt) {
    const s = this.steed;
    if (!s) return;
    const g = s.model.group;
    if (s.ridden) {
      const st = s.ridden.state, dx = st.x - s.x, dz = st.z - s.z, v = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      s.x = st.x;
      s.z = st.z;
      g.position.set(s.x, st.y + st.air, s.z);
      const want = Math.atan2(st.dir[0], st.dir[1]), diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
      g.rotation.y += diff * Math.min(1, dt * 8);
      s.phase += dt * (2 + Math.min(v, 40) * 0.42);
      animate(s.model, s.phase, Math.min(v, 30), false, v > RIDE.canter + 1);
      s.ridden.hud.setBreath?.(s.stamina);
      // Deep water or a door: you get down.
      if (s.ridden.swim?.inWater || s.ridden.rooms?.house || st.flying) this.dismount(s.ridden);
      return;
    }
    // Waiting, or coming to a whistle.
    let speed = 0, tx = 0, tz = 0;
    s.stamina = Math.min(1, s.stamina + RIDE.rest * dt);
    if (s.coming) {
      tx = s.coming.state.x - s.x;
      tz = s.coming.state.z - s.z;
      const d = Math.hypot(tx, tz);
      speed = d > 30 ? RIDE.gallop * 0.8 : d > 5 ? RIDE.canter * 0.6 : 0;
      if (d <= 5) s.coming = false;
    } else if (s.scared > 0) {
      s.scared -= dt;
      tx = Math.sin(this.t);
      tz = Math.cos(this.t);
      speed = 6;
    }
    const d = Math.hypot(tx, tz);
    if (speed && d > 0.01) {
      const nx = s.x + (tx / d) * speed * dt, nz = s.z + (tz / d) * speed * dt;
      if (height(nx, nz) > 0.3) {
        s.x = nx;
        s.z = nz;
      }
      g.rotation.y = Math.atan2(tx, tz);
    }
    s.phase += dt * (2 + speed * 0.42);
    g.position.set(s.x, height(s.x, s.z), s.z);
    animate(s.model, s.phase, speed, !speed && Math.sin(this.t * 0.2) > 0.3, speed > RIDE.canter);
    if ((this.saveWait = (this.saveWait ?? 0) - dt) <= 0) {
      this.saveWait = 5;
      this.save();
    }
  }

  // What the Cross button does near your horse, or a wild one.
  spot(hero) {
    if (hero.state.riding || hero.state.air > 1) return null;
    const s = this.steed;
    if (s && Math.hypot(s.x - hero.state.x, s.z - hero.state.z) < 4.5) return { label: `Ride ${s.name}`, act: () => this.mount(hero) };
    for (const h of this.herds) {
      if (!h.live || !h.wild) continue;
      for (const b of h.beasts) {
        if (b.dead || b.scared > 0 || Math.hypot(b.x - hero.state.x, b.z - hero.state.z) > 4.5) continue;
        return { label: s ? 'Calm this wild horse and take it instead' : 'Calm the wild horse and make it yours', act: () => this.tame(hero, h, b) };
      }
    }
    return null;
  }

  tame(hero, h, b) {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    this.scene.remove(b.model.group);
    h.beasts.splice(h.beasts.indexOf(b), 1);
    h.gone++;
    this.own({ name, coat: [b.coat, b.dark] }, { x: b.x, z: b.z });
    hero.hud.message(`You speak low and steady, a hand on its neck. The wild horse is yours: you call her ${name}.`, true);
  }
}
