import { ROADS, TOWNS, PLACES, WORLD, height, smoothHeight, riverDistance, biome, forest } from './terrain.js';

// Where the roadside places stand (roadside.js gives them life). Only the land and the roads
// decide, and nothing here needs three.js, so the ground workers use it too: no trees grow on an
// inn's yard.

// A point part of the way along a road, and the way it runs there (as roads.js along()).
function along(path, gone) {
  let left = gone;
  for (let k = 1; k < path.length; k++) {
    const [ax, az] = path[k - 1], [bx, bz] = path[k], d = Math.hypot(bx - ax, bz - az);
    if (left <= d || k === path.length - 1) {
      const t = d ? Math.min(1, left / d) : 1;
      return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az)];
    }
    left -= d;
  }
  return [path[0][0], path[0][1], 0];
}

const STARTS = ['Ash', 'Bram', 'Cold', 'Dun', 'Elm', 'Fen', 'Gold', 'Hollow', 'Iron', 'Kettle', 'Long', 'Mill', 'Oak', 'Rook', 'Stone', 'Thorn', 'Wold', 'Yew'];
const ENDS = ['ford', 'by', 'stead', 'well', 'mere', 'wick', 'combe', 'ley', 'holt', 'marsh', 'gate', 'bridge'];
function word(seed) {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 1000003;
  return STARTS[h % STARTS.length] + ENDS[(h >> 5) % ENDS.length];
}

const INN_EVERY = 820, STOP_EVERY = 410;   // tiles along a road between inns, and between any two stops
const SIDE = 16;                           // tiles from the middle of the road
const TOWN_GAP = 90, PLACE_GAP = 170;      // tiles kept clear of towns and of each other

const ADJ = ['Red', 'Sleeping', 'Gilded', 'Crooked', 'Laughing', 'Drowned', 'Wandering', 'Black', 'Silver', 'Hungry', 'Lame', 'Merry'];
const NOUN = ['Lantern', 'Boar', 'Goose', 'Wheel', 'Stag', 'Kettle', 'Crow', 'Anchor', 'Horn', 'Barrel', 'Fox', 'Bell'];

// The working places out in the country: what they make, how many, and the land they need.
const slope = (x, z) => Math.abs(smoothHeight(x + 4, z) - smoothHeight(x - 4, z)) / 8 + Math.abs(smoothHeight(x, z + 4) - smoothHeight(x, z - 4)) / 8;
export const WORKS = {
  watermill: { name: 'Watermill', good: 'grain', count: 6, look: 'merchant', land: (x, z, y) => y > 1.5 && y < 40 && riverDistance(x, z) > 4 && riverDistance(x, z) < 11 },
  windmill: { name: 'Windmill', good: 'grain', count: 6, look: 'elder', land: (x, z, y) => y > 16 && y < 140 && biome(x, z)[0] > 0.55 && forest(x, z) < 0.35 && slope(x, z) < 0.12 },
  quarry: { name: 'Quarry', good: 'stone', count: 5, look: 'smith', land: (x, z, y) => y > 25 && y < 220 && slope(x, z) > 0.28 && slope(x, z) < 0.6 },
  lumber: { name: 'Lumber Camp', good: 'wood', count: 6, look: 'smith', land: (x, z, y) => y > 6 && y < 160 && forest(x, z) > 0.75 && slope(x, z) < 0.25 },
  mine: { name: 'Mine', good: 'ore', count: 5, look: 'smith', land: (x, z, y) => y > 70 && y < 260 && slope(x, z) > 0.22 && slope(x, z) < 0.55 },
};

let seed = 9137;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clear = (list, x, z) => TOWNS.every((T) => Math.hypot(x - T.x, z - T.z) > T.r + TOWN_GAP)
  && Math.hypot(x - PLACES.hollow.x, z - PLACES.hollow.z) > PLACES.hollow.r + TOWN_GAP
  && Math.hypot(x - PLACES.spire.x, z - PLACES.spire.z) > PLACES.spire.r + TOWN_GAP
  && list.every((p) => Math.hypot(x - p.x, z - p.z) > PLACE_GAP);

// Where every place stands. Pure: the land and the roads decide.
let cached = null;
export function roadsidePlaces() {
  if (cached) return cached;
  seed = 9137;
  const list = [];
  ROADS.forEach((path, r) => {
    let len = 0;
    for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
    // Inns and waystations a stage apart.
    for (let d = STOP_EVERY / 2, n = 0; d < len - 60; d += STOP_EVERY, n++) {
      const [rx, rz, a] = along(path, d), side = n % 2 ? 1 : -1, px = Math.cos(a) * side, pz = -Math.sin(a) * side;
      const x = rx + px * SIDE, z = rz + pz * SIDE, y = height(x, z);
      if (y < 2 || slope(x, z) > 0.3 || !clear(list, x, z)) continue;
      const inn = Math.round(d / STOP_EVERY) % Math.round(INN_EVERY / STOP_EVERY) === 0;
      const kind = inn ? 'inn' : 'stop', name = inn ? `The ${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}` : `${word(`${r}${n}way`)} Waystation`;
      list.push({ kind, name, x, z, y, road: [rx, rz], face: Math.atan2(-px, -pz), along: a, r: 30 });
    }
    // A toll house before each bridge.
    for (let d = 20, wet = false; d < len; d += 6) {
      const [x, z] = along(path, d), now = riverDistance(x, z) < 0;
      if (now && !wet) {
        const [bx, bz, a] = along(path, Math.max(0, d - 22)), y = height(bx, bz);
        if (y > 1 && clear(list.filter((p) => p.kind === 'toll'), bx, bz) && TOWNS.every((T) => Math.hypot(bx - T.x, bz - T.z) > T.r + 20)) {
          list.push({ kind: 'toll', name: `${word(`${r}${Math.round(d)}toll`)} Toll`, x: bx, z: bz, y, road: [bx, bz], along: a, face: a, r: 20 });
        }
      }
      wet = now;
    }
  });
  // The working places.
  for (const [kind, w] of Object.entries(WORKS)) {
    for (let n = 0, tries = 0; n < w.count && tries < 4000; tries++) {
      const x = 300 + rand() * (WORLD - 600), z = 300 + rand() * (WORLD - 600), y = height(x, z);
      if (!w.land(x, z, y) || !clear(list, x, z)) continue;
      list.push({ kind, name: `${word(`${kind}${n}`)} ${w.name}`, x, z, y, face: rand() * 6.283, r: 26 });
      n++;
    }
  }
  cached = list;
  return list;
}

