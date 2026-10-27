import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';

const TEXT_STYLE = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#f4f4f4',
  stroke: '#1a1c2c',
  strokeThickness: 3,
  resolution: 4,
};

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.hearts = this.add.group();
    this.levelText = this.add.text(6, 16, '', TEXT_STYLE);
    this.xpBar = this.add.graphics();
    this.add.image(this.scale.width - 40, 10, 'coin').setVisible(FEATURES.coins);
    this.coinText = this.add.text(this.scale.width - 32, 4, '', TEXT_STYLE).setVisible(FEATURES.coins);

    this.gameOver = this.add.container(this.scale.width / 2, this.scale.height / 2).setVisible(false);
    this.gameOver.add([
      this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6),
      this.add.text(0, -10, 'You fell...', { ...TEXT_STYLE, fontSize: '20px' }).setOrigin(0.5),
      this.add.text(0, 14, 'Press R to rise again', TEXT_STYLE).setOrigin(0.5),
    ]);

    const onChange = () => this.refresh();
    this.registry.events.on('changedata', onChange);
    this.events.once('shutdown', () => this.registry.events.off('changedata', onChange));
    this.refresh();
  }

  refresh() {
    const r = this.registry;
    const hp = r.get('hp'), maxHp = r.get('maxHp');

    this.hearts.clear(true, true);
    for (let i = 0; i < maxHp; i++) {
      this.hearts.add(this.add.image(8 + i * 9, 8, i < hp ? 'heart' : 'heart_empty'));
    }

    this.levelText.setVisible(FEATURES.leveling).setText(`Lv ${r.get('level')}`);
    this.xpBar.clear();
    if (FEATURES.leveling) {
      const w = 50, ratio = r.get('xp') / r.get('xpNext');
      this.xpBar.fillStyle(0x1a1c2c).fillRect(36, 20, w + 2, 6);
      this.xpBar.fillStyle(0x333c57).fillRect(37, 21, w, 4);
      this.xpBar.fillStyle(0x73eff7).fillRect(37, 21, Math.round(w * ratio), 4);
    }

    this.coinText.setText(`${r.get('coins')}`);
    this.gameOver.setVisible(!!r.get('dead'));
  }
}
