import * as THREE from 'three';
import { TILE } from './generateWorld.js';
import { VoxelBuilder, vmat } from '../render/voxel.js';
import { makeTreeGeometry, makeHouse, makeStall } from '../render/models.js';

const GRASS = ['#4f9e4c', '#4a964a', '#55a552'];
const PATH = ['#c9a46a', '#c09a60', '#d1ad74'];
const FLOWERS = ['#ffcd75', '#f4f4f4', '#ef7d57', '#ff8fb1'];
const ROOFS = { red: ['#b13e53', '#8a2e40'], blue: ['#3b5dc9', '#2c4498'], green: ['#257179', '#1a535a'] };
const OUTER_RING = 4; // extra forest drawn past the map edge

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Turns the tile map into 3D meshes. Returns the water mesh (animated) and
// solid rectangles (in tiles) for buildings.
export function buildWorld(scene, data, village) {
  const H = data.length, W = data[0].length;
  const rand = seeded(99);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const ground = new VoxelBuilder();
  const water = new VoxelBuilder();
  const trees = [];

  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const t = data[z][x], cx = x + 0.5, cz = z + 0.5;
      if (t === TILE.WATER) {
        ground.box(cx, -0.55, cz, 1, 0.1, 1, '#2b4a6e', 0.05);
        water.box(cx, -0.15, cz, 1, 0.04, 1, '#41a6f6', 0.03);
        continue;
      }
      ground.box(cx, -0.25, cz, 1, 0.5, 1, t === TILE.PATH ? pick(PATH) : pick(GRASS), 0.03);
      if (t === TILE.FLOWERS) {
        for (let i = 0; i < 3; i++) ground.box(x + 0.2 + rand() * 0.6, 0.04, z + 0.2 + rand() * 0.6, 0.1, 0.08, 0.1, pick(FLOWERS), 0);
      } else if (t === TILE.GRASS && rand() < 0.3) {
        ground.box(x + 0.15 + rand() * 0.7, 0.05, z + 0.15 + rand() * 0.7, 0.08, 0.1, 0.08, '#2f7a3e', 0.1);
      } else if (t === TILE.PATH && rand() < 0.15) {
        ground.box(x + 0.2 + rand() * 0.6, 0.03, z + 0.2 + rand() * 0.6, 0.12, 0.06, 0.1, '#8a8a8a', 0.1);
      }
      if (t === TILE.TREE) trees.push([cx, cz]);
    }
  }

  // Forest floor and extra trees around the map so the edge isn't empty.
  const far = 30;
  ground.box(-far / 2, -0.25, H / 2, far, 0.5, H + far * 2, '#3c7f42', 0);
  ground.box(W + far / 2, -0.25, H / 2, far, 0.5, H + far * 2, '#3c7f42', 0);
  ground.box(W / 2, -0.25, -far / 2, W, 0.5, far, '#3c7f42', 0);
  ground.box(W / 2, -0.25, H + far / 2, W, 0.5, far, '#3c7f42', 0);
  for (let z = -OUTER_RING; z < H + OUTER_RING; z++)
    for (let x = -OUTER_RING; x < W + OUTER_RING; x++)
      if ((x < 0 || z < 0 || x >= W || z >= H) && rand() < 0.75) trees.push([x + 0.5 + (rand() - 0.5) * 0.4, z + 0.5 + (rand() - 0.5) * 0.4]);

  const groundMesh = new THREE.Mesh(ground.build(), vmat());
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const waterMesh = new THREE.Mesh(water.build(), vmat({ transparent: true, opacity: 0.78 }));
  scene.add(waterMesh);

  const forest = new THREE.InstancedMesh(makeTreeGeometry(), vmat(), trees.length);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  trees.forEach(([x, z], i) => {
    const s = 0.85 + rand() * 0.3;
    dummy.position.set(x, 0, z);
    dummy.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2);
    dummy.scale.set(s, s * (0.9 + rand() * 0.25), s);
    dummy.updateMatrix();
    forest.setMatrixAt(i, dummy.matrix);
    forest.setColorAt(i, tint.setScalar(0.85 + rand() * 0.25));
  });
  forest.castShadow = true;
  forest.receiveShadow = true;
  scene.add(forest);

  const rects = [];
  if (village) {
    for (const h of village.houses) {
      const house = makeHouse(...ROOFS[h.roof]);
      house.position.set(h.tx + 1, 0, h.ty + 1);
      scene.add(house);
      rects.push({ x0: h.tx + 0.1, x1: h.tx + 1.9, z0: h.ty + 0.15, z1: h.ty + 1.85 });
    }
    const { tx, ty } = village.stall;
    const stall = makeStall();
    stall.position.set(tx + 1, 0, ty + 0.5);
    scene.add(stall);
    rects.push({ x0: tx + 0.1, x1: tx + 1.9, z0: ty + 0.25, z1: ty + 0.75 });
  }

  return { water: waterMesh, rects };
}
