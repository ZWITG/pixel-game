// Voxel work done off the frame: turning painted models into voxels, and turning voxels into
// meshes. Meshing is greedy (faces of the same colour and shading merge into big quads) with
// per-corner ambient occlusion, as in 0fps's "Meshing in a Minecraft game" and "Ambient occlusion
// for Minecraft-like worlds" (docs/world-upgrade-plan.md, section 3).
//   A volume: { nx, ny, nz, s (voxel size), ox, oy, oz (local corner of voxel 0), mat, col }.

// Materials: 0 is empty. Strength and reach live in voxels.js; here we only sort colours into them.
const THATCH = 1, WOOD = 2, PLASTER = 3, TILE = 4, STONE = 5, GLASS = 6, IRON = 7, GLOW = 8;

function hsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

// What a painted colour is made of.
function materialOf(r, g, b, glow) {
  if (glow) return GLOW;
  const [h, s, l] = hsl(r, g, b);
  if (l < 0.26 && s < 0.25) return IRON;
  if (h >= 38 && h <= 55 && s > 0.45 && l > 0.45) return THATCH;
  if (h >= 15 && h <= 42 && s > 0.25 && l < 0.5) return WOOD;
  if (s < 0.22 && l > 0.62) return PLASTER;
  if (s < 0.3) return STONE;
  if (l > 0.82) return GLASS;
  return TILE;
}

// Paints triangles into a grid: every face sampled finer than a voxel, then the inside filled.
function voxelize({ pos, col, glow, s }) {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
  }
  minY = Math.min(minY, 0);
  const ox = minX - s, oy = minY, oz = minZ - s;
  const nx = Math.ceil((maxX - minX) / s) + 3, ny = Math.ceil((maxY - minY) / s) + 2, nz = Math.ceil((maxZ - minZ) / s) + 3;
  const n = nx * ny * nz, mat = new Uint8Array(n), color = new Uint32Array(n);
  const put = (x, y, z, c, m) => {
    const i = Math.floor((x - ox) / s), j = Math.floor((y - oy) / s), k = Math.floor((z - oz) / s);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    const at = i + nx * (j + ny * k);
    if (mat[at] && mat[at] !== GLOW) return;
    mat[at] = m;
    color[at] = c;
  };
  const tris = pos.length / 9, step = s * 0.45;
  for (let t = 0; t < tris; t++) {
    const a = t * 9, ax = pos[a], ay = pos[a + 1], az = pos[a + 2], bx = pos[a + 3], by = pos[a + 4], bz = pos[a + 5], cx = pos[a + 6], cy = pos[a + 7], cz = pos[a + 8];
    const r = col[a], g = col[a + 1], b = col[a + 2], lit = glow[t];
    const c = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255), m = materialOf(r, g, b, lit);
    const e = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - ax, cy - ay, cz - az), Math.hypot(cx - bx, cy - by, cz - bz));
    const k = Math.max(1, Math.ceil(e / step));
    for (let u = 0; u <= k; u++) {
      for (let v = 0; v <= k - u; v++) {
        const p = u / k, q = v / k, w = 1 - p - q;
        put(ax * w + bx * p + cx * q, ay * w + by * p + cy * q, az * w + bz * p + cz * q, c, m);
      }
    }
  }
  // Everything the outside air can't reach is inside the walls: fill it, a shade darker.
  const out = new Uint8Array(n), stack = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i && j && k && i < nx - 1 && j < ny - 1 && k < nz - 1) continue;
    const at = i + nx * (j + ny * k);
    if (!mat[at] && !out[at]) {
      out[at] = 1;
      stack.push(at);
    }
  }
  while (stack.length) {
    const at = stack.pop(), i = at % nx, j = Math.floor(at / nx) % ny, k = Math.floor(at / (nx * ny));
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = i + di, b = j + dj, c = k + dk;
      if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) continue;
      const to = a + nx * (b + ny * c);
      if (!mat[to] && !out[to]) {
        out[to] = 1;
        stack.push(to);
      }
    }
  }
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    let last = 0, lastM = STONE;
    for (let i = 0; i < nx; i++) {
      const at = i + nx * (j + ny * k);
      if (mat[at]) {
        last = color[at];
        lastM = mat[at] === GLOW || mat[at] === GLASS ? PLASTER : mat[at];
      } else if (!out[at]) {
        mat[at] = lastM;
        const r = ((last >> 16) & 255) * 0.72, g = ((last >> 8) & 255) * 0.72, b = (last & 255) * 0.72;
        color[at] = (r << 16) | (g << 8) | b;
      }
    }
  }
  hollow(nx, ny, nz, s, oy, mat, color);
  return { nx, ny, nz, s, ox, oy, oz, mat, col: color };
}

// Rooms inside: everything more than WALL voxels from the outside air is cleared, leaving walls
// of that thickness, with a plank floor at ground level and every storey up.
const WALL = 2, STOREY = 7, PLANK = (0x6a << 16) | (0x44 << 8) | 0x26;
function hollow(nx, ny, nz, s, oy, mat, color) {
  const n = mat.length, depth = new Uint8Array(n), queue = [];
  const air = (i, j, k) => i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz || !mat[i + nx * (j + ny * k)];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const at = i + nx * (j + ny * k);
    if (!mat[at]) continue;
    if (air(i + 1, j, k) || air(i - 1, j, k) || air(i, j + 1, k) || (j > 0 && air(i, j - 1, k)) || air(i, j, k + 1) || air(i, j, k - 1)) {
      depth[at] = 1;
      queue.push(at);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q], d = depth[at];
    if (d > WALL) continue;
    const i = at % nx, j = Math.floor(at / nx) % ny, k = Math.floor(at / (nx * ny));
    for (const [a, b, c] of [[i + 1, j, k], [i - 1, j, k], [i, j + 1, k], [i, j - 1, k], [i, j, k + 1], [i, j, k - 1]]) {
      if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) continue;
      const to = a + nx * (b + ny * c);
      if (mat[to] && !depth[to]) {
        depth[to] = d + 1;
        queue.push(to);
      }
    }
  }
  const ground = Math.max(0, Math.round(-oy / s));
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const at = i + nx * (j + ny * k);
    if (!mat[at] || depth[at] && depth[at] <= WALL) continue;
    if (j <= ground || (j - ground) % STOREY === 0) {
      mat[at] = WOOD;
      color[at] = PLANK;
    } else mat[at] = 0;
  }
}

// Greedy meshing with corner shading. Faces merge only when colour, material and all four
// corners' shading match, so the shading stays right on merged quads.
function mesh({ nx, ny, nz, s, ox, oy, oz, mat, col }) {
  const dims = [nx, ny, nz], solid = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && mat[i + nx * (j + ny * k)] !== 0;
  const P = [], N = [], C = [], I = [];
  const AO = [0.52, 0.68, 0.84, 1];
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3, x = [0, 0, 0], q = [0, 0, 0];
    q[d] = 1;
    const W = dims[u], H = dims[v], keys = new Float64Array(W * H), cols = new Uint32Array(W * H);
    for (let side = -1; side <= 1; side += 2) {
      for (x[d] = 0; x[d] < dims[d]; x[d]++) {
        let any = false;
        for (x[v] = 0; x[v] < H; x[v]++) {
          for (x[u] = 0; x[u] < W; x[u]++) {
            const at = x[u] + W * x[v];
            const here = solid(x[0], x[1], x[2]), there = solid(x[0] + q[0] * side, x[1] + q[1] * side, x[2] + q[2] * side);
            if (!here || there) {
              keys[at] = 0;
              continue;
            }
            // Corner shading from the air side: two edge neighbours and the diagonal.
            const n = [x[0] + q[0] * side, x[1] + q[1] * side, x[2] + q[2] * side];
            const ao = [];
            for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              const a = [...n], b = [...n], c = [...n];
              a[u] += du; b[v] += dv; c[u] += du; c[v] += dv;
              const s1 = solid(...a) ? 1 : 0, s2 = solid(...b) ? 1 : 0, cc = solid(...c) ? 1 : 0;
              ao.push(s1 && s2 ? 0 : 3 - (s1 + s2 + cc));
            }
            const idx = x[0] + nx * (x[1] + ny * x[2]);
            cols[at] = col[idx];
            keys[at] = 1 + col[idx] * 256 + (ao[0] * 64 + ao[1] * 16 + ao[2] * 4 + ao[3]);
            any = true;
          }
        }
        if (!any) continue;
        // Merge runs of the same face into rectangles.
        for (let j = 0; j < H; j++) {
          for (let i = 0; i < W;) {
            const key = keys[i + W * j];
            if (!key) {
              i++;
              continue;
            }
            let w = 1;
            while (i + w < W && keys[i + w + W * j] === key) w++;
            let h = 1, ok = true;
            while (j + h < H && ok) {
              for (let k = 0; k < w; k++) if (keys[i + k + W * (j + h)] !== key) { ok = false; break; }
              if (ok) h++;
            }
            const aoBits = key % 256, ao = [(aoBits >> 6) & 3, (aoBits >> 4) & 3, (aoBits >> 2) & 3, aoBits & 3], c = cols[i + W * j];
            const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
            const base = [0, 0, 0];
            base[d] = x[d] + (side > 0 ? 1 : 0);
            base[u] = i;
            base[v] = j;
            const du = [0, 0, 0], dv = [0, 0, 0];
            du[u] = w;
            dv[v] = h;
            const corners = [[0, 0], [1, 0], [1, 1], [0, 1]], first = P.length / 3;
            for (let k = 0; k < 4; k++) {
              const [cu, cv] = corners[k];
              P.push(ox + (base[0] + du[0] * cu + dv[0] * cv) * s, oy + (base[1] + du[1] * cu + dv[1] * cv) * s, oz + (base[2] + du[2] * cu + dv[2] * cv) * s);
              N.push(q[0] * side, q[1] * side, q[2] * side);
              const shade = AO[ao[k]];
              C.push(r * shade, g * shade, b * shade);
            }
            // Split the quad along the diagonal that keeps the shading smooth, and face it outward.
            const flip = ao[0] + ao[2] < ao[1] + ao[3];
            const tri = flip ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2], [0, 2, 3]];
            for (const t of tri) I.push(...(side > 0 ? [first + t[0], first + t[1], first + t[2]] : [first + t[0], first + t[2], first + t[1]]));
            for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) keys[i + k + W * (j + a)] = 0;
            i += w;
          }
        }
      }
    }
  }
  return { pos: new Float32Array(P), nor: new Float32Array(N), col: new Float32Array(C), idx: new Uint32Array(I) };
}

self.onmessage = ({ data: m }) => {
  if (m.type === 'voxelize') {
    const v = voxelize(m);
    self.postMessage({ type: 'voxelized', id: m.id, v }, [v.mat.buffer, v.col.buffer]);
  } else if (m.type === 'mesh') {
    const g = mesh(m.v);
    self.postMessage({ type: 'meshed', id: m.id, stamp: m.stamp, g }, [g.pos.buffer, g.nor.buffer, g.col.buffer, g.idx.buffer]);
  }
};
