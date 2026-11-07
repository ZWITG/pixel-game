import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';

// How each nation makes war. `weights` is its character: how much it likes each kind of plan
// (see realm.js). `troops` fight for it, `machine` guards its forts, and `field` is what it does
// to a Conqueror walking its land.
export const DOCTRINES = {
  aurel: {
    title: 'The Legion', style: 'Drilled armies, walls and siege engines',
    weights: { raise: 1.3, fortify: 1.3, build: 1.1, raid: 0.8, settle: 0.9, hunt: 0.9, field: 0.9, war: 1 },
    troops: ['legionary', 'legionary', 'soldier'], machine: 'ballista', field: 'barrage', fieldWord: 'Siege engines open fire!',
  },
  thorn: {
    title: 'The Hidden War', style: 'Ambushes, assassins and traps in the trees',
    weights: { raise: 0.8, fortify: 0.7, build: 0.8, raid: 1.5, settle: 1, hunt: 1.3, field: 1.4, war: 0.8 },
    troops: ['assassin', 'assassin', 'bandit'], machine: 'thornTurret', field: 'ambush', fieldWord: 'Ambush! Figures drop from the trees!',
  },
  frost: {
    title: 'The Long Winter', style: 'Hold the walls and let the cold do the killing',
    weights: { raise: 0.9, fortify: 1.6, build: 1, raid: 0.6, settle: 0.7, hunt: 0.8, field: 1.2, war: 0.6 },
    troops: ['iceGuard', 'iceGuard', 'wraith'], machine: 'frostCannon', field: 'blizzard', fieldWord: 'A blizzard rolls in off the Frostwall!',
  },
  cinder: {
    title: 'Scorched Earth', style: 'Burn the land rather than lose it',
    weights: { raise: 1, fortify: 0.8, build: 0.9, raid: 1.2, settle: 0.6, hunt: 1, field: 1.6, war: 1.3 },
    troops: ['bomber', 'bomber', 'fireSlime'], machine: 'flameCannon', field: 'scorch', fieldWord: 'They are setting the land alight around you!',
  },
  mire: {
    title: 'The Slow Plague', style: 'Spread rot, and raise the drowned to fight again',
    weights: { raise: 1, fortify: 0.9, build: 1.1, raid: 0.9, settle: 1.2, hunt: 0.9, field: 1.3, war: 0.7 },
    troops: ['drowned', 'drowned', 'lurker'], machine: 'plagueEngine', field: 'plague', fieldWord: 'The ground sickens, and the dead stand up!',
  },
  bone: {
    title: 'The Swarm', style: 'Endless numbers, breaking out of the ground',
    weights: { raise: 1.7, fortify: 0.5, build: 1, raid: 1.4, settle: 0.5, hunt: 0.8, field: 1.2, war: 1.4 },
    troops: ['scorpion', 'scorpion', 'golem'], machine: 'boneEngine', field: 'burrow', fieldWord: 'The ground splits, and they pour out!',
  },
};

// What a nation's war machines look like: a timber or bone frame around one great arm.
export function machineMesh(kind) {
  const look = {
    ballista: ['#7a5230', '#b8a98e', '#e8c050'], thornTurret: ['#3a4a2a', '#5fae62', '#2a3a1e'], frostCannon: ['#6a9cb8', '#dff4ff', '#8fe0ff'],
    flameCannon: ['#2a1a14', '#6a3a22', '#ff7a2a'], plagueEngine: ['#2c3424', '#6a7a3a', '#a8d84a'], boneEngine: ['#c8b89c', '#e8dcc0', '#8a7a5e'],
    trebuchet: ['#6a4a2a', '#8a6a44', '#9a9080'],
  }[kind];
  const [frame, arm, tip] = look, b = new VoxelBuilder();
  b.box(0, 0.4, 0, 3.4, 0.5, 4.4, frame, 0.06);
  for (const [x, z] of [[-1.5, -1.9], [1.5, -1.9], [-1.5, 1.9], [1.5, 1.9]]) b.box(x, 0.45, z, 0.5, 0.9, 0.9, frame, 0.06);
  b.box(-1, 1.5, 0, 0.4, 2, 0.4, frame, 0.05).box(1, 1.5, 0, 0.4, 2, 0.4, frame, 0.05).box(0, 2.5, 0, 2.4, 0.4, 0.4, frame);
  b.box(0, 2.1, 1.1, 0.5, 0.5, 4, arm, 0.05).box(0, 2.1, 3.3, 0.9, 0.9, 0.9, tip, 0.03);
  b.box(-1.3, 2.1, 1.6, 2.2, 0.2, 0.25, arm).box(1.3, 2.1, 1.6, 2.2, 0.2, 0.25, arm);
  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  return mesh;
}

// A stockade thrown up on the frontier: stakes, a gate, a watchtower and a banner in its colors.
export function fortMesh(color) {
  const wood = '#7a5230', dark = '#5a3a22', b = new VoxelBuilder(), R = 24;
  b.box(0, 0.05, 0, R * 2, 0.1, R * 2, '#6a5a44', 0.08);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 6.283, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (z > R * 0.88 && Math.abs(x) < 6) continue;
    b.box(x, 2.6, z, 1.4, 5.2, 1.4, i % 3 ? wood : dark, 0.08).box(x, 5.5, z, 0.7, 0.7, 0.7, '#c9b89e');
  }
  b.box(0, 5, -8, 7, 0.6, 7, wood, 0.05).box(0, 7, -8, 1, 4, 1, dark);
  for (const [x, z] of [[-3, -11], [3, -11], [-3, -5], [3, -5]]) b.box(x, 2.5, z, 0.6, 5, 0.6, dark);
  b.box(1.8, 9.4, -8, 3.2, 2, 0.15, color, 0).box(0, 8.5, -8, 0.3, 5, 0.3, dark);
  for (const [x, z] of [[-12, 8], [11, 6]]) b.box(x, 1.2, z, 6, 2.4, 5, color, 0.08).box(x, 2.9, z, 4, 1.2, 5, color, 0.08);
  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// What each nation does to a hero on its land. All of it can be seen coming or fought off.
const BARRAGE = 7, AMBUSH = 4, RISEN = 4, SWARM = 5;
export const FIELD = {
  barrage(realm, hero) {
    for (let i = 0; i < BARRAGE; i++) {
      const a = Math.random() * 6.283, d = 4 + Math.random() * 18;
      realm.bombard(hero, hero.state.x + Math.cos(a) * d, hero.state.z + Math.sin(a) * d, 5, 1 + i * 0.35);
    }
  },
  ambush(realm, hero, n) {
    realm.warband(hero, n, AMBUSH, 13, 'assassin');
  },
  blizzard(realm, hero) {
    realm.blizzard = 24;
    realm.world.scars.mark('ice', hero.state.x, hero.state.z, 12, null, 3);
  },
  scorch(realm, hero) {
    const { x, z } = hero.state;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      realm.world.scars.mark('fire', x + Math.cos(a) * 17, z + Math.sin(a) * 17, 4, null, 3);
    }
  },
  plague(realm, hero, n) {
    realm.world.scars.mark('void', hero.state.x, hero.state.z, 9, null, 4);
    realm.warband(hero, n, RISEN, 9, 'drowned');
  },
  burrow(realm, hero, n) {
    realm.warband(hero, n, SWARM, 8, 'scorpion');
    const { x, z } = hero.state;
    realm.world.fx.impact('earth', x + 6, Math.max(hero.state.y, 0), z, 7);
    realm.world.fx.impact('earth', x - 6, Math.max(hero.state.y, 0), z, 7);
  },
};
