import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { masonry } from './materials.js';
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
  const H = Math.round(T.r * 0.62), gate = 11, tall = 18, thick = 6;
  b.box(0, 0.05, 0, H * 2, 0.1, H * 2, '#9c8e7a', 0.03);
  for (const z of [-1, 1]) b.box(0, 0.12, z * 1, H * 2, 0.1, 22, PAVE, 0.03);
  b.box(0, 0.13, 0, 22, 0.1, H * 2, PAVE, 0.03);
  // Four walls, each with a gate in the middle.
  for (const side of [-1, 1]) {
    for (const part of [-1, 1]) {
      const mid = part * (H + gate) / 2, len = H - gate;
      b.box(mid, tall / 2, side * H, len, tall, thick, STONE, 0.05).box(side * H, tall / 2, mid, thick, tall, len, STONE, 0.05);
      add.rect(mid - len / 2, mid + len / 2, side * H - thick / 2, side * H + thick / 2);
      add.rect(side * H - thick / 2, side * H + thick / 2, mid - len / 2, mid + len / 2);
      for (let i = -3; i <= 3; i++) {
        b.box(mid + (i / 7) * len, tall + 0.9, side * H, 2.4, 1.8, thick + 0.4, STONE_DARK, 0.04);
        b.box(side * H, tall + 0.9, mid + (i / 7) * len, thick + 0.4, 1.8, 2.4, STONE_DARK, 0.04);
      }
    }
    for (const c of [-1, 1]) {
      b.box(side * H, 13, c * H, 15, 26, 15, STONE_DARK, 0.05).box(side * H, 28, c * H, 18, 3, 18, STONE, 0.05);
      add.rect(side * H - 7.5, side * H + 7.5, c * H - 7.5, c * H + 7.5);
      // Towers either side of each gate.
      b.box(side * H, 12, c * (gate + 3), 9, 24, 9, STONE, 0.05).box(c * (gate + 3), 12, side * H, 9, 24, 9, STONE, 0.05);
    }
  }
  // The keep at the heart of the city.
  b.box(0, 12, 0, 54, 24, 54, STONE, 0.05).box(0, 34, 0, 34, 22, 34, STONE_DARK, 0.05).box(0, 56, 0, 14, 24, 14, STONE, 0.05);
  for (const [x, z] of [[-27, -27], [27, -27], [-27, 27], [27, 27]]) b.box(x, 22, z, 11, 44, 11, STONE_DARK, 0.05).box(x, 47, z, 13, 6, 13, '#6a4a6e', 0.04);
  b.box(0, 72, 0, 6, 8, 6, '#6a4a6e', 0.04).box(0, 8, 27.3, 10, 16, 1, WOOD_DARK);
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
  // Sharpened stakes all round, with the way in to the south.
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (z > R * 0.9 && Math.abs(x) < 9) continue;
    const h = 5 + rand() * 1.6;
    b.box(x, h / 2, z, 1.5, h, 1.5, i % 3 ? WOOD : WOOD_DARK, 0.08).box(x, h + 0.3, z, 0.7, 0.8, 0.7, '#c9b89e');
  }
  add.rect(-R, -9, R - 2, R + 2);
  add.rect(9, R, R - 2, R + 2);
  add.rect(-R, R, -R - 2, -R + 2);
  add.rect(-R - 2, -R + 2, -R, R);
  add.rect(R - 2, R + 2, -R, R);
  // Tents.
  for (const [x, z, c] of [[-20, -16, '#8e2036'], [18, -20, '#5a4a38'], [-22, 14, '#5a4a38'], [22, 12, '#8e2036']]) {
    b.box(x, 1.4, z, 9, 2.8, 7, c, 0.06).box(x, 3.4, z, 6.5, 1.4, 7, c, 0.06).box(x, 4.6, z, 3, 1, 7, c, 0.06);
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
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R, h = rand() < 0.28 ? 0 : 3 + rand() * 13;
    if (!h) {
      b.box(x, 0.7, z, 4, 1.4, 4, STONE_DARK, 0.1);
      continue;
    }
    b.box(x, h / 2, z, 6.4, h, 6.4, i % 2 ? STONE : STONE_DARK, 0.08);
    add.circle(x, z, 3.4);
  }
  b.box(0, 13, 0, 26, 26, 26, STONE_DARK, 0.06).box(-7, 31, -7, 12, 10, 12, STONE, 0.08).box(8, 29, 8, 10, 6, 10, STONE, 0.08);
  b.box(0, 5, 13.3, 8, 10, 0.6, '#2a2030');
  add.rect(-13, 13, -13, 13);
  for (let i = 0; i < 18; i++) {
    const a = rand() * 6.28, d = 18 + rand() * 20;
    b.box(Math.cos(a) * d, 0.6, Math.sin(a) * d, 1 + rand() * 2.6, 1.2, 1 + rand() * 2.6, STONE, 0.1);
  }
}

// A boss's lair: a ring of standing stones around an open floor to fight on.
function lair(T, b, add, rand) {
  const R = 92;
  b.box(0, 0.06, 0, R * 2, 0.12, R * 2, '#4a3e44', 0.08);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.28, x = Math.cos(a) * R, z = Math.sin(a) * R, h = 12 + rand() * 12;
    b.box(x, h / 2, z, 6, h, 6, STONE_DARK, 0.08).box(x, h + 1, z, 7.6, 2, 7.6, STONE, 0.08);
    add.circle(x, z, 3.6);
  }
}

const BUILD = { village, city, bandit, keep, lair };

export function addTowns(scene, marks) {
  for (const T of TOWNS) {
    const b = new VoxelBuilder(), rand = seeded(T.name);
    let n = 0;
    BUILD[T.kind](T, b, {
      house: (x, z, rot, roof) => placeHouse(scene, marks, `${T.name}${n++}`, T.x + x, T.z + z, rot, roof),
      rect: (x0, x1, z0, z1) => marks.solids.push({ x0: T.x + x0, x1: T.x + x1, z0: T.z + z0, z1: T.z + z1 }),
      circle: (x, z, r) => marks.solids.push({ x: T.x + x, z: T.z + z, r }),
    }, rand);
    const mesh = new THREE.Mesh(b.build(), masonry());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(T.x, T.y, T.z);
    scene.add(mesh);
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
    return this.world.marks.solids.some((s) => (s.r ? Math.hypot(x - s.x, z - s.z) < s.r + 1 : !s.off && x > s.x0 - 1 && x < s.x1 + 1 && z > s.z0 - 1 && z < s.z1 + 1));
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
