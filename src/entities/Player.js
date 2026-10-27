import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { HERO_LOOK } from '../art/looks.js';
import { makeHumanoid, walkPose, makeSlash, makeSpinSlash, makeDust } from '../render/models.js';

const SPEED = 4.6;            // tiles per second
const ATTACK_COOLDOWN = 0.35;
const ATTACK_TIME = 0.18;     // length of the swing animation
const ATTACK_REACH = 0.75;
const ATTACK_RADIUS = 0.9;
const INVULN = 0.9;
const KNOCK_TIME = 0.16;
const SPIN_TIME = 0.3;        // spin slash: one full turn hitting everything around the hero
const SPIN_COOLDOWN = 1.2;
const SPIN_RADIUS = 1.35;
const SPIN_BONUS = 1;         // extra damage over a normal swing
const ROLL_TIME = 0.4;        // seconds a dodge roll lasts
const ROLL_SPEED = 8;         // tiles per second at the start, easing to half (about 2.4 tiles per roll)
const ROLL_IFRAMES = 0.3;     // invincible for this long from the start of a roll
const ROLL_COOLDOWN = 0.2;    // after a roll ends
const ROLL_BUFFER = 0.15;     // a roll pressed this early (during knockback or cooldown) still happens
const ROLL_TUCK = 0.75;       // body scale while rolling
const ROLL_HEIGHT = 0.5;      // height of the body's center at the top of the roll

export default class Player {
  constructor(game) {
    this.game = game;
    this.model = makeHumanoid(HERO_LOOK, { sword: true });
    this.group = this.model.group;
    game.scene.add(this.group);
    this.radius = 0.28;
    this.facing = new THREE.Vector2(0, 1); // (x, z)
    this.rollDir = new THREE.Vector2();
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
    this.rollReadyAt = 0;
    this.rollQueuedUntil = 0;
    this.rollIframesUntil = 0;
    this.spinStart = -1;
    this.spinReadyAt = 0;
    this.walkPhase = 0;
    this.walkAmount = 0;
    this.idlePose();
  }

  // input: { move: {x, z} in world space, attack, spin, dodge: bool,
  //          target: locked-on enemy | null, idleFacing: {x, z} | null }
  update(dt, input) {
    if (this.dead) return;
    const t = this.game.time;
    const moving = Math.hypot(input.move.x, input.move.z);
    const target = input.target;

    if (FEATURES.dodgeRoll && input.dodge) this.rollQueuedUntil = t + ROLL_BUFFER;
    if (!this.rolling && t < this.rollQueuedUntil && t >= this.rollReadyAt && t >= this.knockUntil) {
      this.startRoll(input.move, moving, target);
    }

    if (this.rolling) {
      this.updateRoll(dt);
    } else if (t < this.knockUntil) {
      this.game.collision.move(this, this.knock.x * dt, this.knock.y * dt);
    } else if (moving > 0.05) {
      const amount = Math.min(1, moving);
      const speed = SPEED * (1 + this.game.store.get('speedBonus')) * amount;
      const dx = input.move.x / moving, dz = input.move.z / moving;
      this.game.collision.move(this, dx * speed * dt, dz * speed * dt);
      if (!target) this.setFacing(dx, dz);
      this.walkPhase += dt * 11 * amount;
    }
    // Locked on: keep facing the target while strafing around it.
    if (target && !this.rolling) this.faceToward(target.x, target.z);
    this.walkAmount += ((moving > 0.05 && !this.rolling ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 12);

    if (FEATURES.combat && input.attack && !this.rolling && t >= this.attackReadyAt) {
      if (moving <= 0.05 && !target && input.idleFacing) this.setFacing(input.idleFacing.x, input.idleFacing.z);
      this.attack();
    }
    if (FEATURES.spinSlash && input.spin && !this.rolling && t >= this.spinReadyAt && t >= this.attackReadyAt) this.spin();

    this.pose();
    this.group.visible = !(t < this.invulnUntil && Math.floor(t * 16) % 2);
  }

  pose() {
    const t = this.game.time, root = this.model.root;
    if (this.rolling) {
      // Forward somersault around the middle of the body, arms and legs tucked in.
      const k = Math.min(1, (t - this.rollStart) / ROLL_TIME);
      const spin = (1 - (1 - k) * (1 - k)) * Math.PI * 2;
      const c = 0.5 * ROLL_TUCK;
      const center = c + (ROLL_HEIGHT - c) * Math.sin(Math.PI * k);
      walkPose(this.model, 0, 0);
      for (const leg of this.model.legs) leg.rotation.x = -1.3;
      for (const arm of this.model.arms) arm.rotation.set(-1.2, 0, 0);
      root.scale.setScalar(ROLL_TUCK);
      root.rotation.set(spin, 0, 0);
      root.position.set(0, center - c * Math.cos(spin), -c * Math.sin(spin));
      if (this.model.cape) this.model.cape.rotation.x = 0.3;
      return;
    }
    const swing = (t - this.attackStart) / ATTACK_TIME;
    const attacking = swing >= 0 && swing <= 1;
    const spin = (t - this.spinStart) / SPIN_TIME;
    const spinning = spin >= 0 && spin <= 1;
    walkPose(this.model, this.walkPhase, this.walkAmount, { skipRightArm: attacking || spinning });
    if (attacking) this.model.arms[0].rotation.set(-1.45, 1.3 - swing * 2.5, 0);
    if (spinning) this.model.arms[0].rotation.set(-1.5, 0.9, 0); // sword held out to the side
    root.scale.setScalar(1);
    root.rotation.set(0, spinning ? -spin * Math.PI * 2 : 0, 0);
    root.position.set(0, Math.abs(Math.sin(this.walkPhase)) * 0.04 * this.walkAmount, 0);
    // The cape lifts behind the hero when running and flutters a little.
    if (this.model.cape) this.model.cape.rotation.x = 0.06 + this.walkAmount * 0.5 + Math.sin(t * 9) * 0.04 * this.walkAmount;
  }

  idlePose() {
    this.rolling = false;
    this.walkAmount = 0;
    walkPose(this.model, 0, 0);
    const root = this.model.root;
    root.scale.setScalar(1);
    root.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
  }

  setFacing(x, z) {
    if (Math.hypot(x, z) < 1e-4) return;
    this.facing.set(x, z).normalize();
    this.group.rotation.y = Math.atan2(this.facing.x, this.facing.y);
  }

  faceToward(x, z) {
    this.setFacing(x - this.x, z - this.z);
  }

  // Rolls toward the stick direction. With no input it rolls forward,
  // or away from the target when locked on.
  startRoll(move, moving, target) {
    const t = this.game.time;
    if (moving > 0.05) this.rollDir.set(move.x, move.z).normalize();
    else if (target) this.rollDir.set(this.x - target.x, this.z - target.z).normalize();
    else this.rollDir.copy(this.facing);
    this.rolling = true;
    this.rollStart = t;
    this.rollQueuedUntil = 0;
    this.rollReadyAt = t + ROLL_TIME + ROLL_COOLDOWN;
    this.rollIframesUntil = t + ROLL_IFRAMES;
    this.dodged = false;
    this.attackStart = -1;
    this.setFacing(this.rollDir.x, this.rollDir.y);
    this.puff(3);
  }

  updateRoll(dt) {
    const k = (this.game.time - this.rollStart) / ROLL_TIME;
    if (k >= 1) {
      this.rolling = false;
      this.puff(2);
      return;
    }
    const speed = ROLL_SPEED * (1 - 0.5 * k) * (1 + this.game.store.get('speedBonus'));
    this.game.collision.move(this, this.rollDir.x * speed * dt, this.rollDir.y * speed * dt);
  }

  puff(count) {
    for (let i = 0; i < count; i++) {
      const dust = makeDust();
      dust.position.set(this.x + (Math.random() - 0.5) * 0.4, 0.08, this.z + (Math.random() - 0.5) * 0.4);
      dust.rotation.y = Math.random() * Math.PI;
      this.game.addEffect(dust, 0.35, { rise: 0.8, grow: 2 });
    }
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

  // A full turn that hits every enemy around the hero, harder than a swing.
  spin() {
    const game = this.game, t = game.time;
    this.spinStart = t;
    this.spinReadyAt = t + SPIN_COOLDOWN;
    this.attackReadyAt = t + SPIN_TIME;
    const ring = makeSpinSlash();
    ring.position.set(this.x, 0.5, this.z);
    game.addEffect(ring, 0.25, { grow: 0.6 });
    const atk = game.store.get('atk') + game.store.get('atkBonus') + SPIN_BONUS;
    for (const enemy of game.enemies.slice()) {
      if (!enemy.dying && Math.hypot(this.x - enemy.x, this.z - enemy.z) <= SPIN_RADIUS + enemy.radius) enemy.takeHit(atk, this.x, this.z);
    }
  }

  // Returns true when the hit landed (false while invulnerable or rolling through it).
  hurt(damage, source) {
    const game = this.game, t = game.time;
    if (this.dead || t < this.invulnUntil) return false;
    if (t < this.rollIframesUntil) {
      // Rolled through the hit.
      if (!this.dodged) game.hud.floatText(this.x, 1.3, this.z, 'Dodge!', '#73eff7');
      this.dodged = true;
      return false;
    }
    this.invulnUntil = t + INVULN;
    damage = Math.max(1, damage - game.store.get('def'));

    const hp = Math.max(0, game.store.get('hp') - damage);
    game.store.set('hp', hp);
    if (FEATURES.damageNumbers) game.hud.floatText(this.x, 1.3, this.z, `-${damage}`, '#ff6b6b');
    game.rig.shake(0.18);

    this.knock.set(this.x - source.x, this.z - source.z).normalize().multiplyScalar(6);
    this.knockUntil = t + KNOCK_TIME;
    if (hp <= 0) this.die();
    return true;
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
