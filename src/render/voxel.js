import * as THREE from 'three';

// Each face: outward normal and 4 corners (unit cube, counter-clockwise from outside).
const FACES = [
  { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];
const tmp = new THREE.Color();

// Collects colored boxes into one geometry, so a whole model is a single draw call.
export class VoxelBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.col = [];
    this.idx = [];
  }

  // Box centered at (x, y, z) with size (w, h, d). `jitter` varies brightness a little
  // so flat colors get a hand-made feel. Side faces get darker toward the bottom
  // (cheap ambient occlusion) so blocks look grounded. `tint(vx, vz)` can return a
  // brightness factor per top vertex, used for smooth color blending across tiles.
  box(x, y, z, w, h, d, color, jitter = 0.06, { ao = 0.72, tint = null } = {}) {
    tmp.set(color);
    const k = 1 + (Math.random() * 2 - 1) * jitter;
    for (const face of FACES) {
      const base = this.pos.length / 3;
      for (const [cx, cy, cz] of face.c) {
        const vx = x + (cx * w) / 2, vy = y + (cy * h) / 2, vz = z + (cz * d) / 2;
        this.pos.push(vx, vy, vz);
        this.norm.push(face.n[0], face.n[1], face.n[2]);
        let s = k;
        if (face.n[1] === 0 && cy < 0) s *= ao;
        else if (face.n[1] < 0) s *= ao;
        if (tint && face.n[1] > 0) s *= tint(vx, vz);
        this.col.push(tmp.r * s, tmp.g * s, tmp.b * s);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export function vmat(options = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...options });
}

export function voxelMesh(builder, material, castShadow = true) {
  const mesh = new THREE.Mesh(builder.build(), material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

// Frees the geometry and material of a model that owns them.
export function disposeModel(group) {
  const mats = new Set();
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    mats.add(o.material);
  });
  for (const m of mats) m.dispose();
}
