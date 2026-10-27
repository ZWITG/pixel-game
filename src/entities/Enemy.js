import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { SLIME_COLORS } from '../art/looks.js';
import { makeSlime } from '../render/models.js';
import { disposeModel } from '../render/voxel.js';

const DEATH_TIME = 0.22;

// A data-driven enemy: behaviour comes from an entry in data/enemies.js.
export default class Enemy {
  constructor(game, x, z, def) {
    this.game = game;
    this.def = def;
    this.model = makeSlime(SLIME_COLORS[def.colors]);
    this.group = this.model.group;
    this.group.position.set(x, 0, z);
    game.scene.add(this.group);

    this.radius = def.radius;
    this.hp = def.hp;
    this.vel = new THREE.Vector2();
    this.nextWander = 0;
    this.knockUntil = 0;
    this.flashUntil = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.dying = false;
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  update(dt) {
    const game = this.game, t = game.time, player = game.player, def = this.def;
    if (this.dying) return this.animateDeath(dt);

    if (t >= this.knockUntil) {
      const dist = Math.hypot(player.x - this.x, player.z - this.z);
      if (game.inVillage(this.x, this.z)) {
        // Village wards push monsters back out.
        const c = game.villageCenter();
        this.vel.set(this.x - c.x, this.z - c.z).normalize().multiplyScalar(def.chaseSpeed);
      } else if (dist < def.aggro && !player.dead && !game.inVillage(player.x, player.z)) {
        this.vel.set(player.x - this.x, player.z - this.z).normalize().multiplyScalar(def.chaseSpeed);
      } else if (t > this.nextWander) {
        this.nextWander = t + 1 + Math.random() * 1.5;
        if (Math.random() < 0.35) this.vel.set(0, 0);
        else {
          const a = Math.random() * Math.PI * 2;
          this.vel.set(Math.cos(a), Math.sin(a)).multiplyScalar(def.speed);
        }
      }
    }

    game.collision.move(this, this.vel.x * dt, this.vel.y * dt);
    if (t >= this.knockUntil && this.vel.lengthSq() > 0.01) this.group.rotation.y = Math.atan2(this.vel.x, this.vel.y);

    // Squash-and-stretch hop
    const moving = this.vel.lengthSq() > 0.01;
    this.phase += dt * (moving ? 9 : 4);
    const s = Math.sin(this.phase);
    this.model.root.scale.set(1 - s * 0.06, 1 + s * 0.12, 1 - s * 0.06);
    this.model.root.position.y = moving ? Math.max(0, s) * 0.1 : 0;
    this.model.mat.emissive.setScalar(t < this.flashUntil ? 1 : 0);
  }

  takeHit(damage, fromX, fromZ) {
    if (this.dying) return;
    const game = this.game;
    this.hp -= damage;
    if (FEATURES.damageNumbers) game.hud.floatText(this.x, 1, this.z, `${damage}`, '#ffffff');
    this.flashUntil = game.time + 0.08;
    this.vel.set(this.x - fromX, this.z - fromZ).normalize().multiplyScalar(7);
    this.knockUntil = game.time + 0.2;
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
    this.model.mat.transparent = true;
    this.model.mat.opacity = 1 - k;
    if (k >= 1) this.game.removeEnemy(this);
  }

  remove() {
    this.game.scene.remove(this.group);
    disposeModel(this.group);
  }
}
