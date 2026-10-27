// Builds the overworld as a 2D array of tile indexes from a seed,
// so the same seed always gives the same map.
export const TILE = { GRASS: 0, FLOWERS: 1, PATH: 2, WATER: 3, TREE: 4 };
export const SOLID_TILES = [TILE.WATER, TILE.TREE];
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
export const VILLAGE = { name: 'Lumen Hollow', x: 7, y: 3, w: 18, h: 13 };

function carveVillage(data, set) {
  const v = VILLAGE;
  for (let y = v.y; y < v.y + v.h; y++)
    for (let x = v.x; x < v.x + v.w; x++)
      if (SOLID_TILES.includes(data[y][x])) set(x, y, TILE.GRASS);

  // Each house is 2x2 tiles; its door sits between tx and tx + 1.
  const houses = [
    { tx: 9, ty: 5, roof: 'red' },
    { tx: 14, ty: 4, roof: 'blue' },
    { tx: 20, ty: 5, roof: 'green' },
  ];
  for (let y = 9; y <= 10; y++) for (let x = 9; x <= 21; x++) set(x, y, TILE.PATH);
  for (const h of houses)
    for (let y = h.ty + 2; y <= 8; y++) {
      set(h.tx, y, TILE.PATH);
      set(h.tx + 1, y, TILE.PATH);
    }

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
    stall: { tx: 20, ty: 12 }, // 2 tiles wide
    spots: {
      elder: { tx: 12, ty: 8 },
      kid: { tx: 18, ty: 11 },
      merchant: { tx: 22, ty: 12 },
      guard: { tx: 17, ty: 14 },
    },
  };
}

export function generateWorld(seed, { village = true } = {}) {
  const rand = mulberry32(seed);
  const ri = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const data = [];
  for (let y = 0; y < WORLD_H; y++) {
    const row = [];
    for (let x = 0; x < WORLD_W; x++) row.push(rand() < 0.06 ? TILE.FLOWERS : TILE.GRASS);
    data.push(row);
  }
  const set = (x, y, t) => {
    if (x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H) data[y][x] = t;
  };

  // Ponds
  for (let i = 0; i < 6; i++) {
    const cx = ri(6, WORLD_W - 7), cy = ri(6, WORLD_H - 7), r = ri(2, 4);
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + rand() * 2) set(cx + x, cy + y, TILE.WATER);
  }

  // Tree clusters
  for (let i = 0; i < 45; i++) {
    let x = ri(2, WORLD_W - 3), y = ri(2, WORLD_H - 3);
    for (let n = ri(3, 9); n > 0; n--) {
      set(x, y, TILE.TREE);
      x += ri(-1, 1);
      y += ri(-1, 1);
    }
  }

  // Crossroads paths with a little wiggle
  const midY = Math.floor(WORLD_H / 2), midX = Math.floor(WORLD_W / 2);
  let py = midY;
  for (let x = 2; x < WORLD_W - 2; x++) {
    if (rand() < 0.15) py = Math.max(midY - 3, Math.min(midY + 3, py + ri(-1, 1)));
    set(x, py, TILE.PATH);
    set(x, py + 1, TILE.PATH);
  }
  let px = midX;
  for (let y = 2; y < WORLD_H - 2; y++) {
    if (rand() < 0.15) px = Math.max(midX - 3, Math.min(midX + 3, px + ri(-1, 1)));
    set(px, y, TILE.PATH);
    set(px + 1, y, TILE.PATH);
  }

  // Clear the spawn area
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++)
      if (SOLID_TILES.includes(data[midY + y][midX + x])) set(midX + x, midY + y, TILE.GRASS);

  const villageInfo = village ? carveVillage(data, set) : null;

  // Forest border
  for (let x = 0; x < WORLD_W; x++) for (const y of [0, 1, WORLD_H - 2, WORLD_H - 1]) set(x, y, TILE.TREE);
  for (let y = 0; y < WORLD_H; y++) for (const x of [0, 1, WORLD_W - 2, WORLD_W - 1]) set(x, y, TILE.TREE);

  return { data, spawn: { x: midX + 0.5, z: midY + 0.5 }, village: villageInfo };
}
