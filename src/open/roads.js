import { ROADS, height, riverDistance } from './terrain.js';
import { nationAt } from './nations.js';

// The road network as a graph, so traders go the way people really would: along the road while
// it serves, across country where it doesn't, and never over open water. Roads that end at a
// town's edge are joined through it.
const JOIN = 520;            // tiles between road ends that count as one crossroads, through a town
const STRAIGHT = 650;        // closer than this, a trader just goes straight there
const DETOUR = 1.9;          // a road this many times longer than the straight way isn't worth it
const SAMPLE = 30;           // tiles between checks for water along a straight leg
export const FERRY_DEPTH = -1.5; // water deeper than this is crossed by ferry

const nodes = [], edges = new Map();
function nodeAt(x, z) {
  let n = nodes.find((p) => p.x === x && p.z === z);
  if (!n) {
    n = { x, z, i: nodes.length, road: null };
    nodes.push(n);
    edges.set(n.i, []);
  }
  return n;
}
function link(a, b) {
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  edges.get(a.i).push([b.i, d]);
  edges.get(b.i).push([a.i, d]);
}
ROADS.forEach((road, r) => {
  const list = road.map(([x, z]) => nodeAt(x, z));
  list.forEach((n) => { n.road ??= r; });
  for (let i = 1; i < list.length; i++) link(list[i - 1], list[i]);
});
for (const a of nodes) {
  for (const b of nodes) {
    if (a.i < b.i && a.road !== b.road && Math.hypot(a.x - b.x, a.z - b.z) < JOIN && !edges.get(a.i).some(([j]) => j === b.i)) link(a, b);
  }
}

const nearest = (x, z) => nodes.reduce((best, n) => (Math.hypot(n.x - x, n.z - z) < Math.hypot(best.x - x, best.z - z) ? n : best), nodes[0]);

function shortest(from, to) {
  const dist = new Map([[from.i, 0]]), prev = new Map(), open = new Set([from.i]);
  while (open.size) {
    let u = null;
    for (const i of open) if (u === null || dist.get(i) < dist.get(u)) u = i;
    open.delete(u);
    if (u === to.i) break;
    for (const [v, d] of edges.get(u)) {
      const alt = dist.get(u) + d;
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt);
        prev.set(v, u);
        open.add(v);
      }
    }
  }
  const out = [];
  for (let i = to.i; i !== undefined; i = prev.get(i)) out.unshift(nodes[i]);
  return out[0] === from ? out : [from, to];
}

const wet = (ax, az, bx, bz) => {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / SAMPLE);
  for (let i = 1; i < n; i++) if (height(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n) < -1.5 && riverDistance(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n) > 0) return true;
  return false;
};

const length = (pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const cache = new Map();

// The way from one place to another, as a list of [x, z] points.
export function route(a, b) {
  const key = `${a.x | 0},${a.z | 0}>${b.x | 0},${b.z | 0}`;
  if (cache.has(key)) return cache.get(key);
  const straight = [[a.x, a.z], [b.x, b.z]], direct = Math.hypot(b.x - a.x, b.z - a.z), dry = !wet(a.x, a.z, b.x, b.z);
  let way = straight;
  if (direct > STRAIGHT || !dry) {
    const road = shortest(nearest(a.x, a.z), nearest(b.x, b.z)).map((n) => [n.x, n.z]);
    const byRoad = [[a.x, a.z], ...road, [b.x, b.z]];
    if (!dry || length(byRoad) < direct * DETOUR) way = byRoad;
  }
  cache.set(key, way);
  return way;
}

export { length as pathLength };

// Where a way crosses water: rivers by bridge or ford, lakes and pools by ferry. Each is a toll
// for whoever's land it's on.
export function crossings(path) {
  const out = [];
  let wasWet = false;
  for (let k = 1; k < path.length; k++) {
    const [ax, az] = path[k - 1], [bx, bz] = path[k], steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 40);
    for (let i = 1; i <= steps; i++) {
      const x = ax + ((bx - ax) * i) / steps, z = az + ((bz - az) * i) / steps, river = riverDistance(x, z) < 0, now = river || height(x, z) < FERRY_DEPTH;
      if (now && !wasWet) out.push({ x, z, owner: nationAt(x, z)?.id ?? 'free', ferry: !river });
      wasWet = now;
    }
  }
  return out;
}

// A point part of the way along a path, and the way it faces there.
export function along(path, gone) {
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
