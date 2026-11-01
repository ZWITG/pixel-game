import * as THREE from 'three';
import Controls from '../systems/controls.js';
import { prompt } from '../ui/glyphs.js';
import { FEATURES } from '../config/features.js';
import { height, SPAWN } from './terrain.js';
import HeroSprite, { punchFrame, walkFrame, IDLE, JUMP, LOOKS } from './sprite.js';
import Skills from './skills.js';
import Swim, { DEEP } from './swim.js';
import WorldHud from './skillPage.js';
import Body, { ATTRIBUTES } from './body.js';
import { Bag } from './work.js';
import { ITEMS } from './items.js';
import Melee from './melee.js';
import Rooms, { ROOM_Y } from './rooms.js';

// One hero: their own input, body, skills, bag, HUD and sprite. The world they stand in is shared.
const RUN = 6, SPRINT = 16;
const GRAVITY = 22;
const CLIMB_START = 0.45; // slopes steeper than this count as climbing practice
const TURN_WITH_MOVE = 0.75; // radians per second the camera eases round when walking sideways
const LOOK_RESPECT = 1.2;    // seconds after the player steers the camera before it eases again
const REGEN_DELAY = 6, REGEN = 2; // seconds out of a fight, then health per second
const TIME_ORDER = ['morning', 'dusk', 'mist', 'night'];

export default class Player {
  constructor(index, world) {
    this.index = index;
    this.world = world;
    const prefix = index ? 'p2-' : '', save = index ? 'lumen.p2.' : 'lumen.';
    this.controls = new Controls(world.renderer.domElement, { keyboard: index === 0 });
    this.controls.device = 'pad'; // PS5 prompts by default; pressing a key switches them to keyboard
    const hud = this.hud = new WorldHud(prefix);
    this.skills = new Skills((skill, level) => {
      if (level === 1) hud.message(`You learned ${skill.name}! See your Spirit Tree.`, true);
      else hud.message(`${skill.name} improved: ${skill.levels[level - 1].title}`, true);
    }, (name, value) => hud.gain(ATTRIBUTES[name], value), `${save}skills`);
    this.body = new Body(this.skills);
    this.swim = new Swim(this.skills, this.body, hud);
    this.bag = new Bag(this.body, `${save}bag`);
    this.body.bag = this.bag;
    this.rooms = new Rooms(world.scene);
    this.melee = new Melee(world.scene, this, world.work);
    this.melee.monsters = world.monsters;
    this.hero = new HeroSprite(world.scene, LOOKS[index]);
    this.state = { x: SPAWN.x, z: SPAWN.z, y: 0, yaw: 2.6, pitch: 0.16, recenter: null, phase: 0, moving: false, dir: [0, -1], steepAt: 0, air: 0, rise: 0 };
    this.hp = this.body.maxHealth;
    this.guard = 0;
    this.calm = 0;
    this.ringTimer = 0;
    this.looked = 9;
    this.level = this.body.level;
    hud.setLevel(this.level);
    this.site = null;
    this.siteDist = 1e9;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    hud.setBag(this.bag);
  }

  get frozen() {
    return this.world.paused && !this.hud.open;
  }

  // Doors, beds and chests, all used with the same button.
  use(spot) {
    const { hud, rooms, state, bag, world } = this;
    if (spot.site) {
      if (!spot.held) world.sites.use(this, spot.site);
    } else if (spot.action === 'enter' || spot.action === 'leave') {
      hud.gasp();
      if (spot.action === 'enter') rooms.enter(spot.house, state);
      else rooms.leave(state);
    } else if (spot.action === 'rest') {
      hud.gasp();
      const next = TIME_ORDER[(TIME_ORDER.indexOf(world.time) + 1) % TIME_ORDER.length];
      world.setTime(next);
      hud.message(`You sleep until ${next === 'mist' ? 'the mist rises' : next === 'night' ? 'nightfall' : next}.`);
    } else if (spot.action === 'store') {
      const moved = Object.entries(bag.store());
      hud.setBag(bag);
      const kept = Object.entries(bag.stored).map(([id, n]) => `${ITEMS[id].name} ${n}`).join(', ');
      hud.message(moved.length ? `Stored. In the chest: ${kept}` : kept ? `In the chest: ${kept}` : 'The chest is empty.');
    }
  }

  // What the hero could do right now, shown as a prompt and done on a button press.
  // Returns true when the press was used, so the same button doesn't also jump.
  act(just) {
    const { hud, rooms, state, swim, melee, world } = this;
    if (hud.open || this.frozen || !FEATURES.worldWork) {
      hud.setAction('');
      return false;
    }
    const door = !rooms.house && !swim.inWater && world.work.door(state);
    const spot = rooms.house ? rooms.spot(state) : door ? { label: 'Enter', action: 'enter', house: door } : world.sites.spot(this);
    if (FEATURES.punching && just.punch && !state.air && !rooms.house && !swim.inWater) melee.punch(state);
    if (!spot) {
      hud.setAction('');
      return false;
    }
    hud.setAction(`${prompt('interact', this.controls.device)} ${spot.held ? 'Hold: ' : ''}${spot.label}`);
    if (just.interact) this.use(spot);
    return just.interact;
  }

  jump(dt, y) {
    const { state } = this;
    if (state.air <= 0 && state.rise <= 0) return;
    state.rise -= GRAVITY * dt;
    state.air += state.rise * dt;
    if (state.air > 0) return;
    state.air = state.rise = 0;
    this.world.work.burst(state.x, y + 0.1, state.z, ['#c9bcc4', '#a89a8c'], 5, 2);
    if (!this.rooms.house) this.melee.stomp(state);
  }

  // Input, movement and everything that moves this hero, for one frame.
  update(dt) {
    const { controls, hud, state, swim, body, skills, melee, rooms, world } = this, just = controls.just;
    // Together, both heroes steer from the one shared camera.
    const aim = world.together ? world.shared : state;
    if (!this.frozen) {
      if (!hud.open && just.recenter) aim.recenter = Math.atan2(-state.dir[0], -state.dir[1]);
      if (!hud.open && just.camera) world.travel(this);
      if (hud.packOpen ? just.back || just.pack || just.pause : !hud.open && just.pack) {
        hud.togglePack(this);
        world.paused = hud.open;
      } else if (hud.mapOpen ? just.back || just.pause : !hud.open && just.pause) {
        hud.toggle(skills.all(), body);
        world.paused = hud.open;
      } else if (hud.mapOpen) {
        hud.map.handle(just);
      } else if (hud.packOpen) {
        hud.pack.handle(just);
      }
      if (hud.mapOpen) hud.map.update(dt);
      if (hud.packOpen) hud.pack.update();
    }
    const used = this.act(just);
    const free = !hud.open && !this.frozen;
    if (FEATURES.jump && just.jump && !used && free && !state.air && !swim.inWater && !melee.active) {
      state.rise = body.jumpSpeed;
      state.air = 0.01;
      skills.add('running', 0.3);
    }
    const look = free ? controls.look() : { x: 0, y: 0 };
    aim.yaw -= look.x;
    this.looked = look.x || look.y ? 0 : this.looked + dt;
    if (look.x) aim.recenter = null;
    if (aim.recenter !== null) {
      const diff = Math.atan2(Math.sin(aim.recenter - aim.yaw), Math.cos(aim.recenter - aim.yaw));
      aim.yaw += diff * Math.min(1, dt * 10);
      if (Math.abs(diff) < 0.01) aim.recenter = null;
    }
    aim.pitch = THREE.MathUtils.clamp(aim.pitch + look.y, -0.25, 1.2);

    const m = !free || melee.active ? { x: 0, y: 0 } : controls.move(), amount = Math.min(1, Math.hypot(m.x, m.y));
    if (amount > 0.05) {
      const sprint = state.sprinting = controls.held.has('ShiftLeft') || controls.padHeld.R2;
      // Walking sideways slowly brings the camera round behind the hero.
      if (!world.together && !rooms.house && this.looked > LOOK_RESPECT) aim.yaw -= m.x * TURN_WITH_MOVE * dt;
      const s = Math.sin(aim.yaw), c = Math.cos(aim.yaw), speed = (swim.inWater ? swim.speed : (sprint ? SPRINT : RUN) * body.moveScale) * amount;
      const wx = c * m.x + s * m.y, wz = -s * m.x + c * m.y;
      const nx = state.x + wx * speed * dt, nz = state.z + wz * speed * dt;
      const rise = rooms.house ? 0 : height(nx, nz) - height(state.x, state.z), dist = Math.hypot(nx - state.x, nz - state.z);
      const wet = !rooms.house && height(nx, nz) < DEEP;
      const steep = rise / Math.max(dist, 1e-3);
      if (steep < body.climbLimit && (FEATURES.swimming || !wet)) {
        state.x = nx;
        state.z = nz;
        if (steep > CLIMB_START) skills.add('climbing', dt);
        if (sprint && !swim.inWater && !wet) skills.add('running', dt);
      } else if (!wet) {
        // Too steep for now, but straining against it still builds the arms.
        skills.add('climbing', dt * 0.5);
        if (performance.now() - state.steepAt > 5000) hud.message('Too steep. Your arms aren\'t there yet.');
        state.steepAt = performance.now();
      }
      state.dir = [wx, wz];
      state.phase += dt * (sprint ? 16 : 10);
    }
    state.moving = amount > 0.05;
    if (rooms.house) rooms.collide(state);
    else if (FEATURES.worldWork) world.work.collide(state);
    let y = rooms.house ? ROOM_Y : height(state.x, state.z);
    if (!world.paused) this.jump(dt, y);
    if (FEATURES.swimming && !world.paused && !rooms.house) {
      const shore = swim.update(dt, state.x, state.z, y, state.moving);
      if (shore) {
        state.x = shore.x;
        state.z = shore.z;
        y = height(state.x, state.z);
      }
      if (swim.inWater) {
        state.air = state.rise = 0;
        world.splash(this, dt);
      }
    }
    state.y = y;
    this.hero.mesh.scale.setScalar(body.heroScale);

    if (body.level !== this.level) {
      if (body.level > this.level) hud.message(`Level ${body.level}! The monsters stir...`, true);
      this.level = body.level;
      hud.setLevel(this.level);
    }
    if (world.paused) return;
    for (const b of this.bag.buffs) {
      if ((b.left -= dt) <= 0) hud.message(`${ITEMS[b.id].name} wore off.`);
    }
    this.bag.buffs = this.bag.buffs.filter((b) => b.left > 0);
    this.guard = Math.max(0, this.guard - dt);
    this.calm += dt;
    if (this.calm > REGEN_DELAY && this.hp < body.maxHealth) {
      this.hp = Math.min(body.maxHealth, this.hp + REGEN * dt);
      hud.setHealth(this.hp / body.maxHealth);
    }
  }

  canCraft(recipe) {
    const inside = !!this.rooms.house;
    if (recipe.bench && !inside) return false;
    return Object.entries(recipe.needs).every(([id, n]) => this.bag.count(id, inside) >= n);
  }

  craft(recipe) {
    const { bag, hud } = this, def = ITEMS[recipe.id];
    if (!this.canCraft(recipe)) return;
    for (const [id, n] of Object.entries(recipe.needs)) bag.spend(id, n);
    bag.items[recipe.id] = (bag.items[recipe.id] ?? 0) + 1; // made things are never lost to a full bag
    bag.save();
    hud.gain(def, '+1');
  }

  consume(id) {
    const { bag, hud, body } = this, def = ITEMS[id];
    bag.remove(id, 1);
    if (def.heal) {
      this.hp = Math.min(body.maxHealth, this.hp + body.maxHealth * def.heal);
      hud.setHealth(this.hp / body.maxHealth);
    }
    if (def.bonus) {
      bag.buffs = bag.buffs.filter((b) => b.id !== id);
      bag.buffs.push({ id, left: def.secs });
    }
    hud.gain(def, '');
  }

  // Beaten: wake at the start with everything still in the bag.
  down() {
    const { state, hud } = this;
    hud.gasp();
    hud.message('You came to by the water.', true);
    if (this.rooms.house) this.rooms.leave(state);
    state.x = SPAWN.x + this.index * 3;
    state.z = SPAWN.z;
    state.air = state.rise = 0;
    this.hp = this.body.maxHealth;
    this.guard = 3;
  }

  // Turns the sprite to face one camera. Runs once per view, so each screen sees it correctly.
  pose(camera, time) {
    const { state, swim, melee, hero } = this;
    const yaw = Math.atan2(camera.position.x - state.x, camera.position.z - state.z);
    const sy = Math.sin(yaw), cy = Math.cos(yaw), [dx, dz] = state.dir;
    const ahead = -sy * dx - cy * dz, right = cy * dx - sy * dz;
    const view = Math.abs(right) > Math.abs(ahead) ? 2 : ahead > 0 ? 0 : 1;
    // Swimmers sit low in the water; a non-swimmer bobs and thrashes.
    const heroY = swim.inWater ? -1.25 + Math.sin(time * (swim.flailing ? 9 : 3)) * (swim.flailing ? 0.22 : 0.07) : Math.max(state.y, -0.9) + state.air;
    const pose = melee.pose, flip = pose && view !== 2 ? pose.chain === 1 : right < 0;
    hero.update(state.x, heroY, state.z, camera, view, flip, pose ? punchFrame(pose.t) : state.air ? JUMP : state.moving || swim.flailing ? walkFrame(time, swim.flailing ? 16 : state.sprinting ? 15 : 10) : IDLE);
    hero.punch(pose, flip ? -1 : 1);
  }
}
