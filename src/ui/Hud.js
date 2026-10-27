import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { ITEMS, SHOPS } from '../data/items.js';
import { tryBuy } from '../systems/shop.js';
import { ICONS, iconSvg } from '../art/icons.js';

const TYPE_SPEED = 45;   // dialogue characters per second
const FLOAT_TIME = 0.8;  // seconds a damage number stays up
const $ = (id) => document.getElementById(id);

// HTML overlay: stats, banner, talk prompt, floating numbers, dialogue box, shop, game over.
export default class Hud {
  constructor(game) {
    this.game = game;
    this.store = game.store;
    this.mode = null; // null | 'dialogue' | 'shop'
    this.floats = [];
    this.promptTarget = null;
    this.v = new THREE.Vector3();
    this.el = {
      hearts: $('hearts'), level: $('level'), lv: $('lv'), xpfill: $('xpfill'),
      coins: $('coins'), coinCount: $('coin-count'), cam: $('cam-hint'), banner: $('banner'),
      prompt: $('prompt'), floats: $('floats'), flash: $('flash'),
      dlg: $('dialogue'), dlgName: $('dlg-name'), dlgText: $('dlg-text'), dlgMore: $('dlg-more'),
      shop: $('shop'), shopTitle: $('shop-title'), shopCoins: $('shop-coins'), shopList: $('shop-list'),
      shopDesc: $('shop-desc'), shopMsg: $('shop-msg'), gameOver: $('gameover'),
    };
    $('coin-icon').innerHTML = iconSvg(ICONS.coin);
    this.el.coins.hidden = !FEATURES.coins;
    this.el.level.hidden = !FEATURES.leveling;
    this.store.on(() => this.refresh());
  }

  reset() {
    this.mode = null;
    this.el.dlg.hidden = true;
    this.el.shop.hidden = true;
    for (const f of this.floats) f.div.remove();
    this.floats = [];
    this.refresh();
  }

  refresh() {
    const s = this.store;
    if (s.get('hp') === undefined) return;
    const heartsKey = `${s.get('hp')}/${s.get('maxHp')}`;
    if (heartsKey !== this.heartsKey) {
      this.heartsKey = heartsKey;
      let html = '';
      for (let i = 0; i < s.get('maxHp'); i++) html += iconSvg(i < s.get('hp') ? ICONS.heart : ICONS.heartEmpty);
      this.el.hearts.innerHTML = html;
    }
    this.el.lv.textContent = `Lv ${s.get('level')}`;
    this.el.xpfill.style.width = `${Math.round((s.get('xp') / s.get('xpNext')) * 100)}%`;
    this.el.coinCount.textContent = s.get('coins');
    this.el.gameOver.hidden = !s.get('dead');
    if (this.mode === 'shop') this.renderShop();
  }

  setCamMode(mode) {
    this.el.cam.textContent = `Camera: ${mode === 'top' ? 'top-down' : 'behind'}  (V / Select)`;
  }

  showBanner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), 2000);
  }

  flash() {
    const f = this.el.flash;
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 60);
  }

  setPrompt(npc) {
    this.promptTarget = npc;
  }

  floatText(x, y, z, text, color) {
    const div = document.createElement('div');
    div.className = 'float';
    div.textContent = text;
    div.style.color = color;
    this.el.floats.appendChild(div);
    this.floats.push({ div, x, y, z, age: 0 });
  }

  toScreen(x, y, z) {
    this.v.set(x, y, z).project(this.game.camera);
    return {
      x: ((this.v.x + 1) / 2) * innerWidth,
      y: ((1 - this.v.y) / 2) * innerHeight,
      visible: this.v.z > -1 && this.v.z < 1,
    };
  }

  place(el, x, y, z) {
    const p = this.toScreen(x, y, z);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.visibility = p.visible ? 'visible' : 'hidden';
  }

  update(dt) {
    for (const f of this.floats) {
      f.age += dt;
      this.place(f.div, f.x, f.y + f.age * 1.2, f.z);
      f.div.style.opacity = 1 - f.age / FLOAT_TIME;
    }
    this.floats = this.floats.filter((f) => (f.age < FLOAT_TIME ? true : (f.div.remove(), false)));

    const npc = this.mode ? null : this.promptTarget;
    this.el.prompt.style.display = npc ? 'block' : 'none';
    if (npc) this.place(this.el.prompt, npc.x, 1.55, npc.z);

    if (this.mode === 'dialogue' && this.shown < this.fullLine.length) {
      this.shown = Math.min(this.fullLine.length, this.shown + dt * TYPE_SPEED);
      this.el.dlgText.textContent = this.fullLine.slice(0, Math.floor(this.shown));
      this.el.dlgMore.hidden = this.shown < this.fullLine.length;
    }
  }

  // Menu input, called instead of world input while a menu is open.
  handle(just) {
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
        const result = tryBuy(this.store, id, ITEMS[id]);
        this.el.shopMsg.textContent = result.msg;
        this.el.shopMsg.style.color = result.ok ? '#a7f070' : '#ff6b6b';
      }
      this.renderShop();
    }
  }

  // ---- Dialogue ----

  openDialogue(name, lines, onDone) {
    this.mode = 'dialogue';
    this.dlgLines = lines;
    this.dlgIndex = 0;
    this.dlgDone = onDone;
    this.el.dlgName.textContent = name;
    this.el.dlg.hidden = false;
    this.showLine();
  }

  showLine() {
    this.fullLine = this.dlgLines[this.dlgIndex];
    this.shown = 0;
    this.el.dlgText.textContent = '';
    this.el.dlgMore.hidden = true;
  }

  advanceDialogue() {
    if (this.shown < this.fullLine.length) {
      this.shown = this.fullLine.length;
      this.el.dlgText.textContent = this.fullLine;
      this.el.dlgMore.hidden = false;
      return;
    }
    this.dlgIndex++;
    if (this.dlgIndex < this.dlgLines.length) return this.showLine();
    this.el.dlg.hidden = true;
    this.mode = null;
    const done = this.dlgDone;
    this.dlgDone = null;
    done?.();
  }

  // ---- Shop ----

  openShop(shopId) {
    const shop = SHOPS[shopId];
    this.mode = 'shop';
    this.shopItems = shop.items;
    this.shopIndex = 0;
    this.el.shopTitle.textContent = shop.title;
    this.el.shopMsg.textContent = '';
    this.el.shop.hidden = false;
    this.renderShop();
  }

  renderShop() {
    const owned = this.store.get('owned');
    this.el.shopCoins.textContent = `Coins: ${this.store.get('coins')}`;
    const rows = this.shopItems.map((id, i) => {
      const item = ITEMS[id];
      const sold = item.once && owned.includes(id);
      const cls = [i === this.shopIndex ? 'sel' : '', sold ? 'owned' : ''].join(' ');
      return `<li class="${cls}"><span>${i === this.shopIndex ? '&gt; ' : '&nbsp;&nbsp;'}${item.name}</span><span>${sold ? 'OWNED' : `${item.price}c`}</span></li>`;
    });
    const leaveSel = this.shopIndex === this.shopItems.length;
    rows.push(`<li class="${leaveSel ? 'sel' : ''}"><span>${leaveSel ? '&gt; ' : '&nbsp;&nbsp;'}Leave</span></li>`);
    this.el.shopList.innerHTML = rows.join('');
    const item = ITEMS[this.shopItems[this.shopIndex]];
    this.el.shopDesc.textContent = item ? item.desc : 'Come back anytime!';
  }

  closeShop() {
    this.el.shop.hidden = true;
    this.mode = null;
  }
}
