import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { makeHumanoid, walkPose } from '../render/models.js';
import { LOOKS } from '../art/looks.js';
import { height } from './terrain.js';
import { placeHouse } from './landmarks.js';
import { masonry } from './materials.js';
import { NATIONS } from './nations.js';

// Places people have built. The size of a place follows its people: each tier adds houses, then
// a fence, then stone walls. A place is only made into meshes when a hero comes near it.
export const TIERS = [
  { name: 'Homestead', pop: 0, houses: 2 },
  { name: 'Hamlet', pop: 16, houses: 4 },
  { name: 'Village', pop: 45, houses: 9 },
  { name: 'Town', pop: 130, houses: 16 },
  { name: 'City', pop: 350, houses: 26 },
  { name: 'Kingdom', pop: 800, houses: 36 },
];
export const tierOf = (pop) => TIERS.reduce((best, t, i) => (pop >= t.pop ? i : best), 0);

const SHOW_NEAR = 620;       // tiles from a hero that a place is built in the world
const RISE_SECS = 5;         // a new house goes up over this long
const HOUSE_ROOM = 7.5;      // tiles between rings of houses
const BUILDERS = 3;
const CLEARED = 7;           // tiles of trees felled around a new house
const CLEARED_FOR = 3e10;    // ms: for as long as the house stands
const ROOFS = [['#b13e53', '#8a2e40'], ['#3b5dc9', '#2c4498'], ['#e8a33a', '#b87a22'], ['#257179', '#1a535a'], ['#7a5a9e', '#5a4078']];
const FREE_COLOR = '#e8ddc8', YOUR_COLOR = '#f7efdf';
const WORK = [LOOKS.merchant, LOOKS.smith, LOOKS.kid, LOOKS.guard];

const STARTS = ['Ash', 'Bryn', 'Cael', 'Dun', 'Elder', 'Fen', 'Gar', 'Harrow', 'Ivy', 'Kel', 'Lorn', 'Mar', 'Nor', 'Oak', 'Pell', 'Rook', 'Sel', 'Tarn', 'Ul', 'Vey', 'Wyn', 'Yar'];
const ENDS = ['bury', 'cross', 'dale', 'fell', 'ford', 'garth', 'haven', 'holt', 'marsh', 'mere', 'moor', 'reach', 'rest', 'stead', 'ton', 'wick'];
const GIVEN = ['Varro', 'Sera', 'Hald', 'Mirek', 'Oska', 'Tiber', 'Ysolde', 'Corvin', 'Brenna', 'Dask', 'Ilse', 'Rurik', 'Thessa', 'Goran', 'Maren', 'Kael'];
const MARKS = { aurel: ['the Unbowed', 'Ironhand', 'of the Ninth'], thorn: ['Quickknife', 'the Unseen', 'Briar'], frost: ['Rimeheart', 'the Still', 'Coldhand'], cinder: ['Ashborn', 'the Kindler', 'Cinderjaw'], mire: ['the Drowned', 'Mirefather', 'Rotgrin'], bone: ['Marrowking', 'the Hollow', 'Gnawbone'] };

function hash(text) {
  return [...text].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7);
}

export function namePlace(seed, kind) {
  const h = hash(seed), word = STARTS[h % STARTS.length] + ENDS[(h >> 5) % ENDS.length];
  return kind ? `${kind} ${word}` : word;
}

export function nameCaptain(id) {
  const given = GIVEN[Math.floor(Math.random() * GIVEN.length)], marks = MARKS[id];
  return `${given} ${marks[Math.floor(Math.random() * marks.length)]}`;
}

const colorOf = (s) => (s.owner === 'free' ? FREE_COLOR : s.owner === 'hero' ? YOUR_COLOR : NATIONS.find((n) => n.id === s.owner).color);

export default class Towns {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.clock = 0;
  }

  add(list, data) {
    const s = { ...data, built: 0, houses: [], rising: [], walls: -1, banner: null, crew: [] };
    list.push(s);
    return s;
  }

  // Where a place's nth house stands: rings going outward, each door facing the middle.
  spot(s, n) {
    const a = n * 2.4 + s.x * 0.01, d = 11 + Math.sqrt(n + 1) * HOUSE_ROOM;
    return [s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, Math.round(a / (Math.PI / 2)) * (Math.PI / 2)];
  }

  raiseHouse(s, animate) {
    const n = s.built++, [x, z, rot] = this.spot(s, n), { marks } = this.world;
    if (Math.abs(height(x, z) - height(s.x, s.z)) > 14 || height(x, z) < 2) return;
    // Settlers clear the ground before they build on it.
    for (const o of this.world.chunks.near(x, z, CLEARED)) if (o.type === 'tree') this.world.chunks.remove(o, Date.now() + CLEARED_FOR);
    placeHouse(this.scene, marks, `${s.id}|${n}`, x, z, rot, ROOFS[(n + s.name.length) % ROOFS.length]);
    const home = marks.houses[marks.houses.length - 1];
    s.houses.push(home);
    if (animate) s.rising.push({ mesh: home.mesh, y: home.mesh.position.y, left: RISE_SECS });
  }

  // A fence, then stone, as a place grows into them.
  wall(s, tier) {
    if (s.wallMesh) this.scene.remove(s.wallMesh);
    const b = new VoxelBuilder(), R = 26 + Math.sqrt(TIERS[tier].houses) * HOUSE_ROOM, stone = tier >= 4, n = Math.round(R * (stone ? 0.8 : 1.5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283, x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (Math.abs(x) < 8 && z > 0) continue;
      const gy = height(s.x + x, s.z + z) - height(s.x, s.z);
      if (stone) b.box(x, gy + 3.2, z, 5.4, 6.4, 3, '#a89a8c', 0.05).box(x, gy + 7, z, 1.6, 1.4, 3.4, '#7c6e68', 0.05);
      else b.box(x, gy + 1.3, z, 0.8, 2.6, 0.8, i % 2 ? '#7a5230' : '#5a3a22', 0.08);
    }
    s.wallMesh = new THREE.Mesh(b.build(), masonry());
    s.wallMesh.position.set(s.x, height(s.x, s.z), s.z);
    s.wallMesh.castShadow = true;
    this.scene.add(s.wallMesh);
  }

  // The flag in the middle shows who holds it.
  colors(s) {
    if (s.banner) s.banner.material.color.set(colorOf(s));
  }

  raiseBanner(s) {
    const y = height(s.x, s.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 13, 6).translate(0, 6.5, 0), new THREE.MeshLambertMaterial({ color: '#3a2c22' }));
    pole.position.set(s.x, y, s.z);
    s.banner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5).translate(1.7, 10, 0), new THREE.MeshLambertMaterial({ color: colorOf(s), side: THREE.DoubleSide }));
    s.banner.position.set(s.x, y, s.z);
    this.scene.add(pole, s.banner);
  }

  // People at work on whatever is going up.
  crew(s) {
    if (s.crew.length) return;
    for (let i = 0; i < BUILDERS; i++) {
      const who = makeHumanoid(WORK[(i + s.name.length) % WORK.length]);
      who.group.scale.setScalar(1.6);
      this.scene.add(who.group);
      s.crew.push(who);
    }
  }

  update(dt, list) {
    this.clock += dt;
    const { players } = this.world;
    for (const s of list) {
      if (s.fixed) continue;
      const near = players.some((p) => Math.hypot(p.state.x - s.x, p.state.z - s.z) < SHOW_NEAR);
      if (!near) continue;
      const tier = tierOf(s.pop);
      if (!s.banner) this.raiseBanner(s);
      if (s.built < TIERS[tier].houses) this.raiseHouse(s, s.seen === true);
      s.seen = true;
      const wanted = tier >= 4 ? 2 : tier >= 2 ? 1 : 0;
      if (wanted !== s.walls) {
        s.walls = wanted;
        if (wanted) this.wall(s, tier);
      }
      s.rising = s.rising.filter((r) => {
        r.left -= dt;
        const k = Math.max(0, r.left / RISE_SECS);
        r.mesh.position.y = r.y - k * 6;
        return k > 0;
      });
      this.work(s);
    }
  }

  work(s) {
    this.crew(s);
    s.crew.forEach((who, i) => {
      const [x, z] = this.spot(s, Math.max(0, s.built - 1)), a = this.clock * 0.3 + i * 2.1, wx = x + Math.cos(a) * 6, wz = z + Math.sin(a) * 6;
      who.group.position.set(wx, height(wx, wz), wz);
      who.group.rotation.y = -a;
      walkPose(who, this.clock * 7 + i, 0.5);
    });
  }
}
