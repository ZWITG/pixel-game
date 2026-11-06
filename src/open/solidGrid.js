// Solids (walls, houses, trees, landmarks) found by where they are, not by checking them all:
// a big city adds thousands, and heroes, monsters, townsfolk and the camera ask every frame.
// The grid rebuilds itself whenever solids are added or removed.
const CELL = 32, MARGIN = 8;
const key = (i, j) => i * 100003 + j;

function rebuild(marks) {
  const grid = new Map();
  for (const s of marks.solids) {
    const x0 = (s.r ? s.x - s.r : s.x0) - MARGIN, x1 = (s.r ? s.x + s.r : s.x1) + MARGIN;
    const z0 = (s.r ? s.z - s.r : s.z0) - MARGIN, z1 = (s.r ? s.z + s.r : s.z1) + MARGIN;
    for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(s);
      }
    }
  }
  marks.grid = { map: grid, count: marks.solids.length, last: marks.solids[marks.solids.length - 1] };
}

// The solids that could touch a point, or anything within `r` of it.
export function nearSolids(marks, x, z, r = 0) {
  const g = marks.grid;
  if (!g || g.count !== marks.solids.length || g.last !== marks.solids[marks.solids.length - 1]) rebuild(marks);
  const { map } = marks.grid;
  if (!r) return map.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
  const out = new Set();
  for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (const s of map.get(key(i, j)) ?? []) out.add(s);
  }
  return [...out];
}
