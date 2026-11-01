import * as THREE from 'three';
import { height, addDent, dents, dentShape, WORLD } from './terrain.js';
import { terrainMaterial, waterMaterial, shared } from './materials.js';
import { makeTreeMeshes, makeGrass, makeRocks } from './foliage.js';
import { CHUNK, gridData, spotsData, grassData } from './ground.js';

// Terrain streams in around the hero: fine chunks close by, coarse ones further out, and one
// low-detail mesh of the whole world behind them. Workers do the sums, so frames never wait.
const RING = 4;            // chunks each way from the center (9 x 9 streamed)
const NEAR_TREES = 1;      // rings of full trees; further out a tree is a single picture
const TREE_RING = 8;       // rings of trees in all
const GRASS_RING = 1;
const MAX_CACHED = 1600;
const IN_FLIGHT = 4;       // jobs out with the workers at once, so new orders can jump the line
const ADD_PER_FRAME = 2;   // finished chunks turned into meshes per frame
const SCATTER_GAP = 180;   // ms between refills of the instanced trees and grass
const MAX_TREES = 2600, MAX_FAR_TREES = 26000, MAX_BLADES = 70000, MAX_ROCKS = 4000;
const stepFor = (ring) => (ring <= 1 ? 2 : ring <= 2 ? 4 : 8);

function meshData(g) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(g.nor, 3));
  out.setAttribute('aBiome', new THREE.BufferAttribute(g.bio, 3));
  out.setAttribute('aRoad', new THREE.BufferAttribute(g.road, 1));
  out.setAttribute('aLand', new THREE.BufferAttribute(g.land, 2));
  out.setIndex(new THREE.BufferAttribute(g.idx, 1));
  return out;
}

// The water over one chunk knows how deep it is, for clear shallows and foam at the shore.
function waterData(g) {
  const count = g.deep.length, pos = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    pos[k * 3] = g.pos[k * 3];
    pos[k * 3 + 2] = g.pos[k * 3 + 2];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('aDepth', new THREE.BufferAttribute(g.deep, 1));
  out.setIndex(new THREE.BufferAttribute(g.idx.subarray(0, g.faces), 1));
  return out;
}

const upload = (attribute, used) => {
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, used);
  attribute.needsUpdate = true;
};

export default class Chunks {
  constructor(scene, renderer) {
    this.scene = scene;
    this.mat = terrainMaterial();
    this.waterMat = waterMaterial();
    this.live = new Map();
    this.queue = [];
    this.data = new Map(); // tree and grass spots per chunk
    this.center = null;
    this.flying = new Set();
    this.inbox = [];
    this.scatterAt = 0;
    this.dirty = false;
    this.workers = Array.from({ length: Math.min(3, Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2)) }, () => {
      const w = new Worker(new URL('./groundWorker.js', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }) => this.inbox.push(data);
      return w;
    });
    this.next = 0;

    const farMat = terrainMaterial({ far: true });
    const far = new THREE.Mesh(meshData(gridData(-1024, -1024, WORLD + 2048, 32, false)), farMat);
    far.frustumCulled = false;
    far.receiveShadow = false;
    scene.add(far);

    this.trees = makeTreeMeshes(scene, renderer, MAX_TREES, MAX_FAR_TREES);
    this.grass = makeGrass(scene, MAX_BLADES);
    this.rocks = makeRocks(scene, MAX_ROCKS);
    this.gone = new Map();  // chopped or mined: id -> time it grows back
    this.watchers = [];     // called with (x, z, r) whenever the land changes
    this.slots = new Map(); // id -> instance index, so one object can move or vanish
    this.pose3 = new THREE.Object3D();
    this.stumps = [0, 0, 0];
  }

  post(job) {
    this.workers[this.next++ % this.workers.length].postMessage(job);
  }

  tell(job) {
    for (const w of this.workers) w.postMessage(job);
  }

  keep(key, s) {
    const out = { ...s, things: [...s.trees.flat(), ...s.rocks], grass: null };
    this.data.set(key, out);
    if (this.data.size > MAX_CACHED) this.data.delete(this.data.keys().next().value);
    return out;
  }

  // What grows in one chunk. Same every visit, because it comes from the position.
  spots(cx, cz) {
    const key = `${cx},${cz}`;
    return this.data.get(key) ?? this.keep(key, spotsData(cx, cz));
  }

  // Finished work from the workers.
  collect() {
    let added = 0;
    while (this.inbox.length && added < ADD_PER_FRAME) {
      const m = this.inbox.shift();
      if (m.type === 'chunk') {
        this.flying.delete(m.k);
        if (this.wanted?.has(m.k) && !this.live.has(m.k)) {
          this.build(this.wanted.get(m.k), m.g);
          added++;
        }
      } else {
        const key = `${m.cx},${m.cz}`;
        this.flying.delete(`${m.type}${key}`);
        this.dirty = true;
        if (m.type === 'spots') {
          if (!this.data.has(key)) this.keep(key, m.s);
        } else {
          const s = this.data.get(key);
          if (s) {
            s.grass = m.g;
            s.grassOld = false;
          }
        }
      }
    }
  }

  // Send out the most urgent work, a little at a time, so a change of plan isn't stuck behind it.
  pump() {
    while (this.flying.size < IN_FLIGHT && this.queue.length) {
      const c = this.queue.shift();
      if (this.live.has(c.k) || this.flying.has(c.k)) continue;
      this.flying.add(c.k);
      this.post({ type: 'chunk', k: c.k, cx: c.cx, cz: c.cz, step: c.step });
    }
    for (const c of this.seeds ?? []) {
      if (this.flying.size >= IN_FLIGHT) break;
      const key = `${c.cx},${c.cz}`, id = `spots${key}`;
      if (this.data.has(key) || this.flying.has(id)) continue;
      this.flying.add(id);
      this.post({ type: 'spots', cx: c.cx, cz: c.cz });
    }
  }

  // Grows the grass over one chunk, or refreshes it where the ground has changed.
  askGrass(cx, cz) {
    const id = `grass${cx},${cz}`;
    if (this.flying.has(id)) return;
    this.flying.add(id);
    this.post({ type: 'grass', cx, cz });
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
    else this.dirty = true;
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
    const out = [], cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), span = Math.max(1, Math.ceil(range / CHUNK));
    for (let j = -span; j <= span; j++) for (let i = -span; i <= span; i++) {
      for (const o of this.spots(cx + i, cz + j).things) {
        if (Math.abs(o.x - x) < range && Math.abs(o.z - z) < range && !this.gone.has(o.id)) out.push(o);
      }
    }
    return out;
  }

  // `points`: where the heroes are, as [x, z] pairs.
  update(points) {
    const cells = points.map(([x, z]) => [Math.floor(x / CHUNK), Math.floor(z / CHUNK)]), key = cells.join('|');
    if (!this.told) {
      this.told = true;
      this.tell({ type: 'dents', list: dents });
    }
    if (key !== this.center) {
      this.center = key;
      this.cells = cells;
      this.plan();
      this.seeds = this.around(TREE_RING).sort((a, b) => a.ring - b.ring);
      this.dirty = true;
    }
    this.collect();
    this.pump();
    if (this.dirty && performance.now() - this.scatterAt > SCATTER_GAP) this.scatter();
  }

  // After a long jump: the ground underfoot must exist now, not a few frames from now.
  settle() {
    this.queue = this.queue.filter((c) => {
      if (c.ring > 1) return true;
      if (!this.live.has(c.k)) this.build(c, gridData(c.cx * CHUNK, c.cz * CHUNK, CHUNK, c.step, true));
      return false;
    });
    for (const { cx, cz, ring } of this.around(GRASS_RING)) {
      const s = this.spots(cx, cz);
      if (ring <= GRASS_RING && !s.grass) s.grass = grassData(cx, cz);
    }
    this.scatter();
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
      // Long gone behind a fast hero: free it now rather than waiting for a quiet moment.
      const { x0, z0 } = mesh.userData.cell;
      if (this.cells.every(([cx, cz]) => Math.max(Math.abs(x0 / CHUNK - cx), Math.abs(z0 / CHUNK - cz)) > RING + 2)) this.drop(k, mesh);
    }
    this.wanted = new Map([...want.entries()].map(([k, c]) => [k, { k, ...c }]));
    this.queue = [...this.wanted.values()].filter((c) => !this.live.has(c.k)).sort((a, b) => a.ring - b.ring);
    // The far mesh is only cut away once the near ground is really there (see build).
    if (!this.queue.length) this.setHoles((RING + 0.5) * CHUNK - 1);
  }

  drop(k, mesh) {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    if (mesh.userData.water) {
      this.scene.remove(mesh.userData.water);
      mesh.userData.water.geometry.dispose();
    }
    this.live.delete(k);
  }

  build(c, g) {
    const mesh = new THREE.Mesh(meshData(g), this.mat);
    mesh.userData.cell = { x0: c.cx * CHUNK, z0: c.cz * CHUNK, step: c.step };
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.geometry.computeBoundingSphere();
    this.scene.add(mesh);
    this.live.set(c.k, mesh);
    if (g.wet) {
      const water = new THREE.Mesh(waterData(g), this.waterMat);
      water.geometry.computeBoundingSphere();
      water.renderOrder = 1;
      this.scene.add(water);
      mesh.userData.water = water;
    }
    if (!this.queue.length && ![...this.flying].some((id) => this.wanted.has(id))) {
      // Everything is in place: drop what was replaced and open the hole in the far mesh.
      for (const [k, m] of this.live) if (m.userData.stale) this.drop(k, m);
      this.setHoles((RING + 0.5) * CHUNK - 1);
    }
  }

  // Presses a bowl into the land. The shown ground is edited in place rather than rebuilt,
  // which would stall the punch; anything standing there settles or is torn up with it.
  // `later`: many at once call scatter() themselves when they're done.
  deform(x, z, r, depth, later = false) {
    const old = addDent(x, z, r, depth);
    this.tell({ type: 'dents', list: [[x, z, r, depth]] });
    for (const mesh of this.live.values()) {
      this.patch(mesh, x, z, r, depth);
      if (old) this.patch(mesh, old[0], old[1], old[2], -old[3]);
    }
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const s = this.spots(cx + i, cz + j);
      s.grassOld = true; // grows back around the new shape of the land
      s.placed = null;
      for (const o of s.things) if (Math.hypot(o.x - x, o.z - z) < r) o.y = height(o.x, o.z);
    }
    this.dirty = true;
    if (!later) this.scatter();
    for (const watch of this.watchers) watch(x, z, r);
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
    // The curtain around the edge sinks too, or it stands up out of a pit like a wall.
    for (let k = v * v; k < pos.count; k++) pos.setY(k, pos.getY(k) - dentShape(Math.hypot(pos.getX(k) - x, pos.getZ(k) - z), r) * depth);
    const y = (i, j) => pos.getY(Math.min(n, Math.max(0, j)) * v + Math.min(n, Math.max(0, i)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const nx = y(i - 1, j) - y(i + 1, j), nz = y(i, j - 1) - y(i, j + 1), ny = 2 * step, l = Math.hypot(nx, ny, nz);
      nor.setXYZ(j * v + i, nx / l, ny / l, nz / l);
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }

  // One chunk's trees as finished instance arrays, kept until the land there changes.
  placed(s) {
    if (s.placed) return s.placed;
    s.placed = s.trees.map((list) => {
      const mats = new Float32Array(list.length * 16), cols = new Float32Array(list.length * 3);
      list.forEach((o, i) => {
        this.place(o).toArray(mats, i * 16);
        cols.fill(o.shade, i * 3, i * 3 + 3);
      });
      return { mats, cols };
    });
    return s.placed;
  }

  // Refill the instanced trees and grass around the heroes, from what's been worked out so far.
  scatter() {
    this.dirty = false;
    this.scatterAt = performance.now();
    const color = new THREE.Color(), hidden = new Float32Array(16);
    const near = [0, 0, 0], far = [0, 0, 0];
    let b = 0, r = 0;
    this.slots.clear();
    for (const { stump } of this.trees) stump.count = 0;
    for (const { cx, cz, ring } of this.around(TREE_RING)) {
      const s = this.data.get(`${cx},${cz}`);
      if (!s) continue;
      const sets = this.placed(s);
      s.trees.forEach((list, kind) => {
        const T = this.trees[kind], full = ring <= NEAR_TREES, n = list.length, { mats, cols } = sets[kind];
        if (full ? near[kind] + n > MAX_TREES : far[kind] + n > MAX_FAR_TREES) return;
        const at = full ? near[kind] : far[kind], lit = full ? T.crown : T.far;
        lit.instanceMatrix.array.set(mats, at * 16);
        lit.instanceColor.array.set(cols, at * 3);
        if (full) T.trunk.instanceMatrix.array.set(mats, at * 16);
        list.forEach((o, i) => {
          if (this.isGone(o.id)) {
            if (ring <= RING) this.addStump(o);
            lit.instanceMatrix.array.set(hidden, (at + i) * 16);
            if (full) T.trunk.instanceMatrix.array.set(hidden, (at + i) * 16);
          } else if (full) this.slots.set(o.id, at + i);
        });
        if (full) near[kind] += n;
        else far[kind] += n;
      });
      if (ring > RING) continue;
      for (const o of s.rocks) {
        if (r >= MAX_ROCKS || this.isGone(o.id)) continue;
        this.slots.set(o.id, r);
        this.rocks.setMatrixAt(r, this.place(o));
        this.rocks.setColorAt(r++, color.setRGB(...o.tint));
      }
      if (ring > GRASS_RING) continue;
      if (!s.grass || s.grassOld) this.askGrass(cx, cz);
      const g = s.grass;
      if (!g || b + g.count > MAX_BLADES) continue;
      this.grass.instanceMatrix.array.set(g.mats, b * 16);
      this.grass.instanceColor.array.set(g.cols, b * 3);
      b += g.count;
    }
    this.trees.forEach(({ crown, trunk, far: pictures }, k) => {
      crown.count = trunk.count = near[k];
      pictures.count = far[k];
      upload(crown.instanceMatrix, near[k] * 16);
      upload(crown.instanceColor, near[k] * 3);
      upload(trunk.instanceMatrix, near[k] * 16);
      upload(pictures.instanceMatrix, far[k] * 16);
      upload(pictures.instanceColor, far[k] * 3);
    });
    this.rocks.count = r;
    this.rocks.instanceMatrix.needsUpdate = true;
    this.rocks.instanceColor.needsUpdate = true;
    this.grass.count = b;
    upload(this.grass.instanceMatrix, b * 16);
    upload(this.grass.instanceColor, b * 3);
  }

  get pending() {
    return this.queue.length;
  }
}
