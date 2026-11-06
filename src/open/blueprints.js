import { STYLES } from './architecture.js';

// Voxel blueprints for houses: the same house as its painted model (architecture.js, at the
// scale placeHouse uses), but built cube by cube from parts, so it can be broken: a stone footing,
// walls framed the way its people frame them, glass windows, a door, floors, a roof of its own
// stuff, a chimney, and a room inside with a bed, a table and a hearth. Door on +z, as the model.
// Materials are the ids voxels.js knows; colours vary a little cube to cube, like real stone and wood.
const S = 0.5;
const THATCH = 1, WOOD = 2, PLASTER = 3, TILE = 4, STONE = 5, GLASS = 6, IRON = 7, GLOW = 8;
const SCALE = 3.4, HALF_W = 0.86, HALF_D = 0.8, EAVE = 0.16;
const ROOF_MAT = { tile: TILE, thatch: THATCH, slate: STONE, iron: IRON, shingle: WOOD, hide: THATCH };
const WALL_MAT = { timber: PLASTER, log: WOOD, stone: STONE, plank: WOOD, hide: THATCH };

const hex = (c) => parseInt(c.slice(1), 16);
function shade(c, k) {
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

export function houseVoxels(styleId, shape, seed) {
  const st = STYLES[styleId] ?? STYLES.free;
  let rnd = seed * 7919 + 13;
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const vox = (t) => Math.round((t * SCALE) / S);
  const W = vox(HALF_W), D = vox(HALF_D), E = Math.max(1, vox(EAVE)), low = st.stilts ? vox(0.32) : 1;
  const storeys = shape === 1 || shape === 3 ? 1.5 : 1, wallTop = low + vox(st.tall * storeys), rise = Math.round(W * st.pitch * 0.9) + 1;
  const wing = shape === 2 ? 4 : 0, chimneyTop = wallTop + rise + 2;
  const nx = (W + E + 1) * 2 + 1 + wing, ny = chimneyTop + 3, nz = (D + E + 1) * 2 + 3;
  const cx = W + E + 1, cz = D + E + 1; // grid cell of the house's middle
  const mat = new Uint8Array(nx * ny * nz), col = new Uint32Array(nx * ny * nz);
  const set = (x, y, z, m, c, vary = 0.08) => {
    const i = x + cx, k = z + cz;
    if (i < 0 || y < 0 || k < 0 || i >= nx || y >= ny || k >= nz) return;
    const at = i + nx * (y + ny * k);
    mat[at] = m;
    // Most cubes keep the base colour so faces still merge into big quads; some are worn lighter or darker.
    const roll = rand();
    col[at] = roll < 0.72 ? c : shade(c, roll < 0.86 ? 1 - vary : 1 + vary);
  };
  const clear = (x, y, z) => {
    const i = x + cx, k = z + cz;
    if (i >= 0 && y >= 0 && k >= 0 && i < nx && y < ny && k < nz) mat[i + nx * (y + ny * k)] = 0;
  };
  const wall = hex(st.wall), dark = hex(st.dark), beam = hex(st.beam), base = hex(st.base), roofs = st.roof.map(hex), stone = 0x8e8490;
  const wallMat = WALL_MAT[st.frame] ?? PLASTER, roofMat = ROOF_MAT[st.roofKind] ?? TILE;

  // Footing, or stilts and a deck over the water.
  for (let x = -W; x <= W; x++) for (let z = -D; z <= D; z++) {
    if (st.stilts) {
      if ((Math.abs(x) === W || x === 0) && (Math.abs(z) === D)) for (let y = 0; y < low; y++) set(x, y, z, WOOD, beam);
      set(x, low - 1, z, WOOD, (x + z) % 2 ? dark : beam, 0.06);
    } else {
      for (let y = 0; y < low; y++) set(x, y, z, STONE, base, 0.12);
    }
  }
  // Walls, framed in the style's way, with the floor inside.
  const edge = (x, z) => Math.abs(x) === W || Math.abs(z) === D;
  for (let y = low; y < wallTop; y++) {
    for (let x = -W; x <= W; x++) for (let z = -D; z <= D; z++) {
      if (!edge(x, z)) continue;
      const corner = Math.abs(x) === W && Math.abs(z) === D, row = y - low;
      let m = wallMat, c = wall;
      if (st.frame === 'timber') {
        if (corner || (Math.abs(x) === W ? z % 3 === 0 : x % 3 === 0) || row === 0 || y === wallTop - 1 || row === vox(st.tall) - 1) { m = WOOD; c = beam; }
      } else if (st.frame === 'log') {
        c = row % 2 ? wall : dark;
        if (corner) c = beam;
      } else if (st.frame === 'stone') {
        c = (x + z + row * 2) % 3 === 0 ? dark : wall;
        if (corner) c = dark;
      } else if (st.frame === 'plank') {
        c = (Math.abs(x) === W ? z : x) % 2 ? wall : dark;
        if (corner) { m = WOOD; c = beam; }
      } else if (st.frame === 'hide') {
        if (corner || (Math.abs(x) === W ? z % 4 === 0 : x % 4 === 0)) { m = WOOD; c = beam; }
      }
      set(x, y, z, m, c, st.frame === 'stone' ? 0.12 : 0.07);
    }
  }
  for (let x = -W + 1; x < W; x++) for (let z = -D + 1; z < D; z++) set(x, low - 1, z, WOOD, (x + z) % 2 ? 0x7a5230 : 0x6a4426, 0.05);
  // An upper floor for a storey and a half.
  const upper = storeys > 1 ? low + vox(st.tall) : 0;
  if (upper) for (let x = -W + 1; x < W; x++) for (let z = -D + 1; z < D; z++) if (!(x === W - 2 && z === -D + 2)) set(x, upper, z, WOOD, 0x6a4426, 0.05);

  // Windows: glass set in the walls of every floor; a door on the front.
  const windowRows = [low + 3, ...(upper ? [upper + 2] : [])];
  for (const y of windowRows) {
    for (const x of [-W + 2, W - 3]) for (const z of [D, -D]) {
      if (z === D && Math.abs(x) < 2) continue;
      for (const dx of [0, 1]) for (const dy of [0, 1]) set(x + dx, y + dy, z, GLASS, hex(st.light), 0.04);
      for (const dx of [-1, 0, 1, 2]) set(x + dx, y - 1, z + Math.sign(z), WOOD, beam, 0.05);
    }
    for (const z of [-1, 1]) for (const x of [W, -W]) for (const dz of [0, 1]) for (const dy of [0, 1]) set(x, y + dy, z * 2 + dz - (z < 0 ? 1 : 0), GLASS, hex(st.light), 0.04);
  }
  for (let y = low; y < low + 4; y++) for (const x of [-1, 0]) set(x, y, D, WOOD, y === low + 3 ? beam : 0x5a3a22, 0.05);
  for (let y = low; y <= low + 4; y++) for (const x of [-2, 1]) set(x, y, D, WOOD, beam, 0.04);
  for (const x of [-2, -1, 0, 1]) set(x, low + 4, D, WOOD, beam, 0.04);
  for (const x of [-1, 0]) for (const z of [D + 1, D + 2]) set(x, low - 1, z, STONE, stone, 0.1); // the step

  // The roof, ridge running front to back, in rows of its own stuff; gable ends filled with wall.
  for (let dy = 0; dy <= rise; dy++) {
    const hw = Math.round((W + E) * (1 - dy / (rise + 1)));
    for (let z = -D - E; z <= D + E; z++) {
      for (let x = -hw; x <= hw; x++) {
        const outer = Math.abs(x) >= hw - 1 || dy === rise;
        if (outer) {
          const c = st.snow && dy >= rise - 1 ? 0xeef4fa : roofs[(dy + (z & 1)) % roofs.length];
          set(x, wallTop + dy, z, roofMat, c, 0.07);
        } else if (Math.abs(z) === D && Math.abs(x) < hw - 1) set(x, wallTop + dy, z, wallMat === PLASTER ? PLASTER : wallMat, dy % 3 ? wall : beam, 0.06);
      }
    }
  }
  for (let z = -D - E; z <= D + E; z++) set(0, wallTop + rise + 1, z, WOOD, beam, 0.04); // the ridge beam
  // A chimney with its hearth glowing at the bottom.
  if (shape !== 3) {
    const hx = Math.round(W * 0.52), hz = -Math.round(D * 0.4);
    for (let y = low; y <= chimneyTop; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(hx + dx, y, hz + dz, STONE, stone, 0.14);
    for (let y = low; y < low + 2; y++) for (const dx of [0, 1]) clear(hx + dx, y, hz + 1);
    set(hx, low, hz + 1, GLOW, 0xff8a3a, 0.1);
    set(hx + 1, low, hz + 1, GLOW, 0xffb04a, 0.1);
  }
  // A room to live in: a bed with a blanket, a table, a stool, a shelf.
  set(-W + 1, low, -D + 1, WOOD, 0x6a4426); set(-W + 2, low, -D + 1, WOOD, 0x6a4426);
  set(-W + 1, low + 1, -D + 1, PLASTER, 0xe8dcc8); set(-W + 2, low + 1, -D + 1, THATCH, hex(st.roof[0]));
  set(-W + 1, low, -D + 2, WOOD, 0x6a4426); set(-W + 2, low, -D + 2, WOOD, 0x6a4426); set(-W + 2, low + 1, -D + 2, THATCH, hex(st.roof[0]));
  for (const [x, z] of [[0, 0], [1, 0], [0, -1], [1, -1]]) set(x, low + 1, z, WOOD, 0x8a5a32, 0.05);
  set(0, low, 0, WOOD, 0x5a3a22); set(1, low, -1, WOOD, 0x5a3a22);
  set(-1, low, 1, WOOD, 0x7a5230);
  for (let x = -W + 1; x < -W + 4; x++) set(x, low + 3, D - 1, WOOD, 0x6a4426);
  set(-W + 1, low + 4, D - 1, GLASS, 0xd8b0e8); set(-W + 2, low + 4, D - 1, WOOD, 0xe8c060);
  // A lean-to shed for the wing shape; a lookout turret for the tall one.
  if (wing) {
    for (let x = W + 1; x <= W + wing; x++) for (let z = -D + 2; z <= D - 2; z++) {
      for (let y = 0; y < low + 4 - Math.floor((x - W) / 2); y++) if (Math.abs(z) === D - 2 || x === W + wing || y === 0) set(x, y, z, WOOD, (x + y) % 2 ? dark : beam, 0.06);
      set(x, low + 4 - Math.floor((x - W) / 2), z, roofMat, roofs[1], 0.07);
    }
  }
  if (shape === 3) {
    const tx = -Math.round(W * 0.62), tz = Math.round(D * 0.55);
    for (let y = wallTop; y < wallTop + 5; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(tx + dx, y, tz + dz, STONE, stone, 0.12);
    for (let dy = 0; dy < 3; dy++) for (let dx = -(2 - dy); dx <= 2 - dy; dx++) for (let dz = -(2 - dy); dz <= 2 - dy; dz++) set(tx + dx, wallTop + 5 + dy, tz + dz, roofMat, roofs[0], 0.07);
  }
  // Ribs over the hide roofs of the Bone Waste.
  if (st.ribs) {
    for (const z of [-D - 1, -1, 2, D + 1]) for (const side of [-1, 1]) {
      for (let y = 0; y < wallTop + rise; y++) {
        const x = side * Math.max(0, Math.round((W + 1) * Math.min(1, (wallTop + rise - y) / (rise + 2))));
        set(x, y, z, WOOD, beam, 0.03);
      }
    }
  }
  return { nx, ny, nz, s: S, ox: -cx * S - S / 2, oy: 0, oz: -cz * S - S / 2, mat, col };
}
