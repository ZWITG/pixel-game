import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';
import { floatText } from '../ui/floatText.js';

const SPEED = 85;
const ATTACK_COOLDOWN = 350;
const ATTACK_REACH = 12;
const ATTACK_RADIUS = 14;
const INVULN_MS = 900;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'hero_0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(10, 8).setOffset(3, 8);
    this.setCollideWorldBounds(true);

    this.facing = new Phaser.Math.Vector2(0, 1);
    this.attackReadyAt = 0;
    this.invulnUntil = 0;
    this.knockUntil = 0;
    this.dead = false;
  }

  // input: { move: {x, y}, attack: bool }, built by WorldScene from Controls.
  update(time, input) {
    this.setDepth(this.y);
    if (this.dead || this.scene.locked || time < this.knockUntil) return;

    const { x: vx, y: vy } = input.move;
    const dir = new Phaser.Math.Vector2(vx, vy);
    if (dir.length() > 1) dir.normalize();
    const speed = SPEED * (1 + this.scene.registry.get('speedBonus'));
    this.setVelocity(dir.x * speed, dir.y * speed);

    if (vx || vy) {
      this.facing.copy(dir).normalize();
      if (Math.abs(vx) > 0.1) this.setFlipX(vx < 0);
      this.anims.play('hero-walk', true);
    } else {
      this.anims.stop();
      this.setTexture('hero_0');
    }

    if (FEATURES.combat && input.attack && time >= this.attackReadyAt) this.attack(time);
  }

  attack(time) {
    this.attackReadyAt = time + ATTACK_COOLDOWN;
    const hx = this.x + this.facing.x * ATTACK_REACH;
    const hy = this.y + this.facing.y * ATTACK_REACH + 2;

    const slash = this.scene.add.image(hx, hy, 'slash')
      .setRotation(Math.atan2(this.facing.y, this.facing.x))
      .setDepth(this.y + 1);
    this.scene.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });

    const atk = this.scene.registry.get('atk') + this.scene.registry.get('atkBonus');
    for (const enemy of this.scene.enemies.getChildren().slice()) {
      if (enemy.dying) continue;
      if (Phaser.Math.Distance.Between(hx, hy, enemy.x, enemy.y) <= ATTACK_RADIUS) enemy.takeHit(atk, this.x, this.y);
    }
  }

  hurt(damage, source) {
    const now = this.scene.time.now;
    if (this.dead || now < this.invulnUntil) return;
    this.invulnUntil = now + INVULN_MS;

    const reg = this.scene.registry;
    const hp = Math.max(0, reg.get('hp') - damage);
    reg.set('hp', hp);
    if (FEATURES.damageNumbers) floatText(this.scene, this.x, this.y - 10, `-${damage}`, '#ff6b6b');
    this.scene.cameras.main.shake(80, 0.004);

    const away = new Phaser.Math.Vector2(this.x - source.x, this.y - source.y).normalize().scale(170);
    this.setVelocity(away.x, away.y);
    this.knockUntil = now + 160;
    this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 90, yoyo: true, repeat: 4, onComplete: () => this.setAlpha(1) });

    if (hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.setVelocity(0, 0);
    this.anims.stop();
    this.setTint(0x666666);
    this.setAngle(90);
    this.scene.registry.set('dead', true);
  }
}
