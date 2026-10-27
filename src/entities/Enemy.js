import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { SLIME_COLORS } from '../art/looks.js';
import { makeSlime, makeBoar, makeWisp, makeMushroom } from '../render/models.js';
import { disposeModel } from '../render/voxel.js';

const DEATH_TIME = 0.22;
const STUN_TIME = 1;       // a charger that runs into a wall is dazed this long
const REST_TIME = 0.8;     // pause after a charge
const WARD_PUSH = 3;       // tiles/s that village wards push monsters out
const FLASH = new THREE.Color(1, 1, 1);
const WINDUP_GLOW = new THREE.Color(0.7, 0.12, 0);

const MODELS = {
  slime: (def) => makeSlime(SLIME_COLORS[def.colors]),
  boar: () => makeBoar(),
  wisp: () => makeWisp(),
  mushroom: () => makeMushroom(),
};

// A data-driven enemy: looks and behaviour come from an entry in data/enemies.js.
export default class Enemy {
  constructor(game, x, z, def) {
    this.game = game;
    this.def = def;
    this.model = MODELS[def.model](def);
    this.group = this.model.group;
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(def.scale ?? 1);
    game.scene.add(this.group);
    this.baseGlow = this.model.mat.emissive.clone();

    this.radius = def.radius;
    this.overFences = true; // wards can push monsters out over the village fence
    this.hp = def.hp;
    this.vel = new THREE.Vector2();
    this.nextWander = 0;
    this.knockUntil = 0;
    this.flashUntil = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.dying = false;
    this.state = 'roam'; // charge AI: roam | windup | charge | stunned | rest
    this.stateUntil = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.nextShot = game.time + 1 + Math.random() * (def.fireEvery ?? 2);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  update(dt) {
    if (this.dying) return this.animateDeath(dt);
    const game = this.game, t = game.time, player = game.player;
    if (t >= this.knockUntil) this.think(t);

    const dx = this.vel.x * dt, dz = this.vel.y * dt, x0 = this.x, z0 = this.z;
    game.collision.move(this, dx, dz);
    if (this.state === 'charge' && Math.hypot(this.x - x0, this.z - z0) < Math.hypot(dx, dz) * 0.5) {
      // Ran into a wall.
      this.vel.set(0, 0);
      this.setState('stunned', STUN_TIME);
      game.hud.floatText(this.x, 1.1, this.z, 'Dazed!', '#ffcd75');
    }

    if (this.state === 'windup' || (this.def.ai === 'shoot' && this.vel.lengthSq() > 0.01)) {
      this.group.rotation.y = Math.atan2(player.x - this.x, player.z - this.z);
    } else if (t >= this.knockUntil && this.vel.lengthSq() > 0.01) {
      this.group.rotation.y = Math.atan2(this.vel.x, this.vel.y);
    }

    this.animate(dt);
    const glow = this.model.mat.emissive;
    if (t < this.flashUntil) glow.copy(FLASH);
    else if (this.state === 'windup') glow.copy(WINDUP_GLOW).multiplyScalar(0.6 + 0.4 * Math.sin(t * 30));
    else glow.copy(this.baseGlow);
  }

  setState(state, seconds) {
    this.state = state;
    this.stateUntil = this.game.time + seconds;
  }

  think(t) {
    const game = this.game, player = game.player, def = this.def;
    if (game.inVillage(this.x, this.z)) {
      // Village wards push monsters back out.
      const c = game.villageCenter();
      this.state = 'roam';
      this.vel.set(this.x - c.x, this.z - c.z).normalize().multiplyScalar(Math.max(def.speed, WARD_PUSH));
      return;
    }
    const dist = Math.hypot(player.x - this.x, player.z - this.z);
    const sees = dist < def.aggro && !player.dead && !game.inVillage(player.x, player.z);
    if (def.ai === 'charge') return this.thinkCharge(t, sees);
    if (sees && def.ai === 'shoot') return this.thinkShoot(t, dist);
    if (sees && def.ai === 'chase') {
      this.vel.set(player.x - this.x, player.z - this.z).normalize().multiplyScalar(def.chaseSpeed);
      return;
    }
    this.wander(t);
  }

  wander(t) {
    if (t <= this.nextWander) return;
    this.nextWander = t + 1 + Math.random() * 1.5;
    if (Math.random() < 0.35) this.vel.set(0, 0);
    else {
      const a = Math.random() * Math.PI * 2;
      this.vel.set(Math.cos(a), Math.sin(a)).multiplyScalar(this.def.speed);
    }
  }

  // Paw the ground, then dash at where the hero was. Dodge sideways or roll through it.
  thinkCharge(t, sees) {
    const p = this.game.player, def = this.def;
    if (this.state === 'roam') {
      if (!sees) return this.wander(t);
      this.vel.set(0, 0);
      this.setState('windup', def.windup);
    } else if (t >= this.stateUntil) {
      if (this.state === 'windup') {
        this.vel.set(p.x - this.x, p.z - this.z).normalize().multiplyScalar(def.chaseSpeed);
        this.setState('charge', def.chargeTime);
      } else if (this.state === 'charge') {
        this.vel.set(0, 0);
        this.setState('rest', REST_TIME);
      } else {
        this.setState('roam', 0);
      }
    } else if (this.state !== 'charge') {
      this.vel.set(0, 0);
    }
  }

  // Stay at a safe distance, circle the hero, and fire an orb every few seconds.
  thinkShoot(t, dist) {
    const p = this.game.player, def = this.def;
    const dx = (p.x - this.x) / dist, dz = (p.z - this.z) / dist;
    const [near, far] = def.keepAway;
    if (dist < near) this.vel.set(-dx, -dz).multiplyScalar(def.chaseSpeed);
    else if (dist > far) this.vel.set(dx, dz).multiplyScalar(def.chaseSpeed);
    else this.vel.set(-dz * this.strafe, dx * this.strafe).multiplyScalar(def.speed * 0.6);
    if (t >= this.nextShot) {
      this.nextShot = t + def.fireEvery;
      if (Math.random() < 0.3) this.strafe *= -1;
      this.game.fireOrb(this, dx, dz);
    }
  }

  animate(dt) {
    const m = this.model, t = this.game.time, moving = this.vel.lengthSq() > 0.01;
    if (this.def.model === 'boar') {
      this.phase += dt * (moving ? 16 : 3);
      const swing = moving ? Math.sin(this.phase) * 0.7 : 0;
      m.legs[0].rotation.x = m.legs[3].rotation.x = swing;
      m.legs[1].rotation.x = m.legs[2].rotation.x = -swing;
      const shake = this.state === 'windup' ? Math.sin(t * 45) * 0.03 : 0;
      m.root.position.set(shake, moving ? Math.abs(Math.sin(this.phase)) * 0.05 : 0, 0);
      m.root.rotation.set(this.state === 'windup' ? 0.12 : 0, 0, this.state === 'stunned' ? Math.sin(t * 14) * 0.15 : 0);
    } else if (this.def.model === 'wisp') {
      this.phase += dt * 3;
      m.root.position.y = 0.8 + Math.sin(this.phase) * 0.1;
      m.root.rotation.z = Math.sin(this.phase * 0.7) * 0.15;
      m.halo.scale.setScalar(1 + Math.sin(t * 6 + this.phase) * 0.1);
    } else {
      // Squash-and-stretch hop (slimes) or waddle (mushrooms)
      this.phase += dt * (moving ? 9 : 4);
      const s = Math.sin(this.phase);
      m.root.scale.set(1 - s * 0.06, 1 + s * 0.12, 1 - s * 0.06);
      if (this.def.model === 'mushroom') m.root.rotation.z = moving ? s * 0.14 : 0;
      else m.root.position.y = moving ? Math.max(0, s) * 0.1 : 0;
    }
  }

  takeHit(damage, fromX, fromZ) {
    if (this.dying) return;
    const game = this.game;
    this.hp -= damage;
    if (FEATURES.damageNumbers) game.hud.floatText(this.x, 1, this.z, `${damage}`, '#ffffff');
    this.flashUntil = game.time + 0.08;
    this.vel.set(this.x - fromX, this.z - fromZ).normalize().multiplyScalar(7);
    this.knockUntil = game.time + 0.2;
    if (this.state === 'charge') this.setState('rest', REST_TIME);
    if (this.hp <= 0) {
      this.dying = true;
      this.deathTime = 0;
      this.model.mat.emissive.setScalar(0);
      game.onEnemyKilled(this);
    }
  }

  animateDeath(dt) {
    this.deathTime += dt;
    const k = Math.min(1, this.deathTime / DEATH_TIME);
    this.model.root.scale.set(1 + k * 0.6, 1 - k * 0.9, 1 + k * 0.6);
    for (const mat of [this.model.mat, ...(this.model.extraMats ?? [])]) {
      mat.transparent = true;
      mat.opacity = (mat.userData.baseOpacity ??= mat.opacity) * (1 - k);
    }
    if (k >= 1) this.game.removeEnemy(this);
  }

  remove() {
    this.game.scene.remove(this.group);
    disposeModel(this.group);
  }
}
