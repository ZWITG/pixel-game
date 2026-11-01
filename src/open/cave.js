import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';

// Caves: a string of chambers joined by tunnels, built like house rooms, high above the place
// you went in, so the world around it keeps streaming. Each one is a CaveLevel, shared by
// whoever is inside; each hero has a Cave, which takes the place of their house room.
export const CAVE_FLOOR = 1600;
const CELL = 2, ROOF = 9;
const LEVEL_ROCK = ['#4a4250', '#544a5a', '#403844'];
const WALL_ROCK = ['#5e5462', '#6a5e6c', '#524858'];
const MOBS = ['bat', 'puffcap', 'bat', 'golem'];
const HERO_RADIUS = 0.4;

export class CaveLevel {
  constructor(scene, site, monsters, seed) {
    Object.assign(this, { scene, site, monsters, x: site.x, z: site.z });
    this.hostile = true;
    this.dark = true;
    this.goalText = 'Find the chest at the far end';
    this.users = 0;
    this.mobs = [];
    this.group = null;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.rand = rand;
    // Chambers wander outward from the entrance, with the odd side room.
    this.rooms = [{ x: 0, z: 0, r: 8 }];
    this.tunnels = [];
    let a = rand() * 6.28;
    const count = 5 + Math.floor(rand() * 3);
    for (let i = 1; i <= count; i++) {
      const from = this.rooms[this.rooms.length - 1];
      a += (rand() - 0.5) * 1.8;
      const d = 24 + rand() * 12, room = { x: from.x + Math.sin(a) * d, z: from.z + Math.cos(a) * d, r: 7 + rand() * 6 };
      this.rooms.push(room);
      this.tunnels.push([from, room]);
      if (rand() < 0.4) {
        const b = a + (rand() < 0.5 ? 1.6 : -1.6), side = { x: room.x + Math.sin(b) * 20, z: room.z + Math.cos(b) * 20, r: 6 + rand() * 3, side: true };
        this.rooms.push(side);
        this.tunnels.push([room, side]);
        this.rooms.push(room); // the main line carries on from here
      }
    }
    this.rooms = this.rooms.filter((r, i) => this.rooms.indexOf(r) === i);
    this.chest = [...this.rooms].reverse().find((r) => !r.side);
  }

  // Is this point (relative to the entrance) open floor?
  walk(x, z) {
    if (this.rooms.some((r) => Math.hypot(x - r.x, z - r.z) < r.r)) return true;
    return this.tunnels.some(([a, b]) => {
      const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < 3.4;
    });
  }

  build() {
    const b = new VoxelBuilder(), glow = new VoxelBuilder(), rand = this.rand;
    const xs = this.rooms.flatMap((r) => [r.x - r.r, r.x + r.r]), zs = this.rooms.flatMap((r) => [r.z - r.r, r.z + r.r]);
    const x0 = Math.floor(Math.min(...xs) / CELL) - 3, x1 = Math.ceil(Math.max(...xs) / CELL) + 3;
    const z0 = Math.floor(Math.min(...zs) / CELL) - 3, z1 = Math.ceil(Math.max(...zs) / CELL) + 3;
    const open = (i, j) => this.walk(i * CELL, j * CELL);
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
      const x = i * CELL, z = j * CELL, c = (i * 7 + j * 13) & 3;
      if (open(i, j)) {
        b.box(x, -0.5, z, CELL, 1, CELL, LEVEL_ROCK[c % 3], 0.05);
        b.box(x, ROOF + 0.5 + c * 0.3, z, CELL, 1, CELL, WALL_ROCK[c % 3], 0.05);
      } else if ([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([p, q]) => open(i + p, j + q))) {
        b.box(x, ROOF / 2, z, CELL + 0.2, ROOF + 2, CELL + 0.2, WALL_ROCK[c % 3], 0.07);
      }
    }
    for (const r of this.rooms) {
      for (let i = 0; i < 6; i++) {
        const a = rand() * 6.28, d = r.r * (0.45 + rand() * 0.4), x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d, h = 1 + rand() * 2.4;
        if (rand() < 0.5) b.box(x, ROOF - h / 2, z, 0.8, h, 0.8, WALL_ROCK[i % 3], 0.05).box(x, ROOF - h - 0.3, z, 0.4, 0.7, 0.4, WALL_ROCK[i % 3]);
        else glow.box(x, h / 2, z, 0.5, h, 0.5, ['#9fe8ff', '#c9a0ff', '#7fe3c0'][i % 3], 0).box(x + 0.5, h / 3, z, 0.35, h * 0.6, 0.35, '#ffffff', 0);
      }
    }
    b.box(0, 3, 0, 0.1, 0.1, 0.1, '#000000');
    b.box(0, 0.05, 0, 3, 0.1, 3, '#d8c8a0', 0.03); // pale light from the way out
    const c = this.chest;
    b.box(c.x, 0.7, c.z, 3, 1.4, 2, '#8a5a30', 0.05).box(c.x, 1.6, c.z, 3.2, 0.5, 2.2, '#6a4428').box(c.x, 1.1, c.z + 1, 0.5, 0.6, 0.15, '#ffcd75', 0);
    this.group = new THREE.Group();
    const mesh = new THREE.Mesh(b.build(), vmat());
    mesh.receiveShadow = true;
    this.group.add(mesh, new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    this.group.position.set(this.x, CAVE_FLOOR, this.z);
    this.scene.add(this.group);
  }

  enter() {
    if (!this.group) this.build();
    this.group.visible = true;
    if (this.users++) return;
    this.mobs = [];
    this.rooms.slice(1).forEach((r, i) => {
      for (let k = 0; k < 2 + (i % 2); k++) {
        const e = this.monsters.add(MOBS[(i + k) % MOBS.length], this.x + r.x + (k - 1) * 3, this.z + r.z + 2, 1.5, false, this);
        this.mobs.push(e);
      }
    });
  }

  exit() {
    if (--this.users) return;
    this.group.visible = false;
    for (const e of this.mobs) if (this.monsters.list.includes(e)) this.monsters.removeEnemy(e);
    this.mobs = [];
  }
}

export default class Cave {
  constructor(scene, player) {
    this.player = player;
    this.house = null;
    this.floor = CAVE_FLOOR;
    this.good = [0, 0];
    this.light = new THREE.PointLight('#ffc890', 34, 30, 1.5);
    this.light.position.y = -500; // kept in the scene so entering never recompiles materials
    scene.add(this.light);
  }

  enter(level, state) {
    this.house = level;
    level.enter();
    state.x = level.x + 1;
    state.z = level.z + 3;
    state.yaw = 0;
    state.pitch = 0.3;
    state.dir = [0, -1];
    this.good = [state.x, state.z];
  }

  leave(state) {
    const { site } = this.house;
    this.house.exit();
    this.house = null;
    this.light.position.y = -500;
    state.x = site.x;
    state.z = site.z + 7;
    state.yaw = 0;
    state.pitch = 0.16;
    state.dir = [0, 1];
    this.player.rooms = this.player.homeRooms;
  }

  spot(state) {
    const L = this.house, x = state.x - L.x, z = state.z - L.z;
    if (Math.hypot(x, z) < 4) return { label: 'Leave the cave', action: 'leave' };
    if (!L.site.done && Math.hypot(x - L.chest.x, z - L.chest.z) < 4) return { label: 'Open the chest', action: 'chest' };
    return null;
  }

  // Walls of a cave aren't straight, so a step that leaves the floor is simply undone.
  collide(state) {
    const L = this.house, x = state.x - L.x, z = state.z - L.z;
    const clear = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([p, q]) => L.walk(x + p * HERO_RADIUS, z + q * HERO_RADIUS));
    if (clear) this.good = [state.x, state.z];
    else [state.x, state.z] = this.good;
    this.light.position.set(state.x, CAVE_FLOOR + 3.5, state.z);
  }

  // Walks back from the camera's spot until it's inside the rock's open space.
  clampCamera(pos, hx, hz) {
    const L = this.house;
    for (let t = 1; t > 0.05; t -= 0.1) {
      const x = hx + (pos.x - hx) * t, z = hz + (pos.z - hz) * t;
      if (L.walk(x - L.x, z - L.z)) {
        pos.x = x;
        pos.z = z;
        break;
      }
      if (t < 0.15) {
        pos.x = hx;
        pos.z = hz;
      }
    }
    pos.y = THREE.MathUtils.clamp(pos.y, CAVE_FLOOR + 1, CAVE_FLOOR + ROOF - 1);
  }
}
