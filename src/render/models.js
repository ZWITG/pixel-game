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
  if (look.robe) torso.box(0, 0.22, 0, 0.44, 0.44, 0.3, look.tunic);
  root.add(voxelMesh(torso, mat));

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
  if (look.helmet) {
    h.box(0, 0.24, -0.01, 0.48, 0.14, 0.46, '#94b0c2')
      .box(0, 0.17, 0.22, 0.5, 0.05, 0.08, '#566c86')
      .box(0, 0.35, -0.04, 0.05, 0.09, 0.26, '#a02848');
  }
  head.add(voxelMesh(h, mat));
  root.add(head);

  return { group, root, legs, arms, head, mat };
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

export function makeTreeGeometry() {
  return new VoxelBuilder()
    .box(0, 0.05, 0, 0.34, 0.1, 0.34, '#5a3a22')
    .box(0, 0.38, 0, 0.24, 0.7, 0.24, '#7a5230')
    .box(0, 0.95, 0, 0.95, 0.5, 0.95, '#257150')
    .box(0, 1.35, 0, 0.72, 0.4, 0.72, '#38b764')
    .box(0, 1.65, 0, 0.4, 0.25, 0.4, '#4fc36a')
    .box(0.22, 1.18, 0.3, 0.2, 0.14, 0.18, '#a7f070')
    .build();
}

export function makeHouse(roof, roofShade) {
  const b = new VoxelBuilder()
    .box(0, 0.04, 0, 1.8, 0.08, 1.7, '#8a8a8a')
    .box(0, 0.62, 0, 1.7, 1.1, 1.6, '#e8d5b0')
    .box(-0.86, 0.62, 0.81, 0.06, 1.1, 0.06, '#7a5230')
    .box(0.86, 0.62, 0.81, 0.06, 1.1, 0.06, '#7a5230')
    .box(0, 0.42, 0.81, 0.4, 0.76, 0.04, '#7a5230')
    .box(0.12, 0.42, 0.835, 0.04, 0.04, 0.02, '#ffcd75', 0);
  for (const wx of [-0.5, 0.5]) {
    b.box(wx, 0.78, 0.81, 0.32, 0.3, 0.04, '#73eff7').box(wx, 0.78, 0.83, 0.34, 0.04, 0.02, '#7a5230', 0);
  }
  [[2.0, 1.25], [1.6, 1.5], [1.15, 1.75], [0.7, 2.0], [0.3, 2.2]].forEach(([w, y], i) => {
    b.box(0, y, 0, w, 0.25, 1.95, i % 2 ? roofShade : roof);
  });
  b.box(0.55, 1.9, -0.4, 0.22, 0.6, 0.22, '#8a8a8a');
  return voxelMesh(b, vmat());
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
