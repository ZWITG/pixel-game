import * as THREE from 'three';
import { height, biome, noise } from './terrain.js';
import { shared } from './materials.js';
import { MATERIALS } from './voxels.js';

// Ground you can dig. The land stays a smooth heightmap everywhere, until a heavy blow lands or
// a hero punches into a hillside: then that patch of land becomes voxels built from its layers
// (turf, topsoil, clay, stone with veins of iron, deep rock), the smooth ground is cut away over
// it, and blows dig pits and tunnels. Each layer only spans so far without support, so a tunnel
// dug too wide brings its roof down. Patches live near the heroes; what was dug is kept as a short
// list of cuts and dug again when a hero comes back. See docs/world-upgrade-plan.md, phase 2b.
const S = 0.5, HALF = 16, DEPTH = 10;   // tiles: voxel size, half a patch, how far down it goes
const MOST = 6, FORGET = 260, SAVE_KEY = 'lumen.digs', MOST_CUTS = 240;
const HILLSIDE = 1.1;
const KEEP_FLOOR = 2.5, SEA_FLOOR = 1.5;  // tiles of rock always left under a pit, and the lowest a pit may go                    // a blow this far below the land in front is a dig into it
const ORE_PER_IRON = 10, ROCK_PER_STONE = 26;
// The land's own materials, after the structural ones in voxels.js.
const TURF = 9, SOIL = 10, CLAY = 11, ROCK = 12, ORE = 13, DEEP = 14;
MATERIALS[TURF] = { name: 'turf', strength: 0.35, reach: 3, dust: '#6a8a3a' };
MATERIALS[SOIL] = { name: 'soil', strength: 0.4, reach: 3, dust: '#8a6a4a' };
MATERIALS[CLAY] = { name: 'clay', strength: 0.55, reach: 4, dust: '#a8704a' };
MATERIALS[ROCK] = { name: 'rock', strength: 1, reach: 7, dust: '#9a948e' };
MATERIALS[ORE] = { name: 'iron ore', strength: 1.2, reach: 7, dust: '#b07a50' };
MATERIALS[DEEP] = { name: 'deep rock', strength: 1.5, reach: 9, dust: '#5a5660' };

const rgb = (r, g, b) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
const vary = (c, k) => rgb(((c >> 16) & 255) * k, ((c >> 8) & 255) * k, (c & 255) * k);

// The top of the land in the colours the smooth ground has there (materials.js terrain shader):
// meadow, autumn and pine blended by biome, pale sand by the shore, grey rock on steep slopes.
function turf(x, z, top, steep) {
  const [m, a, p] = biome(x, z), lin = (r, g, b) => [r * 255, g * 255, b * 255];
  let c = [0, 1, 2].map((i) => lin(0.29, 0.385, 0.115)[i] * m + lin(0.46, 0.27, 0.115)[i] * a + lin(0.13, 0.245, 0.135)[i] * p);
  const sand = 1 - Math.min(1, Math.max(0, (top - 0.6) / 1.1));
  c = c.map((v, i) => v + (lin(0.72, 0.65, 0.48)[i] - v) * sand);
  const rocky = Math.min(1, Math.max(0, (steep - 0.2) / 0.16));
  return c.map((v, i) => v + (lin(0.43, 0.41, 0.4)[i] - v) * rocky);
}

// One column of land as layers, top down: what each depth is made of, and its colour.
function layer(x, y, z, top, steep) {
  const d = top - y, n = noise(x * 0.11 + y * 0.07, z * 0.11 - y * 0.05), k = 0.9 + n * 0.12;
  if (d < 0.6) return [TURF, vary(rgb(...turf(x, z, top, steep)), k)];
  if (d < 2.6) return [SOIL, vary(rgb(110, 80, 56), k)];
  if (d < 5 + n * 1.5) return [CLAY, vary(rgb(150, 100, 70), k)];
  if (noise(x * 0.17 + 40, y * 0.2 + z * 0.17) > 0.42) return [ORE, vary(rgb(176, 112, 74), k)];
  if (d > 11) return [DEEP, vary(rgb(84, 80, 92), k)];
  return [ROCK, vary(rgb(150, 146, 140), k)];
}

export default class Digs {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.saved = [];
    try {
      this.saved = JSON.parse(localStorage.getItem(SAVE_KEY)) ?? [];
    } catch { /* nothing dug yet */ }
    this.v = new THREE.Vector3();
    shared.uDigs.value = Array.from({ length: MOST }, () => new THREE.Vector4(0, 0, 0, 0));
    world.voxels.onCarve = (entry, out, hero) => this.yield(entry, out, hero);
  }

  get voxels() {
    return this.world.voxels;
  }

  at(x, z) {
    return this.list.find((p) => Math.abs(x - p.x) < HALF && Math.abs(z - p.z) < HALF) ?? null;
  }

  // Turns a patch of land into voxels, its middle on a grid so patches meet edge to edge.
  make(x, z) {
    const cx = Math.round(x / (HALF * 2)) * HALF * 2, cz = Math.round(z / (HALF * 2)) * HALF * 2;
    if (this.at(cx, cz) || height(cx, cz) < 3) return this.at(cx, cz);
    const n = Math.round((HALF * 2) / S), tops = new Float32Array(n * n);
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
      const h = height(cx - HALF + (i + 0.5) * S, cz - HALF + (k + 0.5) * S);
      tops[i + n * k] = h;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    const oy = Math.floor(lo - DEPTH), ny = Math.ceil((hi - oy) / S) + 1, mat = new Uint8Array(n * ny * n), col = new Uint32Array(n * ny * n);
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
      const top = tops[i + n * k], wx = cx - HALF + (i + 0.5) * S, wz = cz - HALF + (k + 0.5) * S;
      const dx = (tops[Math.min(n - 1, i + 1) + n * k] - tops[Math.max(0, i - 1) + n * k]) / (2 * S), dz = (tops[i + n * Math.min(n - 1, k + 1)] - tops[i + n * Math.max(0, k - 1)]) / (2 * S);
      const steep = 1 - 1 / Math.hypot(dx, 1, dz);
      for (let j = 0; j < ny; j++) {
        const y = oy + (j + 0.5) * S;
        if (y > top) break;
        const [m, c] = layer(wx, y, wz, top, steep), at = i + n * (j + ny * k);
        mat[at] = m;
        col[at] = c;
      }
    }
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    this.world.scene.add(group);
    const p = { x: cx, z: cz, group, cuts: [], dig: true, solid: null, tops, mask: new Uint8Array(n * n) };
    this.list.push(p);
    this.voxels.take(p, group, { nx: n, ny, nz: n, s: S, ox: -HALF, oy, oz: -HALF, mat, col, plain: true }, () => this.open(p));
    // Dig again whatever was dug here before.
    const old = this.saved.find((q) => q.x === cx && q.z === cz);
    if (old) {
      for (const [ax, ay, az, r] of old.cuts) p.vox.vol.carve(ax - cx, ay, az - cz, r);
      for (const [ax, ay, az, r] of old.cuts) {
        const [i, j, k] = p.vox.vol.cell(ax - cx, ay, az - cz);
        for (const at of p.vox.vol.unsupported(p.vox.vol.around(i, j, k, Math.ceil(r / Math.sqrt(MATERIALS[1].strength) / S) + 1))) p.vox.vol.mat[at] = 0;
      }
      p.cuts = old.cuts.slice();
      this.voxels.remesh(p.vox);
    }
    this.forgetFar();
    return p;
  }

  // Once its voxels are drawn: cut the smooth ground and grass away over it, and clear its trees.
  open(p) {
    p.ready = true;
    const waiting = p.pending ?? [];
    p.pending = null;
    for (const [x, , z, r] of p.cuts) this.bare(p, x, z, r);
    for (const [x, y, z, r, hero, deep] of waiting) this.blast(x, y, z, r, hero, deep);
    this.holes();
  }

  // Tell the shaders where the patches are, and where in each the surface was dug away.
  holes() {
    const v = shared.uDigs.value, ready = this.list.filter((q) => q.ready), tex = shared.uDigMask.value, side = Math.round((HALF * 2) / S);
    v.forEach((h, i) => {
      const p = ready[i];
      h.set(p ? p.x : 0, p ? p.z : 0, p ? HALF : 0, 0);
      tex.image.data.set(p ? p.mask : new Uint8Array(side * side), i * side * side);
    });
    tex.needsUpdate = true;
  }

  // After a cut: which columns lost their top (their grass goes), and the trees rooted there fall.
  bare(p, x, z, r) {
    const vol = p.vox.vol, n = vol.nx, reach = r / Math.sqrt(MATERIALS[1].strength) + S + vol.most * S; // and what fell in around it
    const i0 = Math.max(0, Math.floor((x - reach - p.x - vol.ox) / S)), i1 = Math.min(n - 1, Math.floor((x + reach - p.x - vol.ox) / S));
    const k0 = Math.max(0, Math.floor((z - reach - p.z - vol.oz) / S)), k1 = Math.min(n - 1, Math.floor((z + reach - p.z - vol.oz) / S));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      let j = vol.ny - 1;
      while (j >= 0 && !vol.solid(i, j, k)) j--;
      if (vol.oy + (j + 1) * S < p.tops[i + n * k] - 0.35) p.mask[i + n * k] = 255;
    }
    for (const o of this.world.chunks.near(x, z, reach + 2)) {
      if (o.type !== 'tree') continue;
      const i = Math.floor((o.x - p.x - vol.ox) / S), k = Math.floor((o.z - p.z - vol.oz) / S);
      if (i >= 0 && k >= 0 && i < n && k < n && p.mask[i + n * k]) this.world.chunks.remove(o, Date.now() + 3e10);
    }
  }

  forgetFar() {
    const { players } = this.world;
    while (this.list.length > MOST) {
      const far = this.list.map((p) => [p, players.reduce((m, h) => Math.min(m, Math.hypot(h.state.x - p.x, h.state.z - p.z)), 1e9)]).sort((a, b) => b[1] - a[1])[0][0];
      this.drop(far);
    }
  }

  drop(p) {
    this.world.scene.remove(p.group);
    this.voxels.forget(p);
    this.list.splice(this.list.indexOf(p), 1);
    this.holes();
  }

  // A blow: dig if it lands in a patch, comes down hard enough to dig, or is driven into a hillside.
  blast(x, y, z, r, hero, deep) {
    const feet = hero.state.y + hero.state.air, ground = height(x, z);
    let p = this.at(x, z);
    const into = ground > feet + HILLSIDE, down = deep > 0;
    if (!p && !into && !down) return false;
    p ??= this.make(x, z);
    if (!p) return false;
    // A patch still being built: the blow lands as soon as it's ready.
    if (!p.vox?.ready) {
      (p.pending ??= []).push([x, y, z, r, hero, deep]);
      return true;
    }
    const cut = down ? Math.max(r, deep * 0.9) : r;
    // Never through the bottom of the patch, nor below the water: a pit always keeps a floor of rock.
    const lowest = Math.max(p.vox.vol.oy + KEEP_FLOOR, SEA_FLOOR) + cut;
    const cy = Math.max(lowest, down ? Math.min(y, ground - r * 0.25) : y);
    if (this.voxels.hit(p, x, cy, z, cut, hero)) {
      this.bare(p, x, z, cut);
      this.holes();
      p.cuts.push([Math.round(x * 10) / 10, Math.round(cy * 10) / 10, Math.round(z * 10) / 10, Math.round(cut * 10) / 10]);
      if (p.cuts.length > MOST_CUTS) p.cuts.shift();
      this.save(p);
    }
    return true;
  }

  // Iron for every few cubes of ore dug out, stone for the rock; digging is mining.
  yield(entry, out, hero) {
    if (!entry.owner.dig || !hero?.bag) return;
    const ore = out.filter((o) => o[4] === ORE).length, rock = out.filter((o) => o[4] === ROCK || o[4] === DEEP).length;
    entry.owner.ore = (entry.owner.ore ?? 0) + ore;
    entry.owner.rock = (entry.owner.rock ?? 0) + rock;
    const iron = Math.floor(entry.owner.ore / ORE_PER_IRON), stone = Math.floor(entry.owner.rock / ROCK_PER_STONE);
    entry.owner.ore -= iron * ORE_PER_IRON;
    entry.owner.rock -= stone * ROCK_PER_STONE;
    if (iron) hero.bag.add('iron', iron);
    if (stone) hero.bag.add('stone', stone);
    if (ore + rock) hero.skills.add('mining', (ore + rock) * 0.02);
  }

  save(p) {
    const at = this.saved.find((q) => q.x === p.x && q.z === p.z);
    if (at) at.cuts = p.cuts;
    else this.saved.push({ x: p.x, z: p.z, cuts: p.cuts });
    clearTimeout(this.saving);
    this.saving = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.saved));
      } catch { /* the digging lasts for this visit */ }
    }, 1500);
  }

  // The ground under a point inside a patch: the top of the voxels below `y`, or the patch's floor.
  // Null outside every patch, where the heightmap is the ground.
  floor(x, z, y) {
    const p = this.at(x, z);
    if (!p?.ready) return null;
    const vol = p.vox.vol, i = Math.floor((x - p.x - vol.ox) / S), k = Math.floor((z - p.z - vol.oz) / S);
    for (let j = Math.min(vol.ny - 1, Math.floor((y + 1.1 - vol.oy) / S)); j >= 0; j--) {
      if (vol.solid(i, j, k)) return vol.oy + (j + 1) * S;
    }
    return vol.oy;
  }

  // Patches come back as a hero nears where something was dug, and go as they leave.
  update(dt) {
    if ((this.wait = (this.wait ?? 0) - dt) > 0) return;
    this.wait = 0.5;
    const { players } = this.world;
    for (const q of this.saved) {
      if (this.at(q.x, q.z)) continue;
      if (players.some((h) => Math.hypot(h.state.x - q.x, h.state.z - q.z) < FORGET * 0.6)) this.make(q.x, q.z);
    }
    for (const p of [...this.list]) {
      if (!players.some((h) => Math.hypot(h.state.x - p.x, h.state.z - p.z) < FORGET)) this.drop(p);
    }
  }
}
