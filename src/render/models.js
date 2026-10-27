import * as THREE from 'three';
import { VoxelBuilder, vmat, voxelMesh } from './voxel.js';

// All models face +z. Sizes are in tiles (1 unit = 1 map tile).

export function makeHumanoid(look, { sword = false } = {}) {
  const mat = vmat();
  const group = new THREE.Group();
  const root = new THREE.Group();
  root.scale.setScalar(look.scale ?? 1);
  group.add(root);

  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.34, 0);
    pivot.add(voxelMesh(new VoxelBuilder()
      .box(0, -0.12, 0, 0.16, 0.24, 0.18, look.pants)
      .box(0, -0.29, 0.02, 0.18, 0.1, 0.22, look.boots), mat));
    root.add(pivot);
    return pivot;
  });

  const torso = new VoxelBuilder()
    .box(0, 0.5, 0, 0.42, 0.34, 0.26, look.tunic)
    .box(0, 0.64, 0, 0.44, 0.07, 0.28, look.tunicShade)
    .box(0, 0.37, 0, 0.44, 0.06, 0.28, look.belt);
  torso.box(0, 0.37, 0.145, 0.08, 0.06, 0.02, '#ffcd75', 0);
  if (look.robe) torso.box(0, 0.22, 0, 0.44, 0.44, 0.3, look.tunic);
  if (look.apron) torso.box(0, 0.36, 0.145, 0.36, 0.46, 0.02, look.apron);
  if (look.pauldron) {
    for (const side of [-1, 1]) torso.box(side * 0.29, 0.69, 0, 0.2, 0.08, 0.26, look.pauldron).box(side * 0.29, 0.645, 0, 0.18, 0.03, 0.24, '#566c86');
  }
  root.add(voxelMesh(torso, mat));

  // A cape hangs from the shoulders; the hero's swings out while running.
  let cape = null;
  if (look.cape) {
    cape = new THREE.Group();
    cape.position.set(0, 0.68, -0.15);
    cape.add(voxelMesh(new VoxelBuilder()
      .box(0, -0.22, -0.02, 0.42, 0.44, 0.04, look.cape)
      .box(0, -0.47, -0.02, 0.42, 0.06, 0.04, look.capeShade)
      .box(0, 0.01, 0.0, 0.46, 0.05, 0.08, look.capeShade), mat));
    root.add(cape);
  }

  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 0.62, 0);
    pivot.rotation.order = 'YXZ';
    pivot.add(voxelMesh(new VoxelBuilder()
      .box(0, -0.12, 0, 0.13, 0.26, 0.15, look.tunicShade)
      .box(0, -0.28, 0, 0.12, 0.07, 0.14, look.skin), mat));
    root.add(pivot);
    return pivot;
  });

  // The right hand (x < 0 when facing +z) holds the sword.
  if (sword) {
    arms[0].add(voxelMesh(new VoxelBuilder()
      .box(0, -0.3, -0.04, 0.05, 0.05, 0.12, '#7a5230')
      .box(0, -0.3, 0.05, 0.18, 0.05, 0.05, '#ffcd75')
      .box(0, -0.3, 0.33, 0.05, 0.04, 0.5, '#dfe6ee'), mat));
  }

  const head = new THREE.Group();
  head.position.y = 0.88;
  const h = new VoxelBuilder()
    .box(0, 0, 0, 0.4, 0.38, 0.38, look.skin)
    .box(-0.09, -0.01, 0.195, 0.07, 0.1, 0.02, look.eye, 0)
    .box(0.09, -0.01, 0.195, 0.07, 0.1, 0.02, look.eye, 0)
    .box(-0.075, 0.02, 0.207, 0.025, 0.03, 0.01, '#ffffff', 0)
    .box(0.105, 0.02, 0.207, 0.025, 0.03, 0.01, '#ffffff', 0)
    .box(0, 0.22, -0.01, 0.46, 0.1, 0.44, look.hair)
    .box(0, 0.04, -0.2, 0.46, 0.42, 0.08, look.hair)
    .box(-0.215, 0.07, -0.03, 0.06, 0.3, 0.36, look.hair)
    .box(0.215, 0.07, -0.03, 0.06, 0.3, 0.36, look.hair)
    .box(0, 0.15, 0.2, 0.46, 0.1, 0.06, look.hair)
    .box(-0.12, 0.09, 0.21, 0.08, 0.08, 0.05, look.hair)
    .box(0.07, 0.1, 0.21, 0.1, 0.06, 0.05, look.hair)
    .box(-0.08, 0.3, 0.02, 0.14, 0.08, 0.16, look.hairShine)
    .box(0.1, 0.29, -0.08, 0.12, 0.06, 0.14, look.hair);
  if (look.beard) h.box(0, -0.15, 0.18, 0.34, 0.12, 0.06, look.beard).box(0, -0.06, 0.2, 0.18, 0.04, 0.03, look.beard);
  if (look.hat) {
    h.box(0, 0.28, -0.01, 0.52, 0.06, 0.5, look.hat)
      .box(0, 0.35, -0.03, 0.36, 0.1, 0.34, look.hat)
      .box(0.2, 0.45, -0.12, 0.04, 0.22, 0.04, '#ffcd75')
      .box(0.2, 0.58, -0.16, 0.04, 0.08, 0.04, '#ef7d57');
  }
  if (look.spiky) {
    h.box(-0.14, 0.32, 0.1, 0.1, 0.1, 0.12, look.hair)
      .box(0.02, 0.34, 0.12, 0.1, 0.12, 0.1, look.hair)
      .box(0.15, 0.31, 0.06, 0.1, 0.09, 0.12, look.hairShine)
      .box(0.05, 0.36, -0.12, 0.14, 0.1, 0.14, look.hair)
      .box(-0.12, 0.33, -0.18, 0.1, 0.08, 0.1, look.hair);
  }
  if (look.helmet) {
    h.box(0, 0.24, -0.01, 0.48, 0.14, 0.46, '#94b0c2')
      .box(0, 0.17, 0.22, 0.5, 0.05, 0.08, '#566c86')
      .box(0, 0.35, -0.04, 0.05, 0.09, 0.26, '#a02848');
  }
  head.add(voxelMesh(h, mat));
  root.add(head);

  return { group, root, legs, arms, head, cape, mat };
}

// Swings legs and arms. `phase` advances while walking, `amount` 0..1 fades the swing.
export function walkPose(model, phase, amount, { skipRightArm = false } = {}) {
  const s = Math.sin(phase) * 0.7 * amount;
  model.legs[0].rotation.x = s;
  model.legs[1].rotation.x = -s;
  if (!skipRightArm) {
    model.arms[0].rotation.set(-s * 0.8, 0, 0);
  }
  model.arms[1].rotation.set(s * 0.8, 0, 0);
}

export function makeSlime(colors) {
  const mat = vmat();
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  root.add(voxelMesh(new VoxelBuilder()
    .box(0, 0.06, 0, 0.72, 0.12, 0.72, colors.shade)
    .box(0, 0.28, 0, 0.7, 0.34, 0.7, colors.main)
    .box(0, 0.5, 0, 0.5, 0.14, 0.5, colors.main)
    .box(0.14, 0.53, 0.1, 0.12, 0.06, 0.12, colors.shine)
    .box(-0.13, 0.32, 0.355, 0.08, 0.12, 0.02, '#1a1c2c', 0)
    .box(0.13, 0.32, 0.355, 0.08, 0.12, 0.02, '#1a1c2c', 0)
    .box(-0.11, 0.35, 0.362, 0.03, 0.03, 0.01, '#ffffff', 0)
    .box(0.15, 0.35, 0.362, 0.03, 0.03, 0.01, '#ffffff', 0), mat));
  return { group, root, mat };
}

// Thornback Boar: four trotting legs, tusks and a ridge of thorns.
export function makeBoar() {
  const mat = vmat();
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  const body = new VoxelBuilder()
    .box(0, 0.5, -0.04, 0.56, 0.42, 0.78, '#7a4a2a')
    .box(0, 0.73, -0.06, 0.42, 0.08, 0.6, '#5a3a22')
    .box(0, 0.47, 0.4, 0.46, 0.38, 0.18, '#8a5a32')
    .box(0, 0.46, 0.58, 0.38, 0.32, 0.22, '#8a5a32')
    .box(0, 0.4, 0.74, 0.24, 0.16, 0.12, '#e8a0a0')
    .box(-0.05, 0.42, 0.805, 0.04, 0.05, 0.02, '#5a3a22', 0)
    .box(0.05, 0.42, 0.805, 0.04, 0.05, 0.02, '#5a3a22', 0)
    .box(-0.15, 0.4, 0.74, 0.04, 0.18, 0.04, '#f4ecd8', 0)
    .box(0.15, 0.4, 0.74, 0.04, 0.18, 0.04, '#f4ecd8', 0)
    .box(-0.12, 0.56, 0.695, 0.07, 0.06, 0.02, '#1a1c2c', 0)
    .box(0.12, 0.56, 0.695, 0.07, 0.06, 0.02, '#1a1c2c', 0)
    .box(-0.18, 0.66, 0.52, 0.08, 0.12, 0.06, '#5a3a22')
    .box(0.18, 0.66, 0.52, 0.08, 0.12, 0.06, '#5a3a22')
    .box(0, 0.56, -0.46, 0.06, 0.06, 0.12, '#5a3a22');
  for (let i = 0; i < 4; i++) {
    const z = -0.3 + i * 0.17;
    body.box(0, 0.84, z, 0.08, 0.16, 0.08, '#4f8a3a')
      .box(-0.16, 0.78, z + 0.06, 0.06, 0.12, 0.06, '#3f7a30')
      .box(0.16, 0.78, z + 0.06, 0.06, 0.12, 0.06, '#3f7a30');
  }
  root.add(voxelMesh(body, mat));
  const legs = [[-0.18, 0.26], [0.18, 0.26], [-0.18, -0.3], [0.18, -0.3]].map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.3, z);
    pivot.add(voxelMesh(new VoxelBuilder()
      .box(0, -0.13, 0, 0.13, 0.26, 0.13, '#5a3a22')
      .box(0, -0.27, 0.01, 0.14, 0.05, 0.15, '#3a2a1f'), mat));
    root.add(pivot);
    return pivot;
  });
  return { group, root, mat, legs };
}

// Wisp: a floating light with a soft glow around it.
export function makeWisp() {
  const mat = vmat({ emissive: new THREE.Color('#2a8fa8') });
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  root.add(voxelMesh(new VoxelBuilder()
    .box(0, 0, 0, 0.32, 0.32, 0.3, '#bff6ff', 0)
    .box(0, 0.02, 0, 0.38, 0.18, 0.2, '#73eff7', 0)
    .box(0, 0.19, -0.02, 0.18, 0.1, 0.18, '#73eff7', 0)
    .box(-0.07, 0.03, 0.155, 0.05, 0.08, 0.02, '#1a1c2c', 0)
    .box(0.07, 0.03, 0.155, 0.05, 0.08, 0.02, '#1a1c2c', 0)
    .box(0, -0.2, -0.06, 0.2, 0.14, 0.18, '#73eff7', 0)
    .box(0, -0.32, -0.12, 0.12, 0.1, 0.12, '#41a6f6', 0)
    .box(0, -0.41, -0.17, 0.06, 0.08, 0.06, '#3b5dc9', 0), mat));
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({ color: '#73eff7', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  root.add(halo);
  root.position.y = 0.8;
  return { group, root, mat, halo, extraMats: [halo.material] };
}

// Puffcap (and its small Sporelings): a walking mushroom with a spotted cap.
export function makeMushroom() {
  const mat = vmat();
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  const b = new VoxelBuilder()
    .box(-0.1, 0.03, 0.04, 0.12, 0.06, 0.16, '#d8c8a8')
    .box(0.1, 0.03, 0.04, 0.12, 0.06, 0.16, '#d8c8a8')
    .box(0, 0.24, 0, 0.36, 0.36, 0.34, '#f4e8d0')
    .box(-0.08, 0.28, 0.175, 0.06, 0.09, 0.02, '#1a1c2c', 0)
    .box(0.08, 0.28, 0.175, 0.06, 0.09, 0.02, '#1a1c2c', 0)
    .box(0, 0.18, 0.176, 0.08, 0.03, 0.02, '#8a3a4a', 0)
    .box(0, 0.44, 0, 0.6, 0.04, 0.58, '#f4c0c8')
    .box(0, 0.52, 0, 0.74, 0.14, 0.72, '#e04060')
    .box(0, 0.64, 0, 0.52, 0.12, 0.5, '#e04060')
    .box(0, 0.73, 0, 0.26, 0.08, 0.26, '#ef5a7a');
  for (const [x, y, z, w] of [[0.24, 0.6, 0.2, 0.12], [-0.22, 0.6, 0.12, 0.1], [0.08, 0.6, -0.26, 0.12], [-0.12, 0.71, -0.12, 0.1], [0.14, 0.71, 0.08, 0.08]]) {
    b.box(x, y, z, w, 0.03, w, '#ffffff', 0);
  }
  root.add(voxelMesh(b, mat));
  return { group, root, mat };
}

let orbParts = null;
// A wisp's shot: a small glowing star. Shares geometry and materials, so nothing to dispose.
export function makeOrb() {
  orbParts ??= {
    core: new THREE.IcosahedronGeometry(0.11, 0),
    glow: new THREE.IcosahedronGeometry(0.22, 1),
    coreMat: new THREE.MeshBasicMaterial({ color: '#eaffff' }),
    glowMat: new THREE.MeshBasicMaterial({ color: '#73eff7', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const group = new THREE.Group();
  group.add(new THREE.Mesh(orbParts.core, orbParts.coreMat), new THREE.Mesh(orbParts.glow, orbParts.glowMat));
  return group;
}

// Three tree kinds: 'oak' (round), 'pine' (layered) and 'birch' (white bark, light leaves).
export function makeTreeGeometry(kind = 'oak') {
  if (kind === 'pine') {
    return new VoxelBuilder()
      .box(0, 0.05, 0, 0.3, 0.1, 0.3, '#5a3a22')
      .box(0, 0.35, 0, 0.18, 0.6, 0.18, '#6a4428')
      .box(0, 0.62, 0, 1.0, 0.32, 1.0, '#1f5c3e')
      .box(0, 0.95, 0, 0.8, 0.32, 0.8, '#257150')
      .box(0, 1.26, 0, 0.58, 0.3, 0.58, '#2f8a55')
      .box(0, 1.54, 0, 0.36, 0.28, 0.36, '#38b764')
      .box(0, 1.76, 0, 0.14, 0.18, 0.14, '#4fc36a')
      .build();
  }
  if (kind === 'birch') {
    return new VoxelBuilder()
      .box(0, 0.05, 0, 0.3, 0.1, 0.3, '#8a8a8a')
      .box(0, 0.5, 0, 0.2, 0.95, 0.2, '#e8e4da')
      .box(0.101, 0.35, 0, 0.01, 0.06, 0.1, '#333c57', 0)
      .box(-0.101, 0.7, 0.03, 0.01, 0.05, 0.08, '#333c57', 0)
      .box(0, 0.55, 0.101, 0.08, 0.04, 0.01, '#333c57', 0)
      .box(0.05, 1.1, 0, 0.8, 0.42, 0.75, '#5fae4a')
      .box(-0.12, 1.42, 0.05, 0.6, 0.34, 0.55, '#7cc95e')
      .box(0.15, 1.62, -0.05, 0.34, 0.22, 0.34, '#a7f070')
      .box(-0.3, 0.98, 0.25, 0.26, 0.2, 0.24, '#7cc95e')
      .build();
  }
  return new VoxelBuilder()
    .box(0, 0.05, 0, 0.34, 0.1, 0.34, '#5a3a22')
    .box(0, 0.38, 0, 0.24, 0.7, 0.24, '#7a5230')
    .box(0, 0.95, 0, 0.95, 0.5, 0.95, '#257150')
    .box(0, 1.35, 0, 0.72, 0.4, 0.72, '#38b764')
    .box(0, 1.65, 0, 0.4, 0.25, 0.4, '#4fc36a')
    .box(0.22, 1.18, 0.3, 0.2, 0.14, 0.18, '#a7f070')
    .build();
}

// A 2x2-tile house. `kind: 'smithy'` gives stone walls, a wide chimney and a glowing forge.
export function makeHouse(roof, roofShade, kind = 'house') {
  const smithy = kind === 'smithy';
  const b = new VoxelBuilder()
    .box(0, 0.04, 0, 1.8, 0.08, 1.7, '#8a8a8a')
    .box(0, 0.62, 0, 1.7, 1.1, 1.6, smithy ? '#9a9aa2' : '#e8d5b0')
    .box(-0.86, 0.62, 0.81, 0.06, 1.1, 0.06, '#7a5230')
    .box(0.86, 0.62, 0.81, 0.06, 1.1, 0.06, '#7a5230')
    .box(0, 1.15, 0.81, 1.74, 0.06, 0.06, '#7a5230')
    .box(0, 0.42, 0.81, 0.4, 0.76, 0.04, '#7a5230')
    .box(0, 0.42, 0.825, 0.04, 0.72, 0.01, '#5a3a22', 0)
    .box(0.12, 0.42, 0.835, 0.04, 0.04, 0.02, '#ffcd75', 0)
    .box(0, 0.86, 0.835, 0.5, 0.06, 0.04, '#5a3a22');
  for (const wx of [-0.5, 0.5]) {
    if (smithy && wx > 0) continue;
    b.box(wx, 0.78, 0.81, 0.32, 0.3, 0.04, '#73eff7')
      .box(wx, 0.78, 0.83, 0.34, 0.04, 0.02, '#7a5230', 0)
      .box(wx, 0.78, 0.83, 0.04, 0.3, 0.02, '#7a5230', 0);
    if (!smithy) {
      b.box(wx, 0.6, 0.87, 0.38, 0.08, 0.1, '#7a4a2a')
        .box(wx - 0.11, 0.67, 0.87, 0.07, 0.07, 0.07, '#ff8fb1', 0)
        .box(wx + 0.01, 0.68, 0.87, 0.07, 0.08, 0.07, '#ffcd75', 0)
        .box(wx + 0.12, 0.67, 0.87, 0.07, 0.07, 0.07, '#f4f4f4', 0);
    }
  }
  if (smithy) {
    for (const [x, y] of [[-0.6, 0.3], [-0.2, 0.95], [0.55, 0.5], [0.3, 0.9], [-0.7, 1.0]]) b.box(x, y, 0.805, 0.22, 0.12, 0.02, '#7a7a82', 0);
    b.box(0.55, 0.32, 0.95, 0.5, 0.64, 0.32, '#566c86').box(0.55, 0.32, 1.1, 0.3, 0.24, 0.02, '#2b2f45', 0);
  }
  [[2.0, 1.25], [1.6, 1.5], [1.15, 1.75], [0.7, 2.0], [0.3, 2.2]].forEach(([w, y], i) => {
    b.box(0, y, 0, w, 0.25, 1.95, i % 2 ? roofShade : roof);
  });
  if (smithy) b.box(0.55, 2.0, -0.35, 0.42, 0.9, 0.42, '#7a7a82').box(0.55, 2.47, -0.35, 0.5, 0.06, 0.5, '#566c86');
  else b.box(0.55, 1.9, -0.4, 0.22, 0.6, 0.22, '#8a8a8a');
  const mesh = voxelMesh(b, vmat());
  if (!smithy) return mesh;
  // The forge mouth glows.
  const group = new THREE.Group();
  const forge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.02), new THREE.MeshBasicMaterial({ color: '#ff8a3d' }));
  forge.position.set(0.55, 0.32, 1.115);
  group.add(mesh, forge);
  return group;
}

export function makeStall() {
  const b = new VoxelBuilder()
    .box(0, 0.3, 0, 1.8, 0.6, 0.5, '#7a5230')
    .box(0, 0.62, 0, 1.86, 0.06, 0.56, '#a86a3a')
    .box(-0.85, 0.95, -0.2, 0.08, 0.7, 0.08, '#5a3a22')
    .box(0.85, 0.95, -0.2, 0.08, 0.7, 0.08, '#5a3a22')
    .box(-0.5, 0.73, 0.05, 0.16, 0.16, 0.16, '#e04060')
    .box(-0.28, 0.72, 0.1, 0.14, 0.14, 0.14, '#e04060')
    .box(0.12, 0.75, 0, 0.1, 0.2, 0.1, '#73eff7')
    .box(0.5, 0.7, 0, 0.3, 0.1, 0.2, '#ffcd75');
  for (let i = 0; i < 6; i++) b.box(-0.75 + i * 0.3, 1.33, 0, 0.3, 0.1, 0.9, i % 2 ? '#f4f4f4' : '#b13e53');
  return voxelMesh(b, vmat());
}

let coinParts = null;
export function makeCoin() {
  coinParts ??= {
    geo: new VoxelBuilder()
      .box(0, 0, 0, 0.32, 0.32, 0.08, '#ffcd75', 0)
      .box(0, 0, 0, 0.14, 0.2, 0.1, '#c08530', 0)
      .build(),
    mat: vmat({ emissive: new THREE.Color('#3a2a00') }),
  };
  const mesh = new THREE.Mesh(coinParts.geo, coinParts.mat);
  mesh.castShadow = true;
  return mesh;
}

const lootParts = {};
// A small glowing gem for monster drops (one shared geometry and material per color).
export function makeLoot(color) {
  lootParts[color] ??= {
    geo: new VoxelBuilder()
      .box(0, 0, 0, 0.2, 0.2, 0.2, color, 0)
      .box(0.05, 0.05, 0.05, 0.08, 0.08, 0.12, '#ffffff', 0)
      .build(),
    mat: vmat({ emissive: new THREE.Color(color).multiplyScalar(0.35) }),
  };
  const mesh = new THREE.Mesh(lootParts[color].geo, lootParts[color].mat);
  mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  mesh.castShadow = true;
  return mesh;
}

// The bag left where the hero fell, with a light beam so it can be found from afar.
export function makeSatchel() {
  const group = new THREE.Group();
  const bag = voxelMesh(new VoxelBuilder()
    .box(0, 0.16, 0, 0.42, 0.32, 0.36, '#8a5a32')
    .box(0, 0.36, 0, 0.3, 0.1, 0.26, '#7a4a2a')
    .box(0, 0.44, 0, 0.16, 0.08, 0.16, '#a86a3a')
    .box(0, 0.4, 0.14, 0.32, 0.04, 0.03, '#ffcd75')
    .box(0.1, 0.2, 0.185, 0.12, 0.12, 0.02, '#ffcd75', 0), vmat());
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.25, 6, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ffcd75', transparent: true, opacity: 0.35, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 3;
  group.add(bag, beam);
  return { group, bag, beam };
}

let dustGeo = null;
// A small puff of dust kicked up by a roll. Fades out through game.addEffect.
export function makeDust() {
  dustGeo ??= new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const mat = new THREE.MeshBasicMaterial({ color: '#efe2c4', transparent: true, opacity: 0.9, depthWrite: false });
  return new THREE.Mesh(dustGeo, mat);
}

// Lock-on marker: a gold diamond above the target (drawn over everything, so trees
// never hide it) and a square reticle on the ground.
export function makeLockMarker() {
  const group = new THREE.Group();
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.13),
    new THREE.MeshBasicMaterial({ color: '#ffcd75', transparent: true, depthTest: false, depthWrite: false }),
  );
  diamond.scale.y = 1.6;
  diamond.renderOrder = 10;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.6, 4, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ff6b6b', transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.position.y = 0.03;
  group.add(diamond, ring);
  return { group, diamond, ring };
}

let spinGeo = null;
// A full flat ring for the spin slash.
export function makeSpinSlash() {
  spinGeo ??= new THREE.RingGeometry(0.6, 1.35, 32).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  return new THREE.Mesh(spinGeo, mat);
}

let slashGeo = null;
// A flat crescent that shows the sword's arc. Point it with rotation.y.
export function makeSlash() {
  slashGeo ??= new THREE.RingGeometry(0.45, 0.95, 10, 1, -1.1, 2.2).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  return new THREE.Mesh(slashGeo, mat);
}

// The Spirit Tree: the great dimmed tree on Spirit Hill, visible from across the map.
// Its crystals pulse faintly (animate `crystals.material`).
export function makeSpiritTree() {
  const group = new THREE.Group();
  const b = new VoxelBuilder();
  // roots
  for (const [x, z, w, d] of [[-1, 0, 0.9, 0.5], [1, 0.1, 0.9, 0.5], [0.1, -1, 0.5, 0.9], [-0.1, 1, 0.5, 0.9], [-0.8, 0.8, 0.5, 0.5], [0.8, -0.8, 0.5, 0.5]]) {
    b.box(x, 0.18, z, w, 0.36, d, '#5a3a22');
  }
  b.box(0, 1.6, 0, 1.4, 3.2, 1.4, '#6a4428')
    .box(0, 1.2, 0, 1.6, 0.9, 1.6, '#5a3a22')
    .box(0.3, 2.2, 0.71, 0.3, 0.9, 0.04, '#4a2f1c', 0)
    .box(-0.71, 1.4, -0.2, 0.04, 0.7, 0.3, '#4a2f1c', 0)
    .box(0, 3.6, 0, 1.0, 1.2, 1.0, '#6a4428');
  // branches
  for (const [x, y, z, w, h, d] of [[1.1, 3.9, 0, 1.4, 0.35, 0.35], [-1.1, 4.2, 0.2, 1.4, 0.35, 0.35], [0, 4.4, 1.1, 0.35, 0.35, 1.4], [0.2, 3.8, -1.1, 0.35, 0.35, 1.4]]) {
    b.box(x, y, z, w, h, d, '#5a3a22');
  }
  // canopy: muted blue-green, as if its light has gone out
  for (const [x, y, z, w, h, d, c] of [
    [0, 4.9, 0, 5.2, 1.0, 5.0, '#3e7a6e'], [0.2, 5.8, -0.2, 4.2, 0.9, 4.2, '#4a8f7e'], [-0.2, 6.6, 0.1, 3.0, 0.8, 3.0, '#5aa38c'],
    [0, 7.25, 0, 1.6, 0.5, 1.6, '#6fb89c'], [2.3, 4.6, 1.2, 1.4, 0.9, 1.6, '#3e7a6e'], [-2.4, 5.0, -1.0, 1.4, 0.8, 1.5, '#4a8f7e'],
    [1.2, 5.3, -2.3, 1.6, 0.8, 1.2, '#3e7a6e'], [-1.0, 4.7, 2.3, 1.8, 0.8, 1.2, '#4a8f7e'],
  ]) {
    b.box(x, y, z, w, h, d, c, 0.08);
  }
  group.add(voxelMesh(b, vmat()));

  // Hanging crystals that still glow a little.
  const c = new VoxelBuilder();
  for (const [x, y, z] of [[1.6, 4.0, 0.9], [-1.8, 4.3, -0.4], [0.6, 4.1, -2.0], [-0.7, 4.0, 2.0], [2.2, 4.1, -0.8], [-2.0, 4.4, 1.3], [0.1, 4.2, 2.4]]) {
    c.box(x, y + 0.25, z, 0.03, 0.3, 0.03, '#2b2f45', 0).box(x, y, z, 0.16, 0.26, 0.16, '#9fe8ff', 0);
  }
  const crystals = new THREE.Mesh(c.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  group.add(crystals);
  return { group, crystals };
}

// A meadow windmill. `blades` turns around its z axis.
export function makeWindmill() {
  const group = new THREE.Group();
  const b = new VoxelBuilder()
    .box(0, 0.1, 0, 1.8, 0.2, 1.8, '#8a8a8a')
    .box(0, 0.9, 0, 1.4, 1.4, 1.4, '#e8d5b0')
    .box(0, 2.0, 0, 1.15, 0.9, 1.15, '#e8d5b0')
    .box(0, 0.55, 0.71, 0.4, 0.7, 0.04, '#7a5230')
    .box(0, 1.25, 0.71, 0.3, 0.3, 0.04, '#73eff7')
    .box(0, 1.7, 0, 1.5, 0.08, 1.5, '#7a5230');
  [[1.4, 2.55], [1.0, 2.8], [0.6, 3.05], [0.2, 3.25]].forEach(([w, y], i) => b.box(0, y, 0, w, 0.25, w, i % 2 ? '#8a2e40' : '#b13e53'));
  b.box(0, 2.6, 0.62, 0.2, 0.2, 0.3, '#5a3a22');
  group.add(voxelMesh(b, vmat()));
  const blades = new THREE.Group();
  blades.position.set(0, 2.6, 0.8);
  const bb = new VoxelBuilder().box(0, 0, 0, 0.18, 0.18, 0.12, '#5a3a22');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, cx = Math.cos(a), cy = Math.sin(a);
    bb.box(cx * 0.75, cy * 0.75, 0, Math.abs(cx) * 1.4 + 0.08, Math.abs(cy) * 1.4 + 0.08, 0.05, '#7a5230');
    const ox = -cy * 0.16, oy = cx * 0.16;
    bb.box(cx * 0.85 + ox, cy * 0.85 + oy, 0.02, Math.abs(cx) * 1.1 + Math.abs(cy) * 0.26, Math.abs(cy) * 1.1 + Math.abs(cx) * 0.26, 0.02, '#f4ecd8');
  }
  blades.add(voxelMesh(bb, vmat()));
  group.add(blades);
  return { group, blades };
}
