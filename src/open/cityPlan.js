import { TOWNS, ROADS, noise } from './terrain.js';

// Street plans for every place people live. A city is a walled ring of wards around a market,
// as in Watabou's Medieval Fantasy City Generator; its streets grow out from the gates and branch
// as in Parish and Müller's road networks (main streets, side streets that join up, lanes and
// alleys); and its houses stand on narrow street-front plots, sized off one unit with fractions
// and multiples of it, as burgage plots were in planned medieval towns. Each district builds its
// own kinds of house. Plans come from the place's name, so each is unique and the same every visit.
// Pure data, with no Three.js, so the terrain workers can paint the streets onto the ground.
// See docs/world-upgrade-plan.md and the research notes there.
const UNIT = 7.5;                    // tiles: the standard plot frontage
const WIDTH = { main: 15, street: 9, lane: 5.5, ring: 9 };
const STEP = 18;                     // tiles a growing street advances at a time
const SNAP = 13;                     // a street this close to another joins it and stops
const MOST_STREETS = { city: 260, village: 40, settlement: 60 };
const CELL = 4, STREET_CELL = 48;
// Building types: footprint in tiles (width along the street, depth back from it) and storeys.
export const TYPES = {
  cottage: { w: 5, d: 5, storeys: 1 },
  house: { w: 5.9, d: 5.5, storeys: 1 },
  townhouse: { w: 4.6, d: 7, storeys: 2 },
  merchant: { w: 8, d: 6.8, storeys: 2 },
  inn: { w: 10, d: 7, storeys: 2 },
  workshop: { w: 7, d: 6, storeys: 1.5 },
  towerhouse: { w: 5, d: 5, storeys: 3 },
  chapel: { w: 6.5, d: 11, storeys: 1.6 },
  barn: { w: 9.5, d: 6.5, storeys: 1.2 },
};
const DISTRICTS = {
  core: [['townhouse', 4], ['merchant', 3], ['inn', 1]],
  castle: [['merchant', 3], ['towerhouse', 2], ['townhouse', 1]],
  trade: [['inn', 2], ['barn', 2], ['workshop', 1], ['house', 1]],
  craft: [['workshop', 4], ['house', 2], ['cottage', 1]],
  outer: [['house', 3], ['cottage', 3], ['townhouse', 1]],
  suburb: [['cottage', 4], ['barn', 2], ['house', 1]],
};

function seeded(text) {
  let s = [...text].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483646, 7) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const pick = (list, r) => {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let roll = r * total;
  for (const [v, w] of list) if ((roll -= w) <= 0) return v;
  return list[0][0];
};

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l));
  return [Math.hypot(px - ax - dx * t, pz - az - dz * t), ax + dx * t, az + dz * t];
}

function inside(poly, x, z) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) yes = !yes;
  }
  return yes;
}

// The plan of one place. `place`: { name, x, z, kind: 'city' | 'village' | 'settlement', R } with R
// the reach of its streets in tiles. Everything returned is in the place's own frame (centre 0, 0).
export function makePlan(place) {
  const rand = seeded(place.name), { kind } = place, R = place.R, walled = kind === 'city';
  const plan = { name: place.name, x: place.x, z: place.z, kind, R, streets: [], plots: [], plazas: [], gates: [], wall: null, civic: [] };
  // Gates where the roads arrive, and enough more that every side has a way in.
  const angles = [];
  for (const road of ROADS) {
    for (let i = 1; i < road.length; i++) {
      const [ax, az] = road[i - 1], [bx, bz] = road[i];
      const [d] = segDist(place.x, place.z, ax, az, bx, bz);
      if (d > R * 1.4) continue;
      for (const [x, z] of [[ax, az], [bx, bz]]) {
        const far = Math.hypot(x - place.x, z - place.z);
        if (far > R * 0.6) angles.push(Math.atan2(z - place.z, x - place.x));
      }
    }
  }
  const gates = [];
  for (const a of angles) if (!gates.some((g) => Math.abs(Math.atan2(Math.sin(g - a), Math.cos(g - a))) < 0.5)) gates.push(a);
  const want = kind === 'city' ? 4 : 2;
  for (let k = 0; gates.length < want && k < 20; k++) {
    const a = rand() * 6.283;
    if (!gates.some((g) => Math.abs(Math.atan2(Math.sin(g - a), Math.cos(g - a))) < 1.1)) gates.push(a);
  }
  plan.gates = gates.map((a) => ({ a, x: Math.cos(a) * R * 1.1, z: Math.sin(a) * R * 1.1 }));
  // The wall: an irregular ring, pushed out a little at the gates.
  if (walled) {
    const n = 22 + Math.floor(R / 70);
    plan.wall = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 6.283, r = R * (0.94 + noise(Math.cos(a) * 1.7 + place.x * 0.01, Math.sin(a) * 1.7) * 0.16);
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  }
  const within = (x, z, margin = 0) => (plan.wall ? inside(plan.wall, x * (1 + margin / R), z * (1 + margin / R)) : Math.hypot(x, z) < R - margin);
  // The heart: a castle and its green for a city, a square with a well elsewhere.
  if (kind === 'city') {
    plan.castle = { x: 0, z: 0, half: 40 };
    plan.plazas.push({ x: 0, z: 0, r: 122, kind: 'bailey' });
  }
  const g0 = plan.gates[0], toward = kind === 'city' ? 0.48 : 0;
  plan.market = { x: g0.x * toward, z: g0.z * toward, r: kind === 'city' ? 48 : kind === 'village' ? 24 : 16 };
  plan.plazas.push({ ...plan.market, kind: 'market' });

  // ---- streets ----
  const grid = new Map();
  const key = (i, j) => i * 100003 + j;
  const addStreet = (pts, width, type) => {
    const s = { pts, width, type };
    plan.streets.push(s);
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
      for (let j = Math.floor((Math.min(az, bz) - 20) / STREET_CELL); j <= Math.floor((Math.max(az, bz) + 20) / STREET_CELL); j++) {
        for (let i = Math.floor((Math.min(ax, bx) - 20) / STREET_CELL); i <= Math.floor((Math.max(ax, bx) + 20) / STREET_CELL); i++) {
          const c = key(i, j);
          if (!grid.has(c)) grid.set(c, []);
          grid.get(c).push([ax, az, bx, bz, width, s]);
        }
      }
    }
    return s;
  };
  const nearest = (x, z, skip) => {
    let best = [Infinity, 0, 0, 0];
    for (const seg of grid.get(key(Math.floor(x / STREET_CELL), Math.floor(z / STREET_CELL))) ?? []) {
      if (seg[5] === skip) continue;
      const [d, px, pz] = segDist(x, z, seg[0], seg[1], seg[2], seg[3]);
      if (d - seg[4] / 2 < best[0]) best = [d - seg[4] / 2, px, pz, seg[4]];
    }
    return best;
  };
  const blocked = (x, z) => plan.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 4);
  // A curving line from one point to another, as a street would wander.
  const wander = (ax, az, bx, bz, sway) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 30)), nx = -(bz - az), nz = bx - ax, l = Math.hypot(nx, nz) || 1, phase = rand() * 6;
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, off = Math.sin(t * Math.PI) * Math.sin(phase + t * 2.4) * sway;
      return [ax + (bx - ax) * t + (nx / l) * off, az + (bz - az) * t + (nz / l) * off];
    });
  };
  // Main streets: every gate to the heart, the first by way of the market.
  const heart = kind === 'city' ? 126 : 0;
  plan.gates.forEach((g, i) => {
    const endR = heart / Math.max(1, Math.hypot(g.x, g.z)), ex = g.x * endR, ez = g.z * endR;
    if (i === 0 && kind === 'city') {
      addStreet(wander(g.x, g.z, plan.market.x, plan.market.z, 20), WIDTH.main, 'main');
      addStreet(wander(plan.market.x, plan.market.z, ex, ez, 10), WIDTH.main, 'main');
    } else addStreet(wander(g.x, g.z, kind === 'city' ? ex : plan.market.x, kind === 'city' ? ez : plan.market.z, R * 0.06), WIDTH.main, 'main');
  });
  if (kind === 'city') {
    // The way round the castle green, and the way round inside the wall.
    for (const [r, w] of [[heart, WIDTH.street], [R * 0.86, WIDTH.ring]]) {
      const n = Math.ceil((r * 6.283) / 34);
      addStreet(Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * 6.283) * r, Math.sin((i / n) * 6.283) * r]), w, 'ring');
    }
  }
  // Side streets grow off the streets already there, turning a little, until they meet another,
  // reach the edge, or run out; then lanes grow off them the same way.
  const grow = (from, width, type, most) => {
    const out = [];
    for (const s of from) {
      for (let k = 1; k < s.pts.length; k++) {
        const [ax, az] = s.pts[k - 1], [bx, bz] = s.pts[k], len = Math.hypot(bx - ax, bz - az), dir = Math.atan2(bz - az, bx - ax);
        for (let t = 12 + rand() * 30; t < len - 6; t += (type === 'lane' ? 34 : 58) + rand() * 40) {
          if (plan.streets.length >= MOST_STREETS[kind]) return out;
          for (const side of [-1, 1]) {
            if (rand() < (type === 'lane' ? 0.45 : 0.25)) continue;
            let x = ax + ((bx - ax) * t) / len, z = az + ((bz - az) * t) / len, a = dir + side * (Math.PI / 2 + (rand() - 0.5) * 0.6);
            const pts = [[x, z]], turn = (rand() - 0.5) * 0.12;
            x += Math.cos(a) * (s.width / 2 + 2);
            z += Math.sin(a) * (s.width / 2 + 2);
            for (let step = 0; step < most / STEP; step++) {
              a += turn + (rand() - 0.5) * 0.18;
              const nx = x + Math.cos(a) * STEP, nz = z + Math.sin(a) * STEP;
              if (!within(nx, nz, 14) || blocked(nx, nz)) break;
              const [d, px, pz] = nearest(nx, nz, s);
              x = nx;
              z = nz;
              if (d < SNAP && step > 0) {
                pts.push([px, pz]);
                break;
              }
              pts.push([x, z]);
            }
            if (pts.length > 2) out.push(addStreet(pts, width, type));
          }
        }
      }
    }
    return out;
  };
  const mains = plan.streets.slice();
  const sides = grow(mains, WIDTH.street, 'street', kind === 'city' ? 320 : 140);
  const more = kind === 'city' ? grow(sides, WIDTH.street, 'street', 200) : [];
  grow([...sides, ...more], WIDTH.lane, 'lane', kind === 'city' ? 110 : 70);

  // Where the kingdom's buildings go: round the market and the castle green, kept clear of houses.
  const mx = plan.market.x, mz = plan.market.z, mr = plan.market.r + 16;
  plan.civic = [
    ['market', mx + mr, mz], ['guild', mx - mr, mz], ['treasury', mx, mz + mr], ['warehouse', mx, mz - mr],
    ['barracks', heart ? heart * 0.72 : mr * 1.6, heart ? heart * 0.3 : 0], ['armory', heart ? -heart * 0.72 : -mr * 1.6, heart ? -heart * 0.3 : 0], ['granary', heart ? -heart * 0.3 : 0, heart ? heart * 0.72 : mr * 1.6],
  ].map(([kind, x, z]) => ({ kind, x, z }));
  for (const c of plan.civic) plan.plazas.push({ x: c.x, z: c.z, r: 11, kind: 'civic' });

  // ---- plots: narrow frontages along every street, houses at the front ----
  const taken = new Set();
  const cellsOf = (x, z, w, d, a) => {
    const out = [], ca = Math.cos(a), sa = Math.sin(a);
    for (let u = -w / 2; u <= w / 2; u += CELL * 0.7) for (let v = -d / 2; v <= d / 2; v += CELL * 0.7) {
      out.push(key(Math.floor((x + u * ca + v * sa) / CELL), Math.floor((z - u * sa + v * ca) / CELL)));
    }
    return out;
  };
  const district = (x, z) => {
    const fromHeart = Math.hypot(x, z), fromMarket = Math.hypot(x - plan.market.x, z - plan.market.z);
    if (kind !== 'city') return fromMarket < R * 0.4 ? 'core' : 'outer';
    if (fromMarket < R * 0.2) return 'core';
    if (fromHeart < R * 0.32) return 'castle';
    if (plan.gates.some((g) => Math.hypot(x - g.x, z - g.z) < R * 0.22)) return 'trade';
    const a = Math.atan2(z, x), craftSide = plan.gates[plan.gates.length - 1].a + 0.9;
    if (Math.abs(Math.atan2(Math.sin(a - craftSide), Math.cos(a - craftSide))) < 0.7) return 'craft';
    return 'outer';
  };
  const lay = (x, z, faceA, type, dist, frontage) => {
    const t = TYPES[type], cells = cellsOf(x, z, t.w + 1.2, t.d + 1.2, faceA);
    if (cells.some((c) => taken.has(c))) return false;
    // Not on any street, not in a square, not past the wall.
    const corners = [[-t.w / 2, -t.d / 2], [t.w / 2, -t.d / 2], [-t.w / 2, t.d / 2], [t.w / 2, t.d / 2], [0, 0]];
    for (const [u, v] of corners) {
      const px = x + u * Math.cos(faceA) + v * Math.sin(faceA), pz = z - u * Math.sin(faceA) + v * Math.cos(faceA);
      if (nearest(px, pz)[0] < 1.2 || blocked(px, pz) || !within(px, pz, 8)) return false;
    }
    for (const c of cells) taken.add(c);
    // The door faces the street: a quarter-turn-free angle, `rot` as the house model uses it.
    plan.plots.push({ x, z, rot: faceA, type, district: dist, frontage, score: 0 });
    return true;
  };
  for (const s of plan.streets) {
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, az] = s.pts[k - 1], [bx, bz] = s.pts[k], len = Math.hypot(bx - ax, bz - az), dir = Math.atan2(bz - az, bx - ax);
      for (const side of [-1, 1]) {
        for (let t = 2; t < len - 2;) {
          const px = ax + ((bx - ax) * t) / len, pz = az + ((bz - az) * t) / len, dist = district(px, pz);
          const type = pick(DISTRICTS[dist], rand()), T = TYPES[type];
          const back = s.width / 2 + 1.4 + T.d / 2, nx = Math.cos(dir + side * Math.PI / 2), nz = Math.sin(dir + side * Math.PI / 2);
          const hx = px + nx * back, hz = pz + nz * back;
          // The house faces the street: its +z (door) side toward it.
          const face = Math.atan2(-nx, -nz);
          if (lay(hx, hz, face, type, dist, s.type)) t += T.w + 0.6 + (s.type === 'main' ? 0 : rand() * 1.5);
          else t += UNIT * 0.5;
        }
      }
    }
  }
  // Outside a city's gates, cottages and barns along the roads out.
  if (walled) {
    for (const g of plan.gates) {
      const len = Math.hypot(g.x, g.z), ux = g.x / len, uz = g.z / len;
      for (let d = R + 30; d < R * 1.32; d += 9 + rand() * 6) {
        for (const side of [-1, 1]) {
          const type = pick(DISTRICTS.suburb, rand()), T = TYPES[type], back = WIDTH.main / 2 + 2 + T.d / 2;
          const x = ux * d - uz * side * back, z = uz * d + ux * side * back;
          lay(x, z, Math.atan2(uz * side, -ux * side), type, 'suburb', 'road');
        }
      }
    }
  }
  // Build order: the best addresses first, so a growing town fills its middle and main streets.
  for (const p of plan.plots) {
    p.score = Math.hypot(p.x - plan.market.x, p.z - plan.market.z) * (p.frontage === 'main' ? 0.6 : p.frontage === 'lane' ? 1.25 : 1) + (p.district === 'suburb' ? R * 0.6 : 0) + rand() * 25;
  }
  plan.plots.sort((a, b) => a.score - b.score);
  // A chapel near the market, and one for every few hundred houses out in the wards.
  const chapels = 1 + Math.floor(plan.plots.length / 400);
  for (let i = 0, n = 0; i < plan.plots.length && n < chapels; i += Math.max(7, Math.floor(plan.plots.length / chapels))) {
    const p = plan.plots[i];
    if (p.district === 'suburb' || TYPES[p.type].w < 6) continue;
    p.type = 'chapel';
    n++;
  }
  return plan;
}

// ---- every plan, and how far a point is from a street (for painting the ground) ----
let plans = null;
const extra = [];
const grid = new Map();
const gkey = (i, j) => i * 100003 + j;

function index(plan) {
  for (const s of plan.streets) {
    for (let k = 1; k < s.pts.length; k++) {
      const ax = s.pts[k - 1][0] + plan.x, az = s.pts[k - 1][1] + plan.z, bx = s.pts[k][0] + plan.x, bz = s.pts[k][1] + plan.z;
      for (let j = Math.floor((Math.min(az, bz) - 24) / 64); j <= Math.floor((Math.max(az, bz) + 24) / 64); j++) {
        for (let i = Math.floor((Math.min(ax, bx) - 24) / 64); i <= Math.floor((Math.max(ax, bx) + 24) / 64); i++) {
          const c = gkey(i, j);
          if (!grid.has(c)) grid.set(c, []);
          grid.get(c).push([ax, az, bx, bz, s.width]);
        }
      }
    }
  }
}

export const SIZE = { city: 0.62, village: 0.55 };
export function townPlans() {
  if (plans) return plans;
  plans = new Map();
  for (const T of TOWNS) {
    if (T.kind !== 'city' && T.kind !== 'village') continue;
    const p = makePlan({ name: T.name, x: T.x, z: T.z, kind: T.kind, R: T.r * SIZE[T.kind] });
    plans.set(T.name, p);
    index(p);
  }
  for (const p of extra) index(p);
  return plans;
}

// A settlement founded while playing: its plan, also told to the terrain workers (chunks.js).
export function addPlan(p) {
  if (extra.some((q) => q.name === p.name)) return;
  extra.push(p);
  if (plans) index(p);
}

// How large a place can ever grow, from its name: most stay small, a few have room to be great.
export function limitOf(s) {
  if (s.fixed) return s.pop < 200 ? 300 : 1000;
  const roll = (s.name.charCodeAt(0) * 37 + s.name.charCodeAt(1) * 11 + s.name.length * 53) % 100;
  return roll < 45 ? 60 : roll < 72 ? 180 : roll < 92 ? 500 : 1000;
}

export function settlementPlan(s, limit) {
  return makePlan({ name: s.name, x: s.x, z: s.z, kind: 'settlement', R: 60 + Math.sqrt(limit) * 9 });
}

// Inside a square: no grass grows on the paving.
export function plazaAt(x, z) {
  for (const p of townPlans().values()) {
    if (Math.abs(x - p.x) > p.R * 1.4 || Math.abs(z - p.z) > p.R * 1.4) continue;
    for (const q of p.plazas) if (q.kind !== 'civic' && Math.hypot(x - p.x - q.x, z - p.z - q.z) < q.r) return true;
  }
  return false;
}

// Distance to the edge of the nearest street, matching how roads are painted (about 4 tiles wide).
export function streetDistance(x, z) {
  townPlans();
  let best = 1e9;
  for (const [ax, az, bx, bz, w] of grid.get(gkey(Math.floor(x / 64), Math.floor(z / 64))) ?? []) {
    const [d] = segDist(x, z, ax, az, bx, bz);
    best = Math.min(best, d - (w / 2 - 4));
  }
  return best;
}
