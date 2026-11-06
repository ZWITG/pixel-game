import { height, biome, region, roadDistance, forest, dentAt, PLACES, TOWNS, SPAWN } from './terrain.js';
import { streetDistance, plazaAt } from './cityPlan.js';

// Working out what the land looks like: plain numbers, no three.js, so a worker can do it away
// from the frame. Everything comes from the position, so it's the same each visit.
export const CHUNK = 64;
const GRASS_GRID = 12;       // land samples across a chunk when placing grass
const GRASS_TRIES = 6000;
const TORN = 0.25;           // how far pushed down before grass won't grow
const SKIRT = 10;            // tiles the hidden curtain under a chunk's edge hangs down, plus more for coarse ones
const ROAD_FAR = 12;         // anything further than this from a road counts as no road at all
const DRY_TONE = [0.6, 0.42, 0.24];
const SWAMP_TONE = [0.16, 0.27, 0.15];
const FLOWERS = [[0.92, 0.82, 0.3], [0.86, 0.3, 0.26], [0.9, 0.9, 0.92], [0.62, 0.45, 0.85]];
const MEADOW_TONES = [[0.3, 0.42, 0.17], [0.4, 0.46, 0.19], [0.25, 0.38, 0.16]];
const AUTUMN_TONES = [[0.55, 0.32, 0.12], [0.47, 0.25, 0.11]];
const PINE_TONES = [[0.15, 0.29, 0.15], [0.2, 0.34, 0.15]];
const ROCK_TINTS = [[0.69, 0.64, 0.67], [0.6, 0.64, 0.6], [0.66, 0.59, 0.55]], ORE_TINT = [0.75, 0.54, 0.39];
// Trees stay out of these, so landmarks stand in the open.
const CLEARINGS = [{ ...SPAWN, r: 70 }, PLACES.hollow, PLACES.ribs, { x: PLACES.spirit.x, z: PLACES.spirit.z, r: 300 }, ...TOWNS];
// No grass through the paving of cities and village squares.
// Streets of every town are painted like roads (cityPlan.js), and its squares are paved.
const paved = (x, z) => plazaAt(x, z);
const way = (x, z) => Math.min(roadDistance(x, z), streetDistance(x, z));
const rnd = (x, z, k) => {
  const v = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

// One square of land as raw arrays, ready to become a mesh.
export function gridData(x0, z0, size, step, skirt) {
  const n = Math.round(size / step), v = n + 1, count = v * v, w = v + 2;
  const hs = new Float32Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) hs[j * w + i] = height(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const extra = skirt ? v * 4 : 0, total = count + extra;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), bio = new Float32Array(total * 3);
  const road = new Float32Array(total), land = new Float32Array(total * 2), deep = new Float32Array(count);
  let wet = false;
  const put = (k, i, j, y) => {
    const x = x0 + i * step, z = z0 + j * step, a = (j + 1) * w + i + 1;
    const nx = hs[a - 1] - hs[a + 1], nz = hs[a - w] - hs[a + w], ny = 2 * step, l = Math.hypot(nx, ny, nz);
    const b = biome(x, z), r = region(x, z);
    pos[k * 3] = x;
    pos[k * 3 + 1] = y ?? hs[a];
    pos[k * 3 + 2] = z;
    nor[k * 3] = nx / l;
    nor[k * 3 + 1] = ny / l;
    nor[k * 3 + 2] = nz / l;
    bio[k * 3] = b[0];
    bio[k * 3 + 1] = b[1];
    bio[k * 3 + 2] = b[2];
    land[k * 2] = r[0];
    land[k * 2 + 1] = r[1];
    road[k] = step <= 8 ? Math.min(ROAD_FAR, way(x, z)) : ROAD_FAR;
  };
  for (let j = 0; j < v; j++) for (let i = 0; i < v; i++) {
    const k = j * v + i;
    put(k, i, j);
    deep[k] = -pos[k * 3 + 1];
    if (deep[k] > -1.5) wet = true;
  }
  const idx = new Uint32Array(n * n * 6 + (skirt ? n * 24 : 0));
  let t = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * v + i;
    idx[t++] = a; idx[t++] = a + v; idx[t++] = a + 1;
    idx[t++] = a + 1; idx[t++] = a + v; idx[t++] = a + v + 1;
  }
  const faces = t;
  if (skirt) {
    // A short curtain around the edge hides cracks where detail levels meet.
    let k = count;
    const edge = (fn, flip) => {
      const start = k;
      for (let e = 0; e < v; e++) {
        const [i, j] = fn(e);
        put(k++, i, j, hs[(j + 1) * w + i + 1] - SKIRT - step * 4);
      }
      for (let e = 0; e < n; e++) {
        const [i, j] = fn(e), [i2, j2] = fn(e + 1);
        const a = j * v + i, b = j2 * v + i2, c = start + e, d = start + e + 1;
        if (flip) { idx[t++] = a; idx[t++] = b; idx[t++] = c; idx[t++] = b; idx[t++] = d; idx[t++] = c; }
        else { idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d; }
      }
    };
    edge((e) => [e, 0], true);
    edge((e) => [e, n], false);
    edge((e) => [0, e], false);
    edge((e) => [n, e], true);
  }
  return { pos, nor, bio, road, land, idx, deep, wet, faces };
}

// The steepest rise or drop a step away from a point, so nothing is placed on a cliff face.
const tilt = (x, z, y) => Math.max(Math.abs(height(x + 2, z) - y), Math.abs(height(x - 2, z) - y), Math.abs(height(x, z + 2) - y), Math.abs(height(x, z - 2) - y));

// What grows in one chunk.
export function spotsData(cx, cz) {
  const trees = [[], [], []], rocks = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let i = 0; i < 150; i++) {
    const x = x0 + rnd(cx, cz, i) * CHUNK, z = z0 + rnd(cx, cz, i + 500) * CHUNK;
    const [bad, marsh] = region(x, z);
    if (rnd(cx, cz, i + 900) > forest(x, z) * (1 - bad * 0.96) * (1 - marsh * 0.25) || CLEARINGS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
    const y = height(x, z);
    if (y < (marsh > 0.5 ? 0.6 : 3) || y > 300 || tilt(x, z, y) > 2.2 || roadDistance(x, z) < 9) continue;
    const [m, a] = biome(x, z);
    const roll = rnd(cx, cz, i + 1300);
    // Old giants stand here and there among the rest; the swamp is all dark pine.
    const kind = marsh > 0.5 ? 0 : roll < a ? 1 : roll < a + m * 0.6 ? 2 : 0, giant = rnd(cx, cz, i + 1900) > 0.97 ? 1.7 : 1, sc = (0.8 + rnd(cx, cz, i + 1700) * 0.8) * giant;
    trees[kind].push({ id: `t${cx},${cz},${i}`, type: 'tree', kind, x, y, z, sc, rot: rnd(cx, cz, i + 2100) * 6.28, r: 0.5 * sc, shade: 0.82 + rnd(cx, cz, i + 2500) * 0.3 });
  }
  // Stones gather in fields, thickest in the badlands, rather than lying evenly everywhere.
  for (let i = 0; i < 26; i++) {
    const x = x0 + rnd(cx, cz, i + 20000) * CHUNK, z = z0 + rnd(cx, cz, i + 20500) * CHUNK;
    const stony = Math.max(0.12, 0.2 + forest(z + 500, x - 300) * 0.5 + region(x, z)[0] * 0.5);
    if (rnd(cx, cz, i + 21000) > stony || CLEARINGS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
    const y = height(x, z);
    if (y < 1 || y > 300 || tilt(x, z, y) > 3 || roadDistance(x, z) < 7) continue;
    const roll = rnd(cx, cz, i + 21500), size = roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
    const sc = [0.5, 1.2, 3][size] + rnd(cx, cz, i + 22000) * [0.4, 0.8, 1.2][size];
    rocks.push({ id: `r${cx},${cz},${i}`, type: 'rock', size, x, y, z, sc, rot: rnd(cx, cz, i + 22500) * 6.28, r: 0.85 * sc, tint: size === 2 ? ORE_TINT : ROCK_TINTS[i % 3] });
  }
  return { trees, rocks };
}

// Grass for one chunk, as ready-made instance data. A coarse grid of the land stands in for
// thousands of exact height lookups.
export function grassData(cx, cz) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK, n = GRASS_GRID + 1, cell = CHUNK / GRASS_GRID;
  const ys = new Float32Array(n * n), bare = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * cell, z = z0 + j * cell;
    ys[j * n + i] = height(x, z);
    bare[j * n + i] = way(x, z) < 5 || paved(x, z) ? 1 : 0;
  }
  const tones = [];
  for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) tones.push([...biome(x0 + (i * CHUNK) / 2, z0 + (j * CHUNK) / 2), ...region(x0 + (i * CHUNK) / 2, z0 + (j * CHUNK) / 2)]);
  const mats = new Float32Array(GRASS_TRIES * 16), cols = new Float32Array(GRASS_TRIES * 3);
  let b = 0;
  for (let i = 0; i < GRASS_TRIES; i++) {
    const u = rnd(cx, cz, i + 3000), v = rnd(cx, cz, i + 7000), r = rnd(cx, cz, i + 11000);
    if (r < 0.12) continue;
    const gx = u * GRASS_GRID, gz = v * GRASS_GRID, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const k = iz * n + ix, h00 = ys[k], h10 = ys[k + 1], h01 = ys[k + n], h11 = ys[k + n + 1];
    if (bare[k] || bare[k + 1] || bare[k + n] || bare[k + n + 1]) continue;
    const y = h00 + (h10 - h00) * fx + (h01 - h00) * fz + (h00 - h10 - h01 + h11) * fx * fz;
    if (y < 2.5 || y > 280 || Math.abs(h10 - h00) > cell * 0.8 || Math.abs(h01 - h00) > cell * 0.8) continue;
    const [m, a, p, bad, marsh] = tones[Math.round(v * 2) * 3 + Math.round(u * 2)];
    if (r < 0.2 + bad * 0.7) continue; // little grows in the badlands
    const pick = Math.floor(r * 997) % 3, patches = Math.sin(x0 + u * 41 + v * 67) > 0.2;
    const list = p > m && p > a ? PINE_TONES : a > m ? AUTUMN_TONES : MEADOW_TONES;
    const c = bad > 0.5 ? DRY_TONE : marsh > 0.5 ? SWAMP_TONE : r > 0.975 && patches && list === MEADOW_TONES ? FLOWERS[i % 4] : list[pick % list.length];
    const sc = 0.8 + r * 0.8, x = x0 + u * CHUNK, z = z0 + v * CHUNK;
    if (dentAt(x, z) > TORN) continue; // broken ground stays bare
    const co = Math.cos(x) * sc, si = Math.sin(x) * sc, b16 = b * 16;
    mats[b16] = co; mats[b16 + 2] = -si; mats[b16 + 5] = sc; mats[b16 + 8] = si; mats[b16 + 10] = co;
    mats[b16 + 12] = x; mats[b16 + 13] = y; mats[b16 + 14] = z; mats[b16 + 15] = 1;
    cols[b * 3] = c[0]; cols[b * 3 + 1] = c[1]; cols[b * 3 + 2] = c[2];
    b++;
  }
  return { mats: mats.slice(0, b * 16), cols: cols.slice(0, b * 3), count: b };
}
