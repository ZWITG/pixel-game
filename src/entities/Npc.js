import Phaser from 'phaser';

// A villager that stands still and can be talked to. Data comes from data/npcs.js.
export default class Npc extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, def) {
    super(scene, x, y, `npc_${def.look}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(10, 8).setOffset(3, 8);
    this.body.setImmovable(true);
    this.body.pushable = false;
    this.setDepth(y);
    this.def = def;
  }

  face(target) {
    this.setFlipX(target.x < this.x);
  }
}
