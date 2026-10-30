import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';
import { height, biome, roadDistance, forest, WORLD } from './terrain.js';
import { terrainMaterial, shared } from './materials.js';

// Terrain streams in around the hero: fine chunks close by, coarse ones further out,
// and one low-detail mesh of the whole world behind them for the far mountains.
const CHUNK = 64;
const RING = 4;            // chunks each way from the center (9 x 9 streamed)
const GRASS_RING = 1;
const BUILDS_PER_FRAME = 2;
const MAX_TREES = 9000, MAX_BLADES = 45000;
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

function treeGeometry(kind) {
  const b = new VoxelBuilder();
  if (kind === 'pine') {
    b.box(0, 3.5, 0, 0.5, 7, 0.5, '#5a3320');
    [[3.4, 3], [2.9, 4.4], [2.3, 5.8], [1.7, 7.1], [1.1, 8.3], [0.6, 9.3]].forEach(([w, y], i) => b.box(0, y, 0, w, 1.3, w, i % 2 ? '#2f7a55' : '#22604a', 0.1));
  } else {
    b.box(0, 3, 0, 0.5, 6, 0.5, kind === 'crimson' ? '#7a3a28' : '#d8d2c4');
    b.box(0.5, 4.4, 0, 1.4, 0.3, 0.3, '#5a3320').box(-0.5, 5, 0.2, 1.4, 0.3, 0.3, '#5a3320');
    const c = kind === 'crimson' ? ['#d22a2e', '#ee4a3a', '#a01c2a'] : ['#e8b52e', '#f4cf52', '#c88a22'];
    [[0, 6.6, 0, 4.4, 1.5], [1.1, 7.7, 0.4, 2.8, 1.3], [-1.1, 7.5, -0.5, 2.6, 1.3], [0, 8.7, 0, 2, 1], [1.7, 5.9, -1, 1.7, 0.9], [-1.6, 6, 1.1, 1.8, 0.9]].forEach(([x, y, z, w, h], i) => b.box(x, y, z, w, h, w, c[i % 3], 0.12));
  }
  return b.build();
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

    this.trees = ['pine', 'crimson', 'gold'].map((kind) => {
      const mesh = new THREE.InstancedMesh(treeGeometry(kind), vmat(), MAX_TREES);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    });
    const blade = new VoxelBuilder().box(0, 0.09, 0, 0.1, 0.18, 0.1, '#ffffff', 0, { ao: 0.6 }).build();
    this.grass = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true }), MAX_BLADES);
    this.grass.frustumCulled = false;
    this.grass.count = 0;
    this.grass.setColorAt(0, new THREE.Color());
    scene.add(this.grass);
  }

  // What grows in one chunk. Same every visit, because it comes from the position.
  spots(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.data.has(key)) return this.data.get(key);
    const trees = [[], [], []], blades = [];
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let i = 0; i < 110; i++) {
      const x = x0 + rnd(cx, cz, i) * CHUNK, z = z0 + rnd(cx, cz, i + 500) * CHUNK;
      if (rnd(cx, cz, i + 900) > forest(x, z)) continue;
      const y = height(x, z);
      if (y < 3 || y > 300 || height(x + 2, z) - y > 2.2 || roadDistance(x, z) < 9) continue;
      const [m, a] = biome(x, z);
      const roll = rnd(cx, cz, i + 1300);
      trees[roll < a ? 1 : roll < a + m * 0.6 ? 2 : 0].push([x, y, z, 0.8 + rnd(cx, cz, i + 1700) * 0.9, rnd(cx, cz, i + 2100) * 6.28]);
    }
    const col = [[0.5, 0.62, 0.15], [0.8, 0.68, 0.14], [0.7, 0.3, 0.1], [0.13, 0.36, 0.2], [0.95, 0.75, 0.18], [0.9, 0.18, 0.12]];
    for (let i = 0; i < 5000; i++) {
      const x = x0 + rnd(cx, cz, i + 3000) * CHUNK, z = z0 + rnd(cx, cz, i + 7000) * CHUNK;
      const [m, a, p] = biome(x, z);
      const r = rnd(cx, cz, i + 11000);
      if (r < 0.25) continue;
      const y = height(x, z);
      if (y < 2.5 || y > 280 || Math.abs(height(x + 1, z) - y) > 0.8 || roadDistance(x, z) < 4.5) continue;
      const pick = r > 0.97 ? 5 : r > 0.92 ? 4 : p > m && p > a ? 3 : a > m ? 2 : r > 0.6 ? 1 : 0;
      blades.push([x, y, z, 0.7 + r * 0.9, col[pick]]);
    }
    const out = { trees, blades };
    this.data.set(key, out);
    if (this.data.size > 400) this.data.delete(this.data.keys().next().value);
    return out;
  }

  update(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), key = `${cx},${cz}`;
    if (key !== this.center) {
      this.center = key;
      this.plan(cx, cz);
      this.scatter(cx, cz);
    }
    for (let i = 0; i < BUILDS_PER_FRAME && this.queue.length; i++) this.build(this.queue.shift());
  }

  // Works out which chunks should exist, nearest first; the far mesh is cut away under them.
  plan(cx, cz) {
    const want = new Map();
    for (let j = -RING; j <= RING; j++) for (let i = -RING; i <= RING; i++) {
      const ring = Math.max(Math.abs(i), Math.abs(j)), step = stepFor(ring);
      want.set(`${cx + i},${cz + j},${step}`, { cx: cx + i, cz: cz + j, step, ring });
    }
    for (const [k, mesh] of this.live) {
      if (want.has(k)) continue;
      mesh.userData.stale = true;
    }
    this.queue = [...want.entries()].filter(([k]) => !this.live.has(k)).map(([k, c]) => ({ k, ...c })).sort((a, b) => a.ring - b.ring);
    shared.uHole.value.set((cx + 0.5) * CHUNK, this.queue.length ? shared.uHole.value.y : (RING + 0.5) * CHUNK - 1, (cz + 0.5) * CHUNK);
  }

  build(c) {
    const mesh = new THREE.Mesh(gridGeometry(c.cx * CHUNK, c.cz * CHUNK, CHUNK, c.step, true), this.mat);
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
      shared.uHole.value.y = (RING + 0.5) * CHUNK - 1;
    }
  }

  // Refill the instanced trees and grass around the new center chunk.
  scatter(cx, cz) {
    const d = new THREE.Object3D(), color = new THREE.Color();
    const counts = [0, 0, 0];
    let b = 0;
    for (let j = -RING; j <= RING; j++) for (let i = -RING; i <= RING; i++) {
      const s = this.spots(cx + i, cz + j);
      s.trees.forEach((list, kind) => {
        for (const [x, y, z, sc, rot] of list) {
          if (counts[kind] >= MAX_TREES) continue;
          d.position.set(x, y - 0.2, z);
          d.rotation.set(0, rot, 0);
          d.scale.set(sc, sc * 1.25, sc);
          d.updateMatrix();
          this.trees[kind].setMatrixAt(counts[kind]++, d.matrix);
        }
      });
      if (Math.max(Math.abs(i), Math.abs(j)) > GRASS_RING) continue;
      for (const [x, y, z, sc, c] of s.blades) {
        d.position.set(x, y, z);
        d.rotation.set(0, x, 0);
        d.scale.set(1, sc, 1);
        d.updateMatrix();
        this.grass.setMatrixAt(b, d.matrix);
        this.grass.setColorAt(b++, color.setRGB(c[0], c[1], c[2]));
      }
    }
    this.trees.forEach((m, k) => {
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
    });
    this.grass.count = b;
    this.grass.instanceMatrix.needsUpdate = true;
    this.grass.instanceColor.needsUpdate = true;
  }

  get pending() {
    return this.queue.length;
  }
}
