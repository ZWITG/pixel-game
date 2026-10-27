import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { resetStats, addXp } from '../config/stats.js';
import { ENEMIES } from '../data/enemies.js';
import { NPCS } from '../data/npcs.js';
import { LOOT } from '../data/items.js';
import { generateWorld } from '../world/generateWorld.js';
import { buildWorld } from '../world/buildWorld.js';
import Collision from '../world/collision.js';
import Store from './Store.js';
import CameraRig from './CameraRig.js';
import Controls from '../systems/controls.js';
import LockOn from '../systems/lockOn.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Npc from '../entities/Npc.js';
import { bagCount } from '../systems/shop.js';
import Hud from '../ui/Hud.js';
import { makeCoin, makeLoot, makeSatchel } from '../render/models.js';
import { disposeModel } from '../render/voxel.js';

const RETRO_SCALE = 3;   // retro mode renders at 1/3 resolution for chunky pixels
const MAX_PIXEL_RATIO = 2;
const WORLD_SEED = 1337;
const MAX_ENEMIES = 14;
const SPAWN_EVERY = 4;   // seconds
const TALK_RANGE = 1.6;  // tiles
const PICKUP_RANGE = 0.55;  // walk this close to pick up a coin or drop
const MAGNET_RANGE = 1.8;   // drops closer than this slide toward the hero
const SATCHEL_RANGE = 0.8;
const SKY_TOP = '#4a8fe0';
const SKY_HORIZON = '#cdeaff';

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(0.75, SKY_HORIZON);
  grad.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default class Game {
  constructor(container) {
    const retro = FEATURES.retroPixels;
    this.renderer = new THREE.WebGLRenderer({ antialias: !retro, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(retro ? 1 : Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = retro ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.imageRendering = retro ? 'pixelated' : 'auto';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(SKY_HORIZON, 24, 46);
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 120);
    this.addLights();

    this.store = new Store();
    this.controls = new Controls(this.renderer.domElement);
    this.hud = new Hud(this);
    this.rig = new CameraRig(this.camera);
    this.hud.setCamMode(this.rig.mode);

    const { data, spawn, village } = generateWorld(WORLD_SEED, { village: FEATURES.village });
    this.spawn = spawn;
    this.village = village;
    const world = buildWorld(this.scene, data, village);
    this.water = world.water;
    this.collision = new Collision(data, world.rects);

    this.npcs = [];
    if (village) {
      for (const def of NPCS) {
        const spot = village.spots[def.spot];
        if (!spot) continue;
        const npc = new Npc(this, def, spot);
        this.npcs.push(npc);
        this.collision.rects.push(npc.rect());
      }
    }

    this.player = new Player(this);
    this.lockOn = new LockOn(this);
    this.enemies = [];
    this.pickups = [];   // coins and monster drops on the ground: { mesh, kind, seed }
    this.satchel = null; // what the hero dropped when falling
    this.effects = [];
    this.time = 0;

    addEventListener('resize', () => this.resize());
    this.resize();
    this.reset();
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight('#d6efff', '#4a6a3a', 1.5));
    const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    sun.castShadow = true;
    const size = FEATURES.retroPixels ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const scale = FEATURES.retroPixels ? RETRO_SCALE : 1;
    this.renderer.setSize(Math.ceil(w / scale), Math.ceil(h / scale), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  reset() {
    resetStats(this.store);
    this.player.respawn(this.spawn.x, this.spawn.z);
    this.lockOn.clear();
    for (const e of this.enemies) e.remove();
    for (const item of this.pickups) this.scene.remove(item.mesh);
    this.enemies = [];
    this.pickups = [];
    this.removeSatchel();
    if (FEATURES.enemies) for (let i = 0; i < MAX_ENEMIES; i++) this.spawnEnemy();
    this.spawnTimer = SPAWN_EVERY;
    this.wasInVillage = false;
    this.hud.reset();
    this.rig.snap(this.player);
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      this.step((now - last) / 1000);
      last = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // One frame. Menus take input while open; otherwise the world runs.
  step(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.controls.update(dt);
    const just = this.controls.just;

    if (just.camera && FEATURES.topDownCamera) {
      this.rig.toggle();
      this.hud.setCamMode(this.rig.mode);
    }
    // Locked on, the camera turns by itself and left/right input switches targets instead.
    const look = this.controls.look();
    this.rig.look(this.lockOn.target ? 0 : look.x, look.y);

    if (this.store.get('dead')) {
      this.lockOn.clear();
      if (just.restart) FEATURES.lootDrop ? this.revive() : this.reset();
    } else if (this.hud.mode) {
      this.hud.handle(just);
    } else {
      this.updateWorld(dt, just);
    }

    this.animate(dt);
    this.rig.update(dt, this.player, this.lockOn.target);
    this.sun.position.set(this.player.x - 8, 14, this.player.z + 6);
    this.sun.target.position.set(this.player.x, 0, this.player.z);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateWorld(dt, just) {
    const player = this.player;
    const npc = FEATURES.dialogue ? this.nearestNpc() : null;
    if (FEATURES.lockOn) {
      if (just.lock) this.lockOn.toggle();
      if (just.targetLeft) this.lockOn.cycle(-1);
      if (just.targetRight) this.lockOn.cycle(1);
      this.lockOn.update();
    }
    player.update(dt, {
      move: this.rig.moveVector(this.controls.move()),
      attack: just.attack,
      spin: just.spin,
      dodge: just.dodge,
      target: this.lockOn.target,
      idleFacing: this.rig.mode === 'third' ? this.rig.forward() : null,
    });

    for (const e of this.enemies.slice()) e.update(dt);
    this.separateEnemies();
    for (const e of this.enemies) {
      if (!e.dying && Math.hypot(e.x - player.x, e.z - player.z) < e.radius + player.radius) player.hurt(e.def.damage, e);
    }
    for (const item of this.pickups.slice()) {
      const pos = item.mesh.position, dx = player.x - pos.x, dz = player.z - pos.z, d = Math.hypot(dx, dz);
      if (d < PICKUP_RANGE) this.collect(item);
      else if (d < MAGNET_RANGE) {
        const pull = Math.min(d, (MAGNET_RANGE - d + 1) * 4 * dt);
        pos.x += (dx / d) * pull;
        pos.z += (dz / d) * pull;
      }
    }
    if (this.satchel && Math.hypot(this.satchel.x - player.x, this.satchel.z - player.z) < SATCHEL_RANGE) this.recoverSatchel();

    if (FEATURES.enemies && (this.spawnTimer -= dt) <= 0) {
      this.spawnTimer = SPAWN_EVERY;
      this.spawnEnemy();
    }

    this.hud.setPrompt(npc);
    if (npc && just.interact) this.talkTo(npc);
    if (just.pause) this.hud.openControls();
    if (just.recenter && !this.lockOn.target) this.rig.recenter(player.facing.x, player.facing.y);

    if (this.village) {
      const inside = this.inVillage(player.x, player.z);
      if (inside && !this.wasInVillage) this.hud.showBanner(this.village.name);
      this.wasInVillage = inside;
    }
  }

  // Things that keep moving even while a menu is open.
  animate(dt) {
    const t = this.time;
    this.water.position.y = Math.sin(t * 1.5) * 0.02;
    for (const npc of this.npcs) npc.animate(t);
    for (const item of this.pickups) {
      item.mesh.rotation.y += dt * 3;
      item.mesh.position.y = 0.35 + Math.sin(t * 4 + item.seed) * 0.06;
    }
    if (this.satchel) {
      const { bag, beam } = this.satchel.model;
      bag.rotation.y = Math.sin(t) * 0.3;
      beam.material.opacity = 0.25 + Math.sin(t * 3) * 0.1;
    }
    for (const fx of this.effects) {
      fx.age += dt;
      fx.mesh.material.opacity = 0.9 * (1 - fx.age / fx.life);
      if (fx.rise) fx.mesh.position.y += fx.rise * dt;
      if (fx.grow) fx.mesh.scale.setScalar(1 + fx.grow * fx.age);
    }
    this.lockOn.animate(t);
    for (const fx of this.effects.filter((f) => f.age >= f.life)) {
      this.scene.remove(fx.mesh);
      fx.mesh.material.dispose();
    }
    this.effects = this.effects.filter((f) => f.age < f.life);
  }

  // A short-lived mesh that fades out. `rise` lifts it (tiles/s), `grow` swells it.
  addEffect(mesh, life, { rise = 0, grow = 0 } = {}) {
    this.scene.add(mesh);
    this.effects.push({ mesh, life, age: 0, rise, grow });
  }

  separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2, nx = dx / d, nz = dz / d;
          this.collision.move(a, -nx * push, -nz * push);
          this.collision.move(b, nx * push, nz * push);
        }
      }
    }
  }

  inVillage(x, z, margin = 0) {
    if (!this.village) return false;
    const r = this.village.rect;
    return x >= r.x - margin && x < r.x + r.w + margin && z >= r.y - margin && z < r.y + r.h + margin;
  }

  villageCenter() {
    const r = this.village.rect;
    return { x: r.x + r.w / 2, z: r.y + r.h / 2 };
  }

  nearestNpc() {
    let best = null, bestDist = TALK_RANGE;
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.x - this.player.x, npc.z - this.player.z);
      if (d < bestDist) {
        best = npc;
        bestDist = d;
      }
    }
    return best;
  }

  talkTo(npc) {
    npc.face(this.player.x, this.player.z);
    this.player.faceToward(npc.x, npc.z);
    this.player.idlePose();
    this.hud.setPrompt(null);
    this.hud.openDialogue(npc.def.name, npc.def.lines, () => {
      if (npc.def.shop && FEATURES.shop) this.hud.openShop(npc.def.shop);
    });
  }

  spawnEnemy() {
    if (this.enemies.filter((e) => !e.dying).length >= MAX_ENEMIES) return;
    const level = this.store.get('level');
    const types = Object.values(ENEMIES).filter((d) => level >= d.minLevel);
    const def = types[Math.floor(Math.random() * types.length)];
    const { w, h } = this.collision;
    for (let tries = 0; tries < 30; tries++) {
      const x = 2 + Math.floor(Math.random() * (w - 4)) + 0.5;
      const z = 2 + Math.floor(Math.random() * (h - 4)) + 0.5;
      if (this.collision.blocked(x, z, def.radius)) continue;
      if (Math.hypot(x - this.player.x, z - this.player.z) < 9) continue;
      if (this.inVillage(x, z, 2)) continue;
      this.enemies.push(new Enemy(this, x, z, def));
      return;
    }
  }

  removeEnemy(enemy) {
    enemy.remove();
    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  onEnemyKilled(enemy) {
    if (FEATURES.coins && Math.random() < 0.7) this.dropPickup(enemy.x, enemy.z, 'coin');
    if (FEATURES.monsterDrops) {
      for (const { item, chance } of enemy.def.drops ?? []) if (Math.random() < chance) this.dropPickup(enemy.x, enemy.z, item);
    }
    if (FEATURES.leveling && addXp(this.store, enemy.def.xp)) {
      this.hud.floatText(this.player.x, 1.6, this.player.z, `LEVEL ${this.store.get('level')}!`, '#ffcd75');
      this.hud.flash();
    }
  }

  // `kind` is 'coin' or a monster drop id from data/items.js LOOT.
  dropPickup(x, z, kind) {
    const mesh = kind === 'coin' ? makeCoin() : makeLoot(LOOT[kind].color);
    mesh.position.set(x + (Math.random() - 0.5) * 0.5, 0.35, z + (Math.random() - 0.5) * 0.5);
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, seed: Math.random() * 10 });
  }

  collect(item) {
    const s = this.store, { mesh, kind } = item, { x, z } = mesh.position;
    if (kind === 'coin') {
      s.set('coins', s.get('coins') + 1);
      this.hud.floatText(x, 0.8, z, '+1', '#ffcd75');
    } else {
      s.set('bag', { ...s.get('bag'), [kind]: (s.get('bag')[kind] ?? 0) + 1 });
      this.hud.floatText(x, 0.8, z, `+${LOOT[kind].name}`, LOOT[kind].color);
    }
    this.scene.remove(mesh);
    this.pickups = this.pickups.filter((p) => p !== item);
  }

  // After falling: carried coins and drops stay in a satchel where the hero fell (an older,
  // unclaimed satchel is lost) and the hero wakes up in the village, keeping level and gear.
  revive() {
    const s = this.store, p = this.player;
    this.removeSatchel();
    const coins = s.get('coins'), bag = s.get('bag');
    if (coins || bagCount(bag)) this.placeSatchel(p.x, p.z, coins, bag);
    s.set('coins', 0);
    s.set('bag', {});
    s.set('hp', s.get('maxHp'));
    const home = this.homeSpot();
    p.respawn(home.x, home.z);
    s.set('dead', false);
    this.wasInVillage = false;
    this.rig.snap(p);
  }

  // Where the hero wakes up after falling: the middle of the village if there is one.
  homeSpot() {
    if (!this.village) return this.spawn;
    const c = this.villageCenter();
    return this.collision.blocked(c.x, c.z, this.player.radius) ? this.spawn : c;
  }

  placeSatchel(x, z, coins, bag) {
    const model = makeSatchel();
    model.group.position.set(x, 0, z);
    this.scene.add(model.group);
    this.satchel = { model, x, z, coins, bag };
  }

  recoverSatchel() {
    const s = this.store, { coins, bag, x, z } = this.satchel;
    const mine = { ...s.get('bag') };
    for (const [id, n] of Object.entries(bag)) mine[id] = (mine[id] ?? 0) + n;
    s.set('bag', mine);
    s.set('coins', s.get('coins') + coins);
    this.hud.floatText(x, 1.2, z, 'Satchel recovered!', '#ffcd75');
    this.removeSatchel();
    this.hud.refresh();
  }

  removeSatchel() {
    if (!this.satchel) return;
    this.scene.remove(this.satchel.model.group);
    disposeModel(this.satchel.model.group);
    this.satchel = null;
  }
}
