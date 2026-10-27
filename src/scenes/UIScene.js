import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';
import { ITEMS, SHOPS } from '../data/items.js';
import { tryBuy } from '../systems/shop.js';
import Controls from '../systems/controls.js';

const TEXT_STYLE = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#f4f4f4',
  stroke: '#1a1c2c',
  strokeThickness: 3,
  resolution: 4,
};
const TYPE_MS = 22;       // dialogue typewriter speed per character
const INPUT_GRACE = 120;  // ignore the same press that opened a box
const SHOP_ROWS = 6;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.controls = new Controls(this);
    this.mode = null; // null | 'dialogue' | 'shop'
    this.sinceOpen = 0;

    this.hearts = this.add.group();
    this.levelText = this.add.text(6, 16, '', TEXT_STYLE);
    this.xpBar = this.add.graphics();
    this.add.image(this.scale.width - 40, 10, 'coin').setVisible(FEATURES.coins);
    this.coinText = this.add.text(this.scale.width - 32, 4, '', TEXT_STYLE).setVisible(FEATURES.coins);

    this.banner = this.add.text(this.scale.width / 2, 44, '', { ...TEXT_STYLE, fontSize: '16px', color: '#ffcd75' })
      .setOrigin(0.5).setAlpha(0);

    this.buildDialogue();
    this.buildShop();

    this.gameOver = this.add.container(this.scale.width / 2, this.scale.height / 2).setVisible(false);
    this.gameOver.add([
      this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6),
      this.add.text(0, -10, 'You fell...', { ...TEXT_STYLE, fontSize: '20px' }).setOrigin(0.5),
      this.add.text(0, 14, 'Press R / Start to rise again', TEXT_STYLE).setOrigin(0.5),
    ]);

    const onChange = () => this.refresh();
    this.registry.events.on('changedata', onChange);
    this.events.once('shutdown', () => this.registry.events.off('changedata', onChange));
    this.refresh();
  }

  update(_time, delta) {
    this.controls.update();
    const just = this.controls.just;
    this.sinceOpen += delta;
    if (!this.mode || this.sinceOpen < INPUT_GRACE) return;

    if (this.mode === 'dialogue') {
      if (just.confirm || just.back) this.advanceDialogue();
    } else if (this.mode === 'shop') {
      const count = this.shopItems.length + 1; // last row is "Leave"
      if (just.up) this.shopIndex = (this.shopIndex + count - 1) % count;
      if (just.down) this.shopIndex = (this.shopIndex + 1) % count;
      if (just.back) return this.closeShop();
      if (just.confirm) {
        if (this.shopIndex === this.shopItems.length) return this.closeShop();
        const id = this.shopItems[this.shopIndex];
        const result = tryBuy(this.registry, id, ITEMS[id]);
        this.shopMsg.setText(result.msg).setColor(result.ok ? '#a7f070' : '#ff6b6b');
      }
      if (just.up || just.down || just.confirm) this.renderShop();
    }
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
    if (this.mode === 'shop') this.renderShop();
  }

  showBanner(text) {
    this.banner.setText(text);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, duration: 300, yoyo: true, hold: 1400 });
  }

  // ---- Dialogue ----

  buildDialogue() {
    const w = this.scale.width, h = this.scale.height;
    const box = this.add.graphics();
    box.fillStyle(0x1a1c2c, 0.94).fillRoundedRect(10, h - 70, w - 20, 62, 4);
    box.lineStyle(2, 0xf4f4f4).strokeRoundedRect(10, h - 70, w - 20, 62, 4);
    this.dlgName = this.add.text(20, h - 66, '', { ...TEXT_STYLE, color: '#ffcd75' });
    this.dlgText = this.add.text(20, h - 52, '', { ...TEXT_STYLE, wordWrap: { width: w - 50 } });
    this.dlgMore = this.add.text(w - 24, h - 18, '▼', TEXT_STYLE).setOrigin(0.5);
    this.tweens.add({ targets: this.dlgMore, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.dlg = this.add.container(0, 0, [box, this.dlgName, this.dlgText, this.dlgMore]).setVisible(false);
  }

  openDialogue(name, lines, onDone) {
    this.mode = 'dialogue';
    this.sinceOpen = 0;
    this.dlgLines = lines;
    this.dlgIndex = 0;
    this.dlgDone = onDone;
    this.dlgName.setText(name);
    this.dlg.setVisible(true);
    this.showLine();
  }

  showLine() {
    this.fullLine = this.dlgLines[this.dlgIndex];
    this.shown = 0;
    this.dlgText.setText('');
    this.dlgMore.setVisible(false);
    this.typeTimer?.remove();
    this.typeTimer = this.time.addEvent({
      delay: TYPE_MS,
      repeat: this.fullLine.length - 1,
      callback: () => {
        this.shown++;
        this.dlgText.setText(this.fullLine.slice(0, this.shown));
        if (this.shown >= this.fullLine.length) this.dlgMore.setVisible(true);
      },
    });
  }

  advanceDialogue() {
    if (this.shown < this.fullLine.length) {
      this.typeTimer.remove();
      this.shown = this.fullLine.length;
      this.dlgText.setText(this.fullLine);
      this.dlgMore.setVisible(true);
      return;
    }
    this.dlgIndex++;
    if (this.dlgIndex < this.dlgLines.length) return this.showLine();
    this.dlg.setVisible(false);
    this.mode = null;
    const done = this.dlgDone;
    this.dlgDone = null;
    done?.();
  }

  // ---- Shop ----

  buildShop() {
    const pw = 300, ph = 170;
    const x = (this.scale.width - pw) / 2, y = (this.scale.height - ph) / 2 - 8;
    const box = this.add.graphics();
    box.fillStyle(0x1a1c2c, 0.96).fillRoundedRect(x, y, pw, ph, 4);
    box.lineStyle(2, 0xffcd75).strokeRoundedRect(x, y, pw, ph, 4);
    this.shopTitle = this.add.text(x + 10, y + 6, '', { ...TEXT_STYLE, color: '#ffcd75' });
    this.shopCoins = this.add.text(x + pw - 10, y + 6, '', TEXT_STYLE).setOrigin(1, 0);
    this.shopRows = [];
    for (let i = 0; i < SHOP_ROWS; i++) this.shopRows.push(this.add.text(x + 10, y + 26 + i * 14, '', TEXT_STYLE));
    this.shopDesc = this.add.text(x + 10, y + ph - 46, '', { ...TEXT_STYLE, color: '#94b0c2' });
    this.shopMsg = this.add.text(x + 10, y + ph - 32, '', TEXT_STYLE);
    const hint = this.add.text(x + 10, y + ph - 16, 'Up/Down choose  E/A buy  Q/B leave', { ...TEXT_STYLE, color: '#566c86' });
    this.shopBox = this.add.container(0, 0, [box, this.shopTitle, this.shopCoins, ...this.shopRows, this.shopDesc, this.shopMsg, hint])
      .setVisible(false);
  }

  openShop(shopId, onClose) {
    const shop = SHOPS[shopId];
    this.mode = 'shop';
    this.sinceOpen = 0;
    this.shopItems = shop.items;
    this.shopIndex = 0;
    this.shopClose = onClose;
    this.shopTitle.setText(shop.title);
    this.shopMsg.setText('');
    this.shopBox.setVisible(true);
    this.renderShop();
  }

  renderShop() {
    const owned = this.registry.get('owned');
    this.shopCoins.setText(`Coins: ${this.registry.get('coins')}`);
    this.shopRows.forEach((row, i) => {
      const selected = i === this.shopIndex;
      const cursor = selected ? '>' : ' ';
      if (i < this.shopItems.length) {
        const id = this.shopItems[i], item = ITEMS[id];
        const sold = item.once && owned.includes(id);
        const price = sold ? 'OWNED' : `${item.price}c`;
        row.setText(`${cursor} ${item.name.padEnd(16)}${price.padStart(6)}`)
          .setColor(sold ? '#566c86' : selected ? '#ffcd75' : '#f4f4f4').setVisible(true);
      } else if (i === this.shopItems.length) {
        row.setText(`${cursor} Leave`).setColor(selected ? '#ffcd75' : '#f4f4f4').setVisible(true);
      } else {
        row.setVisible(false);
      }
    });
    const item = ITEMS[this.shopItems[this.shopIndex]];
    this.shopDesc.setText(item ? item.desc : 'Come back anytime!');
  }

  closeShop() {
    this.shopBox.setVisible(false);
    this.mode = null;
    const close = this.shopClose;
    this.shopClose = null;
    close?.();
  }
}
