import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { HERO_LOOK } from '../art/looks.js';
import { makeHumanoid, walkPose, makeSlash } from '../render/models.js';

const SPEED = 4.6;            // tiles per second
const ATTACK_COOLDOWN = 0.35;
const ATTACK_TIME = 0.18;     // length of the swing animation
const ATTACK_REACH = 0.75;
const ATTACK_RADIUS = 0.9;
const INVULN = 0.9;
const KNOCK_TIME = 0.16;

export default class Player {
  constructor(game) {
    this.game = game;
    this.model = makeHumanoid(HERO_LOOK, { sword: true });
    this.group = this.model.group;
    game.scene.add(this.group);
    this.radius = 0.28;
    this.facing = new THREE.Vector2(0, 1); // (x, z)
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  respawn(x, z) {
    this.group.position.set(x, 0, z);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.model.mat.color.set(0xffffff);
    this.facing.set(0, 1);
    this.dead = false;
    this.attackReadyAt = 0;
    this.attackStart = -1;
    this.invulnUntil = 0;
    this.knockUntil = 0;
    this.knock = new THREE.Vector2();
    this.walkPhase = 0;
    this.walkAmount = 0;
    this.idlePose();
  }

  // input: { move: {x, z} in world space, attack: bool, idleFacing: {x, z} | null }
  update(dt, input) {
    if (this.dead) return;
    const t = this.game.time;
    const moving = Math.hypot(input.move.x, input.move.z);

    if (t < this.knockUntil) {
      this.game.collision.move(this, this.knock.x * dt, this.knock.y * dt);
    } else if (moving > 0.05) {
      const amount = Math.min(1, moving);
      const speed = SPEED * (1 + this.game.store.get('speedBonus')) * amount;
      this.facing.set(input.move.x, input.move.z).normalize();
      this.game.collision.move(this, this.facing.x * speed * dt, this.facing.y * speed * dt);
      this.group.rotation.y = Math.atan2(this.facing.x, this.facing.y);
      this.walkPhase += dt * 11 * amount;
    }
    this.walkAmount += ((moving > 0.05 ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 12);

    if (FEATURES.combat && input.attack && t >= this.attackReadyAt) {
      if (moving <= 0.05 && input.idleFacing) {
        this.facing.set(input.idleFacing.x, input.idleFacing.z).normalize();
        this.group.rotation.y = Math.atan2(this.facing.x, this.facing.y);
      }
      this.attack();
    }

    this.pose();
    this.group.visible = !(t < this.invulnUntil && Math.floor(t * 16) % 2);
  }

  pose() {
    const t = this.game.time;
    const swing = (t - this.attackStart) / ATTACK_TIME;
    const attacking = swing >= 0 && swing <= 1;
    walkPose(this.model, this.walkPhase, this.walkAmount, { skipRightArm: attacking });
    if (attacking) this.model.arms[0].rotation.set(-1.45, 1.3 - swing * 2.5, 0);
    this.model.root.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.04 * this.walkAmount;
  }

  idlePose() {
    this.walkAmount = 0;
    walkPose(this.model, 0, 0);
    this.model.root.position.y = 0;
  }

  faceToward(x, z) {
    this.facing.set(x - this.x, z - this.z).normalize();
    this.group.rotation.y = Math.atan2(this.facing.x, this.facing.y);
  }

  attack() {
    const game = this.game, t = game.time;
    this.attackReadyAt = t + ATTACK_COOLDOWN;
    this.attackStart = t;

    const slash = makeSlash();
    slash.position.set(this.x, 0.5, this.z);
    slash.rotation.y = Math.atan2(-this.facing.y, this.facing.x);
    game.addEffect(slash, 0.15);

    const hx = this.x + this.facing.x * ATTACK_REACH;
    const hz = this.z + this.facing.y * ATTACK_REACH;
    const atk = game.store.get('atk') + game.store.get('atkBonus');
    for (const enemy of game.enemies.slice()) {
      if (!enemy.dying && Math.hypot(hx - enemy.x, hz - enemy.z) <= ATTACK_RADIUS) enemy.takeHit(atk, this.x, this.z);
    }
  }

  hurt(damage, source) {
    const game = this.game, t = game.time;
    if (this.dead || t < this.invulnUntil) return;
    this.invulnUntil = t + INVULN;

    const hp = Math.max(0, game.store.get('hp') - damage);
    game.store.set('hp', hp);
    if (FEATURES.damageNumbers) game.hud.floatText(this.x, 1.3, this.z, `-${damage}`, '#ff6b6b');
    game.rig.shake(0.18);

    this.knock.set(this.x - source.x, this.z - source.z).normalize().multiplyScalar(6);
    this.knockUntil = t + KNOCK_TIME;
    if (hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.idlePose();
    this.group.visible = true;
    this.group.rotation.z = Math.PI / 2;
    this.group.position.y = 0.2;
    this.model.mat.color.set(0x777777);
    this.game.store.set('dead', true);
  }
}
