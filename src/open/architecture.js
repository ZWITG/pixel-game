import * as THREE from 'three';
import { TYPES } from './cityPlan.js';

// Buildings. Every people builds its own way, so you can tell whose land you're on from the
// rooftops. Each style paints one sheet of walls, roof and trim on a canvas, and every house of
// that style is real pitched geometry mapped onto it, one draw call each, with windows that
// light up at night. Sizes match the old house: about 1.7 by 1.6, door on the +z side.
const CELLS = 4, SHEET = 1024, CELL = SHEET / CELLS;
const SHAPES = 4;            // kinds of house per style
const FRONT = 0, SIDE = 1, GABLE = 2, BASE = 3, ROOF = 4, TIMBER = 5, STONE = 6;
const HALF_W = 0.86, HALF_D = 0.8, EAVE = 0.16;

export const STYLES = {
  // The Aurel Crown: white plaster, dark timber, red clay tile.
  aurel: { wall: '#e8dcc4', dark: '#c8b89c', beam: '#4a2e1c', base: '#a89a8c', roof: ['#a8402a', '#c8583a', '#7e2c1e'], roofKind: 'tile', frame: 'timber', pitch: 0.82, tall: 1.2, light: '#ffcf7a' },
  // The Thorn League: dark logs and deep thatch, hunched into the trees.
  thorn: { wall: '#5a3e28', dark: '#3e2a1a', beam: '#2a1c12', base: '#5a5448', roof: ['#8a7a3e', '#a8964e', '#5e5228'], roofKind: 'thatch', frame: 'log', pitch: 1.2, tall: 0.96, light: '#ffb45a' },
  // The Frostwall: hard grey stone, blue slate, snow on the ridge.
  frost: { wall: '#8a93a0', dark: '#646c7a', beam: '#3a4656', base: '#5a6270', roof: ['#3e5068', '#566c88', '#2a3a4e'], roofKind: 'slate', frame: 'stone', pitch: 1.05, tall: 1.1, light: '#ffe2a8', snow: true },
  // The Cinder Reach: black basalt, iron plates, furnaces showing through.
  cinder: { wall: '#2e2826', dark: '#1c1817', beam: '#5a2c16', base: '#1c1817', roof: ['#5a3a2a', '#7a4a2a', '#3a2418'], roofKind: 'iron', frame: 'stone', pitch: 0.55, tall: 1.14, light: '#ff6a1a' },
  // The Drowned Court: tarred planks on stilts, mossy shingle, sick green lamps.
  mire: { wall: '#6a7a5e', dark: '#4e5c46', beam: '#2e3826', base: '#3e4a38', roof: ['#4a5a34', '#5e7040', '#2e3a22'], roofKind: 'shingle', frame: 'plank', pitch: 0.95, tall: 1, light: '#b8f05a', stilts: true },
  // The Bone Waste: hides stretched over great ribs.
  bone: { wall: '#a88a64', dark: '#8a6e4c', beam: '#d8ccb0', base: '#6a543c', roof: ['#9a7a54', '#b4966c', '#6e543a'], roofKind: 'hide', frame: 'hide', pitch: 1.3, tall: 0.9, light: '#ffb060', ribs: true },
  // Free folk build with what's to hand.
  free: { wall: '#d8c8a4', dark: '#b8a884', beam: '#5a3e24', base: '#8a8078', roof: ['#b89c54', '#d0b468', '#8a7238'], roofKind: 'thatch', frame: 'timber', pitch: 1, tall: 1.06, light: '#ffcf7a' },
};

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// One sheet per style: `g` is what the day shows, `glow` holds only what shines at night.
function paintSheet(st) {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = SHEET;
    return c;
  };
  const day = make(), night = make(), g = day.getContext('2d'), n = night.getContext('2d'), r = seeded(9001);
  n.fillStyle = '#000000';
  n.fillRect(0, 0, SHEET, SHEET);
  const at = (i) => [(i % CELLS) * CELL, Math.floor(i / CELLS) * CELL];
  const fill = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };

  function wallIn(i) {
    const [x, y] = at(i), { wall, dark, beam, frame } = st;
    fill(x, y, CELL, CELL, wall);
    if (frame === 'log') {
      for (let k = 0; k < 11; k++) {
        const ly = y + k * (CELL / 11);
        fill(x, ly, CELL, CELL / 11 - 2, k % 2 ? wall : dark);
        fill(x, ly + CELL / 11 - 3, CELL, 3, beam);
        for (let q = 0; q < 4; q++) fill(x + r() * CELL, ly + 4 + r() * 12, 30 + r() * 40, 1.5, beam);
      }
    } else if (frame === 'stone') {
      for (let row = 0; row < 9; row++) {
        const h = CELL / 9, off = row % 2 ? 26 : 0;
        for (let col = -1; col < 6; col++) {
          const v = r();
          fill(x + col * 52 + off + 1.5, y + row * h + 1.5, 49, h - 3, v < 0.34 ? dark : v < 0.8 ? wall : st.base);
        }
        fill(x, y + row * h, CELL, 2, st.beam);
      }
    } else if (frame === 'plank') {
      for (let k = 0; k < 13; k++) {
        fill(x + k * (CELL / 13), y, CELL / 13 - 2, CELL, k % 3 ? wall : dark);
        fill(x + k * (CELL / 13) + CELL / 13 - 2, y, 2, CELL, beam);
      }
      for (let k = 0; k < 16; k++) fill(x + r() * CELL, y + r() * CELL, 22, 8, '#5e7040');
    } else if (frame === 'hide') {
      for (let k = 0; k < 7; k++) fill(x, y + k * (CELL / 7), CELL, CELL / 7 - 3, k % 2 ? wall : dark);
      for (let k = 0; k < 40; k++) fill(x + r() * CELL, y + r() * CELL, 2, 10, beam);
      fill(x + 40, y, 12, CELL, beam);
      fill(x + CELL - 52, y, 12, CELL, beam);
    } else {
      // Plaster, dirtied low down, held in a frame of dark beams.
      for (let k = 0; k < 500; k++) fill(x + r() * CELL, y + r() * CELL, 2 + r() * 4, 2, dark);
      for (const bx of [0, 84, 172, CELL - 14]) fill(x + bx, y, 14, CELL, beam);
      for (const by of [0, CELL * 0.48, CELL - 16]) fill(x, y + by, CELL, 16, beam);
      g.strokeStyle = beam;
      g.lineWidth = 11;
      for (const [ax, ay, bx, by] of [[14, 16, 84, 122], [242, 16, 172, 122]]) {
        g.beginPath();
        g.moveTo(x + ax, y + ay);
        g.lineTo(x + bx, y + by);
        g.stroke();
      }
    }
  }

  function windowAt(x, y, w, h) {
    fill(x - 7, y - 7, w + 14, h + 14, st.beam);
    fill(x, y, w, h, '#1a2230');
    n.fillStyle = st.light;
    n.fillRect(x, y, w, h);
    fill(x + w / 2 - 2, y, 4, h, st.beam);
    fill(x, y + h / 2 - 2, w, 4, st.beam);
    n.fillStyle = '#000000';
    n.fillRect(x + w / 2 - 2, y, 4, h);
    n.fillRect(x, y + h / 2 - 2, w, 4);
    g.fillStyle = '#ffffff30';
    g.fillRect(x + 3, y + 3, w / 2 - 7, h / 2 - 7);
    fill(x - 11, y + h + 7, w + 22, 8, st.beam);
    if (st.frame === 'timber') for (let k = 0; k < 6; k++) fill(x - 6 + k * (w / 5), y + h + 1 - r() * 4, 7, 6, ['#ff8fb1', '#ffcd75', '#f4f4f4'][k % 3]);
  }

  // The front: a door in the middle, a window either side, and a lamp.
  wallIn(FRONT);
  {
    const [x, y] = at(FRONT), dw = 62, dh = 118, dx = x + (CELL - dw) / 2, dy = y + CELL - dh - 16;
    fill(dx - 9, dy - 12, dw + 18, dh + 28, st.beam);
    fill(dx, dy, dw, dh + 16, '#5a3a22');
    for (let k = 1; k < 4; k++) fill(dx + (dw / 4) * k, dy, 3, dh + 16, '#3a2414');
    for (const by of [24, 84]) fill(dx, dy + by, dw, 7, '#2a2a2e');
    fill(dx + dw - 15, dy + 58, 8, 8, '#ffcd75');
    windowAt(x + 26, y + 60, 44, 56);
    windowAt(x + CELL - 70, y + 60, 44, 56);
  }
  wallIn(SIDE);
  {
    const [x, y] = at(SIDE);
    windowAt(x + 38, y + 70, 44, 56);
    windowAt(x + CELL - 82, y + 70, 44, 56);
  }
  wallIn(GABLE);
  {
    const [x, y] = at(GABLE);
    windowAt(x + CELL / 2 - 18, y + CELL * 0.55, 36, 40);
  }
  // Foundation stones.
  {
    const [x, y] = at(BASE);
    fill(x, y, CELL, CELL, st.base);
    for (let row = 0; row < 5; row++) for (let col = -1; col < 8; col++) {
      const v = 0.72 + r() * 0.4, w = 34, o = row % 2 ? 18 : 0;
      g.fillStyle = `rgba(${v > 1 ? '255,255,255' : '0,0,0'},${Math.abs(v - 1) * 0.5})`;
      g.fillRect(x + col * 37 + o, y + row * 51 + 2, w, 47);
    }
  }
  // The roof, row on row.
  {
    const [x, y] = at(ROOF), [mid, hi, lo] = st.roof;
    fill(x, y, CELL, CELL, mid);
    const rows = { tile: 12, slate: 15, shingle: 13, thatch: 0, iron: 5, hide: 0 }[st.roofKind];
    if (rows) {
      const h = CELL / rows;
      for (let row = 0; row < rows; row++) {
        const w = st.roofKind === 'iron' ? CELL : h * 1.25, count = Math.ceil(CELL / w) + 1;
        for (let col = -1; col < count; col++) {
          const v = r(), bx = x + col * w + (row % 2 ? w / 2 : 0);
          fill(bx + 1, y + row * h, w - 2, h - 2, v < 0.3 ? lo : v > 0.78 ? hi : mid);
          if (st.roofKind === 'tile') fill(bx + 1, y + row * h + h - 7, w - 2, 5, lo);
        }
      }
      if (st.roofKind === 'iron') for (let k = 0; k < 90; k++) fill(x + r() * CELL, y + r() * CELL, 3, 3, '#1a1210');
    } else {
      for (let k = 0; k < 2600; k++) {
        const v = r();
        fill(x + r() * CELL, y + r() * CELL, 1.5, 12 + r() * 18, v < 0.35 ? lo : v > 0.75 ? hi : mid);
      }
    }
    if (st.snow) {
      for (let k = 0; k < 900; k++) {
        const py = r() * r() * CELL * 0.8;
        fill(x + r() * CELL, y + py, 9, 7, '#eef6ff');
      }
    }
  }
  // Plain timber, and rough stone.
  {
    const [x, y] = at(TIMBER);
    fill(x, y, CELL, CELL, st.beam);
    for (let k = 0; k < 70; k++) fill(x + r() * CELL, y + r() * CELL, 40, 2, '#00000030');
    const [sx, sy] = at(STONE);
    fill(sx, sy, CELL, CELL, st.base);
    for (let k = 0; k < 60; k++) fill(sx + r() * CELL, sy + r() * CELL, 20, 14, r() < 0.5 ? '#00000022' : '#ffffff18');
  }
  return { day, night };
}

// Quads and triangles laid on the sheet.
class Shell {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.idx = [];
  }

  // a, b, c, d go round the face, counter-clockwise from outside, from its bottom-left.
  face(points, cell, uvs) {
    const base = this.pos.length / 3, [a, b, c] = points;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    const m = 2 / SHEET, size = 1 / CELLS, u0 = (cell % CELLS) * size, v0 = 1 - (Math.floor(cell / CELLS) + 1) * size;
    points.forEach((p, i) => {
      this.pos.push(...p);
      this.nor.push(nx / l, ny / l, nz / l);
      this.uv.push(u0 + m + uvs[i][0] * (size - 2 * m), v0 + m + uvs[i][1] * (size - 2 * m));
    });
    this.idx.push(base, base + 1, base + 2);
    if (points.length === 4) this.idx.push(base, base + 2, base + 3);
  }

  quad(a, b, c, d, cell, rx = 1, ry = 1) {
    this.face([a, b, c, d], cell, [[0, 0], [rx, 0], [rx, ry], [0, ry]]);
  }

  // A box resting on y, wrapped in one cell.
  box(x, y, z, w, h, d, cell) {
    const X0 = x - w / 2, X1 = x + w / 2, Z0 = z - d / 2, Z1 = z + d / 2, T = y + h;
    this.quad([X0, y, Z1], [X1, y, Z1], [X1, T, Z1], [X0, T, Z1], cell);
    this.quad([X1, y, Z0], [X0, y, Z0], [X0, T, Z0], [X1, T, Z0], cell);
    this.quad([X1, y, Z1], [X1, y, Z0], [X1, T, Z0], [X1, T, Z1], cell);
    this.quad([X0, y, Z0], [X0, y, Z1], [X0, T, Z1], [X0, T, Z0], cell);
    this.quad([X0, T, Z1], [X1, T, Z1], [X1, T, Z0], [X0, T, Z0], cell);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// One storey or two, a roof across the width, and what the style adds.
// `type`: a building type from cityPlan.js, which sets its footprint and storeys.
function shapeHouse(st, shape, type = 'house') {
  const t = TYPES[type] ?? TYPES.house, plain = type === 'house';
  const s = new Shell(), W = HALF_W * (t.w / TYPES.house.w), D = HALF_D * (t.d / TYPES.house.d), low = st.stilts ? 0.32 : 0.1;
  const storeys = plain ? (shape === 1 || shape === 3 ? 1.5 : 1) : t.storeys, top = low + st.tall * storeys;
  const rise = W * st.pitch, peak = top + rise, E = EAVE, wings = shape === 2 && plain;
  if (st.stilts) {
    for (const [x, z] of [[-W, -D], [W, -D], [-W, D], [W, D], [0, D], [0, -D]]) s.box(x * 0.92, 0, z * 0.92, 0.09, low + 0.04, 0.09, TIMBER);
    s.box(0, low - 0.05, 0.08, W * 2.1, 0.05, D * 2.3, TIMBER);
    s.box(0, 0, D + 0.24, 0.42, 0.26, 0.28, TIMBER);
  } else {
    s.quad([-W - 0.03, 0, D + 0.03], [W + 0.03, 0, D + 0.03], [W + 0.03, low + 0.05, D + 0.03], [-W - 0.03, low + 0.05, D + 0.03], BASE, 2, 0.2);
    s.quad([W + 0.03, 0, -D - 0.03], [-W - 0.03, 0, -D - 0.03], [-W - 0.03, low + 0.05, -D - 0.03], [W + 0.03, low + 0.05, -D - 0.03], BASE, 2, 0.2);
    s.quad([W + 0.03, 0, D + 0.03], [W + 0.03, 0, -D - 0.03], [W + 0.03, low + 0.05, -D - 0.03], [W + 0.03, low + 0.05, D + 0.03], BASE, 2, 0.2);
    s.quad([-W - 0.03, 0, -D - 0.03], [-W - 0.03, 0, D + 0.03], [-W - 0.03, low + 0.05, D + 0.03], [-W - 0.03, low + 0.05, -D - 0.03], BASE, 2, 0.2);
  }
  // Walls: the door's cell on the ground floor, windows on any floor above it.
  s.quad([-W, low, D], [W, low, D], [W, low + st.tall, D], [-W, low + st.tall, D], FRONT);
  if (storeys > 1) s.quad([-W, low + st.tall, D], [W, low + st.tall, D], [W, top, D], [-W, top, D], SIDE, 1, 0.5);
  s.quad([W, low, -D], [-W, low, -D], [-W, top, -D], [W, top, -D], SIDE, 1, storeys);
  s.quad([W, low, D], [W, low, -D], [W, top, -D], [W, top, D], SIDE, 1, storeys);
  s.quad([-W, low, -D], [-W, low, D], [-W, top, D], [-W, top, -D], SIDE, 1, storeys);
  // Gable ends, and the two faces of the roof, reaching out past the walls.
  s.face([[-W, top, D], [W, top, D], [0, peak, D]], GABLE, [[0, 0], [1, 0], [0.5, 1]]);
  s.face([[W, top, -D], [-W, top, -D], [0, peak, -D]], GABLE, [[0, 0], [1, 0], [0.5, 1]]);
  const eaveY = top - E * st.pitch, R = W + E, F = D + E;
  s.quad([R, eaveY, F], [R, eaveY, -F], [0, peak, -F], [0, peak, F], ROOF);
  s.quad([-R, eaveY, -F], [-R, eaveY, F], [0, peak, F], [0, peak, -F], ROOF);
  s.quad([R, eaveY, -F], [R, eaveY, F], [0, peak, F], [0, peak, -F], TIMBER, 1, 0.3);
  s.quad([-R, eaveY, F], [-R, eaveY, -F], [0, peak, -F], [0, peak, F], TIMBER, 1, 0.3);
  s.box(0, peak - 0.02, 0, 0.07, 0.05, F * 2.04, TIMBER);
  // A stone chimney on most; a shed against the wall, or a stair of steps to the door.
  if (shape !== 3) s.box(W * 0.52, top + rise * 0.3, -D * 0.4, 0.26, rise * 0.8 + 0.3, 0.26, STONE);
  s.box(0, 0, D + 0.1, 0.5, 0.08 + low * 0.6, 0.2, STONE);
  if (wings) {
    const x = W + 0.26, tall = top * 0.68;
    s.quad([W, 0, D * 0.7], [x + 0.26, 0, D * 0.7], [x + 0.26, tall, D * 0.7], [W, tall, D * 0.7], BASE, 1, 0.5);
    s.quad([x + 0.26, 0, D * 0.7], [x + 0.26, 0, -D * 0.7], [x + 0.26, tall, -D * 0.7], [x + 0.26, tall, D * 0.7], SIDE, 1, 0.7);
    s.quad([x + 0.34, tall - 0.06, D * 0.8], [x + 0.34, tall - 0.06, -D * 0.8], [W, tall + 0.34, -D * 0.8], [W, tall + 0.34, D * 0.8], ROOF, 0.5, 0.4);
  }
  // A chapel's bell tower over its door; an inn's sign; a barn's wide doors.
  if (type === 'chapel') {
    s.box(0, 0, D - 0.3, 0.7, peak + 0.4, 0.7, STONE);
    const t2 = peak + 0.4;
    s.quad([-0.45, t2, D + 0.15], [0.45, t2, D + 0.15], [0, t2 + 1.1, D - 0.3], [0, t2 + 1.1, D - 0.3], ROOF);
    s.quad([0.45, t2, D + 0.15], [0.45, t2, D - 0.75], [0, t2 + 1.1, D - 0.3], [0, t2 + 1.1, D - 0.3], ROOF);
    s.quad([0.45, t2, D - 0.75], [-0.45, t2, D - 0.75], [0, t2 + 1.1, D - 0.3], [0, t2 + 1.1, D - 0.3], ROOF);
    s.quad([-0.45, t2, D - 0.75], [-0.45, t2, D + 0.15], [0, t2 + 1.1, D - 0.3], [0, t2 + 1.1, D - 0.3], ROOF);
  }
  if (type === 'inn') s.box(W * 0.6, low + st.tall * 0.85, D + 0.3, 0.42, 0.3, 0.06, TIMBER);
  if (type === 'barn') s.box(0, 0, D + 0.02, W * 0.9, top * 0.75, 0.05, TIMBER);
  if (shape === 3 && plain) {
    // A watch turret at one corner.
    s.box(-W * 0.62, top, D * 0.55, 0.62, st.tall * 0.8, 0.62, STONE);
    const t = top + st.tall * 0.8;
    s.quad([-W * 0.62 - 0.4, t, D * 0.55 + 0.4], [-W * 0.62 + 0.4, t, D * 0.55 + 0.4], [-W * 0.62, t + 0.7, D * 0.55], [-W * 0.62, t + 0.7, D * 0.55], ROOF);
    s.quad([-W * 0.62 + 0.4, t, D * 0.55 + 0.4], [-W * 0.62 + 0.4, t, D * 0.55 - 0.4], [-W * 0.62, t + 0.7, D * 0.55], [-W * 0.62, t + 0.7, D * 0.55], ROOF);
    s.quad([-W * 0.62 + 0.4, t, D * 0.55 - 0.4], [-W * 0.62 - 0.4, t, D * 0.55 - 0.4], [-W * 0.62, t + 0.7, D * 0.55], [-W * 0.62, t + 0.7, D * 0.55], ROOF);
    s.quad([-W * 0.62 - 0.4, t, D * 0.55 - 0.4], [-W * 0.62 - 0.4, t, D * 0.55 + 0.4], [-W * 0.62, t + 0.7, D * 0.55], [-W * 0.62, t + 0.7, D * 0.55], ROOF);
  }
  if (st.ribs) {
    for (const z of [D + 0.08, 0.26, -0.26, -D - 0.08]) for (const side of [-1, 1]) {
      s.box(side * (W + 0.1), 0, z, 0.08, top * 0.9, 0.08, TIMBER);
      s.quad([side * (W + 0.14), top * 0.9, z], [side * 0.05, peak + 0.42, z], [side * 0.05, peak + 0.42, z + 0.09], [side * (W + 0.14), top * 0.9, z + 0.09], TIMBER);
    }
  }
  return s.build();
}

const made = {};
function style(id) {
  if (made[id]) return made[id];
  const st = STYLES[id] ?? STYLES.free, { day, night } = paintSheet(st);
  const map = new THREE.CanvasTexture(day), emissiveMap = new THREE.CanvasTexture(night);
  map.colorSpace = emissiveMap.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const material = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0 });
  made[id] = { material, st, shapes: new Map() };
  return made[id];
}

// `seed` picks which of the style's houses this is, the same one every visit.
function shapeOf(s, seed, type) {
  const k = `${type}${seed % SHAPES}`;
  if (!s.shapes.has(k)) s.shapes.set(k, shapeHouse(s.st, seed % SHAPES, type));
  return s.shapes.get(k);
}

export function makeBuilding(id, seed, type = 'house') {
  const s = style(id), mesh = new THREE.Mesh(shapeOf(s, seed, type), s.material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Every house of one look in one place is drawn as one batch (an InstancedMesh), so a city of a
// thousand houses is a few dozen draw calls. Each house gets a stand-in that moves and hides its
// own instance, so the rest of the game can treat it as one object.
const batches = new Map(), HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
class Standin extends THREE.Object3D {
  constructor(batch, index) {
    super();
    this.batch = batch;
    this.index = index;
    this.matrixAutoUpdate = false;
  }

  get visible() {
    return this.shown ?? true;
  }

  set visible(v) {
    this.shown = v;
    this.sync();
  }

  // Writes this house's place into its batch. Call after moving it.
  sync() {
    if (!this.batch) return;
    this.updateMatrix();
    this.batch.mesh.setMatrixAt(this.index, this.shown === false ? HIDDEN : this.matrix);
    this.batch.mesh.instanceMatrix.needsUpdate = true;
  }
}

function batchFor(scene, cluster, id, seed, type) {
  const k = `${cluster}|${id}|${type}|${seed % SHAPES}`;
  let b = batches.get(k);
  if (!b) {
    const s = style(id);
    b = { scene, count: 0, mesh: null, geometry: shapeOf(s, seed, type), material: s.material };
    batches.set(k, b);
  }
  if (!b.mesh || b.count >= b.mesh.instanceMatrix.count) {
    const cap = Math.max(16, (b.mesh?.instanceMatrix.count ?? 8) * 2), mesh = new THREE.InstancedMesh(b.geometry, b.material, cap);
    mesh.castShadow = mesh.receiveShadow = true;
    if (b.mesh) {
      mesh.instanceMatrix.array.set(b.mesh.instanceMatrix.array);
      scene.remove(b.mesh);
      b.mesh.dispose();
    }
    mesh.count = b.count;
    b.mesh = mesh;
    scene.add(mesh);
  }
  return b;
}

// A building placed in the world, batched with its kind: returns its stand-in.
export function placeBuilding(scene, cluster, id, seed, type, x, y, z, rot, scale) {
  const b = batchFor(scene, cluster, id, seed, type), stand = new Standin(b, b.count++);
  b.mesh.count = b.count;
  stand.position.set(x, y, z);
  stand.rotation.y = rot;
  stand.scale.setScalar(scale);
  stand.sync();
  b.mesh.computeBoundingSphere();
  return stand;
}

// Windows come on as the light goes.
export function lightWindows(night) {
  for (const s of Object.values(made)) s.material.emissiveIntensity = night * 1.8;
}
