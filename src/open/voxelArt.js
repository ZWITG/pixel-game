import * as THREE from 'three';

// Small cube models for the voxel world (FEATURES.voxelWorld): trees, rocks and grass are sets of
// coloured cells, turned into one mesh whose faces are merged wherever neighbouring cubes show the
// same colour on the same plane, so a crown costs a few hundred quads, not thousands.

let seed = 1;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hex = (c) => new THREE.Color(c).toArray();

// cells: Map of "i,j,k" -> [r, g, b]; s: cube size in tiles; card: the centre leaves draw back to.
export function cubeMesh(cells, s, card = [0, 0, 0]) {
  const keys = [...cells.keys()].map((k) => k.split(',').map(Number));
  const lo = [0, 1, 2].map((a) => Math.min(...keys.map((k) => k[a]))), hi = [0, 1, 2].map((a) => Math.max(...keys.map((k) => k[a])));
  const dims = [0, 1, 2].map((a) => hi[a] - lo[a] + 1), palette = [], index = new Map();
  const grid = new Int32Array(dims[0] * dims[1] * dims[2]);
  const at = (p) => p[0] + dims[0] * (p[1] + dims[1] * p[2]);
  for (const [key, col] of cells) {
    const p = key.split(',').map(Number).map((v, a) => v - lo[a]), name = col.map((v) => Math.round(v * 255)).join(',');
    if (!index.has(name)) {
      palette.push(col);
      index.set(name, palette.length);
    }
    grid[at(p)] = index.get(name);
  }
  const get = (p) => (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[0] >= dims[0] || p[1] >= dims[1] || p[2] >= dims[2] ? 0 : grid[at(p)]);
  const pos = [], nor = [], col = [], cardAt = [], idx = [];
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3, mask = new Int32Array(dims[u] * dims[v]);
    for (const dir of [-1, 1]) {
      for (let x = 0; x < dims[d]; x++) {
        const p = [0, 0, 0], q = [0, 0, 0];
        for (let b = 0; b < dims[v]; b++) for (let a = 0; a < dims[u]; a++) {
          p[d] = x; p[u] = a; p[v] = b;
          q[d] = x + dir; q[u] = a; q[v] = b;
          const c = get(p);
          mask[a + b * dims[u]] = c && !get(q) ? c : 0;
        }
        // Merge equal faces into rectangles.
        for (let b = 0; b < dims[v]; b++) for (let a = 0; a < dims[u];) {
          const c = mask[a + b * dims[u]];
          if (!c) {
            a++;
            continue;
          }
          let w = 1, h = 1;
          while (a + w < dims[u] && mask[a + w + b * dims[u]] === c) w++;
          grow: while (b + h < dims[v]) {
            for (let k = 0; k < w; k++) if (mask[a + k + (b + h) * dims[u]] !== c) break grow;
            h++;
          }
          for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) mask[a + k + (b + j) * dims[u]] = 0;
          const plane = (x + (dir > 0 ? 1 : 0) + lo[d]) * s, corner = (da, db) => {
            const out = [0, 0, 0];
            out[d] = plane;
            out[u] = (a + da + lo[u]) * s;
            out[v] = (b + db + lo[v]) * s;
            return out;
          };
          const P = [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)], N = [0, 0, 0];
          N[d] = dir;
          const base = pos.length / 3, colour = palette[c - 1];
          for (const pt of P) {
            pos.push(...pt);
            nor.push(...N);
            col.push(...colour);
            cardAt.push(...card);
          }
          const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
          const facing = (e1[1] * e2[2] - e1[2] * e2[1]) * N[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * N[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * N[2];
          if (facing >= 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
          a += w;
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(cardAt, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const put = (cells, i, j, k, c) => cells.set(`${i},${j},${k}`, c);

// Leaves on 1-tile cubes; the colour comes in broad patches (so faces merge), lighter on top.
const LEAF = 1;
function leafColour(colors, x, y, z, top) {
  const n = Math.sin(x * 1.3 + z * 0.7) + Math.sin(z * 1.1 - y * 0.9) + Math.sin(y * 0.8 + x * 0.4);
  const band = Math.max(0, Math.min(colors.length - 1, Math.floor((n + 3) / 6 * 2.2 + (y / top) * 1.6)));
  return hex(colors[band]);
}

// A pine: a straight trunk and tiers of square boughs, each a little narrower, tips lighter.
function pine(colors) {
  const cells = new Map(), top = 18;
  for (let t = 0; t < 7; t++) {
    const y = 4 + t * 2, r = 4.2 - t * 0.55;
    for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) for (let k = -Math.ceil(r); k <= Math.ceil(r); k++) {
      const d = Math.max(Math.abs(i), Math.abs(k)) * 0.6 + Math.hypot(i, k) * 0.4;
      if (d > r) continue;
      const edge = d > r - 1.1;
      put(cells, i, y, k, hex(colors[edge ? Math.min(3, 2 + (t % 2)) : t < 3 ? 1 : 2]));
      if (!edge) put(cells, i, y + 1, k, hex(colors[t < 3 ? 0 : 1]));
    }
  }
  put(cells, 0, top - 2, 0, hex(colors[2]));
  put(cells, 0, top - 1, 0, hex(colors[3]));
  return cubeMesh(cells, LEAF, [0, 10, 0]);
}

// A broadleaf crown: a heap of round clumps, ragged at the edge.
function broadleaf(colors, s0) {
  seed = s0;
  const cells = new Map(), top = 15, clumps = [[0, 10.5, 0, 3.6]];
  for (let n = 0; n < 5; n++) {
    const a = rand() * 6.28, d = 1.8 + rand() * 1.8;
    clumps.push([Math.cos(a) * d, 8.5 + rand() * 4, Math.sin(a) * d, 2.2 + rand() * 1.2]);
  }
  for (const [cx, cy, cz, r] of clumps) {
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) for (let k = Math.floor(cz - r); k <= Math.ceil(cz + r); k++) {
      const d = Math.hypot(i - cx, (j - cy) * 1.15, k - cz);
      if (d > r || (d > r - 1 && rand() < 0.3)) continue;
      put(cells, i, j, k, leafColour(colors, i, j, k, top));
    }
  }
  return cubeMesh(cells, LEAF, [0, 10, 0]);
}

export function voxelCrown(kind, colors) {
  return kind === 'pine' ? pine(colors) : broadleaf(colors, kind === 'gold' ? 11 : 23);
}

// A trunk of half-tile cubes, two wide, in streaks of bark; broadleaf trunks fork into the crown.
export function voxelTrunk(kind) {
  const bark = kind === 'gold' ? ['#d9d2c4', '#b3a99b', '#7d7468'] : kind === 'crimson' ? ['#7c5140', '#5c3a2c', '#4a2e22'] : ['#6e4a35', '#4e3226', '#3e271d'];
  const cells = new Map(), tall = kind === 'pine' ? 30 : 20;
  seed = kind.length * 7;
  for (let j = 0; j < tall; j++) for (const [i, k] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    put(cells, i, j, k, hex(bark[Math.floor(Math.sin(i * 3.1 + k * 1.7 + Math.floor(j / 3) * 0.9) * 1.4 + 1.4) % 3]));
  }
  // Roots flare at the foot.
  for (const [i, k] of [[-2, -1], [1, 0], [-1, 1], [0, -2]]) put(cells, i, 0, k, hex(bark[1]));
  if (kind !== 'pine') {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1]]) {
      for (let t = 0; t < 5; t++) put(cells, (dx > 0 ? 0 : -1) + dx * (t + 1), tall - 5 + t, (dz > 0 ? 0 : -1) + dz * (t + 1), hex(bark[t % 2]));
    }
  }
  return cubeMesh(cells, 0.5);
}

// A stone: a lump of grey cubes with lichen here and there; scaled per instance.
export function voxelRock() {
  seed = 41;
  const cells = new Map(), greys = ['#b8b0b4', '#a39aa0', '#cdc6c4', '#8f878d'];
  for (let i = -2; i <= 2; i++) for (let j = 0; j <= 2; j++) for (let k = -2; k <= 2; k++) {
    const d = Math.hypot(i * 0.8, j * 1.1, k * 0.8);
    if (d > 2.2 - rand() * 0.5) continue;
    put(cells, i, j, k, hex(j === 2 && rand() < 0.3 ? '#8a9a6a' : greys[Math.floor(rand() * greys.length)]));
  }
  return cubeMesh(cells, 0.4).translate(0, -0.15, 0);
}

// A tuft of grass: a few thin blades as tall narrow cubes, dark at the root, light at the tip.
export function voxelTuft() {
  const pos = [], nor = [], col = [], card = [], idx = [];
  const blade = (x, z, w, h) => {
    const sides = [[[1, 0, 0], x + w, z], [[-1, 0, 0], x - w, z], [[0, 0, 1], x, z + w], [[0, 0, -1], x, z - w]];
    for (const [N] of sides) {
      const base = pos.length / 3, ax = N[2] !== 0 ? 1 : 0, az = N[0] !== 0 ? 1 : 0;
      const cx = x + N[0] * w, cz = z + N[2] * w;
      const P = [[cx - ax * w, 0, cz - az * w], [cx + ax * w, 0, cz + az * w], [cx + ax * w, h, cz + az * w], [cx - ax * w, h, cz - az * w]];
      P.forEach((p, n) => {
        pos.push(...p);
        nor.push(...N);
        const k = n < 2 ? 0.45 : 1;
        col.push(k, k, k * 0.95);
        card.push(0, 0, 0);
      });
      const e1 = [P[1][0] - P[0][0], 0, P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], h, P[2][2] - P[0][2]];
      const facing = (e1[1] * e2[2] - e1[2] * e2[1]) * N[0] + (e1[0] * e2[1] - e1[1] * e2[0]) * N[2];
      if (facing >= 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const base = pos.length / 3;
    for (const [px, pz] of [[x - w, z - w], [x - w, z + w], [x + w, z + w], [x + w, z - w]]) {
      pos.push(px, h, pz);
      nor.push(0, 1, 0);
      col.push(1, 1, 0.95);
      card.push(0, 0, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  blade(-0.12, 0.05, 0.05, 0.62);
  blade(0.1, -0.08, 0.05, 0.48);
  blade(0.02, 0.16, 0.045, 0.36);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 3));
  g.setIndex(idx);
  return g;
}

