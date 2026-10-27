import Phaser from 'phaser';
import { makeAllTextures } from '../art/makeTextures.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    makeAllTextures(this);
    this.anims.create({
      key: 'hero-walk',
      frames: [{ key: 'hero_0' }, { key: 'hero_1' }],
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'slime-bounce',
      frames: [{ key: 'slime_0' }, { key: 'slime_1' }],
      frameRate: 4,
      repeat: -1,
    });
    this.scene.start('World');
  }
}
