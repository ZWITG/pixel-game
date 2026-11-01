import * as THREE from 'three';
import { height, biome, roadDistance, forest, addDent, dentAt, dentShape, WORLD, PLACES } from './terrain.js';
import { terrainMaterial, shared } from './materials.js';
import { makeTreeMeshes, makeGrass, makeRocks } from './foliage.js';

// Terrain streams in around the hero: fine chunks close by, coarse ones further out,
// and one low-detail mesh of the whole world behind them for the far mountains.
const CHUNK = 64;
const RING = 4;            // chunks each way from the center (9 x 9 streamed)
const GRASS_RING = 1;
const BUILDS_PER_FRAME = 2;
const MAX_TREES = 9000, MAX_BLADES = 90000, MAX_ROCKS = 4000;
const ROCK_TINTS = ['#b0a2ac', '#9aa39a', '#a8968c'], ORE_TINT = '#c08a64';
// Trees stay out of these, so landmarks stand in the open.
const CLEARINGS = [PLACES.hollow, PLACES.ribs, { x: PLACES.spirit.x, z: PLACES.spirit.z, r: 300 }];
const stepFor = (ring) => (ring <= 1 ? 1 : ring <= 2 ? 2 : 4);
const rnd = (x, z, k) => {
  const v = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

function gridGeometry(x0, z0, size, step, skirt) {
  const n = Math.round(size / step), v = n + 1, count = v * v;
  const hs = new Float32Array((v + 2) * (v + 2));
  for (let j = 0; j < v + 2; j++) for (let i = 0; i < v + 2; i++) hs[j * (v + 2) + i] = height(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const extra = skirt ? v * 4 : 0;
  const pos = new Float32Array((count + extra) * 3), nor = new Float32Array((count + extra) * 3);
  const bio = new Float32Array((count + extra) * 3), road = new Float32Array(count + extra);
  const put = (k, i, j, y) => {
    const x = x0 + i * step, z = z0 + j * step;
    const a = (j + 1) * (v + 2) + i + 1;
    const nx = hs[a - 1] - hs[a + 1], nz = hs[a - (v + 2)] - hs[a + (v + 2)], ny = 2 * step;
    const l = Math.hypot(nx, ny, nz);
    pos.set([x, y ?? hs[a], z], k * 3);
    nor.set([nx / l, ny / l, nz / l], k * 3);
    bio.set(biome(x, z), k * 3);
    road[k] = step <= 8 && roadDistance(x, z) < 4.5 ? 1 : 0;
  };
  for (let j = 0; j < v; j++) for (let i = 0; i < v; i++) put(j * v + i, i, j);
  const idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * v + i;
    idx.push(a, a + v, a + 1, a + 1, a + v, a + v + 1);
  }
  if (skirt) {
    // A short curtain around the edge hides cracks where detail levels meet.
    let k = count;
    const edge = (fn, flip) => {
      const start = k;
      for (let t = 0; t < v; t++) {
        const [i, j] = fn(t);
        put(k++, i, j, hs[(j + 1) * (v + 2) + i + 1] - 10);
      }
      for (let t = 0; t < n; t++) {
        const [i, j] = fn(t), [i2, j2] = fn(t + 1);
        const a = j * v + i, b = j2 * v + i2, c = start + t, d = start + t + 1;
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    };
    edge((t) => [t, 0], true);
    edge((t) => [t, n], false);
    edge((t) => [0, t], false);
    edge((t) => [n, t], true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aBiome', new THREE.BufferAttribute(bio, 3));
  g.setAttribute('aRoad', new THREE.BufferAttribute(road, 1));
  g.setIndex(idx);
  return g;
}

export default class Chunks {
  constructor(scene) {
    this.scene = scene;
    this.mat = terrainMaterial();
    this.live = new Map();
    this.queue = [];
    this.data = new Map(); // tree and grass spots per chunk
    this.center = null;

    const farMat = terrainMaterial({ far: true });
    const far = new THREE.Mesh(gridGeometry(-1024, -1024, WORLD + 2048, 32, false), farMat);
    far.frustumCulled = false;
    far.receiveShadow = false;
    scene.add(far);

    this.trees = makeTreeMeshes(scene, MAX_TREES);
    this.grass = makeGrass(scene, MAX_BLADES);
    this.rocks = makeRocks(scene, MAX_ROCKS);
    this.gone = new Map();  // chopped or mined: id -> time it grows back
    this.slots = new Map(); // id -> instance index, so one object can move or vanish
    this.pose3 = new THREE.Object3D();
    this.stumps = [0, 0, 0];
  }

  // What grows in one chunk. Same every visit, because it comes from the position.
  spots(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.data.has(key)) return this.data.get(key);
    const trees = [[], [], []], blades = [], rocks = [];
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let i = 0; i < 150; i++) {
      const x = x0 + rnd(cx, cz, i) * CHUNK, z = z0 + rnd(cx, cz, i + 500) * CHUNK;
      if (rnd(cx, cz, i + 900) > forest(x, z) || CLEARINGS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
      const y = height(x, z);
      if (y < 3 || y > 300 || height(x + 2, z) - y > 2.2 || roadDistance(x, z) < 9) continue;
      const [m, a] = biome(x, z);
      const roll = rnd(cx, cz, i + 1300);
      const kind = roll < a ? 1 : roll < a + m * 0.6 ? 2 : 0, sc = 0.8 + rnd(cx, cz, i + 1700) * 0.8;
      trees[kind].push({ id: `t${cx},${cz},${i}`, type: 'tree', kind, x, y, z, sc, rot: rnd(cx, cz, i + 2100) * 6.28, r: 0.5 * sc });
    }
    for (let i = 0; i < 16; i++) {
      const x = x0 + rnd(cx, cz, i + 20000) * CHUNK, z = z0 + rnd(cx, cz, i + 20500) * CHUNK;
      if (rnd(cx, cz, i + 21000) > 0.5 || CLEARINGS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
      const y = height(x, z);
      if (y < 1 || y > 300 || roadDistance(x, z) < 7) continue;
      const roll = rnd(cx, cz, i + 21500), size = roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
      const sc = [0.5, 1.2, 3][size] + rnd(cx, cz, i + 22000) * [0.4, 0.8, 1.2][size];
      rocks.push({ id: `r${cx},${cz},${i}`, type: 'rock', size, x, y, z, sc, rot: rnd(cx, cz, i + 22500) * 6.28, r: 0.85 * sc, tint: size === 2 ? ORE_TINT : ROCK_TINTS[i % 3] });
    }
    const col = [[0.5, 0.62, 0.15], [0.8, 0.68, 0.14], [0.7, 0.3, 0.1], [0.13, 0.36, 0.2], [0.95, 0.75, 0.18], [0.9, 0.18, 0.12]];
    for (let i = 0; i < 5000; i++) {
      const x = x0 + rnd(cx, cz, i + 3000) * CHUNK, z = z0 + rnd(cx, cz, i + 7000) * CHUNK;
      const [m, a, p] = biome(x, z);
      const r = rnd(cx, cz, i + 11000);
      if (r < 0.25) continue;
      const y = height(x, z);
      if (y < 2.5 || y > 280 || Math.abs(height(x + 1, z) - y) > 0.8 || roadDistance(x, z) < 4.5 || dentAt(x, z) > 0.2) continue;
      const pick = r > 0.97 ? 5 : r > 0.92 ? 4 : p > m && p > a ? 3 : a > m ? 2 : r > 0.6 ? 1 : 0;
      blades.push([x, y, z, 0.8 + r * 0.7, col[pick]]);
    }
    const out = { trees, blades, rocks, things: [...trees.flat(), ...rocks] };
    this.data.set(key, out);
    if (this.data.size > 400) this.data.delete(this.data.keys().next().value);
    return out;
  }

  // Sets one object's instance transform; `lean` tips it a little, for the shudder of a blow.
  place(o, lean = 0) {
    const d = this.pose3;
    if (o.type === 'tree') {
      d.position.set(o.x, o.y - 0.2, o.z);
      d.rotation.set(lean, o.rot, lean * 0.6);
      d.scale.set(o.sc, o.sc * 1.25, o.sc);
    } else {
      d.position.set(o.x, o.y + o.sc * 0.2, o.z);
      d.rotation.set(o.rot + lean, o.rot * 2, lean);
      d.scale.set(o.sc, o.sc * 0.78, o.sc * 0.92);
    }
    d.updateMatrix();
    return d.matrix;
  }

  meshesOf(o) {
    return o.type === 'tree' ? [this.trees[o.kind].crown, this.trees[o.kind].trunk] : [this.rocks];
  }

  pose(o, lean = 0) {
    const slot = this.slots.get(o.id);
    if (slot === undefined) return;
    const matrix = this.place(o, lean);
    for (const m of this.meshesOf(o)) {
      m.setMatrixAt(slot, matrix);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  // Takes one object out of the world until `back` (a time in ms).
  remove(o, back) {
    this.gone.set(o.id, back);
    const slot = this.slots.get(o.id), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    if (slot !== undefined) for (const m of this.meshesOf(o)) {
      m.setMatrixAt(slot, hidden);
      m.instanceMatrix.needsUpdate = true;
    }
    if (o.type === 'tree') this.addStump(o);
  }

  addStump(o) {
    const mesh = this.trees[o.kind].stump;
    if (mesh.count >= mesh.instanceMatrix.count) return;
    const d = this.pose3;
    d.position.set(o.x, o.y - 0.25, o.z);
    d.rotation.set(0, o.rot, 0);
    d.scale.set(o.sc, o.sc, o.sc);
    d.updateMatrix();
    mesh.setMatrixAt(mesh.count++, d.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  isGone(id) {
    if (!this.gone.has(id)) return false;
    if (this.gone.get(id) > Date.now()) return true;
    this.gone.delete(id);
    return false;
  }

  // Standing trees and rocks within `range` of a point.
  near(x, z, range) {
    const out = [], cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      for (const o of this.spots(cx + i, cz + j).things) {
        if (Math.abs(o.x - x) < range && Math.abs(o.z - z) < range && !this.gone.has(o.id)) out.push(o);
      }
    }
    return out;
  }

  // `points`: where the heroes are, as [x, z] pairs.
  update(points) {
    const cells = points.map(([x, z]) => [Math.floor(x / CHUNK), Math.floor(z / CHUNK)]), key = cells.join('|');
    if (key !== this.center) {
      this.center = key;
      this.cells = cells;
      this.plan();
      this.scatter();
    }
    for (let i = 0; i < BUILDS_PER_FRAME && this.queue.length; i++) this.build(this.queue.shift());
  }

  // Every chunk within reach of any hero, with its distance to the closest one.
  around(range) {
    const best = new Map();
    for (const [cx, cz] of this.cells) {
      for (let j = -range; j <= range; j++) for (let i = -range; i <= range; i++) {
        const k = `${cx + i},${cz + j}`, ring = Math.max(Math.abs(i), Math.abs(j));
        if (!best.has(k) || ring < best.get(k).ring) best.set(k, { cx: cx + i, cz: cz + j, ring });
      }
    }
    return [...best.values()];
  }

  setHoles(size) {
    const [a, b = a] = this.cells;
    shared.uHole.value.set((a[0] + 0.5) * CHUNK, size ?? shared.uHole.value.y, (a[1] + 0.5) * CHUNK);
    shared.uHole2.value.set((b[0] + 0.5) * CHUNK, size ?? shared.uHole2.value.y, (b[1] + 0.5) * CHUNK);
  }

  // Works out which chunks should exist, nearest first; the far mesh is cut away under them.
  plan() {
    const want = new Map();
    for (const c of this.around(RING)) {
      const step = stepFor(c.ring);
      want.set(`${c.cx},${c.cz},${step}`, { ...c, step });
    }
    for (const [k, mesh] of this.live) {
      if (want.has(k)) continue;
      mesh.userData.stale = true;
    }
    this.queue = [...want.entries()].filter(([k]) => !this.live.has(k)).map(([k, c]) => ({ k, ...c })).sort((a, b) => a.ring - b.ring);
    this.setHoles(this.queue.length ? undefined : (RING + 0.5) * CHUNK - 1);
  }

  build(c) {
    const mesh = new THREE.Mesh(gridGeometry(c.cx * CHUNK, c.cz * CHUNK, CHUNK, c.step, true), this.mat);
    mesh.userData.cell = { x0: c.cx * CHUNK, z0: c.cz * CHUNK, step: c.step };
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.geometry.computeBoundingSphere();
    this.scene.add(mesh);
    this.live.set(c.k, mesh);
    if (!this.queue.length) {
      // Everything is in place: drop what was replaced and open the hole in the far mesh.
      for (const [k, m] of this.live) if (m.userData.stale) {
        this.scene.remove(m);
        m.geometry.dispose();
        this.live.delete(k);
      }
      this.setHoles((RING + 0.5) * CHUNK - 1);
    }
  }

  // Presses a bowl into the land. The shown ground is edited in place rather than rebuilt,
  // which would stall the punch; anything standing there settles or is torn up with it.
  deform(x, z, r, depth) {
    addDent(x, z, r, depth);
    for (const mesh of this.live.values()) this.patch(mesh, x, z, r, depth);
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const s = this.spots(cx + i, cz + j);
      s.blades = s.blades.filter(([bx, , bz]) => Math.hypot(bx - x, bz - z) > r * 0.8);
      for (const o of s.things) if (Math.hypot(o.x - x, o.z - z) < r) o.y = height(o.x, o.z);
    }
    this.scatter();
  }

  patch(mesh, x, z, r, depth) {
    const { x0, z0, step } = mesh.userData.cell, n = Math.round(CHUNK / step), v = n + 1;
    const i0 = Math.max(0, Math.floor((x - r - x0) / step)), i1 = Math.min(n, Math.ceil((x + r - x0) / step));
    const j0 = Math.max(0, Math.floor((z - r - z0) / step)), j1 = Math.min(n, Math.ceil((z + r - z0) / step));
    if (i0 > i1 || j0 > j1) return;
    const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * v + i;
      pos.setY(k, pos.getY(k) - dentShape(Math.hypot(pos.getX(k) - x, pos.getZ(k) - z), r) * depth);
    }
    const y = (i, j) => pos.getY(Math.min(n, Math.max(0, j)) * v + Math.min(n, Math.max(0, i)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const nx = y(i - 1, j) - y(i + 1, j), nz = y(i, j - 1) - y(i, j + 1), ny = 2 * step, l = Math.hypot(nx, ny, nz);
      nor.setXYZ(j * v + i, nx / l, ny / l, nz / l);
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }

  // Refill the instanced trees and grass around the heroes.
  scatter() {
    const d = new THREE.Object3D(), color = new THREE.Color();
    const counts = [0, 0, 0];
    let b = 0, r = 0;
    this.slots.clear();
    for (const { stump } of this.trees) stump.count = 0;
    for (const { cx, cz, ring } of this.around(RING)) {
      const s = this.spots(cx, cz);
      s.trees.forEach((list, kind) => {
        for (const o of list) {
          if (counts[kind] >= MAX_TREES) continue;
          if (this.isGone(o.id)) {
            this.addStump(o);
            continue;
          }
          const matrix = this.place(o);
          this.slots.set(o.id, counts[kind]);
          this.trees[kind].crown.setMatrixAt(counts[kind], matrix);
          this.trees[kind].trunk.setMatrixAt(counts[kind]++, matrix);
        }
      });
      for (const o of s.rocks) {
        if (r >= MAX_ROCKS || this.isGone(o.id)) continue;
        this.slots.set(o.id, r);
        this.rocks.setMatrixAt(r, this.place(o));
        this.rocks.setColorAt(r++, color.set(o.tint));
      }
      if (ring > GRASS_RING) continue;
      for (const [x, y, z, sc, c] of s.blades) {
        if (b >= MAX_BLADES) break;
        d.position.set(x, y, z);
        d.rotation.set(0, x, 0);
        d.scale.setScalar(sc);
        d.updateMatrix();
        this.grass.setMatrixAt(b, d.matrix);
        this.grass.setColorAt(b++, color.setRGB(c[0], c[1], c[2]));
      }
    }
    this.trees.forEach(({ crown, trunk }, k) => {
      for (const m of [crown, trunk]) {
        m.count = counts[k];
        m.instanceMatrix.needsUpdate = true;
      }
    });
    this.rocks.count = r;
    this.rocks.instanceMatrix.needsUpdate = true;
    this.rocks.instanceColor.needsUpdate = true;
    this.grass.count = b;
    this.grass.instanceMatrix.needsUpdate = true;
    this.grass.instanceColor.needsUpdate = true;
  }

  get pending() {
    return this.queue.length;
  }
}
