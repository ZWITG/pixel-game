import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';

// House interiors. One room hangs high above the world and moves over whichever house you
// enter, so the terrain around you keeps streaming and leaving is instant.
export const ROOM_Y = 1200;
const W = 18, D = 14, H = 7;
const HERO_RADIUS = 0.4;
const FURNITURE = [
  { x: -6.6, z: -3.6, w: 4, d: 6 },    // bed
  { x: 6.8, z: -5.6, w: 3, d: 1.8 },   // chest
  { x: 3.5, z: 1.5, w: 3.4, d: 2.2 },  // table
  { x: 0, z: -6.4, w: 5, d: 1.2 },     // hearth
];
const SPOTS = [
  { x: -6.6, z: -1, r: 2.6, label: 'Rest', action: 'rest' },
  { x: 6.8, z: -4.4, r: 2.4, label: 'Open chest', action: 'store' },
  { x: 0, z: D / 2 - 1, r: 2.2, label: 'Leave', action: 'leave' },
];

function build() {
  const b = new VoxelBuilder();
  for (let i = 0; i < 9; i++) b.box(-W / 2 + 1 + i * 2, -0.25, 0, 1.96, 0.5, D, i % 2 ? '#8a5a38' : '#9a6a44', 0.04);
  for (const [x, z, w, d] of [[0, -D / 2 - 0.25, W + 1, 0.5], [0, D / 2 + 0.25, W + 1, 0.5], [-W / 2 - 0.25, 0, 0.5, D], [W / 2 + 0.25, 0, 0.5, D]]) {
    b.box(x, H / 2, z, w, H, d, '#e8d5b0', 0.04);
    b.box(x, 0.4, z, w + 0.1, 0.8, d + 0.1, '#7a5230');
  }
  b.box(0, H + 0.25, 0, W + 1, 0.5, D + 1, '#6a4428', 0.04);
  for (let i = 0; i < 4; i++) b.box(-6 + i * 4, H - 0.3, 0, 0.5, 0.6, D, '#5a3a22');

  b.box(0, 1.4, D / 2 - 0.05, 2.6, 2.8, 0.2, '#7a5230').box(0, 1.4, D / 2 - 0.2, 0.1, 2.6, 0.1, '#5a3a22').box(0.9, 1.3, D / 2 - 0.2, 0.18, 0.18, 0.1, '#ffcd75');
  for (const x of [-5, 5]) b.box(x, 3.6, D / 2 - 0.05, 2.4, 2, 0.15, '#9fd8ff').box(x, 3.6, D / 2 - 0.15, 2.6, 0.14, 0.1, '#7a5230').box(x, 3.6, D / 2 - 0.15, 0.14, 2.2, 0.1, '#7a5230');

  // Bed
  b.box(-6.6, 0.45, -3.6, 4, 0.9, 6, '#6a4428').box(-6.6, 0.95, -3.4, 3.7, 0.3, 5.4, '#b13e53', 0.04).box(-6.6, 1.05, -5.6, 3, 0.4, 1.3, '#f3ead8');
  // Chest
  b.box(6.8, 0.6, -5.6, 3, 1.2, 1.8, '#8a5a30', 0.04).box(6.8, 1.35, -5.6, 3.1, 0.3, 1.9, '#6a4428').box(6.8, 1, -4.66, 0.4, 0.5, 0.1, '#ffcd75');
  // Table, stools and a loaf
  b.box(3.5, 1.15, 1.5, 3.4, 0.2, 2.2, '#9a6a44', 0.04);
  for (const [x, z] of [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9]]) b.box(3.5 + x, 0.52, 1.5 + z, 0.2, 1.05, 0.2, '#6a4428');
  b.box(3.2, 1.38, 1.4, 0.8, 0.28, 0.45, '#d8a060').box(4.2, 1.34, 1.8, 0.4, 0.2, 0.4, '#d0d8e0');
  // Hearth
  b.box(0, 1.5, -6.4, 5, 3, 1.2, '#7c6a70', 0.06).box(0, 0.75, -5.9, 2.6, 1.5, 0.3, '#2b2f45').box(0, 0.5, -5.8, 1.6, 0.6, 0.2, '#ffb547').box(0, 4.8, -6.6, 2.2, 3.6, 0.8, '#7c6a70', 0.06);
  // Shelf and rug
  b.box(8, 3.2, 2, 0.5, 0.15, 4, '#6a4428').box(8, 3.55, 1, 0.3, 0.55, 0.3, '#3b5dc9').box(8, 3.55, 2.2, 0.3, 0.55, 0.3, '#e8a33a').box(8, 3.5, 3.1, 0.3, 0.4, 0.5, '#257179');
  b.box(-1, 0.03, 1.5, 7, 0.06, 5, '#3b5dc9', 0.03).box(-1, 0.05, 1.5, 6, 0.06, 4, '#c9b89e', 0.03);

  const mesh = new THREE.Mesh(b.build(), vmat());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export default class Rooms {
  constructor(scene) {
    this.house = null;
    this.floor = ROOM_Y;
    this.group = new THREE.Group();
    this.group.position.y = ROOM_Y;
    this.group.add(build());
    // Always lit and in the scene (not inside the hidden room, where it wouldn't count as a light),
    // parked far below until a house is entered, so entering never rebuilds every shader.
    this.fire = new THREE.PointLight('#ffd8b0', 28, 26, 1.4);
    this.fire.position.set(0, -500, 0);
    scene.add(this.fire);
    this.group.visible = false;
    scene.add(this.group);
  }

  enter(house, state) {
    this.house = house;
    this.group.position.x = house.x;
    this.group.position.z = house.z;
    this.group.visible = true;
    this.fire.position.set(house.x, ROOM_Y + 3.2, house.z - 3);
    state.x = house.x;
    state.z = house.z + D / 2 - 5.5; // a few steps in, so the camera has room behind the hero
    state.yaw = 0;
    state.pitch = 0.3;
    state.dir = [0, -1];
  }

  leave(state) {
    const { door, rot } = this.house, ox = Math.sin(rot), oz = Math.cos(rot);
    state.x = door.x + ox * 0.8;
    state.z = door.z + oz * 0.8;
    state.yaw = rot + Math.PI;
    state.pitch = 0.16;
    state.dir = [ox, oz];
    this.house = null;
    this.group.visible = false;
    this.fire.position.set(0, -500, 0);
  }

  spot(state) {
    const x = state.x - this.house.x, z = state.z - this.house.z;
    return SPOTS.find((s) => Math.hypot(x - s.x, z - s.z) < s.r);
  }

  collide(state) {
    const hx = this.house.x, hz = this.house.z;
    let x = THREE.MathUtils.clamp(state.x - hx, -W / 2 + HERO_RADIUS, W / 2 - HERO_RADIUS);
    let z = THREE.MathUtils.clamp(state.z - hz, -D / 2 + HERO_RADIUS, D / 2 - HERO_RADIUS);
    for (const f of FURNITURE) {
      const px = f.w / 2 + HERO_RADIUS - Math.abs(x - f.x), pz = f.d / 2 + HERO_RADIUS - Math.abs(z - f.z);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) x += x < f.x ? -px : px;
      else z += z < f.z ? -pz : pz;
    }
    state.x = hx + x;
    state.z = hz + z;
  }

  // Keeps the camera between the walls, and low when a wall pushes it in close, so it never
  // ends up looking straight down on the hero.
  clampCamera(pos, hx, hz) {
    pos.x = THREE.MathUtils.clamp(pos.x, this.house.x - W / 2 + 0.3, this.house.x + W / 2 - 0.3);
    pos.z = THREE.MathUtils.clamp(pos.z, this.house.z - D / 2 + 0.3, this.house.z + D / 2 - 0.3);
    // Backed against a wall, it slides toward the middle of the room to stay off the hero's face.
    const nudge = THREE.MathUtils.clamp((3 - Math.hypot(pos.x - hx, pos.z - hz)) / 1.5, 0, 1);
    if (nudge) {
      const cx = this.house.x - hx, cz = this.house.z - hz, l = Math.hypot(cx, cz) || 1;
      pos.x += (hx + (cx / l) * 3.5 - pos.x) * nudge;
      pos.z += (hz + (cz / l) * 3.5 - pos.z) * nudge;
    }
    const close = Math.hypot(pos.x - hx, pos.z - hz);
    pos.y = THREE.MathUtils.clamp(pos.y, ROOM_Y + 0.5, Math.min(ROOM_Y + H - 0.4, ROOM_Y + 1.7 + close * 0.4));
  }
}
