import * as THREE from 'three';
import Controls from '../systems/controls.js';
import { prompt } from '../ui/glyphs.js';
import { FEATURES } from '../config/features.js';
import { height, smoothHeight, SPAWN } from './terrain.js';
import { SADDLE, RIDE } from './animals.js';
import HeroModel, { LOOKS } from './hero3d.js';
import Compass from './compass.js';
import { reachPin, SATCHEL_TAB } from './gameMenu.js';
import PowerSet, { PowerBar } from './powers.js';
import Nature from './nature.js';
import Market from './market.js';
import { CONQUERORS } from './conquerors.js';
import Skills from './skills.js';
import Swim, { DEEP, SURFACE } from './swim.js';
import WorldHud from './skillPage.js';
import Body, { ATTRIBUTES } from './body.js';
import { Bag } from './work.js';
import { ITEMS } from './items.js';
import Melee from './melee.js';
import Wrath from './ultimate.js';
import SpiritArts from './spiritArts.js';
import Rooms from './rooms.js';
import Cave, { CaveLevel } from './cave.js';

// One hero: their own input, body, skills, bag, HUD and sprite. The world they stand in is shared.
const STEP_GLIDE = 1.1;         // tiles: a rise or drop this small is a step the body glides over
const RUN = 6, SPRINT = 16;
const GRAVITY = 22;
const CLIMB_START = 0.45; // slopes steeper than this count as climbing practice
const TURN_WITH_MOVE = 0.4; // radians per second the camera eases round when walking sideways
const LOOK_RESPECT = 1.2;    // seconds after the player steers the camera before it eases again
const FINISH_SIDE = 0.85;     // radians round from behind the hero the camera watches a finisher from
const DUEL_EDGE = 0.55, DUEL_BEHIND = 2.2, DUEL_TURN = 1.3; // radians off-centre the duel camera starts easing, gives up, and radians a second
const REGEN_DELAY = 6, REGEN = 2; // seconds out of a fight, then health per second
const JUMP_MAX = 5;          // the Jumping level that opens Flight
// By Flight level: seconds aloft, top height, and tiles per second across and upward.
const FLY_TIME = [3, 6, 12, 25, 60, Infinity];
const FLY_HEIGHT = [18, 35, 60, 100, 160, 260];
const FLY_SPEED = [10, 13, 17, 22, 28, 36];
const FLY_CLIMB = [8, 9, 11, 13, 16, 20];
const WATER_JUMP = 0.75;
const RUN_MAX = 5;           // the Running level that opens Superspeed
// By Superspeed level: seconds of it, and how many times a sprint.
const SUPER_TIME = [4, 8, 15, 30, 60, Infinity];
const SUPER_BOOST = [2, 2.3, 2.6, 3, 3.5, 4];
const SUPER_TOP = 180;       // tiles per second, the most it can reach
const SUPER_BUILD = [0.14, 0.16, 0.19, 0.23, 0.27, 0.32]; // share of top speed gained per second, by level
const SUPER_FADE = 1.6;      // how fast that drains once you let go, so speed carries on a moment
const SUPER_TURN = 1.4;      // how much a sharp turn scrubs off
const WATER_PACE = 0.45;     // how much speed it takes to stay on top of water
const RAM_PACE = 0.3;        // how much speed it takes to hit anything
const CHASE = 1.5;           // radians per second the camera swings behind a runner at full speed
const WATER_RUN = 3;         // from this level, fast enough to stay on top of water
const FULL_SPRINT = 0.5;     // seconds of sprinting before you're at full tilt
const SPRINT_AGAIN = 0.35;   // seconds to let go of sprint and press it again
const CHARGE_SLOW = 0.35;    // walking speed while gathering a Destructive Blow
const HOLD_SLOW = 0.55;      // walking speed while carrying something
const ROLL_SPEED = 19;       // tiles per second
const RAM_EVERY = 0.15;      // seconds between hits on whatever you barrel into
const LANDING = 0.16;        // seconds of crouch after a real drop
const FLINCH = 0.28;         // seconds of recoil from a hit
const DUST_EVERY = 0.13;     // seconds between puffs under a sprinter
const TAP = 0.16;            // holding the button this long turns a jump into flight
const GLIDE = 0.35;          // gravity while falling, once you have wings
const STAGES = [5, 12, 20];   // Mastery at which a Conqueror's body changes
const STAGE_WORDS = ['Power runs under your skin.', 'Your power has begun to circle you.', 'The ground itself bears your mark.'];
const WAKE_RINGS = [55, 80, 110, 150, 220, 320]; // tiles from where a hero fell
const WAKE_TRIES = 12;
const WAKE_CLEAR = 28;       // tiles a waking hero is kept from any enemy
const TIME_ORDER = ['morning', 'dusk', 'mist', 'night'];

export default class Player {
  constructor(index, world) {
    this.index = index;
    this.world = world;
    const prefix = index ? 'p2-' : '', save = index ? 'lumen.p2.' : 'lumen.';
    this.controls = new Controls(world.renderer.domElement, { keyboard: index === 0 });
    this.controls.device = 'pad'; // PS5 prompts by default; pressing a key switches them to keyboard
    const hud = this.hud = new WorldHud(prefix);
    this.market = new Market(this, prefix);
    this.skills = new Skills((raw, level) => {
      const conq = this.powers?.def, skill = this.nature?.named(raw) ?? raw;
      const twist = this.nature?.twistAt(skill.id, level - 1);
      if (twist) hud.message(`${twist.name}! ${twist.text}`, true, 5000);
      else if (skill.discipline) hud.message(`${skill.levels[level - 1].title}! See Gifts in the menu.`, true);
      else if (skill.power) hud.message(`${skill.name} reached rank ${level + 1}!`, true);
      else if (raw.id === 'jumping' && level === JUMP_MAX && conq?.flight) hud.message('Jumping has evolved into Flight! Jump and hold X to fly.', true, 5000);
      else if (raw.id === 'punching' && level === 5 && conq?.blow) hud.message('Punching has evolved into Destructive Blow! Hold Triangle, then let go.', true, 5000);
      else if (raw.id === 'running' && level === RUN_MAX && conq?.superspeed) hud.message('Running has evolved into the Shade Run! While sprinting, press sprint again.', true, 5000);
      else if (level === 1) hud.message(`You learned ${skill.name}! See your Spirit Tree.`, true);
      else hud.message(`${skill.name} improved: ${skill.levels[level - 1].title}`, true);
    }, (name, value) => hud.gain(ATTRIBUTES[name], value), `${save}skills`);
    this.body = new Body(this.skills);
    this.swim = new Swim(this.skills, this.body, hud);
    this.bag = new Bag(this.body, `${save}bag`);
    this.body.bag = this.bag;
    this.rooms = this.homeRooms = new Rooms(world.scene);
    this.cave = new Cave(world.scene, this);
    this.melee = new Melee(world.scene, this, world.work);
    this.melee.monsters = world.monsters;
    this.powers = new PowerSet(this, `${save}conqueror`);
    this.nature = this.body.nature = new Nature(this);
    this.body.powers = this.powers;
    this.bar = new PowerBar(prefix);
    this.wrath = new Wrath(this);
    this.arts = new SpiritArts(this);
    this.hero = new HeroModel(world.scene, this.powers.def?.look ?? LOOKS[index]);
    this.compass = new Compass(index ? 'p2-' : '');
    this.state = { x: SPAWN.x, z: SPAWN.z, y: 0, yaw: 2.6, pitch: 0.16, recenter: null, phase: 0, moving: false, dir: [0, -1], steepAt: 0, air: 0, rise: 0 };
    this.hp = this.body.maxHealth;
    this.guard = 0;
    this.calm = 0;
    this.ringTimer = 0;
    this.wind = 0;             // seconds of flight left; refills on the ground
    this.rush = 0;             // seconds of Superspeed left
    this.clock = 0;
    this.ram = 0;
    this.flinch = 0;
    this.landed = 0;
    this.dust = 0;
    this.looked = 9;
    this.level = this.body.level;
    hud.setLevel(this.level);
    this.site = null;
    this.siteDist = 1e9;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
  }

  get frozen() {
    return this.world.paused && !this.hud.open;
  }

  // Doors, beds and chests, all used with the same button.
  use(spot) {
    const { hud, rooms, state, bag, world } = this;
    if (spot.menu) this.market.open({ menu: spot.menu() });
    else if (spot.act) spot.act();
    else if (spot.caravan) {
      if (!spot.idle) this.market.open({ run: spot.caravan });
    } else if (spot.market) this.market.open({ place: spot.market });
    else if (spot.person) world.people.talk(this, spot.person);
    else if (spot.site) {
      if (spot.site.cat.goal === 'cave') this.enterCave(spot.site);
      else if (!spot.held) world.sites.use(this, spot.site);
    } else if (spot.action === 'chest') world.sites.finish(this.rooms.house.site, this);
    else if (spot.action === 'enter' || spot.action === 'leave') {
      hud.gasp();
      if (spot.action === 'enter') rooms.enter(spot.house, state);
      else rooms.leave(state);
    } else if (spot.action === 'rest') {
      hud.gasp();
      const next = TIME_ORDER[(TIME_ORDER.indexOf(world.time) + 1) % TIME_ORDER.length];
      world.setTime(next);
      this.hp = this.body.maxHealth;
      hud.setHealth(1);
      hud.message(`You sleep until ${next === 'mist' ? 'the mist rises' : next === 'night' ? 'nightfall' : next}.`);
    } else if (spot.action === 'store') {
      const moved = Object.entries(bag.store());
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
    const spot = rooms.house ? rooms.spot(state) : door ? { label: 'Enter', action: 'enter', house: door } : world.sites.spot(this) ?? world.animals?.spot(this) ?? world.events?.spot(this) ?? world.fairs?.spot(this) ?? world.roadside?.spot(this) ?? world.caravans.spot(this) ?? world.people.spot(this) ?? world.caravans.market(this);
    // With Destructive Blow, the button waits to see if it's a tap or a hold (see updateCharge).
    // While an ultimate plays the hero does nothing else.
    const fights = (!rooms.house || rooms.house.hostile) && !this.wrath.ult && !melee.staged;
    if (melee.clashing && just.punch) melee.pushClash();
    // L1 held is the Spirit shift: Square and Triangle become Spirit Arts, and R1 waits on the ultimate.
    const shift = !!(this.controls.padHeld.L1 || this.controls.held.has('KeyQ'));
    // On horseback: Circle gets you down. Anywhere: the whistle calls your horse.
    if (just.whistle) world.animals?.whistle(this);
    if (state.riding && just.roll) {
      world.animals.dismount(this);
      just.roll = false;
    }
    if (fights && !swim.inWater) {
      if (just.roll) {
        const m = this.controls.move(), yaw = world.viewYaw(this), sy = Math.sin(yaw), cy = Math.cos(yaw);
        melee.dodge(state, cy * m.x + sy * m.y, -sy * m.x + cy * m.y);
      }
      // With Wrath full, R1 grabs on release, so pressing it with L1 for an ultimate never grabs.
      const r1 = !!(this.controls.padHeld.R1 || this.controls.held.has('KeyF'));
      if (!this.wrath.full) {
        if (just.grab && !shift) melee.grab(state);
      } else {
        if (r1 && shift) this.r1Combo = true;
        if (!r1 && this.r1Was && !this.r1Combo) melee.grab(state);
        if (!r1) this.r1Combo = false;
      }
      this.r1Was = r1;
      if (shift && FEATURES.spiritArts && !state.air) {
        if (just.punch) this.arts.shot();
        if (just.heavy) this.arts.waveStart();
      }
      if (just.target) melee.aim(state);
      if (melee.lock && just.targetLeft) melee.shiftAim(state, -1);
      if (melee.lock && just.targetRight) melee.shiftAim(state, 1);
      if (just.punch && state.air > 0.8 && melee.hover <= 0 && !melee.pursuing) melee.dive(state);
    }
    // Square: the rush chain. Triangle: a smash, which once Destructive Blow is open throws on release.
    const reach = !state.air || melee.hover > 0;
    const arts = shift && FEATURES.spiritArts;
    // A slab in the air takes the punch instead: it bursts.
    if (FEATURES.punching && just.punch && fights && !arts && this.powers.onPunch()) just.punch = false;
    if (FEATURES.punching && just.punch && fights && reach && !arts) melee.punch(state);
    if (FEATURES.punching && just.heavy && fights && reach && !arts && (!melee.blowReady || melee.hover > 0)) melee.heavy(state);
    if (!spot) {
      hud.setAction('');
      return false;
    }
    hud.setAction(`${prompt('interact', this.controls.device)} ${spot.held ? 'Hold: ' : ''}${spot.label}`);
    if (just.interact) this.use(spot);
    return just.interact;
  }

  get bolt() {
    return FEATURES.superspeed && !!this.powers.def?.superspeed && this.skills.level('running') >= RUN_MAX;
  }

  // Superspeed: at full sprint, let go of sprint and press it again. It lasts until you stop
  // sprinting, stop moving, or run out.
  updateSuper(dt, sprint, moving) {
    const { state, skills, swim, melee, world } = this, level = skills.level('superspeed'), most = SUPER_TIME[level];
    this.clock += dt;
    if (!sprint && state.sprintWas) {
      state.sprintUp = this.clock;
      state.sprintFor = state.sprintT;
    }
    if (sprint && !state.sprintWas && this.bolt && this.rush > 0 && !this.rooms.house && !swim.inWater
      && this.clock - (state.sprintUp ?? -9) < SPRINT_AGAIN && (state.sprintFor ?? 0) >= FULL_SPRINT) {
      state.super = true;
      world.work.burst(state.x, state.y + 0.5, state.z, ['#ff7ad9', '#ffffff'], 16, 7);
    }
    state.sprintWas = sprint;
    state.sprintT = sprint && moving ? (state.sprintT ?? 0) + dt : 0;
    if (state.super && (!sprint || !moving || this.rush <= 0 || swim.inWater)) state.super = false;
    if (!state.super) {
      // Speed bleeds away rather than cutting out, and all at once if you actually stop.
      state.pace = moving ? Math.max(0, (state.pace ?? 0) - dt * SUPER_FADE) : 0;
      if (this.bolt) this.rush = most === Infinity ? 1 : Math.min(most, this.rush + (dt * most) / 6);
      return;
    }
    state.pace = Math.min(1, (state.pace ?? 0) + dt * SUPER_BUILD[level]);
    if (most !== Infinity) this.rush -= dt;
    skills.add('superspeed', dt);
    // Whatever you barrel into takes the hit, harder the faster you're going.
    if (state.pace > RAM_PACE && (this.ram -= dt) <= 0) {
      this.ram = RAM_EVERY;
      world.work.actor = this;
      melee.blast(state.x, state.z, melee.force * state.pace, 0, 0, '#ff7ad9', null);
    }
  }

  // From a normal sprint up to the top of the skill; it builds slowly, then pulls away.
  get superSpeed() {
    const { pace = 0 } = this.state, sprint = SPRINT * this.body.moveScale;
    const top = Math.min(SUPER_TOP, sprint * SUPER_BOOST[this.skills.level('superspeed')]);
    return sprint + (Math.max(top, sprint) - sprint) * pace * pace;
  }

  get wings() {
    return FEATURES.flight && !!this.powers.def?.flight && this.skills.level('jumping') >= JUMP_MAX;
  }

  jump(dt, y) {
    const { state, skills, hud, controls } = this, level = skills.level('flight'), most = FLY_TIME[level];
    const hold = controls.padHeld.CROSS || controls.held.has('Space');
    // Hanging mid-combo: no gravity, and no hard landing to come.
    if ((this.melee.hover > 0 || this.melee.pursuing) && state.air > 0) {
      state.rise = 0;
      state.peak = state.air;
      return;
    }
    state.held = hold && state.air > 0 ? (state.held ?? 0) + dt : 0;
    state.flying = this.wings && !this.rooms.house && this.wind > 0 && state.held > TAP;
    if (state.flying) {
      // Climb while there's height left, then hold there.
      const goal = state.air < FLY_HEIGHT[level] ? FLY_CLIMB[level] : 0;
      state.rise += Math.max(-dt * 30, Math.min(dt * 30, goal - state.rise));
      state.air += state.rise * dt;
      state.peak = Math.max(state.peak ?? 0, state.air);
      if (most !== Infinity) this.wind -= dt;
      skills.add('flight', dt);
      return;
    }
    if (state.air <= 0 && state.rise <= 0) {
      if (this.wings) this.wind = most === Infinity ? 1 : Math.min(most, this.wind + (dt * most) / 3);
      return;
    }
    const falling = this.wings && state.rise < 0 && state.air > 2;
    state.rise = Math.max(state.rise - GRAVITY * (falling ? GLIDE : 1) * dt, falling ? -14 : -60);
    state.air += state.rise * dt;
    state.peak = Math.max(state.peak ?? 0, state.air);
    if (state.air > 0) return;
    const fell = state.peak, dived = state.dive;
    state.dive = false;
    if (dived) this.melee.landDive(state);
    state.air = state.rise = state.peak = 0;
    this.nature.landed(fell);
    this.landed = fell > 2 ? LANDING : 0;
    this.world.work.burst(state.x, y + 0.1, state.z, ['#c9bcc4', '#a89a8c'], fell > 2 ? 12 : 5, 2 + Math.min(4, fell * 0.2));
    if (!this.rooms.house) this.melee.stomp(state, fell);
  }

  // Input, movement and everything that moves this hero, for one frame.
  update(dt) {
    const { controls, hud, state, swim, body, skills, melee, rooms, world } = this, just = controls.just;
    // A press that closed a menu this frame mustn't also reach the world and open it again.
    const busy = hud.open;
    // Together, both heroes steer from the one shared camera.
    const aim = world.together ? world.shared : state;
    if (!this.frozen && !world.gameMenu.isOpen) {
      // V recenters at once; L1 only if it was let go without being used as the Spirit shift.
      const l1 = !!controls.padHeld.L1;
      if (l1 && (just.punch || just.heavy || just.grab || just.power0 || just.power1 || just.power2 || just.power3)) this.l1Used = true;
      if (l1 && !this.l1Was) this.l1Used = false;
      if (!hud.open && ((just.recenter && controls.held.has('KeyV')) || (!l1 && this.l1Was && !this.l1Used))) aim.recenter = Math.atan2(-state.dir[0], -state.dir[1]);
      this.l1Was = l1;
      if (!hud.open && just.camera && !world.players.some((p) => p.rooms.house)) world.travel(this);
      // In co-op the Satchel opens in this hero's own half, so the other can play on.
      if (world.players.length > 1 && (hud.packOpen ? just.back || just.pack || just.pause : !hud.open && just.pack)) {
        hud.togglePack(this);
        world.checkPause();
      } else if (!hud.open && just.pack) world.gameMenu.open(this, SATCHEL_TAB);
      else if (!hud.open && just.pause) world.gameMenu.open(this);
      else if (hud.marketOpen) this.market.handle(just);
      else if (hud.packOpen) hud.pack.handle(just);
      if (hud.packOpen) hud.pack.update();
    }
    if (!world.paused) reachPin(this);
    const used = busy ? false : this.act(just);
    const free = !hud.open && !this.frozen;
    if (free && !melee.active && this.powers.def && !this.wrath.ult) {
      // L1 + the D-pad wears the second page of powers.
      const page = controls.padHeld.L1 || controls.held.has('KeyQ') ? 4 : 0;
      for (let i = 0; i < 4; i++) if (just[`power${i}`]) this.powers.use(i + page);
    }
    if (!world.paused) {
      this.wrath.update(dt);
      this.arts.update(dt);
      this.powers.update(dt);
      this.nature.update(dt);
    }
    this.bar.update(this.powers, controls.device, controls.padHeld.L1 || controls.held.has('KeyQ') ? 1 : 0);
    if (this.powers.def) this.growForm();
    // Cross just after a Launcher flies up after the foe instead of jumping.
    const pursued = just.jump && !used && free && melee.pursue(state);
    if (FEATURES.jump && just.jump && !used && !pursued && free && !state.air && !melee.active) {
      // A kick up out of the water is weaker than a jump off the ground, but it gets you out.
      state.rise = body.jumpSpeed * (swim.inWater ? WATER_JUMP : 1);
      world.work.burst(state.x, state.y + 0.1, state.z, ['#c9bcc4', '#a89a8c'], 4, 2);
      state.air = 0.01;
      skills.add('jumping', 1);
      this.nature.jumpedOff();
    } else if (FEATURES.jump && just.jump && !used && !pursued && free && state.air > 0.3 && !melee.active && melee.hover <= 0) this.nature.airJump();
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

    const m = !free || melee.active || melee.rolling > 0 || melee.hover > 0 || melee.pursuing || melee.broken > 0 || this.wrath.ult || this.arts.wave || this.powers.busy ? { x: 0, y: 0 } : controls.move(false), amount = Math.min(1, Math.hypot(m.x, m.y));
    if (!world.paused) {
      this.updateSuper(dt, !!(controls.held.has('ShiftLeft') || controls.padHeld.R2), amount > 0.05 && free);
      melee.updateMoves(dt, state);
      melee.setGuard(free && !!(controls.held.has('KeyG') || controls.padHeld.L2));
      melee.updateCharge(dt, state, !melee.held && !!(controls.held.has('KeyU') || controls.padHeld.TRIANGLE), free);
    }
    if (amount > 0.05) {
      const sprint = state.sprinting = controls.held.has('ShiftLeft') || controls.padHeld.R2;
      // Walking sideways slowly brings the camera round behind the hero.
      if (!world.together && !rooms.house && this.looked > LOOK_RESPECT) aim.yaw -= m.x * TURN_WITH_MOVE * dt;
      const s = Math.sin(aim.yaw), c = Math.cos(aim.yaw), speed = state.riding ? world.animals.speed(this, sprint, dt) * amount : (state.flying ? FLY_SPEED[skills.level('flight')] * (sprint ? 1.4 : 1) * body.moveScale : state.pace > 0 ? this.superSpeed : swim.inWater ? swim.speed(sprint) : (sprint ? SPRINT : RUN) * body.moveScale * this.nature.stride()) * amount * (melee.charging || melee.guarding ? CHARGE_SLOW : melee.held ? HOLD_SLOW : 1) * (this.slowUntil > world.monsters.time ? 0.5 : 1) * (this.rootUntil > world.monsters.time ? 0.1 : 1);
      const wx = c * m.x + s * m.y, wz = -s * m.x + c * m.y;
      if (state.pace > 0) {
        // A hard turn at speed costs you: momentum has to go somewhere.
        const was = Math.hypot(...state.dir) || 1, now = Math.hypot(wx, wz) || 1;
        const across = 1 - (state.dir[0] * wx + state.dir[1] * wz) / (was * now);
        state.pace = Math.max(0, state.pace - across * SUPER_TURN * dt);
        // The camera swings round behind the runner, the faster the firmer.
        if (!world.together && this.looked > 0.4) {
          const behind = Math.atan2(-wx, -wz), diff = Math.atan2(Math.sin(behind - state.yaw), Math.cos(behind - state.yaw));
          state.yaw += Math.max(-1, Math.min(1, diff)) * CHASE * state.pace * dt;
        }
      }
      const nx = state.x + wx * speed * dt, nz = state.z + wz * speed * dt;
      // Frozen water holds the hero up. Steepness is the land under the cubes, or every step is a wall.
      const footing = (x, z) => world.scars.floor(x, z, smoothHeight(x, z));
      const rise = rooms.house ? 0 : footing(nx, nz) - footing(state.x, state.z), dist = Math.hypot(nx - state.x, nz - state.z);
      const wet = !rooms.house && footing(nx, nz) < DEEP;
      state.onWater = !!state.super && state.pace > WATER_PACE && skills.level('superspeed') >= WATER_RUN && (wet || state.y < DEEP);
      const steep = rise / Math.max(dist, 1e-3);
      // Slopes only matter on foot: a swimmer can make for any bank, however steep the bed.
      // Walls of cubes stop the hero; holes cut in them let the hero through.
      const walled = !rooms.house && world.voxels?.blocks(nx, state.y + state.air, nz);
      if (walled) {
        if (!world.voxels.blocks(nx, state.y + state.air, state.z)) state.x = nx;
        else if (!world.voxels.blocks(state.x, state.y + state.air, nz)) state.z = nz;
      } else if (state.air > 2 || swim.inWater || state.onWater || (steep < (state.riding ? RIDE.climb : body.climbLimit) && (FEATURES.swimming || !wet))) {
        state.x = nx;
        state.z = nz;
        if (steep > CLIMB_START && !state.air) skills.add('climbing', dt);
        if (sprint && !swim.inWater && !wet && !state.air) skills.add('running', dt);
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
    if (melee.rolling > 0) {
      const scale = Math.sqrt(body.moveScale);
      state.x += melee.rollDir[0] * ROLL_SPEED * scale * dt;
      state.z += melee.rollDir[1] * ROLL_SPEED * scale * dt;
    }
    // A paired finisher: the camera swings round to watch it from the side.
    if (melee.staged && !world.together) {
      const e = melee.staged.e, want = Math.atan2(state.x - e.x, state.z - e.z) + FINISH_SIDE, diff = Math.atan2(Math.sin(want - state.yaw), Math.cos(want - state.yaw));
      state.yaw += diff * Math.min(1, dt * 5);
    } else if (melee.lock && !world.together) {
      const want = Math.atan2(state.x - melee.lock.x, state.z - melee.lock.z), diff = Math.atan2(Math.sin(want - state.yaw), Math.cos(want - state.yaw));
      state.yaw += diff * Math.min(1, dt * 7);
      if (!state.moving && melee.rolling <= 0) state.dir = [melee.lock.x - state.x, melee.lock.z - state.z];
    } else if (world.duelCam && !world.together && !rooms.house && this.looked > LOOK_RESPECT && melee.duel?.foe && melee.duel.count <= 2) {
      // The duel camera: a foe drifting toward the edge of the view is eased back in, never swung round from behind.
      const foe = melee.duel.foe, want = Math.atan2(state.x - foe.x, state.z - foe.z), diff = Math.atan2(Math.sin(want - state.yaw), Math.cos(want - state.yaw));
      const off = Math.abs(diff);
      if (off > DUEL_EDGE && off < DUEL_BEHIND) state.yaw += Math.sign(diff) * Math.min(off - DUEL_EDGE, DUEL_TURN * dt);
    }
    if (rooms.house) rooms.collide(state);
    else if (FEATURES.worldWork) world.work.collide(state);
    // Rubble, ledges and rooftops can be stood on.
    // Dug ground is its own floor; elsewhere the land, frozen water, rubble, ledges and rooftops.
    const dug = rooms.house ? null : world.digs?.floor(state.x, state.z, state.y + state.air);
    const y = rooms.house ? rooms.floor : dug ?? Math.max(world.scars.floor(state.x, state.z, height(state.x, state.z)), world.voxels?.floor(state.x, state.z, state.y + state.air) ?? -Infinity);
    // Walking off an edge into a pit: fall, don't drop.
    if (!state.air && !state.flying && y < state.y - 1.2) {
      state.air = state.y - y;
      state.rise = 0;
      state.peak = state.air;
    }
    if (!world.paused) this.jump(dt, y);
    if (FEATURES.swimming && !world.paused && !rooms.house) {
      swim.update(dt, state.air > 0 || (state.super && state.onWater) ? 0 : y, state.moving, state.sprinting); // the air over a lake isn't the lake
      if (swim.inWater) world.splash(this, dt);
    }
    // Swimming hides this bar every frame on land, so flight draws it afterward.
    if (melee.charging) hud.setBreath(melee.charge);
    else if (state.super && SUPER_TIME[skills.level('superspeed')] !== Infinity) hud.setBreath(Math.max(0, this.rush) / SUPER_TIME[skills.level('superspeed')]);
    if (state.flying && FLY_TIME[skills.level('flight')] !== Infinity) hud.setBreath(Math.max(0, this.wind) / FLY_TIME[skills.level('flight')]);
    // Up or down a cube step: the body glides over it instead of jumping.
    const step = y - state.y;
    if (!state.air && !rooms.house && step !== 0 && Math.abs(step) <= STEP_GLIDE) this.stepOff = (this.stepOff ?? 0) - step;
    this.stepOff = (this.stepOff ?? 0) * Math.exp(-dt * 16);
    state.y = y;
    this.hero.mesh.scale.setScalar(body.heroScale);
    this.landed = Math.max(0, this.landed - dt);
    this.flinch = Math.max(0, this.flinch - dt);
    this.hero.flinch(this.flinch > FLINCH * 0.5);
    // Dust kicks up under a sprinter, thicker the faster they go.
    if (state.moving && state.sprinting && !state.air && !swim.inWater && !state.onWater && !rooms.house && (this.dust -= dt) <= 0) {
      this.dust = DUST_EVERY;
      world.work.burst(state.x, y + 0.1, state.z, ['#c9bcc4', '#b4a48c'], 2 + Math.floor((state.pace ?? 0) * 4), 1.6);
    }
    this.hero.leaveTrail(state.pace ?? 0, dt);

    if (body.level !== this.level) {
      if (body.level > this.level) hud.message(`Level ${body.level}! The monsters stir...`, true);
      this.level = body.level;
      hud.setLevel(this.level);
    }
    this.hp = Math.min(this.hp, body.maxHealth); // gear or a bonus that lifted the limit can go
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
    hud.setRally(this.hp / body.maxHealth, melee.rally / body.maxHealth);
  }

  // Mastery shows on the body; reaching a new stage is an event, and everyone near can see it.
  growForm() {
    const stage = STAGES.reduce((n, at, i) => (this.powers.mastery >= at ? i + 1 : n), 0);
    if (stage === this.stage) return;
    const risen = this.stage !== undefined && stage > this.stage;
    this.stage = stage;
    this.hero.ascend(stage);
    if (!risen) return;
    const { state, powers, world } = this;
    this.hud.message(STAGE_WORDS[stage - 1], true, 3000);
    world.fx.impact(powers.element, state.x, Math.max(state.y, 0), state.z, 7);
    world.work.shake = 0.4;
    world.work.shakeAt = state;
  }

  // Stands a Conqueror's figure in the hero's place, for the choosing screen or for good.
  showAs(id) {
    this.hero.dispose();
    this.hero = new HeroModel(this.world.scene, CONQUERORS[id].look);
    this.stage = undefined;
  }

  becomeConqueror(id) {
    this.powers.choose(id);
    this.showAs(id);
    this.melee.refreshStage();
    this.hp = this.body.maxHealth;
    this.hud.setHealth(1);
  }

  enterCave(site) {
    const { world, state, hud } = this;
    site.level ??= new CaveLevel(world.scene, site, world.monsters, site.index * 971 + 13);
    hud.gasp();
    this.rooms = this.cave;
    this.cave.enter(site.level, state);
    hud.message(site.cat.name, true);
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

  // The closest safe ground to where a hero fell: dry, level, clear of walls and of enemies.
  // Near rings first, each tried all the way round; the start is the last resort.
  wakeSpot() {
    const { state, world: { marks, monsters, scars } } = this;
    const clearOf = (s, x, z) => (s.r ? Math.hypot(x - s.x, z - s.z) > s.r + 3 : x < s.x0 - 3 || x > s.x1 + 3 || z < s.z0 - 3 || z > s.z1 + 3);
    for (const d of WAKE_RINGS) {
      for (let i = 0; i < WAKE_TRIES; i++) {
        const a = (i / WAKE_TRIES) * 6.283, x = state.x + Math.cos(a) * d, z = state.z + Math.sin(a) * d, y = height(x, z);
        if (y < 2 || Math.abs(height(x + 4, z) - y) > 3 || Math.abs(height(x, z + 4) - y) > 3) continue;
        if (scars.at(x, z)?.burn > 0 || monsters.within(x, z, WAKE_CLEAR).length) continue;
        if (marks.solids.every((s) => s.off || clearOf(s, x, z))) return [x, z];
      }
    }
    return [SPAWN.x + this.index * 3, SPAWN.z];
  }

  // Beaten: wake close by with everything still in the bag, and a moment before anyone notices.
  down() {
    const { state, hud } = this;
    this.melee.rally = 0;
    hud.gasp();
    hud.message('You came to, not far from where you fell.', true);
    this.world.realm.heroFell(this);
    if (this.rooms.house) this.rooms.leave(state);
    [state.x, state.z] = this.wakeSpot();
    state.air = state.rise = 0;
    state.flying = false;
    this.hp = this.body.maxHealth;
    this.guard = 3;
  }

  // What the body is doing now, as [pose name, forward lean, options]; the first thing that applies wins.
  motion(pose, time) {
    const { state, swim, melee } = this, pace = state.pace ?? 0;
    if (pose?.react) return ['clip', 0, { arm: pose.arm, clip: pose.clip, t: pose.t }];
    if (melee.broken > 0) return [FEATURES.heroClips ? 'broken' : 'hurt', -0.1];
    if (this.flinch) return ['hurt', -0.15];
    if (this.powers.casting > 0) return [this.powers.pose, 0.05];
    if (pose?.clip) return ['clip', 0, { arm: pose.arm, clip: pose.clip, t: pose.t }];
    if (pose) return [pose.t < 0.35 ? 'windup' : pose.move, 0, { arm: pose.arm }];
    if (melee.pursuing || melee.hover > 0) return ['rising', 0.1];
    if (melee.rolling > 0) return ['roll', (1 - melee.rolling / 0.42) * Math.PI * 2];
    if (melee.held) return ['hold', 0];
    if (melee.slam > 0) return [state.moving ? 'throw' : 'slam', 0.25];
    if (melee.guarding) return ['guard', 0.05];
    if (melee.charging) return [melee.charge < 0.4 ? 'charge' : melee.charge < 0.8 ? 'gather' : 'peak', 0.08 - melee.charge * 0.18];
    if (state.riding && state.air < 1.5) return ['ride', 0.05, { gallop: state.riding.galloping }];
    if (state.flying) return ['fly', state.moving ? 1.25 : 0.2];
    if (state.air > 0.4) {
      if (state.rise > 1) return ['rising', 0.1];
      return this.wings && state.air > 2 ? ['glide', 0.5] : ['falling', 0];
    }
    if (this.landed) return ['landing', 0.12];
    if (swim.inWater) return ['swim', state.moving ? 1.05 : 0.2, { run: swim.flailing ? 2 : state.moving ? 1 : 0.45 }];
    if (pace > 0.15) return ['dash', 0.15 + pace * 0.3];
    if (state.moving) return state.sprinting ? ['run', 0.08] : ['walk', 0];
    return ['idle', 0];
  }

  // Poses the figure. Runs once per view; the model works it out on the first of them.
  pose(camera, time) {
    const { state, swim, melee, hero } = this;
    // Swimmers sit low in the water; a non-swimmer bobs and thrashes.
    const heroY = swim.inWater ? -1.2 * this.body.heroScale + Math.sin(time * (swim.flailing ? 9 : 3)) * (swim.flailing ? 0.16 : 0.07) : (state.super && state.onWater ? Math.max(state.y, 0) : Math.max(state.y, SURFACE)) + state.air + melee.lift + (this.stepOff ?? 0) + (state.riding ? SADDLE : 0);
    const pose = melee.pose, [name, lean, options] = this.motion(pose, time);
    hero.update(state.x, heroY, state.z, state.dir, name, lean, time, options);
    hero.punch(pose, pose?.arm ?? 0);
  }
}
