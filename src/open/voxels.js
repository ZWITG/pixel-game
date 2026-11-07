import * as THREE from 'three';
import { height } from './terrain.js';
import { houseVoxels } from './blueprints.js';
import { nationAt } from './nations.js';
import { TOWNS } from './terrain.js';

// Breakable structures in the manner of Teardown: built from cubes of real materials that a blow
// cuts exactly where it lands. After each cut the structure checks what still holds it up
// (7 Days to Die's rule: support runs straight down without limit, but each material only
// reaches so far sideways), and whatever is left hanging falls as solid chunks that tumble,
// bounce, crush what's under them and settle as rubble. Built from the toon models by the
// worker (voxelWorker.js), so every kit-built structure can become voxels.
// See docs/world-upgrade-plan.md, section 3.
const S = 0.5;                       // tiles across one voxel
// Materials, by id from voxelWorker.js. strength: how hard a blow must be (stone 1). reach: voxels
// a material can hold out sideways from support. burns: fire eats it.
export const MATERIALS = [
  null,
  { name: 'thatch', strength: 0.3, reach: 4, burns: true, dust: '#d8b060' },
  { name: 'wood', strength: 0.5, reach: 10, burns: true, dust: '#8a6040' },
  { name: 'plaster', strength: 0.55, reach: 4, dust: '#efe6d6' },
  { name: 'tile', strength: 0.6, reach: 5, dust: '#b06048' },
  { name: 'stone', strength: 1, reach: 6, dust: '#c9bcc4' },
  { name: 'glass', strength: 0.12, reach: 2, dust: '#dff4ff' },
  { name: 'iron', strength: 2.2, reach: 14, dust: '#6a6a74' },
  { name: 'glow', strength: 0.3, reach: 3, dust: '#ffcd75' },
];
const GRAVITY = 32, REST_SPEED = 0.7, REST_SECS = 0.5, SHATTER_SPEED = 10;
const MOST_CHUNKS = 70, MOST_BITS = 600, BIT = 0.24, BIT_LIFE = 2.6;
const CRUSH = 0.03;                  // of a hero's might per voxel, to whatever a falling chunk lands on
const STEP_UP = 1.1;                 // tiles a hero can step up onto rubble or a ledge
const BODY = [0.5, 1.4, 2.3];        // heights at which a hero's body meets walls
const PIECE = 7;                     // voxels across a piece when a whole structure comes down
const MESHES_PER_FRAME = 4;
const BIG = 60000, WINDOW = 12;     // cells past which a volume checks support only near a cut, and how far round it
const SECTOR_NEAR = 330, SECTOR_FAR = 480, STONE_VOXEL = 1; // city walls and castles: tiles, and their coarser voxels
const HOUSE_NEAR = 170, HOUSE_FAR = 240, MOST_HOUSES = 36, HOUSE_CHECK = 0.5; // tiles; houses become voxels near a hero

const offsets = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
let REACH_OF = null;

// The voxels of one structure, in its own frame (the group it hangs on).
class Volume {
  constructor(v) {
    Object.assign(this, v);
    this.full = v.mat.slice();
    this.fullCol = v.col.slice();
    this.total = this.count();
    // How far each voxel already reaches from support as built: a wide floor that stands when
    // whole stands, and only falls once what held it is broken.
    this.budget = v.plain ? new Uint8Array(this.mat.length) : this.reach(null);
    // Land (plain): the furthest any of its materials reaches sideways.
    if (v.plain) {
      const seen = new Set(this.mat);
      this.most = Math.max(1, ...[...seen].filter(Boolean).map((m) => MATERIALS[m].reach));
    }
  }

  count() {
    let n = 0;
    for (let i = 0; i < this.mat.length; i++) if (this.mat[i]) n++;
    return n;
  }

  reset() {
    this.mat.set(this.full);
    this.col.set(this.fullCol);
  }

  at(i, j, k) {
    return i + this.nx * (j + this.ny * k);
  }

  cell(x, y, z) {
    const s = this.s;
    return [Math.floor((x - this.ox) / s), Math.floor((y - this.oy) / s), Math.floor((z - this.oz) / s)];
  }

  centre(i, j, k) {
    const s = this.s;
    return [this.ox + (i + 0.5) * s, this.oy + (j + 0.5) * s, this.oz + (k + 0.5) * s];
  }

  solid(i, j, k) {
    return i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz && this.mat[this.at(i, j, k)] !== 0;
  }

  // Takes out everything a blow of this radius breaks: weaker materials over a wider sphere.
  // `only`: a test on the material, for fire that eats only what burns. `low`: nothing below this
  // (local) height is cut. Returns what came out.
  carve(x, y, z, r, only, low = -Infinity) {
    const out = [], reach = r / Math.sqrt(MATERIALS[1].strength);
    const [ci, cj, ck] = this.cell(x, y, z), span = Math.ceil(reach / this.s) + 1;
    for (let k = Math.max(0, ck - span); k <= Math.min(this.nz - 1, ck + span); k++) {
      for (let j = Math.max(0, cj - span); j <= Math.min(this.ny - 1, cj + span); j++) {
        for (let i = Math.max(0, ci - span); i <= Math.min(this.nx - 1, ci + span); i++) {
          const at = this.at(i, j, k), m = this.mat[at];
          if (!m || (only && !only(MATERIALS[m]))) continue;
          const [px, py, pz] = this.centre(i, j, k), d = Math.hypot(px - x, py - y, pz - z);
          if (py < low) continue;
          // A rough edge: some voxels at the rim survive, so holes look torn, not stamped.
          if (d > r / Math.sqrt(MATERIALS[m].strength) * (0.85 + ((i * 7 + j * 13 + k * 5) % 10) * 0.03)) continue;
          out.push([px, py, pz, this.col[at], m]);
          this.mat[at] = 0;
        }
      }
    }
    return out;
  }

  // What still stands: support flows up from the ground for free, and out sideways (or down)
  // one voxel at a time, as far as each material can reach. A 0-1 breadth-first search.
  // `win`: cell bounds { i0, i1, j0, j1, k0, k1 } to look within, for big volumes: what's on the
  // window's edges counts as held, as a collapse only ever involves what's near the hole.
  unsupported(win) {
    const best = this.reach(this.budget, win), loose = [];
    if (win) {
      const w = win.inner ?? win;
      for (let k = w.k0; k <= w.k1; k++) for (let j = w.j0; j <= w.j1; j++) for (let i = w.i0; i <= w.i1; i++) {
        const at = this.at(i, j, k);
        if (this.mat[at] && best[at] === 255) loose.push(at);
      }
      return loose;
    }
    for (let i = 0; i < best.length; i++) if (this.mat[i] && best[i] === 255) loose.push(i);
    return loose;
  }

  window(i, j, k, span) {
    if (this.plain) return this.around(i, j, k, span);
    return { i0: Math.max(0, i - span), i1: Math.min(this.nx - 1, i + span), j0: Math.max(0, j - span), j1: Math.min(this.ny - 1, j + span), k0: Math.max(0, k - span), k1: Math.min(this.nz - 1, k + span) };
  }

  // Land: support never travels further sideways (or down) than its furthest-reaching material,
  // so a cut can loosen only what lies that near it, and what holds those lies that much further
  // out. Worked out from that far below the cut to the sky, its sides held by nothing; land
  // deeper down can't be loosened by it, so the bottom of the box holds.
  around(i, j, k, span) {
    const box = (d) => ({ i0: Math.max(0, i - d), i1: Math.min(this.nx - 1, i + d), j0: Math.max(0, j - span - this.most), j1: this.ny - 1, k0: Math.max(0, k - d), k1: Math.min(this.nz - 1, k + d) });
    return { ...box(span + 2 * this.most), open: true, inner: box(span + this.most) };
  }

  // Each voxel's distance from support; `budget` lets one reach as far as it did when built.
  // Worked out level by level: going up costs nothing, so it stays in the level it came from.
  reach(budget, win) {
    const { nx, ny, nz, mat } = this, n = mat.length;
    this.bestBuf ??= new Uint8Array(n); // kept between blows, so a castle's punch allocates nothing big
    const best = budget ? this.bestBuf : new Uint8Array(n);
    const w = win ?? { i0: 0, i1: nx - 1, j0: 0, j1: ny - 1, k0: 0, k1: nz - 1 };
    let level = [], next = [];
    const ground = Math.max(0, Math.floor((0.6 - this.oy) / this.s));
    for (let k = w.k0; k <= w.k1; k++) for (let j = w.j0; j <= w.j1; j++) for (let i = w.i0; i <= w.i1; i++) {
      const at = this.at(i, j, k);
      best[at] = 255;
      // Held: the ground layer, and, in a window, everything on its edge.
      const edge = win && (win.open ? j === w.j0 : i === w.i0 || i === w.i1 || k === w.k0 || k === w.k1 || j === w.j0 || j === w.j1);
      if (mat[at] && (j <= ground || edge)) {
        best[at] = 0;
        level.push(at);
      }
    }
    // How far each material reaches, looked up once.
    if (REACH_OF?.n !== MATERIALS.length) {
      REACH_OF = Uint8Array.from({ length: 256 }, (_, m) => MATERIALS[m]?.reach ?? 0);
      REACH_OF.n = MATERIALS.length;
    }
    const far = REACH_OF;
    const layer = nx * ny;
    let h = 0;
    const go = (to, nh) => {
      const m = mat[to];
      if (!m || nh >= best[to] || nh > (budget ? Math.max(far[m], budget[to]) : 250)) return;
      best[to] = nh;
      (nh === h ? level : next).push(to);
    };
    for (; level.length; h++) {
      for (let q = 0; q < level.length; q++) {
        const at = level[q];
        if (best[at] !== h) continue;
        const k = (at / layer) | 0, rest = at - k * layer, j = (rest / nx) | 0, i = rest - j * nx, up = h + 1;
        if (j < w.j1) go(at + nx, h);
        if (i > w.i0) go(at - 1, up);
        if (i < w.i1) go(at + 1, up);
        if (j > w.j0) go(at - nx, up);
        if (k > w.k0) go(at - layer, up);
        if (k < w.k1) go(at + layer, up);
      }
      level = next;
      next = [];
    }
    return best;
  }

  // Groups loose voxels into the separate pieces they fall as.
  pieces(list, size = 0) {
    const inList = new Uint8Array(this.mat.length), seen = new Uint8Array(this.mat.length), out = [];
    for (const at of list) inList[at] = 1;
    for (const start of list) {
      if (seen[start]) continue;
      const piece = [], stack = [start];
      seen[start] = 1;
      const si = start % this.nx, sj = Math.floor(start / this.nx) % this.ny, sk = Math.floor(start / (this.nx * this.ny));
      while (stack.length) {
        const at = stack.pop(), i = at % this.nx, j = Math.floor(at / this.nx) % this.ny, k = Math.floor(at / (this.nx * this.ny));
        piece.push(at);
        for (const [di, dj, dk] of offsets) {
          const a = i + di, b = j + dj, c = k + dk;
          if (a < 0 || b < 0 || c < 0 || a >= this.nx || b >= this.ny || c >= this.nz) continue;
          // When a whole structure comes down, it breaks into blocks rather than one slab.
          if (size && (Math.floor(a / size) !== Math.floor(si / size) || Math.floor(b / size) !== Math.floor(sj / size) || Math.floor(c / size) !== Math.floor(sk / size))) continue;
          const to = this.at(a, b, c);
          if (inList[to] && !seen[to]) {
            seen[to] = 1;
            stack.push(to);
          }
        }
      }
      out.push(piece);
    }
    return out;
  }

  // A piece lifted out into a volume of its own.
  lift(piece) {
    let i0 = Infinity, j0 = Infinity, k0 = Infinity, i1 = -1, j1 = -1, k1 = -1;
    for (const at of piece) {
      const i = at % this.nx, j = Math.floor(at / this.nx) % this.ny, k = Math.floor(at / (this.nx * this.ny));
      i0 = Math.min(i0, i); j0 = Math.min(j0, j); k0 = Math.min(k0, k);
      i1 = Math.max(i1, i); j1 = Math.max(j1, j); k1 = Math.max(k1, k);
    }
    const nx = i1 - i0 + 1, ny = j1 - j0 + 1, nz = k1 - k0 + 1, mat = new Uint8Array(nx * ny * nz), col = new Uint32Array(nx * ny * nz);
    let cx = 0, cy = 0, cz = 0;
    for (const at of piece) {
      const i = at % this.nx, j = Math.floor(at / this.nx) % this.ny, k = Math.floor(at / (this.nx * this.ny)), to = (i - i0) + nx * ((j - j0) + ny * (k - k0));
      mat[to] = this.mat[at];
      col[to] = this.col[at];
      this.mat[at] = 0;
      const [x, y, z] = this.centre(i, j, k);
      cx += x; cy += y; cz += z;
    }
    const n = piece.length;
    const s = this.s;
    return { v: { nx, ny, nz, s, ox: this.ox + i0 * s, oy: this.oy + j0 * s, oz: this.oz + k0 * s, mat, col }, centre: [cx / n, cy / n, cz / n], count: n };
  }

  data() {
    const { nx, ny, nz, s, ox, oy, oz, mat, col } = this;
    return { nx, ny, nz, s, ox, oy, oz, mat: mat.slice(), col: col.slice() };
  }
}

export default class Voxels {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
    this.worker = new Worker(new URL('./voxelWorker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => this.reply(data);
    this.waiting = new Map();   // id -> what asked
    this.next = 1;
    this.list = [];             // standing structures: { vol, mesh, group, owner, dirty, stamp }
    this.chunks = [];
    this.queue = [];
    this.bits = new THREE.InstancedMesh(new THREE.BoxGeometry(BIT, BIT, BIT), new THREE.MeshStandardMaterial({ roughness: 0.9 }), MOST_BITS);
    this.bits.count = 0;
    this.bits.frustumCulled = false;
    this.bits.castShadow = true;
    scene.add(this.bits);
    this.flying = [];
    this.towns = TOWNS; // for debugging: the walled places this works on
    // Draw one of each kind far under the ground from the start, so their shaders are ready
    // before the first wall comes down (the first collapse otherwise stalls a quarter second).
    const warm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.material);
    warm.castShadow = true;
    warm.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(warm.geometry.attributes.position.count * 3).fill(1), 3));
    warm.position.set(0, -900, 0);
    warm.frustumCulled = false;
    scene.add(warm);
    this.bits.count = 1;
    this.bits.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, -900, 0));
    this.bits.setColorAt(0, new THREE.Color('#ffffff'));
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
  }

  // ---- making them ----
  // Hands a kit-built model over: it stays as it is until its voxels are ready, then they replace it.
  // `size`: tiles across a voxel; big stonework uses coarser ones.
  adopt(owner, group, parts, lit = [], size = S) {
    const pos = [], col = [], glow = [];
    const add = (list, isGlow) => {
      for (const g of list) {
        const flat = g.index ? g.toNonIndexed() : g, p = flat.attributes.position.array, c = flat.attributes.color.array;
        for (let i = 0; i < p.length; i++) {
          pos.push(p[i]);
          col.push(c[i]);
        }
        for (let t = 0; t < p.length / 9; t++) glow.push(isGlow ? 1 : 0);
      }
    };
    add(parts, false);
    add(lit, true);
    const id = this.next++;
    this.waiting.set(id, { kind: 'adopt', owner, group });
    this.worker.postMessage({ type: 'voxelize', id, pos: new Float32Array(pos), col: new Float32Array(col), glow: new Uint8Array(glow), s: size }, []);
  }

  reply(m) {
    const job = this.waiting.get(m.id);
    this.waiting.delete(m.id);
    if (!job) return;
    if (m.type === 'voxelized') {
      const entry = this.take(job.owner, job.group, m.v);
      if (job.owner.fallen) entry.left = 0;
    } else if (m.type === 'meshed') {
      if (m.stamp !== job.entry.stamp) return; // a newer cut is on its way
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.g.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(m.g.nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(m.g.col, 3));
      g.setIndex(new THREE.BufferAttribute(m.g.idx, 1));
      g.computeBoundingSphere();
      this.wear(job.entry, g);
    }
  }

  // A volume made directly (blueprints.js) rather than from a painted model.
  take(owner, group, v, onReady) {
    // Its middle and reach in the world, so collision only asks the structures a hero is near.
    const vol = new Volume(v);
    group.updateMatrixWorld(true);
    const at = group.localToWorld(new THREE.Vector3(v.ox + (v.nx * v.s) / 2, 0, v.oz + (v.nz * v.s) / 2)), reach = (Math.max(v.nx, v.nz) * v.s) / 2 + 4;
    const entry = { vol, group, owner, mesh: null, stamp: 0, ready: false, at, reach, onReady };
    owner.vox = entry;
    if (owner.solid) owner.solid.voxel = true; // the hero meets the voxels themselves now
    this.list.push(entry);
    this.remesh(entry);
    return entry;
  }

  // Puts a fresh mesh on a structure or a chunk, hiding the painted model the first time.
  wear(entry, g) {
    if (entry.mesh) {
      entry.mesh.geometry.dispose();
      entry.mesh.geometry = g;
    } else {
      entry.mesh = new THREE.Mesh(g, this.material);
      entry.mesh.castShadow = entry.mesh.receiveShadow = true;
      (entry.pivot ?? entry.group).add(entry.mesh);
      if (!entry.pivot) for (const c of entry.group.children) if (c !== entry.mesh && c.isMesh) c.visible = false;
    }
    const first = !entry.ready;
    entry.ready = true;
    if (first) entry.onReady?.();
  }

  remesh(entry) {
    entry.stamp++;
    if (!this.queue.includes(entry)) this.queue.push(entry);
  }

  // ---- breaking them ----
  // A blow on a structure: cut, then let fall whatever has lost its support. `r` in tiles.
  hit(owner, x, y, z, r, hero, only, low) {
    const entry = owner.vox;
    if (!entry?.ready) return 0;
    entry.group.updateMatrixWorld(true);
    // Its own vector: spray() below reuses this.v.
    const local = entry.group.worldToLocal(new THREE.Vector3(x, y, z));
    const out = entry.vol.carve(local.x, local.y, local.z, r, only, low === undefined ? -Infinity : low - entry.group.position.y);
    if (!out.length) return 0;
    this.onCarve?.(entry, out, hero);
    this.spray(entry, out, x, y, z);
    const vol = entry.vol, big = vol.mat.length > BIG, [ci, cj, ck] = vol.cell(local.x, local.y, local.z);
    const loose = vol.unsupported(vol.plain ? vol.around(ci, cj, ck, Math.ceil(r / Math.sqrt(MATERIALS[1].strength) / vol.s) + 1) : big ? vol.window(ci, cj, ck, Math.ceil(r / vol.s) + WINDOW) : null);
    if (loose.length) this.drop(entry, entry.vol.pieces(loose), hero, x, y, z);
    this.remesh(entry);
    entry.left = entry.vol.count() / entry.vol.total;
    return out.length;
  }

  // The whole thing comes down: everything left breaks into blocks and falls.
  fell(owner, hero) {
    const entry = owner.vox;
    if (!entry?.ready) return;
    const all = [];
    for (let i = 0; i < entry.vol.mat.length; i++) if (entry.vol.mat[i]) all.push(i);
    entry.group.updateMatrixWorld(true);
    const c = entry.group.localToWorld(new THREE.Vector3(0, 3, 0));
    this.drop(entry, entry.vol.pieces(all, PIECE), hero, c.x, c.y, c.z, true);
    this.remesh(entry);
    entry.left = 0;
  }

  // Back as it was built.
  mend(owner) {
    const entry = owner.vox;
    if (!entry) return;
    entry.vol.reset();
    entry.left = 1;
    this.remesh(entry);
  }

  // Pieces lifted out of a structure, each its own falling body.
  drop(entry, pieces, hero, x, y, z, whole = false) {
    entry.group.updateMatrixWorld(true);
    const rot = entry.group.getWorldQuaternion(new THREE.Quaternion());
    for (const piece of pieces) {
      const lifted = entry.vol.lift(piece);
      if (lifted.count < 4) {
        // Too small to be a chunk: it bursts into bits.
        const at = entry.group.localToWorld(new THREE.Vector3(...lifted.centre));
        this.burst(at, lifted.v.col.find((c) => c) ?? 0xc9bcc4, Math.min(4, lifted.count), 4);
        continue;
      }
      const pivot = new THREE.Group(), centre = entry.group.localToWorld(new THREE.Vector3(...lifted.centre));
      pivot.position.copy(centre);
      pivot.quaternion.copy(rot);
      this.scene.add(pivot);
      const away = new THREE.Vector3(centre.x - x, 0, centre.z - z);
      const len = away.length() || 1, push = whole ? 2 + Math.random() * 3 : 1 + Math.random() * 2;
      const chunk = {
        pivot, group: pivot, mesh: null, stamp: 0, ready: false, owner: hero, count: lifted.count,
        vol: new Volume(lifted.v), offset: lifted.centre,
        vel: new THREE.Vector3((away.x / len) * push, whole ? Math.random() * 2 : 1, (away.z / len) * push),
        spin: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2).multiplyScalar(3 / Math.cbrt(lifted.count)),
        radius: Math.max(lifted.v.nx, lifted.v.ny, lifted.v.nz) * lifted.v.s * 0.5, still: 0, asleep: false, age: 0, hard: false,
      };
      this.chunks.push(chunk);
      this.remesh(chunk);
    }
    // Too many down at once: the oldest crumble away into bits.
    while (this.chunks.length > MOST_CHUNKS) this.crumble(this.chunks.shift());
  }

  crumble(c) {
    this.burst(c.pivot.position, c.vol.col.find((x) => x) ?? 0xc9bcc4, 6, 3);
    this.scene.remove(c.pivot);
    c.mesh?.geometry.dispose();
  }

  // Dust and flying bits where voxels came out.
  spray(entry, out, x, y, z) {
    const n = Math.min(24, out.length), step = Math.max(1, Math.floor(out.length / n));
    for (let i = 0; i < out.length; i += step) {
      const [px, py, pz, c] = out[i], at = entry.group.localToWorld(new THREE.Vector3(px, py, pz));
      const dir = at.clone().sub(this.v.set(x, y, z)).normalize();
      this.fling(at, c, dir.multiplyScalar(4 + Math.random() * 6).add(new THREE.Vector3(0, 3 + Math.random() * 4, 0)));
    }
    const mats = [...new Set(out.slice(0, 30).map((o) => MATERIALS[o[4]].dust))];
    this.world.work.burst(x, y, z, mats, 10, 4);
  }

  burst(at, color, count, speed) {
    for (let i = 0; i < count; i++) this.fling(at.clone(), color, new THREE.Vector3((Math.random() - 0.5) * speed * 2, Math.random() * speed, (Math.random() - 0.5) * speed * 2));
  }

  fling(at, color, vel) {
    if (this.flying.length >= MOST_BITS) this.flying.shift();
    this.flying.push({ at, vel, life: BIT_LIFE * (0.6 + Math.random() * 0.4), color: new THREE.Color(color), spin: Math.random() * 6 });
  }

  // ---- every frame ----
  update(dt) {
    for (let i = 0; i < MESHES_PER_FRAME && this.queue.length; i++) {
      const entry = this.queue.shift(), id = this.next++;
      this.waiting.set(id, { kind: 'mesh', entry });
      this.worker.postMessage({ type: 'mesh', id, stamp: entry.stamp, v: entry.vol.data() });
    }
    for (const c of this.chunks) if (!c.asleep) this.fall(c, dt);
    this.updateBits(dt);
    if ((this.houseCheck = (this.houseCheck ?? 0) - dt) <= 0) {
      this.houseCheck = HOUSE_CHECK;
      this.houses();
      this.walls();
    }
  }

  // A city's walls, towers, gates and castle near a hero are voxels, a sector at a time; the
  // painted sector goes once every piece of it is ready, and comes back when all are left behind.
  walls() {
    const { players } = this.world;
    for (const T of TOWNS) {
      for (const sec of T.sectors ?? []) {
        const d = players.reduce((m, p) => Math.min(m, Math.hypot(p.state.x - sec.x, p.state.z - sec.z)), 1e9);
        if (!sec.vox && d < SECTOR_NEAR) {
          sec.vox = true;
          for (const piece of sec.pieces) {
            const group = new THREE.Group();
            group.position.set(T.x, T.y, T.z);
            this.scene.add(group);
            piece.townPiece = true;
            this.adopt(piece, group, piece.parts.map((g) => g.clone()), [], STONE_VOXEL);
          }
        } else if (sec.vox) {
          const ready = sec.pieces.every((p) => p.vox?.ready);
          if (ready && sec.mesh.visible) {
            sec.mesh.visible = false;
            for (const p of sec.pieces) for (const s of p.solids) s.voxel = true;
          }
          const hurt = sec.pieces.some((p) => p.vox && p.vox.vol.count() < p.vox.vol.total);
          if (d > SECTOR_FAR && ready && !hurt) {
            for (const p of sec.pieces) {
              this.scene.remove(p.vox.group);
              this.forget(p);
              for (const s of p.solids) s.voxel = false;
            }
            sec.mesh.visible = true;
            sec.vox = false;
          }
        }
      }
    }
  }

  // A blow on a city's stonework: whatever piece is near enough is cut.
  blast(x, y, z, r, hero) {
    for (const e of this.list) {
      if (!e.owner.townPiece || !e.ready) continue;
      const b = e.box ??= new THREE.Box3().setFromObject(e.mesh ?? e.group);
      if (x < b.min.x - r || x > b.max.x + r || z < b.min.z - r || z > b.max.z + r) continue;
      this.hit(e.owner, x, y, z, r, hero);
    }
  }

  // Houses near a hero are voxels, built from their blueprint; far off they're the painted model.
  houses() {
    const { marks, players, work } = this.world;
    let active = this.list.filter((e) => e.owner.house).length;
    for (const h of marks.houses) {
      const d = players.reduce((m, p) => Math.min(m, Math.hypot(p.state.x - h.x, p.state.z - h.z)), 1e9), gone = work.chunks.isGone(h.id);
      if (h.vox) {
        if (d > HOUSE_FAR) {
          this.scene.remove(h.vox.group);
          this.forget(h);
          h.solid.voxel = false;
          h.voxFell = false;
          work.showHouse(h);
          active--;
        } else if (h.vox.ready) {
          h.mesh.visible = false;
          if (!gone && h.vox.left === 0) {
            this.mend(h);
            h.voxFell = false;
          }
          if (h.rubble) h.rubble.visible = gone && !h.voxFell;
        }
        continue;
      }
      if (d > HOUSE_NEAR || gone || active >= MOST_HOUSES) continue;
      const seed = [...h.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7), group = new THREE.Group();
      group.position.copy(h.mesh.position);
      group.rotation.y = h.mesh.rotation.y;
      this.scene.add(group);
      h.house = true;
      this.take(h, group, houseVoxels(nationAt(h.x, h.z)?.id ?? 'free', seed % 4, seed, h.type), () => { h.mesh.visible = false; });
      active++;
    }
  }

  fall(c, dt) {
    if (!c.ready) return;
    if (!c.placed) {
      c.mesh.position.set(-c.offset[0], -c.offset[1], -c.offset[2]);
      c.placed = true;
    }
    c.age += dt;
    c.vel.y -= GRAVITY * dt;
    c.pivot.position.addScaledVector(c.vel, dt);
    this.q.setFromEuler(new THREE.Euler(c.spin.x * dt, c.spin.y * dt, c.spin.z * dt));
    c.pivot.quaternion.multiply(this.q);
    const p = c.pivot.position, floor = height(p.x, p.z) + c.radius * 0.45;
    if (p.y < floor) {
      const speed = -c.vel.y;
      p.y = floor;
      if (speed > 4) this.land(c, speed);
      c.vel.y = speed > 2 ? speed * 0.22 : 0;
      c.vel.x *= 0.55;
      c.vel.z *= 0.55;
      c.spin.multiplyScalar(0.5);
    }
    const moving = c.vel.length() + c.spin.length() * 0.3;
    c.still = moving < REST_SPEED && p.y <= floor + 0.05 ? c.still + dt : 0;
    if (c.still > REST_SECS || c.age > 12) c.asleep = true;
  }

  // A chunk hitting the ground: dust, bits, and anything under it crushed.
  land(c, speed) {
    const p = c.pivot.position, color = c.vol.col.find((x) => x) ?? 0xc9bcc4;
    this.world.work.burst(p.x, p.y, p.z, ['#c9bcc4', '#a89a8c', `#${color.toString(16).padStart(6, '0')}`], Math.min(10, 2 + c.count / 20), 2 + c.radius);
    if (speed > SHATTER_SPEED && !c.hard) {
      c.hard = true;
      this.burst(p.clone(), color, Math.min(10, Math.floor(c.count / 10) + 2), 5);
    }
    if (!c.owner || speed < 6) return;
    const { monsters } = this.world;
    for (const e of monsters.within(p.x, p.z, c.radius + 1.5)) monsters.hit(e, Math.min(c.count, 300) * CRUSH * c.owner.body.might, p.x, p.z);
  }

  updateBits(dt) {
    const { m, q } = this;
    this.flying = this.flying.filter((b) => (b.life -= dt) > 0);
    let n = 0;
    for (const b of this.flying) {
      b.vel.y -= GRAVITY * dt;
      b.at.addScaledVector(b.vel, dt);
      const floor = height(b.at.x, b.at.z) + BIT / 2;
      if (b.at.y < floor) {
        b.at.y = floor;
        b.vel.multiplyScalar(0.3);
        b.vel.y = Math.abs(b.vel.y);
      }
      b.spin += dt * 5;
      const k = Math.min(1, b.life / 0.6);
      q.setFromAxisAngle(this.v.set(0.4, 1, 0.2).normalize(), b.spin);
      m.compose(b.at, q, new THREE.Vector3(k, k, k));
      this.bits.setMatrixAt(n, m);
      this.bits.setColorAt(n, b.color);
      n++;
    }
    this.bits.count = n;
    this.bits.instanceMatrix.needsUpdate = true;
    if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
  }

  // ---- a hero among them ----
  // Is there something solid where a hero's body would be?
  blocks(x, y, z) {
    for (const e of this.list) {
      if (!e.ready || !e.group.visible || e.left === 0) continue;
      const g = e.group;
      if (Math.abs(e.at.x - x) > e.reach || Math.abs(e.at.z - z) > e.reach) continue;
      g.updateMatrixWorld();
      for (const h of BODY) {
        const p = g.worldToLocal(this.v.set(x, y + h, z)), [i, j, k] = e.vol.cell(p.x, p.y, p.z);
        if (e.vol.solid(i, j, k)) return true;
      }
    }
    return false;
  }

  // The top of whatever solid is under a hero, close enough below or a step above.
  floor(x, z, y) {
    let best = -Infinity;
    for (const e of this.list) {
      if (!e.ready || !e.group.visible || e.left === 0) continue;
      const g = e.group;
      if (Math.abs(e.at.x - x) > e.reach || Math.abs(e.at.z - z) > e.reach) continue;
      g.updateMatrixWorld();
      const p = g.worldToLocal(this.v.set(x, y + STEP_UP, z)), [i, j0, k] = e.vol.cell(p.x, p.y, p.z);
      for (let j = Math.min(j0, e.vol.ny - 1); j >= 0 && j > j0 - 8; j--) {
        if (e.vol.solid(i, j, k)) {
          const top = g.localToWorld(this.v.set(p.x, e.vol.oy + (j + 1) * e.vol.s, p.z)).y;
          best = Math.max(best, top);
          break;
        }
      }
    }
    return best;
  }

  forget(owner) {
    const e = owner.vox;
    if (!e) return;
    this.list.splice(this.list.indexOf(e), 1);
    this.queue = this.queue.filter((q) => q !== e);
    e.mesh?.geometry.dispose();
    owner.vox = null;
  }
}
