import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';
import { floatText } from '../ui/floatText.js';

// A data-driven enemy: behaviour comes from an entry in data/enemies.js.
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, def) {
    super(scene, x, y, `${def.texture}_0`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(12, 8).setOffset(2, 6);
    this.setCollideWorldBounds(true);
    if (def.tint) this.setTint(def.tint);
    this.anims.play(`${def.texture}-bounce`);

    this.def = def;
    this.hp = def.hp;
    this.nextWander = 0;
    this.knockUntil = 0;
    this.dying = false;
  }

  update(time, player) {
    this.setDepth(this.y);
    const scene = this.scene;
    if (this.dying || scene.locked || time < this.knockUntil) return;

    // Village wards push monsters back out.
    if (scene.inVillage(this.x, this.y)) {
      const c = scene.villageCenter();
      const away = new Phaser.Math.Vector2(this.x - c.x, this.y - c.y).normalize().scale(this.def.chaseSpeed);
      this.setVelocity(away.x, away.y);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist < this.def.aggro && !player.dead && !scene.inVillage(player.x, player.y)) {
      this.scene.physics.moveToObject(this, player, this.def.chaseSpeed);
      this.setFlipX(player.x < this.x);
    } else if (time > this.nextWander) {
      this.nextWander = time + Phaser.Math.Between(1000, 2500);
      if (Math.random() < 0.35) {
        this.setVelocity(0, 0);
      } else {
        const angle = Math.random() * Math.PI * 2;
        this.setVelocity(Math.cos(angle) * this.def.speed, Math.sin(angle) * this.def.speed);
      }
    }
  }

  takeHit(damage, fromX, fromY) {
    if (this.dying) return;
    this.hp -= damage;
    if (FEATURES.damageNumbers) floatText(this.scene, this.x, this.y - 8, `${damage}`, '#ffffff');

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.active) return;
      this.clearTint();
      if (this.def.tint) this.setTint(this.def.tint);
    });

    const away = new Phaser.Math.Vector2(this.x - fromX, this.y - fromY).normalize().scale(180);
    this.setVelocity(away.x, away.y);
    this.knockUntil = this.scene.time.now + 200;

    if (this.hp <= 0) this.die();
  }

  die() {
    this.dying = true;
    this.body.enable = false;
    this.scene.events.emit('enemy-killed', this);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.6,
      scaleY: 0.2,
      alpha: 0,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }
}
