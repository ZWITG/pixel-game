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

// Built places: walled cities, villages, bandit camps and ruined keeps. Every layout comes from
// the town's name, so it's the same each visit. Houses are ordinary houses: enter or wreck them.
const STONE = '#a89a8c', STONE_DARK = '#7c6e68', WOOD = '#7a5230', WOOD_DARK = '#5a3a22', PAVE = '#b8a98e';
const ROOFS = [['#b13e53', '#8a2e40'], ['#3b5dc9', '#2c4498'], ['#e8a33a', '#b87a22'], ['#257179', '#1a535a'], ['#7a5a9e', '#5a4078']];
const FOLK_NEAR = 160;      // tiles past a town's edge that people start to appear
const CROWD = { village: 8, city: 16 };
const TALK = 3.6;
const GREET = 8;            // tiles at which townsfolk stop and wave
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

function village(T, b, add, rand) {
  b.box(0, 0.06, 0, 56, 0.12, 56, PAVE, 0.04);
  b.box(0, 0.8, 0, 7, 1.6, 7, STONE, 0.05).box(0, 1.65, 0, 4.4, 0.1, 4.4, '#3f8fb0', 0).box(0, 5.6, 0, 8.4, 0.5, 8.4, WOOD_DARK);
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.box(x, 3.4, z, 0.4, 3.8, 0.4, WOOD);
  add.circle(0, 0, 4.5);
  const n = 8 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rand() * 0.3, d = 44 + rand() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d;
    add.house(x, z, quarter(x, z), ROOFS[i % ROOFS.length]);
  }
  stall(b, -18, 16, '#b13e53');
  stall(b, 18, -16, '#257179');
  for (let i = 0; i < 6; i++) lantern(b, Math.cos(i) * 30, Math.sin(i) * 30);
}

function city(T, b, add, rand) {
  const H = Math.round(T.r * 0.62), gate = 11, tall = 18, thick = 6, P = add.P;
  b.box(0, 0.05, 0, H * 2, 0.1, H * 2, '#9c8e7a', 0.03);
  for (const z of [-1, 1]) b.box(0, 0.12, z * 1, H * 2, 0.1, 22, PAVE, 0.03);
  b.box(0, 0.13, 0, 22, 0.1, H * 2, PAVE, 0.03);
  // Four walls with a gate in each, a great tower at every corner, the citadel in the middle.
  for (const side of [-1, 1]) {
    for (const part of [-1, 1]) {
      const mid = part * (H + gate) / 2, len = H - gate, from = part * gate, to = part * H;
      wall(add.stone, P, from, side * H, to, side * H, tall, thick);
      wall(add.stone, P, side * H, from, side * H, to, tall, thick);
      add.rect(mid - len / 2, mid + len / 2, side * H - thick / 2, side * H + thick / 2);
      add.rect(side * H - thick / 2, side * H + thick / 2, mid - len / 2, mid + len / 2);
    }
    for (const c of [-1, 1]) {
      tower(add.stone, P, side * H, c * H, 7.6, tall + 12, { flag: true });
      add.rect(side * H - 7.5, side * H + 7.5, c * H - 7.5, c * H + 7.5);
    }
    gatehouse(add.stone, P, 0, side * H, gate, tall, thick, true);
    gatehouse(add.stone, P, side * H, 0, gate, tall, thick, false);
  }
  citadel(add.stone, P, 27, 9);
  add.rect(-32, 32, -32, 32);
  // Streets of houses, leaving the two avenues clear.
  const step = 40;
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    if (!gx || !gz || (Math.abs(gx) <= 1 && Math.abs(gz) <= 1)) continue;
    for (const side of [-1, 1]) {
      const x = gx * step + side * 10, z = gz * step;
      if (Math.max(Math.abs(x), Math.abs(z)) > H - 12) continue;
      add.house(x, z + (side > 0 ? 8 : -8), Math.abs(gx) > Math.abs(gz) ? (gz > 0 ? 0 : Math.PI) : (gx > 0 ? -Math.PI / 2 : Math.PI / 2), ROOFS[Math.floor(rand() * ROOFS.length)]);
    }
  }
  // Market on the south avenue.
  for (let i = -2; i <= 2; i++) if (i) stall(b, i * 9 + (i > 0 ? 5 : -5), H - 28, ROOFS[(i + 2) % 5][0]);
  for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) {
    lantern(b, s * 12, i * 32);
    lantern(b, s * 12, -i * 32);
    lantern(b, i * 32, s * 12);
    lantern(b, -i * 32, s * 12);
  }
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
    BUILD[T.kind](T, b, {
      stone, glow, P: STONEWORK[nationAt(T.x, T.z)?.id ?? 'free'],
      house: (x, z, rot, roof) => placeHouse(scene, marks, `${T.name}${n++}`, T.x + x, T.z + z, rot, roof),
      rect: (x0, x1, z0, z1) => marks.solids.push({ x0: T.x + x0, x1: T.x + x1, z0: T.z + z0, z1: T.z + z1 }),
      circle: (x, z, r) => marks.solids.push({ x: T.x + x, z: T.z + z, r }),
    }, rand);
    const mesh = new THREE.Mesh(b.build(), masonry());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(T.x, T.y, T.z);
    scene.add(mesh);
    if (stone.length) {
      const work = new THREE.Mesh(mergeGeometries(stone.map((g) => (g.index ? g.toNonIndexed() : g))), mesh.material);
      work.castShadow = true;
      work.receiveShadow = true;
      work.position.copy(mesh.position);
      scene.add(work);
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
    const rand = seeded(`${T.name}folk`), spread = T.kind === 'city' ? T.r * 0.5 : 26;
    for (let i = 0; i < CROWD[T.kind]; i++) {
      const model = makeFigure(FOLK[i % FOLK.length]);
      const job = i === 0 ? 'healer' : i === 1 ? 'trader' : 'folk';
      const x = T.x + (rand() - 0.5) * spread * 2, z = T.z + (rand() - 0.5) * spread * 2;
      model.group.position.set(x, T.y, z);
      model.group.scale.setScalar(2.3);
      this.scene.add(model.group);
      this.list.push({ T, model, job, phase: rand() * 6, dir: rand() * 6.28, turn: rand() * 4, moving: true, spread, line: CHATTER[T.kind][i % CHATTER[T.kind].length] });
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
    return this.world.marks.solids.some((s) => !s.off && (s.r ? Math.hypot(x - s.x, z - s.z) < s.r + 1 : x > s.x0 - 1 && x < s.x1 + 1 && z > s.z0 - 1 && z < s.z1 + 1));
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
      const stray = Math.max(Math.abs(nx - f.T.x), Math.abs(nz - f.T.z)) > f.spread;
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
