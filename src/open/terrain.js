// The open world as pure functions: height and biome at any point. 1 unit = 1 tile (about 1 m).
// World is 8192 x 8192 tiles (8 km across; for scale, Skyrim is roughly 6 km across).
export const WORLD = 8192;
export const SEA = 0;

// Fixed places. Everything else is grown from noise around them.
export const PLACES = {
  hollow: { x: 2900, z: 5300, r: 260, y: 26, name: 'Lumen Hollow' },
  lake: { x: 4300, z: 4300, r: 820, name: 'Glimmer Lake' },
  spire: { x: 4300, z: 4120, r: 170, y: 22, name: 'The Lantern Spire' },
  spirit: { x: 5900, z: 2700, r: 520, y: 150, name: 'Spirit Hill' },
  ribs: { x: 6300, z: 5700, r: 420, y: 40, name: 'The Titan Ribs' },
  isles: { x: 2000, z: 3200, r: 300, name: 'The Drifting Isles' },
};
export const SPAWN = { x: 3650, z: 4600 };

// Built places (see towns.js). `r` is the ground levelled for it.
export const TOWNS = [
  { kind: 'city', name: 'Aurelgate', x: 5400, z: 5000, r: 300, y: 36 },
  { kind: 'city', name: 'Thornmere', x: 2250, z: 4000, r: 260, y: 30 },
  { kind: 'village', name: 'Fernwick', x: 3350, z: 5950, r: 110, y: 24 },
  { kind: 'village', name: 'Mossford', x: 4650, z: 6100, r: 110, y: 22 },
  { kind: 'village', name: 'Emberfield', x: 1700, z: 5050, r: 110, y: 26 },
  { kind: 'village', name: 'Larkrest', x: 5450, z: 3650, r: 110, y: 34 },
  { kind: 'village', name: 'Hollowbrook', x: 3050, z: 3250, r: 110, y: 28 },
  { kind: 'bandit', name: 'Redfang Camp', x: 2250, z: 6150, r: 75, y: 22 },
  { kind: 'bandit', name: 'Crow\'s Rest', x: 4150, z: 6750, r: 75, y: 20 },
  { kind: 'bandit', name: 'Ashpit Camp', x: 6100, z: 4450, r: 75, y: 44 },
  { kind: 'bandit', name: 'Blackmoor Camp', x: 1500, z: 4250, r: 75, y: 26 },
  { kind: 'bandit', name: 'Wolfrock Camp', x: 6500, z: 3650, r: 75, y: 60 },
  { kind: 'bandit', name: 'Gallows Hill', x: 3650, z: 2950, r: 75, y: 40 },
  { kind: 'keep', name: 'The Old Bastion', x: 4900, z: 2550, r: 85, y: 60 },
  { kind: 'keep', name: 'Sunder Keep', x: 1950, z: 2650, r: 85, y: 50 },
  { kind: 'keep', name: 'Greywatch', x: 5600, z: 6400, r: 85, y: 30 },
  { kind: 'lair', name: 'The Gravepit', boss: 'gravemaw', x: 7000, z: 4750, r: 150, y: 60 },
  { kind: 'lair', name: 'The Drowned Hollow', boss: 'mirewyrm', x: 1700, z: 6300, r: 150, y: 4 },
  { kind: 'lair', name: 'The Frozen Throne', boss: 'frostwarden', x: 3000, z: 1750, r: 150, y: 320 },
  { kind: 'lair', name: 'The Ember Caldera', boss: 'emberhorn', x: 5500, z: 7000, r: 150, y: 30 },
];

// Every town can be walked to by road; city roads end at their gates.
const ROADS = [
  [[2900, 5300], [3200, 5120], [3470, 4960], [3560, 4700], [3700, 4000]],
  [[3700, 4000], [4000, 3360], [4700, 3280], [5300, 3050], [5640, 2860]],
  [[2900, 5300], [2600, 4640], [2250, 4190]],
  [[2250, 3810], [2500, 3480], [3050, 3250], [3700, 3650], [3700, 4000]],
  [[3470, 4960], [4200, 5380], [5120, 5480], [5400, 5210]],
  [[5120, 5480], [5560, 5560], [6050, 5660]],
  [[3470, 4960], [3300, 5420], [3350, 5840]],
  [[4200, 5380], [4420, 5760], [4650, 5990]],
  [[4650, 6210], [5100, 6320], [5520, 6380]],
  [[2600, 4640], [2100, 4860], [1810, 5050]],
  [[4700, 3280], [5150, 3440], [5350, 3600]],
  [[5580, 3690], [5500, 4300], [5400, 4790]],
  [[4700, 3280], [4780, 2900], [4900, 2640]],
  [[2250, 3810], [2020, 3200], [1950, 2740]],
  [[3350, 6060], [2800, 6140], [2330, 6150]],
];
const SEGMENTS = ROADS.flatMap((r) => r.slice(1).map((b, i) => [r[i], b]));

// Rivers run from the high ground to the lake or the sea. [x, z, half width].
const RIVERS = [
  [[3300, 1900, 7], [3520, 2550, 10], [3320, 3120, 13], [3760, 3560, 18]],
  [[5250, 1850, 7], [5120, 2500, 10], [4960, 3180, 13], [4830, 3740, 17]],
  [[1250, 2350, 7], [1500, 3050, 10], [1280, 3800, 14], [820, 4620, 18], [470, 5260, 24]],
  [[4320, 5060, 12], [4500, 5720, 14], [4020, 6420, 17], [3720, 7260, 22], [3700, 7960, 28]],
];
const STREAMS = RIVERS.flatMap((r) => r.slice(1).map((b, i) => [r[i], b]));

// Two lands with their own shape and color. `r` is reached with a noisy edge.
const BADLANDS = { x: 6850, z: 4250, r: 900 };
const SWAMP = { x: 1950, z: 5950, r: 720 };

// ---- noise ----
const P = new Uint8Array(512);
{
  let s = 1337;
  const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = a[i & 255];
}
const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1.41, 0], [-1.41, 0], [0, 1.41], [0, -1.41]];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const g = (ix, iy, dx, dy) => {
    const v = G[P[P[(X + ix) & 255] + ((Y + iy) & 255)] & 7];
    return v[0] * dx + v[1] * dy;
  };
  const u = fade(xf), v = fade(yf);
  const a = g(0, 0, xf, yf) + (g(1, 0, xf - 1, yf) - g(0, 0, xf, yf)) * u;
  const b = g(0, 1, xf, yf - 1) + (g(1, 1, xf - 1, yf - 1) - g(0, 1, xf, yf - 1)) * u;
  return a + (b - a) * v;
}
function fbm(x, y, oct) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
function ridged(x, y, oct) {
  let sum = 0, amp = 0.55, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += (1 - Math.abs(noise(x * f, y * f)) * 2) ** 2 * amp;
    f *= 2.1;
    amp *= 0.48;
  }
  return sum;
}
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// Distance to the nearest road, in tiles.
export function roadDistance(x, z) {
  let best = 1e9;
  for (const [[ax, az], [bx, bz]] of SEGMENTS) {
    if (x < Math.min(ax, bx) - 60 || x > Math.max(ax, bx) + 60 || z < Math.min(az, bz) - 60 || z > Math.max(az, bz) + 60) continue;
    const dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  // Roads wander a little.
  return best + noise(x * 0.012, z * 0.012) * 9;
}

const near = (p, x, z) => Math.hypot(x - p.x, z - p.z) / p.r;

// How close to a river's bed, and how wide it is there: [distance past the bank, half width].
function riverAt(x, z) {
  let best = 1e9, wide = 0;
  const wander = x + noise(x * 0.004, z * 0.004) * 60, drift = z + noise(x * 0.004 + 9, z * 0.004) * 60;
  for (const [[ax, az, aw], [bx, bz, bw]] of STREAMS) {
    if (wander < Math.min(ax, bx) - 90 || wander > Math.max(ax, bx) + 90 || drift < Math.min(az, bz) - 90 || drift > Math.max(az, bz) + 90) continue;
    const dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((wander - ax) * dx + (drift - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(wander - ax - dx * t, drift - az - dz * t), w = aw + (bw - aw) * t;
    if (d - w < best) {
      best = d - w;
      wide = w;
    }
  }
  return [best, wide];
}

// How far into the badlands and the swamp a point is, each 0..1.
export function region(x, z) {
  const edge = fbm(x * 0.0015 + 3, z * 0.0015, 3) * 0.45;
  return [sstep(1, 0.72, near(BADLANDS, x, z) + edge), sstep(1, 0.7, near(SWAMP, x, z) + edge)];
}

export function riverDistance(x, z) {
  return riverAt(x, z)[0];
}

function baseHeight(x, z) {
  const cx = x / WORLD - 0.5, cz = z / WORLD - 0.5;
  const edge = Math.hypot(cx, cz) * 2 + fbm(x * 0.0006, z * 0.0006, 3) * 0.35;
  const land = sstep(1.0, 0.8, edge);

  let h = mix(-40, 18, land);
  const soft = h + fbm(x * 0.0018, z * 0.0018, 2) * 90 * land; // the land without its bumps, for roads
  h += fbm(x * 0.0018, z * 0.0018, 5) * 90 * land;
  h += fbm(x * 0.012, z * 0.012, 3) * 7 * land;

  // The Frostwall: a mountain range along the north, with spurs running south.
  const north = sstep(2300, 900, z + fbm(x * 0.001, 3.3, 3) * 900);
  h += ridged(x * 0.0011, z * 0.0011, 5) * 760 * north * land;
  // Rolling highlands in the east.
  h += ridged(x * 0.0024, z * 0.0024, 4) * 130 * sstep(4300, 6200, x) * land;

  const [bad, marsh] = region(x, z);
  if (bad > 0) {
    // Badlands: the land steps up in flat-topped red terraces.
    const v = h * 1.25 + 26, band = 24, f = v / band - Math.floor(v / band);
    h = mix(h, (Math.floor(v / band) + sstep(0.72, 0.94, f)) * band, bad);
  }
  // Swamp: low and level, with black pools where it dips below the water.
  if (marsh > 0) h = mix(h, 2.2 + fbm(x * 0.009, z * 0.009, 3) * 11, marsh);

  // Rivers cut down to the water before towns level the ground back over them.
  const [bank, wide] = riverAt(x, z);
  if (bank < 34) h = mix(h, Math.min(h, -2.6), sstep(30, -wide * 0.5, bank));

  // Places carve the land.
  const L = PLACES.lake, ld = near(L, x, z) + fbm(x * 0.002, z * 0.002, 3) * 0.3;
  h = mix(h, -26, sstep(1.0, 0.72, ld));
  const S = PLACES.spire;
  h = mix(h, S.y, sstep(1.0, 0.7, near(S, x, z) + fbm(x * 0.01, z * 0.01, 2) * 0.25));
  const H = PLACES.hollow;
  h = mix(h, H.y, sstep(1.0, 0.6, near(H, x, z)));
  const T = PLACES.spirit;
  h = mix(h, T.y + (1 - near(T, x, z)) * 60, sstep(1.0, 0.45, near(T, x, z)));
  const R = PLACES.ribs;
  h = mix(h, R.y, sstep(1.0, 0.6, near(R, x, z)) * 0.8);

  // Roads smooth out the land they cross, and bank up across rivers as fords.
  if (h > 2 || bank < 8) {
    const rd = roadDistance(x, z);
    if (rd < 34) h = mix(h, Math.max(3, Math.min(h + 14, soft)), sstep(30, 6, rd));
    if (bank < 8 && rd < 9) h = Math.max(h, 1.2);
  }
  // Towns last: their ground stays level whatever runs through it.
  for (const T of TOWNS) {
    const d = near(T, x, z);
    if (d < 1) h = mix(h, T.y, sstep(1.0, 0.6, d));
  }
  return h;
}

// Damage to the land: bowls pressed into the height function, saved with the world.
// Each is [x, z, radius, depth]. A grid keeps the lookup cheap, since height() runs constantly.
const DENT_CELL = 64, MAX_DENTS = 1500;
export const dents = [];
let dentGrid = new Map();
const cellKey = (i, j) => i * 100000 + j;

function indexDent(d) {
  const [x, z, r] = d;
  for (let j = Math.floor((z - r) / DENT_CELL); j <= Math.floor((z + r) / DENT_CELL); j++) {
    for (let i = Math.floor((x - r) / DENT_CELL); i <= Math.floor((x + r) / DENT_CELL); i++) {
      const k = cellKey(i, j);
      if (!dentGrid.has(k)) dentGrid.set(k, []);
      dentGrid.get(k).push(d);
    }
  }
}

export const dentShape = (d, r) => (d >= r ? 0 : (1 - (d / r) ** 2) ** 2);

// Returns the oldest dent if this one pushed it out, so what's on screen can fill it back in.
export function addDent(x, z, r, depth) {
  const d = [x, z, r, depth];
  dents.push(d);
  indexDent(d);
  if (dents.length <= MAX_DENTS) return null;
  const old = dents.shift();
  dentGrid = new Map();
  dents.forEach(indexDent);
  return old;
}

// How far the land has been pushed down at a point.
export function dentAt(x, z) {
  const list = dentGrid.get(cellKey(Math.floor(x / DENT_CELL), Math.floor(z / DENT_CELL)));
  if (!list) return 0;
  let sum = 0;
  for (const [dx, dz, r, depth] of list) sum += dentShape(Math.hypot(x - dx, z - dz), r) * depth;
  return sum;
}

export function height(x, z) {
  return dents.length ? baseHeight(x, z) - dentAt(x, z) : baseHeight(x, z);
}

// How much of each ground type: [golden meadow, crimson autumn wood, deep pine wood].
export function biome(x, z) {
  const warm = fbm(x * 0.0009 + 7, z * 0.0009, 3) + (z - 4000) * 0.00008;
  const wet = fbm(x * 0.0012 - 3, z * 0.0012 + 5, 3);
  let meadow = sstep(-0.05, 0.2, warm) * (1 - sstep(0.02, 0.2, wet));
  let autumn = sstep(0.0, 0.18, wet) * sstep(-0.2, 0.1, warm);
  let pine = 1 - Math.min(1, meadow + autumn);
  const sum = meadow + autumn + pine;
  meadow /= sum;
  autumn /= sum;
  pine /= sum;
  return [meadow, autumn, pine];
}

// Trees per chunk, 0..1. Clumped into woods with open glades.
export function forest(x, z) {
  return sstep(-0.05, 0.2, fbm(x * 0.004, z * 0.004 + 9, 3));
}
