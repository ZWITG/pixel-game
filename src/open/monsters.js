import * as THREE from 'three';
import Enemy from '../entities/Enemy.js';
import { ENEMIES } from '../data/enemies.js';
import { makeOrb } from '../render/models.js';
import { height, biome, PLACES, SPAWN } from './terrain.js';

// Monsters in the open world. They use the game's own Enemy class; this file is the small
// `game` it expects, plus spawning around the hero and the hero's health.
const SIZE = 2.5;            // the hero is a lot bigger here than in the main game
const PACE = 1.8;
const MAX_NEAR = 12;
const SPAWN_FROM = 60, SPAWN_TO = 110, FORGET = 190;
const SPAWN_EVERY = 1.2;     // seconds
const WARD = 200;            // tiles around the Hollow's center that monsters won't enter
const DANGER_SPAN = 1500;    // monsters get one level tougher this many tiles from the start
const ELDER_CHANCE = 0.08;
const HURT_GUARD = 0.7;      // seconds of safety after being hit
const REGEN_DELAY = 6, REGEN = 2; // seconds out of a fight, then health per second
const KNOCK_LIMIT = 45;
const GROUPS = [
  ['slime', 'slime', 'boar', 'fireSlime'],  // meadow
  ['boar', 'fireSlime', 'slime', 'puffcap'], // autumn wood
  ['puffcap', 'puffcap', 'slime', 'wisp'],  // pine wood
];

// A main-game enemy stretched to open-world size, then made tougher by where it lives.
function fit(def, danger, elder) {
  const grow = elder ? 2 : 1;
  return {
    ...def,
    name: elder ? `Elder ${def.name}` : def.name,
    scale: (def.scale ?? 1) * SIZE * grow,
    radius: def.radius * SIZE * grow,
    speed: def.speed * PACE,
    chaseSpeed: def.chaseSpeed * PACE,
    aggro: def.aggro * SIZE * 2,
    keepAway: def.keepAway?.map((d) => d * SIZE),
    shotSpeed: (def.shotSpeed ?? 0) * PACE,
    hp: def.hp * danger * (elder ? 8 : 1),
    damage: def.damage * danger * (elder ? 2 : 1),
  };
}

export default class Monsters {
  constructor(scene, ctx) {
    Object.assign(this, ctx); // work, skills, body, hud, onDown
    this.scene = scene;
    this.list = [];
    this.orbs = [];
    this.time = 0;
    this.spawnIn = 0;
    this.guard = 0;
    this.calm = 0;
    this.hp = this.body.maxHealth;
    this.state = null;
    this.hidden = false;
    this.player = { x: 0, z: 0, dead: false };
    this.collision = {
      // Land only, so nothing wades in after a swimmer.
      move: (e, dx, dz) => {
        const x = e.group.position.x + dx, z = e.group.position.z + dz;
        if (height(x, z) < 0.5) return;
        e.group.position.x = x;
        e.group.position.z = z;
      },
    };
    this.hud.setHealth(1);
  }

  // The rest of what Enemy asks of its game.
  inVillage(x, z) {
    return Math.hypot(x - PLACES.hollow.x, z - PLACES.hollow.z) < WARD;
  }

  villageCenter() {
    return PLACES.hollow;
  }

  fireOrb(e, dx, dz) {
    const orb = makeOrb();
    orb.scale.setScalar(SIZE);
    orb.position.set(e.x, e.group.position.y + 2, e.z);
    this.scene.add(orb);
    this.orbs.push({ orb, dx, dz, speed: e.def.shotSpeed, damage: e.def.damage, life: 4 });
  }

  onEnemyKilled(e) {
    this.skills.add('fighting', 3);
    const drops = {};
    for (const { item, chance } of e.def.drops) if (Math.random() < chance) drops[item] = 1;
    this.work.give(drops);
    if (e.def.splitInto) for (const side of [-1, 1]) this.add(e.def.splitInto, e.x + side * 2, e.z, this.danger(e.x, e.z), false);
  }

  removeEnemy(e) {
    this.list.splice(this.list.indexOf(e), 1);
    e.remove();
  }

  danger(x, z) {
    return 1 + Math.hypot(x - SPAWN.x, z - SPAWN.z) / DANGER_SPAN;
  }

  add(type, x, z, danger, elder) {
    const e = new Enemy(this, x, z, fit(ENEMIES[type], danger, elder));
    e.air = 0;
    e.rise = 0;
    e.group.position.y = height(x, z);
    this.list.push(e);
    return e;
  }

  spawn(hero) {
    const near = this.list.filter((e) => Math.hypot(e.x - hero.x, e.z - hero.z) < FORGET);
    if (near.length >= MAX_NEAR) return;
    const a = Math.random() * 6.28, d = SPAWN_FROM + Math.random() * (SPAWN_TO - SPAWN_FROM);
    const x = hero.x + Math.cos(a) * d, z = hero.z + Math.sin(a) * d;
    if (height(x, z) < 2 || this.inVillage(x, z)) return;
    const b = biome(x, z), kind = b.indexOf(Math.max(...b.slice(0, 3)));
    const group = GROUPS[kind], type = hero.time === 'night' ? 'wisp' : group[Math.floor(Math.random() * group.length)];
    this.add(type, x, z, this.danger(x, z), Math.random() < ELDER_CHANCE);
  }

  // Closest monster the hero can reach, for the punch to turn toward.
  target(state) {
    let best = null, score = 5;
    for (const e of this.list) {
      if (e.dying) continue;
      const d = Math.hypot(e.x - state.x, e.z - state.z) - e.radius;
      if (d < score) { score = d; best = e; }
    }
    return best;
  }

  within(x, z, range) {
    return this.list.filter((e) => !e.dying && Math.hypot(e.x - x, e.z - z) - e.radius < range);
  }

  // A blow on a monster: heavier blows send it further and throw it into the air.
  hit(e, force, x, z) {
    if (e.dying) return;
    e.takeHit(Math.round(force * 10) / 10, x, z);
    this.skills.add('fighting', 1);
    const fling = Math.min(KNOCK_LIMIT, 7 + force * 1.5);
    e.vel.normalize().multiplyScalar(fling);
    e.knockUntil = this.time + 0.2 + Math.min(0.8, force * 0.02);
    e.rise = Math.min(30, force * 1.2);
    e.air = Math.max(e.air, 0.01);
  }

  hurt(amount, fromX, fromZ) {
    const s = this.state;
    if (this.guard > 0 || !s || this.hidden) return;
    const heavy = this.body.massScale, taken = Math.max(0.5, amount / Math.sqrt(heavy));
    this.hp -= taken;
    this.guard = HURT_GUARD;
    this.calm = 0;
    this.skills.add('fighting', 0.5);
    this.hud.float(`-${Math.round(taken * 10) / 10}`, s.x, s.y + 2.6, s.z, '#ff7a6a');
    const d = Math.hypot(s.x - fromX, s.z - fromZ) || 1, push = 2.5 / heavy;
    s.x += ((s.x - fromX) / d) * push;
    s.z += ((s.z - fromZ) / d) * push;
    this.work.shake = Math.max(this.work.shake, 0.2);
    if (this.hp <= 0) {
      this.hp = this.body.maxHealth;
      this.guard = 3;
      this.onDown();
    }
    this.hud.setHealth(this.hp / this.body.maxHealth);
  }

  update(dt, state, hidden) {
    this.state = state;
    this.hidden = hidden;
    this.time += dt;
    this.guard = Math.max(0, this.guard - dt);
    this.calm += dt;
    const p = this.player;
    p.x = state.x;
    p.z = state.z;
    p.dead = hidden;

    if ((this.spawnIn -= dt) <= 0 && !hidden) {
      this.spawnIn = SPAWN_EVERY;
      this.spawn(state);
    }
    for (const e of [...this.list]) {
      if (Math.hypot(e.x - state.x, e.z - state.z) > FORGET * 1.3) {
        this.removeEnemy(e);
        continue;
      }
      e.update(dt);
      if (this.list.indexOf(e) < 0) continue;
      if (e.air > 0 || e.rise > 0) {
        e.rise -= 40 * dt;
        e.air = Math.max(0, e.air + e.rise * dt);
        if (!e.air) e.rise = 0;
      }
      e.group.position.y = height(e.x, e.z) + e.air;
      if (!e.dying && e.air < 1 && Math.hypot(e.x - state.x, e.z - state.z) < e.radius + 0.7) this.hurt(e.def.damage, e.x, e.z);
    }
    for (const o of this.orbs) {
      o.life -= dt;
      o.orb.position.x += o.dx * o.speed * dt;
      o.orb.position.z += o.dz * o.speed * dt;
      if (Math.hypot(o.orb.position.x - state.x, o.orb.position.z - state.z) < 1) {
        this.hurt(o.damage, o.orb.position.x, o.orb.position.z);
        o.life = 0;
      }
      if (o.life <= 0) this.scene.remove(o.orb);
    }
    this.orbs = this.orbs.filter((o) => o.life > 0);

    if (this.calm > REGEN_DELAY && this.hp < this.body.maxHealth) {
      this.hp = Math.min(this.body.maxHealth, this.hp + REGEN * dt);
      this.hud.setHealth(this.hp / this.body.maxHealth);
    }
  }
}
