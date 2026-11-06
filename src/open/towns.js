import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { masonry } from './materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STONEWORK, wall, tower, gatehouse, citadel, broken, brokenTower, tent } from './fortress.js';
import { paint, rock, spike, aimed, block, shine } from './kit.js';
import { nationAt } from './nations.js';
import { walkPose } from '../render/models.js';
import { makeFigure } from './figures.js';
import { LOOKS } from '../art/looks.js';
import { TOWNS } from './terrain.js';
import { placeHouse } from './landmarks.js';
import { ITEMS } from './items.js';
import { townPlans } from './cityPlan.js';
import { nearSolids } from './solidGrid.js';

// Built places: walled cities, villages, bandit camps and ruined keeps. Every layout comes from
// the town's name, so it's the same each visit. Houses are ordinary houses: enter or wreck them.
const SECTORS = 8;          // a city's stonework is drawn and turned to voxels in this many parts, and the castle
const STONE = '#a89a8c', STONE_DARK = '#7c6e68', WOOD = '#7a5230', WOOD_DARK = '#5a3a22', PAVE = '#b8a98e';
const ROOFS = [['#b13e53', '#8a2e40'], ['#3b5dc9', '#2c4498'], ['#e8a33a', '#b87a22'], ['#257179', '#1a535a'], ['#7a5a9e', '#5a4078']];
const FOLK_NEAR = 160;      // tiles past a town's edge that people start to appear
const CROWD = { village: 10, city: 44 };
const TALK = 3.6;
const GREET = 8;
const FOLK_SEEN = 200;      // tiles (as the crow walks the grid) at which a townsperson is drawn            // tiles at which townsfolk stop and wave
const WANDER = 2.4;         // townsfolk walking speed
const TRADE_COST = 5;
const FOLK = [LOOKS.merchant, LOOKS.kid, LOOKS.smith, LOOKS.bard, LOOKS.elder, LOOKS.guard];
const CHATTER = {
  village: ['Quiet here, and I like it so.', 'The well has never once run dry.', 'Keep to the lanterns after dark.'],
  city: ['The walls have stood for three hundred winters.', 'Everything comes through the south gate eventually.', 'Mind the keep guards. They have no humor.'],
};

function seeded(text) {
  let seed = [...text].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

const quarter = (x, z) => (Math.abs(x) > Math.abs(z) ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : (z > 0 ? Math.PI : 0));

function lantern(b, x, z) {
  b.box(x, 2.2, z, 0.3, 4.4, 0.3, WOOD_DARK).box(x, 4.7, z, 0.8, 0.8, 0.8, '#ffd98a', 0);
}

function stall(b, x, z, color) {
  b.box(x, 0.8, z, 6, 1.6, 2.4, WOOD, 0.05).box(x, 3.6, z, 7, 0.4, 3.4, color, 0.03);
  for (const [dx, dz] of [[-3, -1.4], [3, -1.4], [-3, 1.4], [3, 1.4]]) b.box(x + dx, 2.6, z + dz, 0.25, 2, 0.25, WOOD_DARK);
  for (let i = -2; i <= 2; i++) b.box(x + i, 1.8, z, 0.6, 0.4, 0.6, ['#d8a060', '#ef7d57', '#a7f070'][(i + 2) % 3], 0);
}

// A village: a square with its well, stalls on market day, lanterns along the main street.
// Its houses grow along the plan's streets with its people (settlements.js).
function village(T, b, add, rand) {
  const { plan } = add, m = plan.market;
  b.box(m.x, 0.8, m.z, 7, 1.6, 7, STONE, 0.05).box(m.x, 1.65, m.z, 4.4, 0.1, 4.4, '#3f8fb0', 0).box(m.x, 5.6, m.z, 8.4, 0.5, 8.4, WOOD_DARK);
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.box(m.x + x, 3.4, m.z + z, 0.4, 3.8, 0.4, WOOD);
  add.circle(m.x, m.z, 4.5);
  stall(b, m.x - 14, m.z + 12, '#b13e53');
  stall(b, m.x + 14, m.z - 12, '#257179');
  lanterns(b, plan, 'main', 34);
}

// Lanterns down the streets of one kind, set back from the middle.
function lanterns(b, plan, type, every) {
  for (const st of plan.streets) {
    if (st.type !== type) continue;
    let carry = every / 2;
    for (let k = 1; k < st.pts.length; k++) {
      const [ax, az] = st.pts[k - 1], [bx, bz] = st.pts[k], len = Math.hypot(bx - ax, bz - az);
      for (let t = carry; t < len; t += every) {
        const side = (Math.floor(t / every) % 2 ? 1 : -1) * (st.width / 2 + 1), nx = -(bz - az) / len, nz = (bx - ax) / len;
        lantern(b, ax + ((bx - ax) * t) / len + nx * side, az + ((bz - az) * t) / len + nz * side);
      }
      carry = (carry - len) % every;
      if (carry < 0) carry += every;
    }
  }
}

// A stretch of the city wall from a to b, cut into pieces short enough to break as voxels.
function walls(add, P, ax, az, bx, bz, tall, thick) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 40));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    add.piece(() => {
      wall(add.stone, P, ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, tall, thick);
      for (let t = t0 * len; t <= t1 * len; t += 6) add.circle(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len, thick / 2 + 1.2);
    });
  }
}

// A city from its plan: an irregular ring of wall with a tower at every turn and a gatehouse
// where each road comes in, the castle on its green in the middle, the market with its stalls.
// Its houses grow along the streets with its people (settlements.js).
function city(T, b, add, rand) {
  const { plan } = add, P = add.P, tall = 18, thick = 6, gap = 11, poly = plan.wall, n = poly.length;
  // Where each gate meets the wall: the edge its road crosses, and how far along.
  const gates = plan.gates.map((g) => {
    for (let i = 0; i < n; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n], dx = bx - ax, dz = bz - az, ux = Math.cos(g.a), uz = Math.sin(g.a);
      const den = ux * dz - uz * dx;
      if (Math.abs(den) < 1e-6) continue;
      const t = (ux * az - uz * ax) / den, r = (ax * dz - az * dx) / den;
      if (t >= 0 && t <= 1 && r > 0) return { edge: i, t, x: ax + dx * t, z: az + dz * t, a: g.a };
    }
    return null;
  }).filter(Boolean);
  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n], len = Math.hypot(bx - ax, bz - az);
    const here = gates.filter((g) => g.edge === i).sort((p, q) => p.t - q.t);
    let from = 0;
    for (const g of here) {
      const half = (gap + 9) / len;
      if (g.t - half > from) walls(add, P, ax + (bx - ax) * from, az + (bz - az) * from, ax + (bx - ax) * (g.t - half), az + (bz - az) * (g.t - half), tall, thick);
      from = g.t + half;
    }
    if (from < 1) walls(add, P, ax + (bx - ax) * from, az + (bz - az) * from, bx, bz, tall, thick);
    add.piece(() => {
      tower(add.stone, P, ax, az, 6.6, tall + 11, { flag: i % 3 === 0 });
      add.circle(ax, az, 7.4);
    });
  }
  // Gatehouses, turned to face down their road.
  for (const g of gates) {
    add.piece(() => {
      const parts = [];
      gatehouse(parts, P, 0, 0, gap, tall, thick, true);
      const turn = Math.atan2(Math.cos(g.a), Math.sin(g.a));
      for (const part of parts) add.stone.push(part.rotateY(turn).translate(g.x, 0, g.z));
      for (const s of [-1, 1]) add.circle(g.x + Math.cos(g.a + Math.PI / 2) * s * (gap + 3.5), g.z + Math.sin(g.a + Math.PI / 2) * s * (gap + 3.5), 6);
    });
  }
  // The castle on its green.
  add.piece(() => {
    citadel(add.stone, P, plan.castle.half, 12);
    add.rect(-plan.castle.half - 6, plan.castle.half + 6, -plan.castle.half - 6, plan.castle.half + 6);
  });
  // The market: a fountain in the middle and stalls round its edge.
  const m = plan.market;
  b.box(m.x, 0.7, m.z, 9, 1.4, 9, STONE, 0.05).box(m.x, 1.5, m.z, 7, 0.1, 7, '#3f8fb0', 0).box(m.x, 3.4, m.z, 1.4, 4, 1.4, STONE_DARK, 0.05);
  add.circle(m.x, m.z, 5.5);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 6.283 + 0.3, x = m.x + Math.cos(a) * (m.r - 8), z = m.z + Math.sin(a) * (m.r - 8);
    stall(b, x, z, ROOFS[i % ROOFS.length][0]);
  }
  lanterns(b, plan, 'main', 30);
  lanterns(b, plan, 'ring', 46);
  void rand;
}

function bandit(T, b, add, rand) {
  const R = 40;
  b.box(0, 0.05, 0, R * 2, 0.1, R * 2, '#6a5a44', 0.08);
  // Sharpened logs all round, leaning out, with the way in to the south.
  for (let i = 0; i < 74; i++) {
    const a = (i / 74) * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (z > R * 0.9 && Math.abs(x) < 9) continue;
    const h = 5.5 + rand() * 2, lean = 0.14;
    add.stone.push(paint(aimed(new THREE.CylinderGeometry(0.62, 0.72, h, 7).translate(0, h / 2, 0), 0, 0, 0, Math.cos(a) * lean, 1, Math.sin(a) * lean), i % 3 ? WOOD : WOOD_DARK).translate(x, 0, z));
    add.stone.push(paint(aimed(spike(0.62, 1.5), 0, 0, 0, Math.cos(a) * lean, 1, Math.sin(a) * lean), '#c9b89e').translate(x + Math.cos(a) * lean * h, h, z + Math.sin(a) * lean * h));
  }
  add.rect(-R, -9, R - 2, R + 2);
  add.rect(9, R, R - 2, R + 2);
  add.rect(-R, R, -R - 2, -R + 2);
  add.rect(-R - 2, -R + 2, -R, R);
  add.rect(R - 2, R + 2, -R, R);
  // Tents.
  for (const [x, z, c] of [[-20, -16, '#8e2036'], [18, -20, '#5a4a38'], [-22, 14, '#5a4a38'], [22, 12, '#8e2036']]) {
    tent(add.stone, x, z, 9, 7, c, rand);
    add.rect(x - 4.5, x + 4.5, z - 3.5, z + 3.5);
  }
  // Fire, watchtower, loot.
  b.box(0, 0.25, 0, 3, 0.5, 3, '#3a2c30').box(0, 0.9, 0, 1.2, 1, 1.2, '#ff8a4c', 0);
  for (const [x, z] of [[-3, 30], [3, 30], [-3, 24], [3, 24]]) b.box(x, 6, z - 50, 0.7, 12, 0.7, WOOD_DARK);
  b.box(0, 12.5, -23, 9, 1, 9, WOOD, 0.05).box(0, 14, -27, 9, 2.4, 0.5, WOOD_DARK).box(-4.3, 14, -23, 0.5, 2.4, 9, WOOD_DARK).box(4.3, 14, -23, 0.5, 2.4, 9, WOOD_DARK);
  b.box(0, 0.8, -8, 4, 1.6, 2.6, '#8a5a30', 0.05).box(0, 1.8, -8, 4.2, 0.5, 2.8, '#6a4428').box(0, 1.2, -6.6, 0.7, 0.8, 0.2, '#ffcd75', 0);
}

function keep(T, b, add, rand) {
  const R = 44;
  b.box(0, 0.05, 0, R * 2, 0.1, R * 2, '#7a7070', 0.08);
  // Walls that have mostly fallen: each stretch stands to a different height, or not at all.
  const P = add.P;
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R, h = rand() < 0.28 ? 0 : 5 + rand() * 13;
    if (!h) {
      add.stone.push(paint(rock(2 + rand()), P.dark).translate(x, 0.8, z));
      continue;
    }
    broken(add.stone, P, x, z, h, a + 1.57, rand);
    add.circle(x, z, 3.4);
  }
  // The old keep, its roof gone and its towers split open.
  add.stone.push(paint(block(26, 19, 26).translate(0, 9.5, 0), P.dark), paint(block(23, 1, 23).translate(0, 19.4, 0), '#3a2c30'));
  for (const [x, z] of [[-13, -13], [13, 13], [13, -13], [-13, 13]]) brokenTower(add.stone, P, x, z, 5, x === z ? 36 : 26, rand);
  for (let i = 0; i < 16; i++) add.stone.push(paint(block(2.4, 1.6 + rand() * 7, 2).translate(-11 + i * 1.5, 19 + rand() * 2.2, 12), P.stone), paint(block(2, 1.6 + rand() * 5, 2.4).translate(-12, 19 + rand() * 2.2, 11 - i * 1.5), P.stone));
  add.stone.push(paint(block(8, 10, 0.6).translate(0, 5, 13.3), '#141014'));
  add.rect(-13, 13, -13, 13);
  for (let i = 0; i < 22; i++) {
    const a = rand() * 6.28, d = 18 + rand() * 20;
    add.stone.push(paint(rock(0.7 + rand() * 1.5), P.stone).translate(Math.cos(a) * d, 0.5, Math.sin(a) * d));
  }
}

// A boss's lair: a ring of standing stones around an open floor to fight on.
function lair(T, b, add, rand) {
  const R = 92;
  b.box(0, 0.06, 0, R * 2, 0.12, R * 2, '#4a3e44', 0.08);
  // Black fangs of rock lean in over the floor, with the ruler's mark burning in each.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R, h = 18 + rand() * 18;
    add.stone.push(paint(aimed(spike(5.4, h, 6), 0, 0, 0, -Math.cos(a) * 0.2, 1, -Math.sin(a) * 0.2), STONE_DARK).translate(x, -1, z));
    add.stone.push(paint(rock(3 + rand() * 2), '#3a3036').translate(x + Math.cos(a) * 3, 0.8, z + Math.sin(a) * 3));
    add.glow.push(paint(new THREE.OctahedronGeometry(1).scale(0.6, 2.2, 0.3).rotateY(-a + 1.57), add.P.trim).translate(x - Math.cos(a) * (3.4 + h * 0.03), h * 0.34, z - Math.sin(a) * (3.4 + h * 0.03)));
    add.circle(x, z, 3.6);
  }
}

const BUILD = { village, city, bandit, keep, lair };

export function addTowns(scene, marks) {
  for (const T of TOWNS) {
    const b = new VoxelBuilder(), rand = seeded(T.name), stone = [], glow = [];
    let n = 0;
    // Each piece of stonework (a stretch of wall, a tower, a gate, the castle) is kept apart too,
    // so it can be broken on its own as voxels.
    T.pieces = [];
    let current = null;
    const solid = (s) => {
      marks.solids.push(s);
      current?.solids.push(s);
    };
    BUILD[T.kind](T, b, {
      stone, glow, P: STONEWORK[nationAt(T.x, T.z)?.id ?? 'free'], plan: townPlans().get(T.name),
      piece: (fn) => {
        const from = stone.length;
        current = { parts: null, solids: [], from };
        fn();
        current.parts = stone.slice(from);
        T.pieces.push(current);
        current = null;
      },
      house: (x, z, rot, roof) => placeHouse(scene, marks, `${T.name}${n++}`, T.x + x, T.z + z, rot, roof),
      rect: (x0, x1, z0, z1) => solid({ x0: T.x + x0, x1: T.x + x1, z0: T.z + z0, z1: T.z + z1 }),
      circle: (x, z, r) => solid({ x: T.x + x, z: T.z + z, r }),
    }, rand);
    // A city's stonework in sectors, each its own mesh, so the part near a hero can become voxels
    // (voxels.js) while the rest stays one painted mesh.
    const inPiece = new Set(T.pieces.flatMap((p) => p.parts));
    T.sectors = [];
    for (const p of T.pieces) {
      const box = new THREE.Box3();
      for (const g of p.parts) {
        g.computeBoundingBox();
        box.union(g.boundingBox);
      }
      const c = box.getCenter(new THREE.Vector3()), castle = Math.hypot(c.x, c.z) < 70, k = castle ? 'castle' : Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / (2 * Math.PI)) * SECTORS) % SECTORS;
      let sec = T.sectors.find((x) => x.k === k);
      if (!sec) T.sectors.push(sec = { k, pieces: [], x: 0, z: 0, n: 0 });
      sec.pieces.push(p);
      sec.x += c.x;
      sec.z += c.z;
      sec.n++;
    }
    const mesh = new THREE.Mesh(b.build(), masonry());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(T.x, T.y, T.z);
    scene.add(mesh);
    const drawn = (parts) => {
      const work = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), mesh.material);
      work.castShadow = true;
      work.receiveShadow = true;
      work.position.copy(mesh.position);
      scene.add(work);
      return work;
    };
    const loose = stone.filter((g) => !inPiece.has(g));
    if (loose.length) drawn(loose);
    for (const sec of T.sectors) {
      sec.x = T.x + sec.x / sec.n;
      sec.z = T.z + sec.z / sec.n;
      sec.mesh = drawn(sec.pieces.flatMap((p) => p.parts));
      sec.y = T.y;
    }
    if (glow.length) {
      const lit = new THREE.Group();
      lit.position.copy(mesh.position);
      shine(lit, glow);
      scene.add(lit);
    }
  }
}

// Townsfolk walk about while someone's near, and can be spoken to.
export class People {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.list = [];
    this.live = new Set();
  }

  fill(T) {
    this.live.add(T);
    const rand = seeded(`${T.name}folk`), spread = T.kind === 'city' ? T.r * 0.5 : 26, plan = townPlans().get(T.name);
    // Out on the streets, the busy ones near the middle.
    const streets = plan.streets.filter((st) => st.type !== 'lane'), at = () => {
      const st = streets[Math.floor(rand() * streets.length)], p = st.pts[Math.floor(rand() * st.pts.length)];
      return [T.x + p[0], T.z + p[1]];
    };
    for (let i = 0; i < CROWD[T.kind]; i++) {
      const model = makeFigure(FOLK[i % FOLK.length]);
      const job = i === 0 ? 'healer' : i === 1 ? 'trader' : 'folk';
      const [x, z] = at();
      model.group.position.set(x, T.y, z);
      model.group.scale.setScalar(2.3);
      this.scene.add(model.group);
      this.list.push({ T, home: [x, z], model, job, phase: rand() * 6, dir: rand() * 6.28, turn: rand() * 4, moving: true, spread: 40, line: CHATTER[T.kind][i % CHATTER[T.kind].length] });
    }
  }

  empty(T) {
    this.live.delete(T);
    this.list = this.list.filter((f) => {
      if (f.T !== T) return true;
      this.scene.remove(f.model.group);
      return false;
    });
  }

  blocked(x, z) {
    return nearSolids(this.world.marks, x, z).some((s) => !s.off && (s.r ? Math.hypot(x - s.x, z - s.z) < s.r + 1 : x > s.x0 - 1 && x < s.x1 + 1 && z > s.z0 - 1 && z < s.z1 + 1));
  }

  update(dt) {
    const { players } = this.world;
    for (const T of TOWNS) {
      if (!CROWD[T.kind]) continue;
      const near = players.some((p) => Math.hypot(p.state.x - T.x, p.state.z - T.z) < T.r + FOLK_NEAR);
      if (near && !this.live.has(T)) this.fill(T);
      else if (!near && this.live.has(T)) this.empty(T);
      for (const p of players) {
        const inside = !p.rooms.house && Math.hypot(p.state.x - T.x, p.state.z - T.z) < T.r * 0.8;
        if (inside && p.town !== T) {
          p.town = T;
          p.hud.message(T.name, true);
        } else if (!inside && p.town === T) p.town = null;
      }
    }
    for (const f of this.list) {
      // Only those near enough to see are drawn and walked: a big city's crowd is mostly far off.
      const g0 = f.model.group.position, seen = players.some((p) => Math.abs(p.state.x - g0.x) + Math.abs(p.state.z - g0.z) < FOLK_SEEN);
      f.model.group.visible = seen;
      if (!seen) continue;
      if ((f.turn -= dt) <= 0) {
        f.turn = 2 + Math.random() * 5;
        f.moving = Math.random() < 0.7;
        f.dir = Math.random() * 6.28;
      }
      // Someone close by gets a look and a wave.
      const friend = players.find((p) => Math.hypot(p.state.x - f.model.group.position.x, p.state.z - f.model.group.position.z) < GREET);
      if (friend) {
        const g = f.model.group;
        g.rotation.y = Math.atan2(friend.state.x - g.position.x, friend.state.z - g.position.z);
        walkPose(f.model, f.phase, 0);
        f.model.arms[0].rotation.set(-2.6 + Math.sin(performance.now() * 0.012) * 0.3, 0, 0);
        continue;
      }
      const g = f.model.group, nx = g.position.x + Math.sin(f.dir) * WANDER * dt, nz = g.position.z + Math.cos(f.dir) * WANDER * dt;
      const stray = Math.max(Math.abs(nx - f.home[0]), Math.abs(nz - f.home[1])) > f.spread;
      if (f.moving && !stray && !this.blocked(nx, nz)) {
        g.position.x = nx;
        g.position.z = nz;
        g.rotation.y = f.dir;
        f.phase += dt * 8;
        walkPose(f.model, f.phase, 1);
      } else {
        if (f.moving) f.dir += 2;
        walkPose(f.model, f.phase, 0);
      }
    }
  }

  spot(p) {
    const f = this.list.find((k) => Math.hypot(k.model.group.position.x - p.state.x, k.model.group.position.z - p.state.z) < TALK);
    if (!f) return null;
    return { label: f.job === 'healer' ? 'Be healed' : f.job === 'trader' ? `Trade ${TRADE_COST} goods` : 'Talk', person: f };
  }

  talk(p, f) {
    const { hud, bag, body } = p;
    if (f.job === 'healer') {
      p.hp = body.maxHealth;
      hud.setHealth(1);
      hud.message('Rest easy. You\'re mended.');
    } else if (f.job === 'trader') {
      const pile = Object.keys(bag.items).find((id) => ITEMS[id].kind === 'material' && bag.items[id] >= TRADE_COST);
      if (!pile) return hud.message(`Bring ${TRADE_COST} of anything and I'll make you a salve.`);
      bag.remove(pile, TRADE_COST);
      bag.items.salve = (bag.items.salve ?? 0) + 1;
      bag.save();
      hud.message(`${TRADE_COST} ${ITEMS[pile].name} for a Healing Salve.`);
    } else {
      const site = p.site;
      hud.message(site && Math.random() < 0.6 ? `They say there's a ${site.cat.name} about ${Math.round(p.siteDist)} m from here.` : f.line);
    }
    return undefined;
  }
}
