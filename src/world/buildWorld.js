import * as THREE from 'three';
import { TILE } from './generateWorld.js';
import { FEATURES } from '../config/features.js';
import { VoxelBuilder, vmat } from '../render/voxel.js';
import { makeTreeGeometry, makeHouse, makeStall } from '../render/models.js';
import {
  rock, bush, smallMushroom, lilyPad, barrel, crate, noticeBoard, anvil, fence, lanternPost, fountain,
  makeCloud, makeGlowSprite,
} from '../render/props.js';

const GRASS = '#55a64e';
const PATH = '#c9a46a';
const FLOWERS = ['#ffcd75', '#f4f4f4', '#ef7d57', '#ff8fb1'];
const ROOFS = {
  red: ['#b13e53', '#8a2e40'], blue: ['#3b5dc9', '#2c4498'], green: ['#257179', '#1a535a'],
  yellow: ['#e8a33a', '#b87a22'], slate: ['#3d4260', '#2b2f45'],
};
const TREE_KINDS = [['oak', 0.5], ['pine', 0.3], ['birch', 0.2]]; // kind and share of trees
const OUTER_RING = 4; // extra forest drawn past the map edge
const CLOUDS = 16;

// Smooth brightness field so the ground blends across tiles instead of a checkerboard.
const meadow = (x, z) => 0.84 + 0.1 * Math.sin(x * 0.31 + z * 0.17) + 0.07 * Math.sin(z * 0.53 - x * 0.21) + 0.04 * Math.sin(x * 1.7 + z * 1.3);
const dirt = (x, z) => 0.93 + 0.05 * Math.sin(x * 0.9 + z * 0.7) + 0.03 * Math.sin(x * 2.3 - z * 1.9);

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Turns the tile map into 3D meshes. Returns the water mesh and clouds (animated) and
// solid rectangles (in tiles) for buildings and props.
export function buildWorld(scene, data, village) {
  const H = data.length, W = data[0].length;
  const rand = seeded(99);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const inVillage = (x, z) => village && x >= village.rect.x - 1 && x < village.rect.x + village.rect.w + 1 && z >= village.rect.y - 1 && z < village.rect.y + village.rect.h + 1;
  const ground = new VoxelBuilder();
  const water = new VoxelBuilder();
  const props = new VoxelBuilder();  // casts shadows
  const glow = new VoxelBuilder();   // drawn unlit (lantern lamps)
  const trees = [];
  const blades = [];
  const rects = [];

  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const t = data[z][x], cx = x + 0.5, cz = z + 0.5;
      if (t === TILE.WATER) {
        ground.box(cx, -0.55, cz, 1, 0.1, 1, '#2b4a6e', 0.05);
        water.box(cx, -0.15, cz, 1, 0.04, 1, '#3f9be8', 0.02);
        if (rand() < 0.12) lilyPad(ground, x + 0.2 + rand() * 0.6, z + 0.2 + rand() * 0.6, rand);
        continue;
      }
      if (t === TILE.PATH) ground.box(cx, -0.25, cz, 1, 0.5, 1, PATH, 0, { tint: dirt });
      else ground.box(cx, -0.25, cz, 1, 0.5, 1, GRASS, 0, { tint: meadow });
      if (t === TILE.GRASS || t === TILE.FLOWERS) {
        for (let i = 0; i < 4; i++) blades.push([x + 0.08 + rand() * 0.84, z + 0.08 + rand() * 0.84, 0.6 + rand() * 0.8, rand() * Math.PI]);
      }
      if (t === TILE.FLOWERS) {
        for (let i = 0; i < 3; i++) {
          const fx = x + 0.2 + rand() * 0.6, fz = z + 0.2 + rand() * 0.6;
          ground.box(fx, 0.08, fz, 0.025, 0.16, 0.025, '#2f7a3e', 0);
          ground.box(fx, 0.17, fz, 0.1, 0.05, 0.1, pick(FLOWERS), 0);
        }
      } else if (t === TILE.PATH && rand() < 0.15) {
        ground.box(x + 0.2 + rand() * 0.6, 0.03, z + 0.2 + rand() * 0.6, 0.12, 0.06, 0.1, '#8a8a8a', 0.1);
      } else if (t === TILE.GRASS && !inVillage(x, z)) {
        // Wild scenery. Too small to block anyone.
        const roll = rand();
        if (roll < 0.025) rock(props, x + 0.3 + rand() * 0.4, z + 0.3 + rand() * 0.4, rand);
        else if (roll < 0.045) bush(props, x + 0.5, z + 0.5, rand);
        else if (roll < 0.06) smallMushroom(props, x + 0.2 + rand() * 0.6, z + 0.2 + rand() * 0.6);
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

  if (village) buildVillage(village, data, props, glow, water, rects, scene);

  const groundMesh = new THREE.Mesh(ground.build(), vmat());
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const propMesh = new THREE.Mesh(props.build(), vmat());
  propMesh.castShadow = true;
  propMesh.receiveShadow = true;
  scene.add(propMesh);
  scene.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));

  const waterMesh = new THREE.Mesh(water.build(), new THREE.MeshPhongMaterial({
    vertexColors: true, transparent: true, opacity: 0.8, shininess: 90, specular: new THREE.Color('#bfe6ff'),
  }));
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  if (FEATURES.grassBlades && blades.length) {
    const bladeGeo = new VoxelBuilder()
      .box(0, 0.05, 0, 0.035, 0.1, 0.035, '#3f8a3c', 0, { ao: 0.6 })
      .box(0, 0.14, 0, 0.03, 0.08, 0.03, '#7cc95e', 0, { ao: 1 })
      .build();
    const grass = new THREE.InstancedMesh(bladeGeo, vmat(), blades.length);
    const d = new THREE.Object3D();
    blades.forEach(([x, z, s, r], i) => {
      d.position.set(x, 0, z);
      d.rotation.set((rand() - 0.5) * 0.3, r, (rand() - 0.5) * 0.3);
      d.scale.set(1, s, 1);
      d.updateMatrix();
      grass.setMatrixAt(i, d.matrix);
    });
    grass.receiveShadow = true;
    scene.add(grass);
  }

  // One instanced mesh per tree kind.
  const byKind = Object.fromEntries(TREE_KINDS.map(([k]) => [k, []]));
  for (const pos of trees) {
    let roll = rand(), kind = TREE_KINDS[0][0];
    for (const [k, share] of TREE_KINDS) {
      if (roll < share) { kind = k; break; }
      roll -= share;
    }
    byKind[kind].push(pos);
  }
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const [kind, list] of Object.entries(byKind)) {
    if (!list.length) continue;
    const forest = new THREE.InstancedMesh(makeTreeGeometry(kind), vmat(), list.length);
    list.forEach(([x, z], i) => {
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
  }

  const clouds = [];
  for (let i = 0; i < CLOUDS; i++) {
    const cloud = makeCloud(rand);
    cloud.position.set(-10 + rand() * (W + 20), 13 + rand() * 4, -10 + rand() * (H + 20));
    cloud.userData.speed = 0.3 + rand() * 0.4;
    scene.add(cloud);
    clouds.push(cloud);
  }

  return { water: waterMesh, clouds, rects };
}

// Houses, stall, Market Row, lanterns, props and a fence around the village edge.
function buildVillage(village, data, props, glow, water, rects, scene) {
  for (const h of village.houses) {
    const house = makeHouse(...ROOFS[h.roof], h.kind);
    house.position.set(h.tx + 1, 0, h.ty + 1);
    scene.add(house);
    rects.push({ x0: h.tx + 0.1, x1: h.tx + 1.9, z0: h.ty + 0.15, z1: h.ty + 1.85 });
  }
  const { tx, ty } = village.stall;
  const stall = makeStall();
  stall.position.set(tx + 1, 0, ty + 0.5);
  scene.add(stall);
  rects.push({ x0: tx + 0.1, x1: tx + 1.9, z0: ty + 0.25, z1: ty + 0.75 });

  const f = village.fountain;
  fountain(props, water, f.tx, f.ty);
  rects.push({ x0: f.tx + 0.1, x1: f.tx + 1.9, z0: f.ty + 0.1, z1: f.ty + 1.9 });

  anvil(props, village.anvil.x, village.anvil.z);
  rects.push({ x0: village.anvil.x - 0.24, x1: village.anvil.x + 0.24, z0: village.anvil.z - 0.15, z1: village.anvil.z + 0.15 });

  for (const [x, z] of village.lanterns) {
    lanternPost(props, glow, x, z);
    const halo = makeGlowSprite();
    halo.position.set(x + 0.24, 1.1, z);
    scene.add(halo);
    rects.push({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12 });
  }

  const draw = { barrel, crate, board: noticeBoard };
  for (const p of village.props) {
    draw[p.kind](props, p.x, p.z);
    const half = p.kind === 'board' ? [0.4, 0.06] : [0.2, 0.2];
    rects.push({ x0: p.x - half[0], x1: p.x + half[0], z0: p.z - half[1], z1: p.z + half[1] });
  }

  // Fence along the village edge, with gaps wherever a path leaves.
  const r = village.rect, open = (x, z) => data[z]?.[x] === TILE.GRASS || data[z]?.[x] === TILE.FLOWERS;
  const edges = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    edges.push([x, r.y, x, r.y + 0.08, x + 1, r.y + 0.08]);
    edges.push([x, r.y + r.h - 1, x, r.y + r.h - 0.08, x + 1, r.y + r.h - 0.08]);
  }
  for (let z = r.y; z < r.y + r.h; z++) {
    edges.push([r.x, z, r.x + 0.08, z, r.x + 0.08, z + 1]);
    edges.push([r.x + r.w - 1, z, r.x + r.w - 0.08, z, r.x + r.w - 0.08, z + 1]);
  }
  for (const [tx, tz, x0, z0, x1, z1] of edges) {
    if (!open(tx, tz)) continue;
    fence(props, x0, z0, x1, z1);
    rects.push({ x0: Math.min(x0, x1) - 0.06, x1: Math.max(x0, x1) + 0.06, z0: Math.min(z0, z1) - 0.06, z1: Math.max(z0, z1) + 0.06, fence: true });
  }
}
