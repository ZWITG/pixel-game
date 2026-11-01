import * as THREE from 'three';
import { paint, rock, spike, aimed, block } from './kit.js';

// Stonework in real shapes: round towers under pointed roofs, walls with battlements, gatehouses
// and keeps. Everything here is painted parts for one masonry mesh, in a town's local tiles.
// `P` is a palette: stone, dark, roof, trim. Solid ground plans stay in towns.js.
export const STONEWORK = {
  aurel: { stone: '#c8bca8', dark: '#9c9080', roof: '#a8402a', trim: '#e8c050' },
  thorn: { stone: '#7a7664', dark: '#5a5848', roof: '#3e5a34', trim: '#5fae62' },
  frost: { stone: '#8a93a0', dark: '#646c7a', roof: '#3e5068', trim: '#8fe0ff' },
  cinder: { stone: '#4a4240', dark: '#2e2826', roof: '#5a3a2a', trim: '#ff7a2a' },
  mire: { stone: '#5e6a54', dark: '#3e4a38', roof: '#3e4a2a', trim: '#a8d84a' },
  bone: { stone: '#a8967a', dark: '#7c6a54', roof: '#6e543a', trim: '#d8ccb0' },
  free: { stone: '#a89a8c', dark: '#7c6e68', roof: '#6a4a6e', trim: '#ffcd75' },
};

const cyl = (top, bottom, h, sides = 16, open = false) => new THREE.CylinderGeometry(top, bottom, h, sides, 1, open);
const MERLON_GAP = 3.2;

// A stretch of wall from one point to another, with a walkway and teeth along both edges.
export function wall(parts, P, ax, az, bx, bz, tall, thick) {
  const len = Math.hypot(bx - ax, bz - az), turn = Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const put = (g, along, y, across) => parts.push(g.rotateY(-turn).translate(mx + Math.cos(turn) * along - Math.sin(turn) * across, y, mz + Math.sin(turn) * along + Math.cos(turn) * across));
  put(paint(block(len, tall, thick), P.stone), 0, tall / 2, 0);
  put(paint(block(len, 1.2, thick + 0.9), P.dark), 0, tall - 1.4, 0);
  put(paint(block(len, tall * 0.28, thick + 1.3), P.dark), 0, tall * 0.14, 0);
  const n = Math.floor(len / MERLON_GAP);
  for (let i = 0; i < n; i++) {
    const at = (i + 0.5 - n / 2) * (len / n);
    for (const side of [-1, 1]) put(paint(block(1.7, 1.9, 0.8), P.stone), at, tall + 0.9, side * (thick / 2 + 0.05));
  }
  // Buttresses to break up the long run, and arrow slits between them.
  for (let at = -len / 2 + 12; at < len / 2; at += 24) {
    for (const side of [-1, 1]) put(paint(aimed(cyl(0.9, 2, tall * 0.7, 4), 0, 0, 0, 0, 1, 0), P.dark), at, tall * 0.35, side * (thick / 2 + 0.5));
    for (const side of [-1, 1]) put(paint(block(0.5, 2.6, 0.2), '#141418'), at + 12, tall * 0.68, side * (thick / 2 + 0.06));
  }
}

// A round tower: a flared foot, a ring of corbels, teeth, and a pointed roof.
export function tower(parts, P, x, z, r, tall, { roof = true, flag = false } = {}) {
  const put = (g, y) => parts.push(g.translate(x, y, z));
  put(paint(cyl(r * 1.02, r * 1.26, tall * 0.2, 18), P.dark), tall * 0.1);
  put(paint(cyl(r, r * 1.02, tall, 18), P.stone), tall / 2);
  put(paint(cyl(r * 1.26, r * 1.02, 1.8, 18), P.dark), tall + 0.2);
  put(paint(cyl(r * 1.26, r * 1.26, 0.9, 18), P.stone), tall + 1.3);
  const teeth = Math.max(8, Math.round(r * 3));
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * 6.283;
    parts.push(paint(block(1.2, 1.5, 0.8).rotateY(-a + 1.57), P.stone).translate(x + Math.cos(a) * r * 1.2, tall + 2.4, z + Math.sin(a) * r * 1.2));
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4, y = tall * (0.4 + i * 0.16);
    parts.push(paint(block(0.6, 2.4, 0.3).rotateY(-a + 1.57), '#141418').translate(x + Math.cos(a) * r * 1.01, y, z + Math.sin(a) * r * 1.01));
  }
  if (roof) {
    put(paint(new THREE.ConeGeometry(r * 1.34, r * 2.6, 18), P.roof), tall + 2.2 + r * 1.3);
    put(paint(cyl(0.12, 0.2, 3.4, 6), P.trim), tall + 2.2 + r * 2.6 + 1.5);
    if (flag) put(paint(block(3, 1.8, 0.1).translate(1.6, 0.8, 0), P.trim), tall + 2.2 + r * 2.6 + 1.2);
  }
}

// A gate between two towers, with a stone arch and the portcullis drawn up. `across`: x or z.
export function gatehouse(parts, P, x, z, gap, tall, thick, across) {
  const place = (g, a, y, b) => parts.push((across ? g : g.rotateY(Math.PI / 2)).translate(x + (across ? a : b), y, z + (across ? b : a)));
  for (const s of [-1, 1]) tower(parts, P, x + (across ? s * (gap + 3.5) : 0), z + (across ? 0 : s * (gap + 3.5)), 5.2, tall + 7, { flag: true });
  place(paint(block(gap * 2 + 4, tall * 0.34, thick + 2), P.stone), 0, tall * 0.86, 0);
  place(paint(block(gap * 2 + 5, 1.2, thick + 2.8), P.dark), 0, tall * 1.04, 0);
  // The arch stands out from the wall, voussoirs fanned around the opening.
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI, ax = Math.cos(a) * gap, ay = tall * 0.56 + Math.sin(a) * gap * 0.46;
    for (const side of [-1, 1]) place(paint(block(2.2, 1.7, 1).rotateZ(a), i % 2 ? P.dark : P.stone), ax, ay, side * (thick / 2 + 0.7));
  }
  for (let i = -3; i <= 3; i++) place(paint(aimed(spike(0.22, 1.3, 5), 0, 0, 0, 0, -1, 0), '#3a3a42'), (i / 3.4) * gap, tall * 0.68, 0);
  for (let i = -3; i <= 3; i++) place(paint(block(0.3, 2.4, 0.3), '#3a3a42'), (i / 3.4) * gap, tall * 0.74, 0);
}

// The heart of a city: a square hall, a corner tower each way, and a great round tower rising
// through the middle, with a door you could march an army through.
export function citadel(parts, P, half, door) {
  parts.push(paint(block(half * 2, half * 0.9, half * 2).translate(0, half * 0.45, 0), P.stone), paint(block(half * 2.14, 1.4, half * 2.14).translate(0, half * 0.9 + 0.2, 0), P.dark));
  for (const x of [-1, 1]) {
    wall(parts, P, -half, x * half, half, x * half, half * 0.9, 1);
    wall(parts, P, x * half, -half, x * half, half, half * 0.9, 1);
    for (const z of [-1, 1]) tower(parts, P, x * half, z * half, 5.8, half * 1.5, { flag: x === z });
  }
  parts.push(paint(block(half * 1.2, half * 0.8, half * 1.2).translate(0, half * 1.3, 0), P.dark));
  tower(parts, P, 0, 0, half * 0.42, half * 2.3, { flag: true });
  for (const [x, z] of [[-1, -1], [1, 1]]) tower(parts, P, x * half * 0.5, z * half * 0.5, 3.4, half * 1.9);
  // The great door, under its own pointed gable.
  parts.push(paint(block(door + 3, door * 1.5, 2).translate(0, door * 0.75, half + 0.6), P.dark), paint(block(door, door * 1.3, 0.5).translate(0, door * 0.65, half + 1.7), '#3a2414'));
  for (const x of [-door * 0.25, door * 0.25]) parts.push(paint(block(0.3, door * 1.3, 0.2).translate(x, door * 0.65, half + 2), '#2a2a2e'));
  parts.push(paint(new THREE.ConeGeometry(door * 0.95, door * 0.8, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).translate(0, door * 1.8, half + 0.8), P.roof));
}

// A stretch of ruin: the top broken away in steps, with its stones lying where they fell.
export function broken(parts, P, x, z, tall, turn, rand) {
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const h = tall * (0.45 + rand() * 0.55), along = (i - (steps - 1) / 2) * 2.4;
    parts.push(paint(block(2.5, h, 3.4).rotateY(-turn), i % 2 ? P.stone : P.dark).translate(x + Math.cos(turn) * along, h / 2, z + Math.sin(turn) * along));
  }
  for (let i = 0; i < 3; i++) parts.push(paint(rock(0.7 + rand() * 0.8), P.dark).translate(x + (rand() - 0.5) * 8, 0.5, z + (rand() - 0.5) * 8));
}

// A tower with its head knocked off, open to the sky.
export function brokenTower(parts, P, x, z, r, tall, rand) {
  parts.push(paint(cyl(r, r * 1.1, tall * 0.55, 16, true).scale(1, 1, 1), P.stone).translate(x, tall * 0.275, z));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.283, h = 2 + rand() * tall * 0.45;
    parts.push(paint(block(1.9, h, 1.4).rotateY(-a + 1.57), i % 2 ? P.stone : P.dark).translate(x + Math.cos(a) * r * 0.98, tall * 0.55 + h / 2 - 0.5, z + Math.sin(a) * r * 0.98));
  }
}

// A shelter of hide on poles, ridge running front to back.
export function tent(parts, x, z, w, d, color, rand) {
  const h = w * 0.72, g = new THREE.BufferGeometry();
  const X = w / 2, Z = d / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-X, 0, Z, X, 0, Z, 0, h, Z, X, 0, -Z, -X, 0, -Z, 0, h, -Z, X, 0, Z, X, 0, -Z, 0, h, -Z, 0, h, Z, -X, 0, -Z, -X, 0, Z, 0, h, Z, 0, h, -Z], 3));
  g.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 6, 8, 9, 10, 11, 12, 10, 12, 13]);
  g.computeVertexNormals();
  parts.push(paint(g, color).translate(x, 0, z));
  parts.push(paint(block(0.3, 0.3, d + 1).translate(0, h, 0), '#5a3a22').translate(x, 0, z));
  parts.push(paint(block(w * 0.3, h * 0.72, 0.1).translate(0, h * 0.36, Z + 0.05), '#1a1412').translate(x, 0, z));
  for (const s of [-1, 1]) parts.push(paint(aimed(cyl(0.05, 0.05, 2.4, 4), 0, 0, 0, s, 1.4, rand() - 0.5), '#5a3a22').translate(x + s * (X + 1), 0.6, z));
}
