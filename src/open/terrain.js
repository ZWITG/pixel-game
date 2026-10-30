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

const ROADS = [
  [[2900, 5300], [3200, 5120], [3470, 4960], [3560, 4700], [3700, 4000]],
  [[3700, 4000], [4000, 3360], [4700, 3280], [5300, 3050], [5640, 2860]],
  [[2900, 5300], [2500, 4500], [2180, 3640]],
  [[3470, 4960], [4200, 5380], [5200, 5500], [6050, 5660]],
];
const SEGMENTS = ROADS.flatMap((r) => r.slice(1).map((b, i) => [r[i], b]));

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

export function height(x, z) {
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

  // Roads smooth out the land they cross.
  if (h > 2) {
    const rd = roadDistance(x, z);
    if (rd < 34) h = mix(h, Math.max(3, Math.min(h + 14, soft)), sstep(30, 6, rd));
  }
  return h;
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
