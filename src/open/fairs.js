import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOWNS, ROADS, height } from './terrain.js';
import { along } from './roads.js';
import { tent } from './fortress.js';
import { VoxelBuilder } from '../render/voxel.js';
import { masonry } from './materials.js';
import { makeFigure } from './figures.js';
import { LOOKS } from '../art/looks.js';
import { walkPose } from '../render/models.js';
import { GOODS } from './economy.js';
import { nationAt } from './nations.js';
import { showPlace, hidePlace } from './compass.js';

// Fairs (phase 7). Like the old charter fairs, a fair comes round on a fixed turn: every few days
// one town holds it on a meadow by the road outside its walls. Merchants arrive from far away (its
// market fills with every kind of good), the crowd comes out, and there's a bell to ring for a
// prize. A fair keeps its own court, as the "piepowder" courts did for travelling traders: break
// its stalls or knock its folk about and its warden fines you on the spot.
const EVERY = 3;              // days between fairs; a fair lasts the day it opens
const NEAR = 520;             // tiles: the fair is built while a hero is this close
const OUT = 70;               // tiles beyond a town's edge, along its road
const RING = 26;              // tiles across the fairground
const CROWD = 14, SCALE = 2.3, WANDER = 1.6, TALK = 7;
const BRING = 25;             // of each good the merchants bring
const BELL = 2, BELL_PRIZE = 30, FINE = 15;
const TENTS = ['#c0392b', '#e8c050', '#3b5dc9', '#efe6d6', '#257179', '#9b4fd0', '#d86a5a', '#5fae62'];
const FOLK = [LOOKS.merchant, LOOKS.kid, LOOKS.smith, LOOKS.bard, LOOKS.elder, LOOKS.guard];

// Where a town holds its fair: out along the road that reaches it, or beside it if none does.
function ground(T) {
  for (const path of ROADS) {
    for (const end of [0, 1]) {
      const p = end ? path.at(-1) : path[0];
      if (Math.hypot(p[0] - T.x, p[1] - T.z) > T.r) continue;
      const pts = end ? [...path].reverse() : path, [x, z, a] = along(pts, T.r + OUT);
      return { x: x + Math.cos(a) * 30, z: z - Math.sin(a) * 30 };
    }
  }
  return { x: T.x + T.r + OUT, z: T.z };
}

export default class Fairs {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.fair = null;
    this.t = 0;
  }

  get realm() {
    return this.world.realm;
  }

  // The town whose turn it is on a given day.
  host(day) {
    return TOWNS[Math.floor(day / EVERY) % TOWNS.length];
  }

  open(day) {
    return day % EVERY === 0;
  }

  // For the talk at inns: the next fair, or the one going on.
  coming() {
    const day = this.realm?.day ?? 1;
    if (this.open(day)) return `The fair is on at ${this.host(day).name} today, out by the road.`;
    const next = day + (EVERY - (day % EVERY)), T = this.host(next), wait = next - day;
    return `The fair comes to ${T.name} ${wait === 1 ? 'tomorrow' : `in ${wait} days`}. Merchants from all over.`;
  }

  update(dt) {
    this.t += dt;
    const day = this.realm?.day ?? 1, { players } = this.world;
    // Opening and closing with the days.
    if (this.open(day) && this.fair?.day !== day) {
      this.close();
      const T = this.host(day), at = ground(T), s = this.realm?.settlements.find((p) => p.name === T.name);
      this.fair = { day, T, s, ...at, y: height(at.x, at.z), name: `${T.name} Fair`, r: RING, built: false, folk: [], fined: -1e9 };
      // The merchants arrive: the market fills with everything.
      if (s) {
        for (const g of Object.keys(GOODS)) s.stock[g] = (s.stock[g] ?? 0) + BRING;
        for (const g of Object.keys(GOODS)) s.price[g] = this.realm.economy.priceOf(s, g);
      }
      showPlace(this.fair);
      this.realm?.say(`The fair has opened at ${T.name}.`, '#e8c050');
    } else if (!this.open(day) && this.fair) this.close();
    // Tomorrow's fair is called through the land the evening before.
    if (!this.open(day) && this.open(day + 1) && this.called !== day) {
      this.called = day;
      this.realm?.say(`Criers: the fair comes to ${this.host(day + 1).name} tomorrow.`, '#e8c050');
    }
    const f = this.fair;
    if (!f) return;
    const near = players.some((p) => Math.hypot(p.state.x - f.x, p.state.z - f.z) < NEAR);
    if (near && !f.built) this.build(f);
    else if (!near && f.built) this.unbuild(f);
    if (!f.built) return;
    for (const k of f.folk) {
      const g = k.model.group;
      if ((k.turn -= dt) <= 0) {
        k.turn = 2 + Math.random() * 4;
        k.dir = Math.random() * 6.283;
        k.moving = Math.random() < 0.65;
      }
      const nx = g.position.x + Math.sin(k.dir) * WANDER * dt, nz = g.position.z + Math.cos(k.dir) * WANDER * dt;
      if (k.moving && Math.hypot(nx - f.x, nz - f.z) < RING) {
        g.position.set(nx, height(nx, nz), nz);
        g.rotation.y = k.dir;
        k.phase += dt * 8;
        walkPose(k.model, k.phase, 1);
      } else {
        if (k.moving) k.dir += 2.4;
        walkPose(k.model, k.phase, 0);
      }
    }
    f.bell = Math.max(0, (f.bell ?? 0) - dt);
    if (f.bellMesh) f.bellMesh.rotation.z = Math.sin(this.t * 20) * Math.min(0.5, f.bell);
  }

  build(f) {
    f.built = true;
    const parts = [], b = new VoxelBuilder(), y = f.y;
    let seed = f.day * 7 + 3;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Tents in a ring, stalls between them, bunting from a tall pole in the middle.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + 0.2, d = RING - 6;
      tent(parts, Math.cos(a) * d, Math.sin(a) * d, 6 + rand() * 3, 7 + rand() * 3, TENTS[i % TENTS.length], rand);
      const s = a + 0.39, sx = f.x + Math.cos(s) * (RING - 9), sz = f.z + Math.sin(s) * (RING - 9);
      b.box(sx, y + 0.8, sz, 5, 1.6, 2.2, '#7a5232', 0.05).box(sx, y + 3.4, sz, 6, 0.35, 3, TENTS[(i + 3) % TENTS.length], 0.03);
      for (let k = -2; k <= 2; k++) b.box(sx + k, y + 1.8, sz, 0.6, 0.4, 0.6, ['#d8a060', '#ef7d57', '#a7f070', '#e8c060'][(k + 2) % 4], 0);
    }
    b.box(f.x, y + 6, f.z, 0.5, 12, 0.5, '#5a3a22');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283;
      for (let k = 1; k < 10; k++) {
        const t = k / 10, bx = f.x + Math.cos(a) * (RING - 6) * t, bz = f.z + Math.sin(a) * (RING - 6) * t;
        b.box(bx, y + 11.5 - t * 7 - Math.sin(t * Math.PI) * 1.2, bz, 0.5, 0.6, 0.5, TENTS[(i + k) % TENTS.length], 0);
      }
    }
    // The bell: a tall post, a pad to strike, the bell at the top.
    f.bellAt = { x: f.x - 9, z: f.z - 7 };
    b.box(f.bellAt.x, y + 5, f.bellAt.z, 0.6, 10, 0.6, '#7a5232').box(f.bellAt.x + 1, y + 0.3, f.bellAt.z, 1.4, 0.6, 1.4, '#c0392b');
    for (let k = 0; k < 10; k++) b.box(f.bellAt.x - 0.45, y + 0.5 + k, f.bellAt.z, 0.1, 0.6, 0.5, k % 2 ? '#e8c050' : '#efe6d6', 0);
    const bell = new VoxelBuilder();
    bell.box(0, -0.6, 0, 1.2, 1.1, 1.2, '#e8c050', 0).box(0, 0, 0, 0.6, 0.3, 0.6, '#b08d33', 0);
    f.bellMesh = new THREE.Mesh(bell.build(), masonry());
    f.bellMesh.position.set(f.bellAt.x, y + 10.4, f.bellAt.z);
    const tents = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), masonry());
    tents.position.set(f.x, y, f.z);
    f.meshes = [tents, new THREE.Mesh(b.build(), masonry()), f.bellMesh];
    for (const m of f.meshes) {
      m.castShadow = true;
      this.scene.add(m);
    }
    // The warden, a merchant at the stalls, and the crowd.
    const stand = (look, x, z) => {
      const model = makeFigure(look);
      model.group.position.set(x, height(x, z), z);
      model.group.scale.setScalar(SCALE);
      this.scene.add(model.group);
      return model;
    };
    f.warden = stand(LOOKS.guard, f.x - 4, f.z + RING - 3);
    f.trader = stand(LOOKS.merchant, f.x + Math.cos(0.59) * (RING - 11), f.z + Math.sin(0.59) * (RING - 11));
    for (let i = 0; i < CROWD; i++) {
      const a = rand() * 6.283, d = rand() * (RING - 8);
      f.folk.push({ model: stand(FOLK[i % FOLK.length], f.x + Math.cos(a) * d, f.z + Math.sin(a) * d), dir: rand() * 6.283, turn: rand() * 3, moving: true, phase: rand() * 6 });
    }
  }

  unbuild(f) {
    f.built = false;
    for (const m of f.meshes ?? []) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    for (const m of [f.warden, f.trader, ...f.folk.map((k) => k.model)]) if (m) this.scene.remove(m.group);
    f.folk = [];
    f.meshes = null;
    f.warden = f.trader = f.bellMesh = null;
  }

  close() {
    if (!this.fair) return;
    if (this.fair.built) this.unbuild(this.fair);
    hidePlace(this.fair);
    this.fair = null;
  }

  spot(h) {
    const f = this.fair;
    if (!f?.built || h.state.air > 2) return null;
    const d = (m) => (m ? Math.hypot(h.state.x - m.group.position.x, h.state.z - m.group.position.z) : 1e9);
    if (d(f.trader) < TALK && f.s) return { label: 'Trade at the fair', act: () => h.market.open({ place: f.s }) };
    if (Math.hypot(h.state.x - f.bellAt.x, h.state.z - f.bellAt.z) < TALK) return { label: `Ring the bell (${BELL} gold)`, act: () => this.ring(h) };
    if (d(f.warden) < TALK) return { label: 'Talk to the fair warden', act: () => h.hud.message(`Welcome to the ${f.name}. Trade fair, keep the peace, and the court leaves you be.`) };
    return null;
  }

  // The strength test: strike the pad, and the harder the blow the higher the marker flies.
  ring(h) {
    const { bag, hud } = h, f = this.fair;
    if (bag.gold < BELL) return hud.message('Two gold to try the bell.');
    bag.gold -= BELL;
    const might = h.body.might ?? 1, score = Math.min(1.2, (0.35 + Math.random() * 0.45) * Math.sqrt(might));
    if (score >= 1) {
      bag.gold += BELL_PRIZE;
      f.bell = 1.5;
      hud.message(`DONG! The bell rings out over the fair. The crowd cheers and you win ${BELL_PRIZE} gold.`, true);
    } else hud.message(`The marker climbs ${Math.round(score * 100)}% of the way. ${score > 0.8 ? 'So close!' : 'The crowd laughs kindly.'}`);
    bag.save();
    return undefined;
  }

  // The fair's court: a blow among the stalls or the crowd costs a fine, paid on the spot.
  struck(x, z, reach, force, hero) {
    const f = this.fair;
    if (!f?.built || !hero || Math.hypot(x - f.x, z - f.z) > RING + reach) return;
    if (this.t - f.fined < 6) return;
    f.fined = this.t;
    const { bag, hud } = hero, n = nationAt(f.x, f.z);
    if (bag.gold >= FINE) {
      bag.gold -= FINE;
      bag.save();
      hud.message(`The fair warden hauls you before the fair court: ${FINE} gold fine for breaking the peace.`, true);
    } else {
      hud.message('The fair court finds you guilty and you can\'t pay. The warden calls the watch!', true);
      const { monsters } = this.world;
      for (let i = 0; i < 3; i++) {
        const e = monsters.add('soldier', f.x + (Math.random() - 0.5) * 10, f.z + (Math.random() - 0.5) * 10, monsters.danger(f.x, f.z), false);
        if (e && n) e.nation = n.id;
      }
    }
    void force;
  }
}
