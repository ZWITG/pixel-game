import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { ITEMS, LOOT, SHOPS } from '../data/items.js';
import { tryBuy, trySell, sellAll, bagCount, bagValue } from '../systems/shop.js';
import { ICONS, iconSvg } from '../art/icons.js';
import { prompt, buttonHtml, keyHtml } from './glyphs.js';
import { controllerSvg, keyboardHtml } from './controllerMap.js';

const TYPE_SPEED = 45;   // dialogue characters per second
const FLOAT_TIME = 0.8;  // seconds a damage number stays up
const $ = (id) => document.getElementById(id);

// HTML overlay: stats, hints, banner, talk prompt, lock-on target, floating numbers,
// dialogue box, shop, controls screen, game over.
export default class Hud {
  constructor(game) {
    this.game = game;
    this.store = game.store;
    this.mode = null; // null | 'dialogue' | 'shop' | 'controls'
    this.floats = [];
    this.promptTarget = null;
    this.v = new THREE.Vector3();
    this.el = {
      hearts: $('hearts'), level: $('level'), lv: $('lv'), xpfill: $('xpfill'),
      coins: $('coins'), coinCount: $('coin-count'), bagInfo: $('bag-info'), satchelInfo: $('satchel-info'),
      cam: $('cam-hint'), actionHint: $('action-hint'), banner: $('banner'),
      prompt: $('prompt'), floats: $('floats'), flash: $('flash'),
      target: $('target'), targetName: $('target-name'), targetFill: $('target-fill'),
      dlg: $('dialogue'), dlgName: $('dlg-name'), dlgText: $('dlg-text'), dlgMore: $('dlg-more'),
      shop: $('shop'), shopTitle: $('shop-title'), shopCoins: $('shop-coins'), shopTabs: $('shop-tabs'),
      shopList: $('shop-list'), shopDesc: $('shop-desc'), shopMsg: $('shop-msg'), shopHint: $('shop-hint'),
      controls: $('controls'), padMap: $('pad-map'), keyMap: $('key-map'), controlsHint: $('controls-hint'),
      gameOver: $('gameover'), gameOverLoot: $('gameover-loot'), gameOverHint: $('gameover-hint'),
    };
    $('coin-icon').innerHTML = iconSvg(ICONS.coin);
    this.el.coins.hidden = !FEATURES.coins;
    this.el.level.hidden = !FEATURES.leveling;
    this.el.padMap.innerHTML = controllerSvg();
    this.el.keyMap.innerHTML = keyboardHtml();
    this.store.on(() => this.refresh());
  }

  reset() {
    this.mode = null;
    this.el.dlg.hidden = true;
    this.el.shop.hidden = true;
    this.el.controls.hidden = true;
    for (const f of this.floats) f.div.remove();
    this.floats = [];
    this.refresh();
  }

  refresh() {
    const s = this.store;
    if (s.get('hp') === undefined || s.get('bag') === undefined) return; // stats still being set up
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
    const drops = bagCount(s.get('bag'));
    this.el.bagInfo.textContent = drops ? `Drops x${drops}` : '';
    const satchel = this.game.satchel;
    this.el.satchelInfo.textContent = satchel ? `Satchel: ${this.lootText(satchel.coins, satchel.bag)}` : '';
    this.el.gameOver.hidden = !s.get('dead');
    if (s.get('dead')) this.renderGameOver();
    if (this.mode === 'shop') this.renderShop();
  }

  lootText(coins, bag) {
    const drops = bagCount(bag);
    return [coins ? `${coins} coins` : '', drops ? `${drops} drops` : ''].filter(Boolean).join(' + ');
  }

  renderGameOver() {
    const s = this.store, lines = [];
    if (FEATURES.lootDrop) {
      const lost = this.lootText(s.get('coins'), s.get('bag'));
      if (lost) lines.push(`You dropped ${lost}.`, 'Go back and pick them up!');
      if (this.game.satchel) lines.push('Your last satchel is gone for good.');
    }
    this.el.gameOverLoot.textContent = lines.join('\n');
  }

  setCamMode(mode) {
    this.el.cam.hidden = !FEATURES.topDownCamera;
    this.el.cam.textContent = `Camera: ${mode === 'top' ? 'top-down' : 'behind'}`;
  }

  // Button prompts follow the device used last, so they change when you pick up the controller.
  renderPrompts() {
    const d = this.game.controls.device, locked = !!this.game.lockOn.target;
    const key = `${d}/${locked}`;
    if (key === this.promptsKey) return;
    this.promptsKey = key;
    const p = (action) => prompt(action, d);
    const tips = [];
    if (FEATURES.combat) tips.push(`${p('attack')} Attack`);
    if (FEATURES.spinSlash) tips.push(`${p('spin')} Spin`);
    if (FEATURES.dodgeRoll) tips.push(`${p('dodge')} Roll`);
    if (FEATURES.lockOn) {
      tips.push(`${p('lock')} ${locked ? 'Unlock' : 'Lock on'}`);
      if (locked) tips.push(`${d === 'pad' ? buttonHtml('FLICK_LEFT') : keyHtml('KeyZ') + keyHtml('KeyX')} Switch`);
    }
    tips.push(`${p('recenter')} Recenter`);
    if (FEATURES.topDownCamera) tips.push(`${p('camera')} View`);
    tips.push(`${p('pause')} Controls`);
    this.el.actionHint.innerHTML = tips.join('&nbsp; ');
    this.el.prompt.innerHTML = `${p('interact')} Talk`;
    const tabs = d === 'pad' ? `${buttonHtml('L1')}${buttonHtml('R1')}` : `${keyHtml('KeyA')}${keyHtml('KeyD')}`;
    const choose = d === 'pad' ? buttonHtml('UP') : `${keyHtml('KeyW')}${keyHtml('KeyS')}`;
    this.el.shopHint.innerHTML = `${choose} choose &nbsp;${p('confirm')} ok &nbsp;${tabs} buy/sell &nbsp;${p('back')} leave`;
    this.el.controlsHint.innerHTML = `${p('back')} close`;
    const home = FEATURES.lootDrop && this.game.village ? ` in ${this.game.village.name}` : '';
    this.el.gameOverHint.innerHTML = `Press ${p('restart')} to rise again${home}`;
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
    this.renderPrompts();
    for (const f of this.floats) {
      f.age += dt;
      this.place(f.div, f.x, f.y + f.age * 1.2, f.z);
      f.div.style.opacity = 1 - f.age / FLOAT_TIME;
    }
    this.floats = this.floats.filter((f) => (f.age < FLOAT_TIME ? true : (f.div.remove(), false)));

    const npc = this.mode ? null : this.promptTarget;
    this.el.prompt.style.display = npc ? 'block' : 'none';
    if (npc) this.place(this.el.prompt, npc.x, 1.55, npc.z);

    const target = this.mode ? null : this.game.lockOn.target;
    this.el.target.style.display = target ? 'block' : 'none';
    if (target) {
      this.place(this.el.target, target.x, 1.5, target.z);
      this.el.targetName.textContent = target.def.name;
      this.el.targetFill.style.width = `${Math.max(0, target.hp / target.def.hp) * 100}%`;
    }

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
    } else if (this.mode === 'controls') {
      if (just.back || just.pause || just.confirm) this.closeControls();
    } else if (this.mode === 'shop') {
      if (this.sells() && (just.left || just.right)) {
        this.shopTab = this.shopTab === 'buy' ? 'sell' : 'buy';
        this.shopIndex = 0;
        this.el.shopMsg.textContent = '';
      }
      const rows = this.shopRows();
      if (just.up) this.shopIndex = (this.shopIndex + rows.length - 1) % rows.length;
      if (just.down) this.shopIndex = (this.shopIndex + 1) % rows.length;
      if (just.back) return this.closeShop();
      if (just.confirm) {
        const row = rows[this.shopIndex];
        if (row.leave) return this.closeShop();
        if (row.act) {
          const result = row.act();
          this.el.shopMsg.textContent = result.msg;
          this.el.shopMsg.style.color = result.ok ? '#a7f070' : '#ff6b6b';
        }
      }
      this.renderShop();
    }
  }

  // ---- Controls screen ----

  openControls() {
    this.mode = 'controls';
    this.el.controls.hidden = false;
  }

  closeControls() {
    this.el.controls.hidden = true;
    this.mode = null;
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

  // ---- Shop: a Buy tab, and a Sell tab for monster drops when the shop buys them ----

  openShop(shopId) {
    this.shop = SHOPS[shopId];
    this.mode = 'shop';
    this.shopTab = 'buy';
    this.shopIndex = 0;
    this.el.shopTitle.textContent = this.shop.title;
    this.el.shopMsg.textContent = '';
    this.el.shop.hidden = false;
    this.renderShop();
  }

  sells() {
    return FEATURES.monsterDrops && this.shop.buysLoot;
  }

  // Each row: { label, right, desc, dim, act() -> { ok, msg }, leave }
  shopRows() {
    const s = this.store, rows = [];
    if (this.shopTab === 'buy') {
      for (const id of this.shop.items) {
        const item = ITEMS[id], sold = item.once && s.get('owned').includes(id);
        rows.push({ label: item.name, right: sold ? 'OWNED' : `${item.price}c`, desc: item.desc, dim: sold, act: () => tryBuy(s, id, item) });
      }
    } else {
      const bag = s.get('bag');
      for (const [id, n] of Object.entries(bag)) {
        const item = LOOT[id];
        rows.push({ label: `${item.name} x${n}`, right: `${item.value}c`, desc: item.desc, act: () => trySell(s, id, item) });
      }
      if (rows.length) rows.push({ label: 'Sell all', right: `${bagValue(bag, LOOT)}c`, desc: 'Sell every drop you carry.', act: () => sellAll(s, LOOT) });
      else rows.push({ label: 'Nothing to sell', desc: 'Bring me monster drops and I pay in coins!', dim: true });
    }
    rows.push({ label: 'Leave', desc: 'Come back anytime!', leave: true });
    return rows;
  }

  renderShop() {
    const rows = this.shopRows();
    this.shopIndex = Math.min(this.shopIndex, rows.length - 1);
    this.el.shopCoins.textContent = `Coins: ${this.store.get('coins')}`;
    this.el.shopTabs.hidden = !this.sells();
    this.el.shopTabs.innerHTML = ['buy', 'sell'].map((t) => `<span class="${t === this.shopTab ? 'sel' : ''}">${t.toUpperCase()}</span>`).join('');
    this.el.shopList.innerHTML = rows.map((row, i) => {
      const sel = i === this.shopIndex;
      const cls = [sel ? 'sel' : '', row.dim ? 'owned' : ''].join(' ');
      return `<li class="${cls}"><span>${sel ? '&gt; ' : '&nbsp;&nbsp;'}${row.label}</span><span>${row.right ?? ''}</span></li>`;
    }).join('');
    this.el.shopDesc.textContent = rows[this.shopIndex].desc;
  }

  closeShop() {
    this.el.shop.hidden = true;
    this.mode = null;
  }
}
