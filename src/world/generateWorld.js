import { REGIONS, MEADOW, regionAt } from './regions.js';

// Builds the overworld as a 2D array of tile indexes from a seed,
// so the same seed always gives the same map.
// ROCK is a boulder, RUIN a broken stone pillar; both are solid.
export const TILE = { GRASS: 0, FLOWERS: 1, PATH: 2, WATER: 3, TREE: 4, ROCK: 5, RUIN: 6 };
export const SOLID_TILES = [TILE.WATER, TILE.TREE, TILE.ROCK, TILE.RUIN];
export const WORLD_W = 60;
export const WORLD_H = 40;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The starting village, in tile coordinates. Enemies stay out of this rectangle.
// Sections are named parts of it; entering one shows its name.
export const VILLAGE = {
  name: 'Lumen Hollow', x: 7, y: 3, w: 31, h: 13,
  sections: [{ name: 'Market Row', x: 25, y: 3, w: 13, h: 13 }],
};

function carveVillage(data, set) {
  const v = VILLAGE;
  for (let y = v.y; y < v.y + v.h; y++)
    for (let x = v.x; x < v.x + v.w; x++)
      if (SOLID_TILES.includes(data[y][x])) set(x, y, TILE.GRASS);

  // Each house is 2x2 tiles; its door sits between tx and tx + 1. `kind: 'smithy'` is Odo's forge.
  const houses = [
    { tx: 9, ty: 5, roof: 'red' },
    { tx: 14, ty: 4, roof: 'blue' },
    { tx: 20, ty: 5, roof: 'green' },
    { tx: 26, ty: 4, roof: 'yellow' },
    { tx: 32, ty: 4, roof: 'slate', kind: 'smithy' },
  ];
  for (let y = 9; y <= 10; y++) for (let x = 9; x <= 36; x++) set(x, y, TILE.PATH);
  for (const h of houses)
    for (let y = h.ty + 2; y <= 8; y++) {
      set(h.tx, y, TILE.PATH);
      set(h.tx + 1, y, TILE.PATH);
    }

  // Market Row plaza: a fountain (2x2) with a path ring around it.
  const fountain = { tx: 28, ty: 12 };
  for (let y = fountain.ty - 1; y <= fountain.ty + 2; y++)
    for (let x = fountain.tx - 1; x <= fountain.tx + 2; x++) set(x, y, TILE.PATH);
  set(fountain.tx, 11, TILE.PATH);

  // Road south until it meets the main road.
  for (let y = 11; y < WORLD_H - 2; y++) {
    if (y > v.y + v.h && data[y][15] === TILE.PATH) break;
    set(15, y, TILE.PATH);
    set(16, y, TILE.PATH);
  }

  return {
    name: v.name,
    rect: { x: v.x, y: v.y, w: v.w, h: v.h },
    houses,
    sections: v.sections,
    stall: { tx: 20, ty: 12 }, // 2 tiles wide
    fountain,
    anvil: { x: 35.3, z: 7.4 },
    // Lantern posts (tile centers are +0.5) and small props, kept off paths and doors.
    lanterns: [[11.5, 8.2], [17.5, 11.8], [23.5, 8.2], [25.5, 11.8], [30.5, 8.2], [35.5, 11.8], [14.3, 13.8]],
    props: [
      { kind: 'barrel', x: 19.4, z: 12.4 }, { kind: 'crate', x: 23.4, z: 12.7 }, { kind: 'barrel', x: 31.6, z: 6.6 },
      { kind: 'crate', x: 34.6, z: 5.6 }, { kind: 'barrel', x: 34.6, z: 6.4 }, { kind: 'board', x: 13, z: 11.6 },
      { kind: 'crate', x: 25.4, z: 6.5 },
    ],
    spots: {
      elder: { tx: 12, ty: 8 },
      kid: { tx: 18, ty: 11 },
      merchant: { tx: 22, ty: 12 },
      guard: { tx: 17, ty: 14 },
      smith: { tx: 34, ty: 7 },
      bard: { tx: 32, ty: 13 },
      home: { tx: 16, ty: 9 }, // where the hero wakes up after falling
    },
  };
}

// Fixed places in the world (tiles). The Spirit Tree's trunk fills a 2x2 square.
export const LANDMARKS = {
  spiritTree: { tx: 49, ty: 8 },
  ruins: { x: 50, y: 30 },
  fairyRing: { x: 9, y: 31 },
  windmill: { tx: 19, ty: 24 },
  lake: { x: 32, y: 31, rx: 7.5, ry: 4.2 },
};

export function generateWorld(seed, { village = true } = {}) {
  const rand = mulberry32(seed);
  const ri = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const W = WORLD_W, H = WORLD_H;
  const data = [];
  const region = [];
  for (let y = 0; y < H; y++) {
    const row = [], rrow = [];
    for (let x = 0; x < W; x++) {
      const r = regionAt(x + 0.5, y + 0.5);
      rrow.push(r.id);
      row.push(rand() < r.flowers ? TILE.FLOWERS : TILE.GRASS);
    }
    data.push(row);
    region.push(rrow);
  }
  const set = (x, y, t) => {
    if (x >= 0 && y >= 0 && x < W && y < H) data[y][x] = t;
  };
  const get = (x, y) => data[y]?.[x];
  const near = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;

  // Glimmer Lake, and the river that runs south into it from the northern hills.
  const L = LANDMARKS.lake;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = ((x + 0.5 - L.x) / L.rx) ** 2 + ((y + 0.5 - L.y) / L.ry) ** 2;
      if (d < 1 + 0.15 * Math.sin(x * 0.9) * Math.sin(y * 1.3)) set(x, y, TILE.WATER);
    }
  const riverX = (y) => 41 + Math.sin(y * 0.33) * 1.3 - Math.max(0, y - 21) * 0.5;
  for (let y = 0; y <= L.y; y++) {
    const x = Math.round(riverX(y));
    set(x, y, TILE.WATER);
    set(x + 1, y, TILE.WATER);
  }
  // Two small ponds in the meadow.
  for (let i = 0, tries = 0; i < 2 && tries < 50; tries++) {
    const cx = ri(6, W - 7), cy = ri(17, H - 7);
    if (regionAt(cx, cy) !== MEADOW || near(cx, cy, 30, 20, 6)) continue;
    const r = ri(1, 2);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + rand()) set(cx + x, cy + y, TILE.WATER);
    i++;
  }

  // Trees: dense in the Dimwood (with clearings), scattered elsewhere, clusters in the meadow.
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      if (get(x, y) === TILE.WATER) continue;
      const r = regionAt(x + 0.5, y + 0.5);
      if (r === MEADOW) continue;
      const patchy = 0.6 + 0.8 * (0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(y * 0.6));
      if (rand() < r.treeDensity * patchy) set(x, y, TILE.TREE);
      else if (r.id === 'moors' && rand() < 0.04) set(x, y, TILE.ROCK);
    }
  for (let i = 0; i < 16; i++) {
    let x = ri(2, W - 3), y = ri(2, H - 3);
    if (regionAt(x, y) !== MEADOW) continue;
    for (let n = ri(3, 7); n > 0; n--) {
      if (get(x, y) !== TILE.WATER) set(x, y, TILE.TREE);
      x += ri(-1, 1);
      y += ri(-1, 1);
    }
  }

  // Spirit Hill: a clear crown around the great tree, ringed by standing stones.
  const st = LANDMARKS.spiritTree, sx = st.tx + 1, sy = st.ty + 1;
  for (let y = sy - 4; y <= sy + 4; y++) for (let x = sx - 4; x <= sx + 4; x++) if (near(x + 0.5, y + 0.5, sx, sy, 4.2) && get(x, y) !== TILE.WATER) set(x, y, TILE.GRASS);
  const stones = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = sx + Math.cos(a) * 3.6, z = sy + Math.sin(a) * 3.6;
    if (Math.cos(a) < -0.7) continue; // opening to the west, where the path arrives
    stones.push([x, z]);
  }

  // The Dimwood clearing with its ring of glowing mushrooms.
  const fr = LANDMARKS.fairyRing;
  for (let y = fr.y - 3; y <= fr.y + 3; y++) for (let x = fr.x - 3; x <= fr.x + 3; x++) if (near(x, y, fr.x, fr.y, 3)) set(x, y, TILE.GRASS);

  // Old ruins in the moors: a broken ring of pillars with gaps north and south.
  const ru = LANDMARKS.ruins;
  for (let y = ru.y - 4; y <= ru.y + 4; y++) for (let x = ru.x - 4; x <= ru.x + 4; x++) if (near(x, y, ru.x, ru.y, 4.2)) set(x, y, TILE.GRASS);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (Math.abs(Math.cos(a)) < 0.3) continue;
    set(Math.round(ru.x + Math.cos(a) * 3.2), Math.round(ru.y + Math.sin(a) * 3.2), TILE.RUIN);
  }

  // The windmill stands in the meadow on a 2x2 base.
  const wm = LANDMARKS.windmill;
  for (let y = wm.ty - 1; y <= wm.ty + 2; y++) for (let x = wm.tx - 1; x <= wm.tx + 2; x++) set(x, y, TILE.GRASS);

  // Roads and trails, 2 tiles wide. Where they cross water they become bridges.
  const wet = data.map((row) => row.map((t) => t === TILE.WATER));
  const trail = (points) => {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / steps), y = Math.round(y0 + ((y1 - y0) * k) / steps);
        set(x, y, TILE.PATH);
        set(x + 1, y, TILE.PATH);
        set(x, y + 1, TILE.PATH);
      }
    }
  };
  const midY = Math.floor(H / 2), midX = Math.floor(W / 2);
  let py = midY;
  for (let x = 2; x < W - 2; x++) {
    if (rand() < 0.15) py = Math.max(midY - 2, Math.min(midY + 2, py + ri(-1, 1)));
    set(x, py, TILE.PATH);
    set(x, py + 1, TILE.PATH);
  }
  for (let y = 2; y < H - 2; y++) {
    set(midX, y, TILE.PATH);
    set(midX + 1, y, TILE.PATH);
  }
  trail([[36, 9], [44, 9], [46, 9]]);                     // village east gate to Spirit Hill
  trail([[13, midY], [12, 24], [10, 27], [9, 29]]);       // into the Dimwood
  trail([[50, midY], [51, 24], [50, 26]]);                 // down to the ruins
  trail([[midX, 25], [26, 24], [22, 25]]);                 // to the windmill

  // Clear the spawn crossroads.
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++)
      if (SOLID_TILES.includes(data[midY + y][midX + x])) set(midX + x, midY + y, TILE.GRASS);

  const villageInfo = village ? carveVillage(data, set) : null;
  if (villageInfo) {
    for (let y = VILLAGE.y; y < VILLAGE.y + VILLAGE.h; y++) for (let x = VILLAGE.x; x < VILLAGE.x + VILLAGE.w; x++) region[y][x] = 'village';
  }

  // Forest border
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) set(x, y, TILE.TREE);
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) set(x, y, TILE.TREE);

  const bridges = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (wet[y][x] && data[y][x] === TILE.PATH) bridges.add(`${x},${y}`);
  // The river keeps flowing under the border trees, so they don't dam it.
  for (let y = 0; y < 2; y++) {
    const x = Math.round(riverX(y));
    set(x, y, TILE.WATER);
    set(x + 1, y, TILE.WATER);
  }

  return {
    data,
    region,
    bridges,
    spawn: { x: midX + 0.5, z: midY + 0.5 },
    village: villageInfo,
    landmarks: { ...LANDMARKS, stones },
  };
}
