import * as THREE from 'three';
import { VoxelBuilder } from './voxel.js';

// Static scenery drawn into shared VoxelBuilders, so a whole kind of prop costs one draw call.
// Positions are in tiles; `r` is the world's seeded random function.

export function rock(b, x, z, r) {
  const s = 0.7 + r() * 0.6;
  b.box(x, 0.09 * s, z, 0.34 * s, 0.18 * s, 0.28 * s, '#8a8a8a', 0.1)
    .box(x + 0.08 * s, 0.2 * s, z - 0.03 * s, 0.18 * s, 0.1 * s, 0.16 * s, '#a6a6ae', 0.1);
  if (r() < 0.5) b.box(x - 0.18 * s, 0.05 * s, z + 0.1 * s, 0.14 * s, 0.1 * s, 0.12 * s, '#7a7a82', 0.1);
}

export function bush(b, x, z, r) {
  b.box(x, 0.16, z, 0.5, 0.32, 0.46, '#2f8a45')
    .box(x + 0.05, 0.36, z - 0.02, 0.34, 0.16, 0.32, '#3fa055');
  if (r() < 0.6) {
    for (let i = 0; i < 4; i++) b.box(x - 0.18 + r() * 0.36, 0.2 + r() * 0.2, z + 0.235, 0.06, 0.06, 0.02, '#e04060', 0);
  }
}

export function smallMushroom(b, x, z) {
  b.box(x, 0.05, z, 0.05, 0.1, 0.05, '#f4e8d0', 0).box(x, 0.12, z, 0.14, 0.05, 0.14, '#e04060', 0);
}

export function lilyPad(b, x, z, r) {
  b.box(x, -0.12, z, 0.26, 0.02, 0.24, '#38b764', 0.08);
  if (r() < 0.3) b.box(x + 0.05, -0.09, z, 0.06, 0.05, 0.06, '#ff8fb1', 0);
}

export function barrel(b, x, z) {
  b.box(x, 0.24, z, 0.36, 0.48, 0.36, '#8a5a32')
    .box(x, 0.24, z, 0.4, 0.42, 0.3, '#7a4a2a')
    .box(x, 0.14, z, 0.38, 0.04, 0.38, '#566c86', 0)
    .box(x, 0.36, z, 0.38, 0.04, 0.38, '#566c86', 0)
    .box(x, 0.49, z, 0.3, 0.02, 0.3, '#5a3a22', 0);
}

export function crate(b, x, z) {
  b.box(x, 0.2, z, 0.4, 0.4, 0.4, '#a86a3a')
    .box(x, 0.2, z, 0.42, 0.06, 0.42, '#7a4a2a', 0)
    .box(x, 0.2, z, 0.06, 0.42, 0.42, '#7a4a2a', 0);
}

export function noticeBoard(b, x, z) {
  b.box(x - 0.32, 0.45, z, 0.07, 0.9, 0.07, '#5a3a22')
    .box(x + 0.32, 0.45, z, 0.07, 0.9, 0.07, '#5a3a22')
    .box(x, 0.7, z, 0.74, 0.42, 0.06, '#a86a3a')
    .box(x, 0.94, z, 0.82, 0.06, 0.12, '#7a4a2a')
    .box(x - 0.15, 0.72, z + 0.035, 0.2, 0.24, 0.01, '#f4ecd8', 0)
    .box(x + 0.16, 0.68, z + 0.035, 0.22, 0.18, 0.01, '#fff3c0', 0);
}

export function anvil(b, x, z) {
  b.box(x, 0.15, z, 0.3, 0.3, 0.24, '#5a3a22')
    .box(x, 0.36, z, 0.42, 0.12, 0.22, '#3d4260')
    .box(x + 0.25, 0.38, z, 0.12, 0.06, 0.12, '#3d4260')
    .box(x - 0.05, 0.43, z, 0.32, 0.02, 0.18, '#94b0c2', 0);
}

// One fence piece along a tile edge: posts at both ends and two rails.
export function fence(b, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = x1 !== x0;
  b.box(x0, 0.28, z0, 0.1, 0.56, 0.1, '#7a4a2a').box(x1, 0.28, z1, 0.1, 0.56, 0.1, '#7a4a2a');
  for (const y of [0.22, 0.42]) b.box(cx, y, cz, alongX ? len : 0.05, 0.07, alongX ? 0.05 : len, '#a86a3a', 0.04);
}

// Post in `b`; the lamp goes in `glow`, a builder drawn unlit so it reads as light.
export function lanternPost(b, glow, x, z) {
  b.box(x, 0.06, z, 0.24, 0.12, 0.24, '#566c86')
    .box(x, 0.65, z, 0.08, 1.1, 0.08, '#333c57')
    .box(x + 0.12, 1.18, z, 0.3, 0.05, 0.05, '#333c57')
    .box(x + 0.24, 1.24, z, 0.2, 0.05, 0.2, '#333c57')
    .box(x + 0.24, 0.98, z, 0.16, 0.04, 0.16, '#333c57');
  glow.box(x + 0.24, 1.1, z, 0.14, 0.2, 0.14, '#ffd98a', 0);
}

// A stone fountain filling a 2x2 tile square whose corner is (x, z).
export function fountain(b, water, x, z) {
  const cx = x + 1, cz = z + 1;
  b.box(cx, 0.15, cz, 1.8, 0.3, 1.8, '#a6a6ae', 0.04)
    .box(cx, 0.32, cz - 0.85, 1.8, 0.1, 0.12, '#c9ccd4', 0)
    .box(cx, 0.32, cz + 0.85, 1.8, 0.1, 0.12, '#c9ccd4', 0)
    .box(cx - 0.85, 0.32, cz, 0.12, 0.1, 1.8, '#c9ccd4', 0)
    .box(cx + 0.85, 0.32, cz, 0.12, 0.1, 1.8, '#c9ccd4', 0)
    .box(cx, 0.6, cz, 0.24, 0.9, 0.24, '#a6a6ae')
    .box(cx, 1.05, cz, 0.7, 0.12, 0.7, '#c9ccd4')
    .box(cx, 1.2, cz, 0.18, 0.2, 0.18, '#a6a6ae');
  water.box(cx, 0.27, cz, 1.58, 0.04, 1.58, '#3f9be8', 0.02)
    .box(cx, 1.12, cz, 0.56, 0.03, 0.56, '#73c4f0', 0.02)
    .box(cx, 0.7, cz + 0.3, 0.08, 0.8, 0.04, '#9fd8ff', 0)
    .box(cx, 0.7, cz - 0.3, 0.08, 0.8, 0.04, '#9fd8ff', 0);
}

// A puffy cloud made of white blocks, drifting high above the map.
export function makeCloud(r) {
  const b = new VoxelBuilder();
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const w = 1.6 + r() * 2.2;
    b.box((i - n / 2) * 1.2 + r() * 0.6, r() * 0.5, (r() - 0.5) * 1.6, w, 0.7 + r() * 0.6, w * 0.8, '#ffffff', 0.03, { ao: 0.85 });
  }
  const mesh = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#8aa0b8', transparent: true, opacity: 0.92 }));
  return mesh;
}

let glowTexture = null;
// A soft additive light sprite, for lantern halos.
export function makeGlowSprite(color = '#ffcf7a', size = 1.1) {
  if (!glowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTexture = new THREE.CanvasTexture(c);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

// ---- Landmark pieces (v0.6.0) ----

// A mossy boulder filling a ROCK tile.
export function boulder(b, x, z, r) {
  const s = 0.85 + r() * 0.3;
  b.box(x, 0.3 * s, z, 0.82 * s, 0.6 * s, 0.74 * s, '#8a8a92', 0.08)
    .box(x + 0.1, 0.66 * s, z - 0.05, 0.55 * s, 0.24 * s, 0.5 * s, '#9a9aa2', 0.08)
    .box(x - 0.05, 0.8 * s, z, 0.4 * s, 0.06 * s, 0.36 * s, '#5f8a4a', 0.1);
}

// A broken pillar filling a RUIN tile. Moss on top, sometimes a carved capital.
export function ruinPillar(b, x, z, r) {
  const h = 0.8 + r() * 1.5;
  b.box(x, 0.1, z, 0.78, 0.2, 0.78, '#9a9aa2')
    .box(x, 0.1 + h / 2, z, 0.48, h, 0.48, '#b4b4bc', 0.05)
    .box(x + 0.245, 0.1 + h * 0.4, z, 0.02, h * 0.6, 0.1, '#8a8a92', 0)
    .box(x, 0.12 + h, z, 0.5, 0.06, 0.5, '#5f8a4a', 0.1);
  if (h > 1.6) b.box(x, 0.2 + h, z, 0.66, 0.16, 0.66, '#c9ccd4');
  if (r() < 0.5) b.box(x + 0.3, 0.08, z + 0.32, 0.26, 0.16, 0.22, '#9a9aa2', 0.1);
}

// Pieces of a fallen column lying in the grass (not solid).
export function fallenColumn(b, x, z) {
  b.box(x, 0.2, z, 1.1, 0.4, 0.42, '#b4b4bc', 0.05)
    .box(x + 0.75, 0.2, z + 0.1, 0.35, 0.4, 0.42, '#a6a6ae', 0.05)
    .box(x - 0.2, 0.42, z, 0.5, 0.05, 0.3, '#5f8a4a', 0.1);
}

// The altar at the heart of the ruins; its rune glows in `glow`.
export function altar(b, glow, x, z) {
  b.box(x, 0.12, z, 1.3, 0.24, 1.0, '#9a9aa2').box(x, 0.45, z, 0.9, 0.42, 0.6, '#b4b4bc', 0.04);
  glow.box(x, 0.67, z, 0.5, 0.02, 0.2, '#9fe8ff', 0).box(x, 0.67, z, 0.1, 0.02, 0.44, '#9fe8ff', 0);
}

// A tall standing stone with a faintly glowing rune.
export function standingStone(b, glow, x, z, r) {
  const h = 1.3 + r() * 0.5;
  b.box(x, h / 2, z, 0.42, h, 0.3, '#8a8a92', 0.06).box(x, h + 0.04, z, 0.34, 0.08, 0.24, '#9a9aa2');
  glow.box(x, h * 0.6, z + 0.151, 0.08, 0.3, 0.01, '#9fe8ff', 0).box(x, h * 0.6, z + 0.151, 0.22, 0.06, 0.01, '#9fe8ff', 0);
  glow.box(x, h * 0.6, z - 0.151, 0.08, 0.3, 0.01, '#9fe8ff', 0);
}

// A mushroom whose cap glows (stem in `b`, cap in `glow`).
export function glowMushroom(b, glow, x, z, s = 1) {
  b.box(x, 0.07 * s, z, 0.06 * s, 0.14 * s, 0.06 * s, '#f4e8d0', 0);
  glow.box(x, 0.16 * s, z, 0.2 * s, 0.07 * s, 0.2 * s, '#b48cff', 0).box(x, 0.21 * s, z, 0.1 * s, 0.04 * s, 0.1 * s, '#e8dcff', 0);
}

export function reeds(b, x, z, r) {
  for (let i = 0; i < 4; i++) {
    const h = 0.35 + r() * 0.35, rx = x + (r() - 0.5) * 0.4, rz = z + (r() - 0.5) * 0.4;
    b.box(rx, -0.15 + h / 2, rz, 0.03, h, 0.03, '#5f8a3a', 0);
    if (r() < 0.5) b.box(rx, -0.15 + h, rz, 0.05, 0.12, 0.05, '#7a4a2a', 0);
  }
}

export function leafLitter(b, x, z, r) {
  const colors = ['#8a5a32', '#b8862a', '#5f6a2a'];
  for (let i = 0; i < 3; i++) b.box(x + (r() - 0.5) * 0.8, 0.005, z + (r() - 0.5) * 0.8, 0.12, 0.01, 0.08, colors[i % 3], 0.1);
}

// One bridge tile: planks across the crossing and rails on sides that face water.
// `alongX` means people walk along x. `rails` = { n, s, e, w } sides with water.
export function bridgeTile(b, x, z, alongX, rails) {
  for (let i = 0; i < 4; i++) {
    const o = -0.375 + i * 0.25, c = i % 2 ? '#a86a3a' : '#b87a42';
    if (alongX) b.box(x + o, -0.04, z, 0.23, 0.08, 1, c, 0.04);
    else b.box(x, -0.04, z + o, 1, 0.08, 0.23, c, 0.04);
  }
  b.box(x, -0.12, z, 0.9, 0.1, 0.12, '#5a3a22', 0);
  const rail = (rx, rz, w, d) => b.box(rx, 0.32, rz, w, 0.06, d, '#7a4a2a').box(rx, 0.15, rz, Math.min(w, 0.07) || 0.07, 0.3, Math.min(d, 0.07) || 0.07, '#5a3a22');
  if (rails.n) rail(x, z - 0.47, 1, 0.06);
  if (rails.s) rail(x, z + 0.47, 1, 0.06);
  if (rails.w) rail(x - 0.47, z, 0.06, 1);
  if (rails.e) rail(x + 0.47, z, 0.06, 1);
}
