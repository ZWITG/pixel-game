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
  constructor(scene, work, players) {
    Object.assign(this, { scene, work, players });
    this.nightfall = false;
    this.list = [];
    this.orbs = [];
    this.time = 0;
    this.spawnIn = 0;
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
  }

  // The rest of what Enemy asks of its game. Damage numbers show on the striker's screen.
  get hud() {
    return (this.work.actor ?? this.players[0]).hud;
  }

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
    this.work.skills.add('fighting', 3);
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
    const group = GROUPS[kind], type = this.nightfall ? 'wisp' : group[Math.floor(Math.random() * group.length)];
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
    this.work.skills.add('fighting', 1);
    const fling = Math.min(KNOCK_LIMIT, 7 + force * 1.5);
    e.vel.normalize().multiplyScalar(fling);
    e.knockUntil = this.time + 0.2 + Math.min(0.8, force * 0.02);
    e.rise = Math.min(30, force * 1.2);
    e.air = Math.max(e.air, 0.01);
  }

  hurt(p, amount, fromX, fromZ) {
    const s = p.state;
    if (p.guard > 0 || p.rooms.house) return;
    const heavy = p.body.massScale, taken = Math.max(0.5, amount / Math.sqrt(heavy));
    p.hp -= taken;
    p.guard = HURT_GUARD;
    p.calm = 0;
    p.skills.add('fighting', 0.5);
    p.hud.float(`-${Math.round(taken * 10) / 10}`, s.x, s.y + 2.6, s.z, '#ff7a6a');
    const d = Math.hypot(s.x - fromX, s.z - fromZ) || 1, push = 2.5 / heavy;
    s.x += ((s.x - fromX) / d) * push;
    s.z += ((s.z - fromZ) / d) * push;
    this.work.shake = Math.max(this.work.shake, 0.2);
    if (p.hp <= 0) p.down();
    p.hud.setHealth(p.hp / p.body.maxHealth);
  }

  nearest(x, z) {
    let best = null, d = 1e9;
    for (const p of this.players) {
      if (p.rooms.house) continue;
      const k = Math.hypot(p.state.x - x, p.state.z - z);
      if (k < d) { d = k; best = p; }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    const out = this.players.filter((p) => !p.rooms.house);
    if ((this.spawnIn -= dt) <= 0 && out.length) {
      this.spawnIn = SPAWN_EVERY;
      this.spawn(out[Math.floor(Math.random() * out.length)].state);
    }
    for (const e of [...this.list]) {
      const hero = this.nearest(e.x, e.z);
      const far = hero ? Math.hypot(e.x - hero.state.x, e.z - hero.state.z) : 0;
      if (far > FORGET * 1.3) {
        this.removeEnemy(e);
        continue;
      }
      // Enemy reads one `player`, so it's pointed at whoever this monster is nearest.
      this.player.dead = !hero;
      if (hero) {
        this.player.x = hero.state.x;
        this.player.z = hero.state.z;
      }
      e.update(dt);
      if (this.list.indexOf(e) < 0) continue;
      if (e.air > 0 || e.rise > 0) {
        e.rise -= 40 * dt;
        e.air = Math.max(0, e.air + e.rise * dt);
        if (!e.air) e.rise = 0;
      }
      e.group.position.y = height(e.x, e.z) + e.air;
      if (hero && !e.dying && e.air < 1 && far < e.radius + 0.7) this.hurt(hero, e.def.damage, e.x, e.z);
    }
    for (const o of this.orbs) {
      o.life -= dt;
      o.orb.position.x += o.dx * o.speed * dt;
      o.orb.position.z += o.dz * o.speed * dt;
      for (const p of out) {
        if (Math.hypot(o.orb.position.x - p.state.x, o.orb.position.z - p.state.z) < 1) {
          this.hurt(p, o.damage, o.orb.position.x, o.orb.position.z);
          o.life = 0;
        }
      }
      if (o.life <= 0) this.scene.remove(o.orb);
    }
    this.orbs = this.orbs.filter((o) => o.life > 0);
  }
}
