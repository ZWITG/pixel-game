import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';
import { makeSpiritTree, makeHouse } from '../render/models.js';
import { PLACES, height } from './terrain.js';

const HOUSE = { x: 3.1, z: 2.95, door: 3.8 }; // half size and door distance at the scale used here

// The big things you can see from far away. Each one is a promise: walk toward it.

// The Lantern Spire: a citadel of pale rose stone on the lake island, crowned with a huge lamp.
function spire() {
  const b = new VoxelBuilder();
  const stone = ['#b79a98', '#a58a90', '#c7aca4'];
  const tower = (x, z, w, h, base = 0) => {
    b.box(x, base + h / 2, z, w, h, w, stone[Math.abs(Math.round(x + z)) % 3], 0.05);
    b.box(x, base + h + 1, z, w * 1.25, 2, w * 1.25, '#8e7480', 0.05);
    let r = w, y = base + h + 2;
    while (r > 1.2) {
      b.box(x, y + 1.5, z, r, 3.2, r, '#6a4a6e', 0.04);
      r *= 0.72;
      y += 3;
    }
    b.box(x, y + 2, z, 0.5, 5, 0.5, '#e8d8c0');
  };
  b.box(0, 8, 0, 150, 16, 110, '#9c8486', 0.04);
  b.box(0, 26, 0, 96, 22, 74, '#ab9094', 0.04);
  for (const [x, z] of [[-75, -55], [75, -55], [-75, 55], [75, 55], [0, 55]]) tower(x, z, 15, 44);
  for (const [x, z, h] of [[-40, -30, 76], [40, -30, 84], [-46, 26, 66], [44, 28, 60], [0, -38, 92]]) tower(x, z, 19, h, 8);
  tower(0, 0, 30, 118, 8);
  for (let i = 0; i < 9; i++) b.box(-60 + i * 15, 46, 37.5, 4, 9, 1, '#ffd98a', 0);
  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 0), new THREE.MeshBasicMaterial({ color: '#ffcc73', fog: false }));
  lamp.position.y = 176;
  g.add(lamp);
  return g;
}

// The Titan Ribs: the bones of something enormous, arching out of the moor.
function ribs() {
  const b = new VoxelBuilder();
  for (let r = 0; r < 9; r++) {
    const z = -180 + r * 45, span = 95 - Math.abs(r - 4) * 11;
    for (const side of [-1, 1]) {
      for (let t = 0; t < 16; t++) {
        const a = (t / 15) * Math.PI * 0.86;
        const w = 12 - t * 0.5;
        b.box(side * Math.cos(a) * span, Math.sin(a) * span * 1.15, z + side * t * 0.6, w, 13, w, '#e4dccb', 0.05);
      }
    }
    b.box(0, -2, z, 26, 10, 22, '#cfc6b4', 0.05);
  }
  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  return mesh;
}

// The Drifting Isles: pieces of forest torn out of the ground, hanging in the air, spilling water.
function isle(rand) {
  const b = new VoxelBuilder();
  const r = 28 + rand() * 34;
  b.box(0, 0, 0, r * 2, 5, r * 1.8, '#7f9a3a', 0.08);
  for (let i = 0, w = r * 2, y = -6; w > 6; i++, y -= 6, w *= 0.74) {
    b.box((rand() - 0.5) * 8, y, (rand() - 0.5) * 8, w, 7, w * 0.9, i % 2 ? '#7c6a70' : '#94808a', 0.08);
  }
  for (let i = 0; i < 12; i++) {
    const x = (rand() - 0.5) * r * 1.6, z = (rand() - 0.5) * r * 1.4, c = rand() < 0.5 ? '#d22a2e' : '#e8b52e';
    b.box(x, 6, z, 1.2, 10, 1.2, '#5a3320').box(x, 13, z, 9, 6, 9, c, 0.1).box(x, 17, z, 5, 3.5, 5, c, 0.1);
  }
  b.box(r * 0.5, -60, r * 0.86, 4, 120, 2.5, '#d8eef4', 0.05);
  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  return mesh;
}

// What's left of a house, hidden until it comes down.
function rubble(scene, x, z, seed) {
  const b = new VoxelBuilder();
  let s = seed * 97 + 13;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = ['#e8d5b0', '#c9b89e', '#7a5230', '#8a8a8a', '#b13e53'];
  for (let i = 0; i < 40; i++) {
    const w = 0.5 + rand() * 1.6, h = 0.3 + rand() * 0.9, a = rand() * 6.28, d = rand() * rand() * 5;
    b.box(Math.cos(a) * d, h / 2 + rand() * (2.2 - d * 0.4), Math.sin(a) * d, w, h, 0.5 + rand() * 1.6, cols[i % 5], 0.06);
  }
  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  mesh.position.set(x, height(x, z), z);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

export function addLandmarks(scene) {
  // `solids` stop the hero: { x, z, r } circles or { x0, x1, z0, z1 } boxes.
  const out = { isles: [], houses: [], solids: [] };
  const S = spire();
  S.position.set(PLACES.spire.x, PLACES.spire.y - 2, PLACES.spire.z);
  S.scale.setScalar(1.15);
  scene.add(S);
  out.solids.push({ x0: S.position.x - 96, x1: S.position.x + 96, z0: S.position.z - 72, z1: S.position.z + 72 });

  const tree = makeSpiritTree();
  tree.group.scale.setScalar(52);
  tree.group.position.set(PLACES.spirit.x, height(PLACES.spirit.x, PLACES.spirit.z) - 8, PLACES.spirit.z);
  scene.add(tree.group);
  out.crystals = tree.crystals;
  out.solids.push({ x: PLACES.spirit.x, z: PLACES.spirit.z, r: 46 });

  const R = ribs();
  R.position.set(PLACES.ribs.x, PLACES.ribs.y, PLACES.ribs.z);
  R.rotation.y = 0.6;
  scene.add(R);
  // The foot of each rib, turned the same way as the skeleton.
  for (let r = 0; r < 9; r++) {
    const z = -180 + r * 45, span = 95 - Math.abs(r - 4) * 11, c = Math.cos(0.6), s = Math.sin(0.6);
    for (const side of [-1, 1]) {
      const x = side * span;
      out.solids.push({ x: PLACES.ribs.x + x * c + z * s, z: PLACES.ribs.z - x * s + z * c, r: 8 });
    }
  }

  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const a = rand() * 6.28, d = rand() * PLACES.isles.r;
    const m = isle(rand);
    m.position.set(PLACES.isles.x + Math.cos(a) * d, 130 + rand() * 170, PLACES.isles.z + Math.sin(a) * d);
    m.userData.bob = rand() * 6;
    scene.add(m);
    out.isles.push(m);
  }

  // Placeholder rooftops so the Hollow reads at a distance until the real village moves here.
  const H = PLACES.hollow;
  const roofs = [['#b13e53', '#8a2e40'], ['#3b5dc9', '#2c4498'], ['#e8a33a', '#b87a22'], ['#257179', '#1a535a']];
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4, d = 26 + i * 8.5;
    const hx = H.x + Math.cos(a) * d, hz = H.z + Math.sin(a) * d;
    const house = makeHouse(...roofs[i % 4]);
    house.position.set(hx, height(hx, hz), hz);
    house.scale.setScalar(3.4);
    house.rotation.y = Math.round(a * 2) * (Math.PI / 2);
    house.castShadow = true;
    scene.add(house);
    const rot = house.rotation.y, ox = Math.sin(rot), oz = Math.cos(rot);
    const quarter = Math.abs(Math.round(rot / (Math.PI / 2))) % 2 === 1;
    const sx = quarter ? HOUSE.z : HOUSE.x, sz = quarter ? HOUSE.x : HOUSE.z;
    const solid = { x0: hx - sx, x1: hx + sx, z0: hz - sz, z1: hz + sz };
    out.houses.push({ id: `h${i}`, mesh: house, solid, rubble: rubble(scene, hx, hz, i), x: hx, z: hz, rot, door: { x: hx + ox * HOUSE.door, z: hz + oz * HOUSE.door } });
    out.solids.push(solid);
  }
  return out;
}
