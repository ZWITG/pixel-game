import { ITEMS, RECIPES, SLOTS } from './items.js';
import { icon, number, ICONS } from './skillMap.js';
import { prompt } from '../ui/glyphs.js';

// The Satchel: a pixel page with two tabs. Bag shows what you carry and wear; Craft shows what
// you can make, with each ingredient's count. Names and effects sit below it as plain text.
const W = 320, H = 180;
const COLS = 6, ROWS = 4, SLOT = 25, GRID_X = 12, GRID_Y = 26, WEAR_Y = 134;
const INK = '#120d14', PAPER = '#2a1f26', PAPER_HI = '#3a2c30', SLOT_BG = '#1a1318', EDGE = '#5a4638', GOLD = '#ffb547';
const BAD = '#ff6f6f', GOOD = '#8fd86a', DIM = '#6a5a60';

function bigIcon(g, name, x, y, scale) {
  ICONS[name].forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch === '#') g.fillRect(x + (rx - 4) * scale, y + (ry - 4) * scale, scale, scale);
  }));
}

export default class PackPage {
  constructor(canvas, tag, info, hints) {
    Object.assign(this, { tag, info, hints });
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext('2d');
    this.tab = 0;
    this.at = 0;
    this.shown = '';
  }

  open(player) {
    this.player = player;
    this.tab = 0;
    this.at = 0;
    const p = (action) => prompt(action, player.controls.device);
    this.hints.innerHTML = `${p('confirm')} Use, wear or craft&nbsp;&nbsp; ${p('punch')} Drop&nbsp;&nbsp; ${p('packTab')} Bag or Craft&nbsp;&nbsp; ${p('back')} Close`;
  }

  get entries() {
    const { bag } = this.player;
    return Object.keys(ITEMS).filter((id) => bag.items[id] > 0);
  }

  // What the cursor is on: { item } in the bag, { worn } in a gear slot, or { recipe }.
  get pick() {
    const { bag } = this.player;
    if (this.tab === 1) return { recipe: RECIPES[this.at] };
    if (this.at >= COLS * ROWS) {
      const slot = SLOTS[this.at - COLS * ROWS];
      return { slot, worn: bag.worn[slot.id] };
    }
    return { item: this.entries[this.at] };
  }

  move(dx, dy) {
    const count = this.tab === 1 ? RECIPES.length : COLS * ROWS + SLOTS.length;
    let { at } = this;
    const wearing = this.tab === 0 && at >= COLS * ROWS;
    if (wearing) {
      const c = at - COLS * ROWS;
      if (dy < 0) at = COLS * (ROWS - 1) + Math.min(c, COLS - 1);
      else at = COLS * ROWS + Math.max(0, Math.min(SLOTS.length - 1, c + dx));
    } else {
      const c = at % COLS, r = Math.floor(at / COLS);
      if (dx) at = r * COLS + Math.max(0, Math.min(COLS - 1, c + dx));
      if (dy) at = this.tab === 0 && r + dy >= ROWS ? COLS * ROWS + Math.min(c, SLOTS.length - 1) : Math.max(0, at + dy * COLS);
    }
    if (at < count) this.at = at;
  }

  handle(just) {
    const p = this.player, { bag, hud } = p;
    if (just.packTab) {
      this.tab = 1 - this.tab;
      this.at = 0;
      return;
    }
    if (just.left) this.move(-1, 0);
    if (just.right) this.move(1, 0);
    if (just.up) this.move(0, -1);
    if (just.down) this.move(0, 1);
    const { item, worn, slot, recipe } = this.pick;
    if (just.confirm) {
      if (recipe) p.craft(recipe);
      else if (slot && worn) bag.unequip(slot.id);
      else if (item && ITEMS[item].kind === 'gear') bag.equip(item);
      else if (item && ITEMS[item].kind === 'use') p.consume(item);
      hud.setBag(bag);
    } else if (just.punch && item) {
      bag.remove(item, 1);
      hud.setBag(bag);
    }
  }

  slotBox(x, y, on) {
    const g = this.g;
    g.fillStyle = on ? GOLD : EDGE;
    g.fillRect(x, y, SLOT - 3, SLOT - 3);
    g.fillStyle = SLOT_BG;
    g.fillRect(x + 1, y + 1, SLOT - 5, SLOT - 5);
  }

  thing(id, x, y, on, faded) {
    const g = this.g, def = ITEMS[id];
    this.slotBox(x, y, on);
    g.fillStyle = faded ? DIM : def.color;
    icon(g, def.icon, x + 11, y + 10);
  }

  drawBag() {
    const g = this.g, { bag, body } = this.player, ids = this.entries;
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = GRID_X + (i % COLS) * SLOT, y = GRID_Y + Math.floor(i / COLS) * SLOT, on = this.at === i;
      if (!ids[i]) {
        this.slotBox(x, y, on);
        continue;
      }
      this.thing(ids[i], x, y, on);
      g.fillStyle = '#f3ead8';
      number(g, bag.items[ids[i]], x + 2, y + 15);
    }
    SLOTS.forEach((s, i) => {
      const x = GRID_X + i * SLOT, on = this.at === COLS * ROWS + i, worn = bag.worn[s.id];
      if (worn) this.thing(worn, x, WEAR_Y, on);
      else {
        this.slotBox(x, WEAR_Y, on);
        g.fillStyle = '#3f3238';
        icon(g, s.icon, x + 11, WEAR_Y + 10);
      }
    });
    // How full the bag is.
    const fill = Math.min(1, bag.weight / body.carry);
    g.fillStyle = INK;
    g.fillRect(GRID_X, 162, COLS * SLOT - 3, 6);
    g.fillStyle = fill >= 1 ? BAD : GOLD;
    g.fillRect(GRID_X + 1, 163, Math.round((COLS * SLOT - 5) * fill), 4);
  }

  drawCraft() {
    const g = this.g, p = this.player;
    RECIPES.forEach((r, i) => {
      const x = GRID_X + (i % COLS) * SLOT, y = GRID_Y + Math.floor(i / COLS) * SLOT;
      this.thing(r.id, x, y, this.at === i, !p.canCraft(r));
      if (r.bench) {
        g.fillStyle = p.rooms.house ? GOOD : DIM;
        g.fillRect(x + 16, y + 16, 3, 3);
      }
    });
  }

  drawDetail(id, needs) {
    const g = this.g, x = 236;
    if (!id) return;
    g.fillStyle = ITEMS[id].color;
    bigIcon(g, ITEMS[id].icon, x, 60, 4);
    if (!needs) return;
    const p = this.player;
    Object.entries(needs).forEach(([need, n], i) => {
      const y = 104 + i * 16, have = p.bag.count(need, !!p.rooms.house);
      g.fillStyle = ITEMS[need].color;
      icon(g, ITEMS[need].icon, x - 30, y + 3);
      g.fillStyle = have >= n ? GOOD : BAD;
      number(g, have, x - 18, y);
      g.fillRect(x - 18 + String(have).length * 4 + 1, y + 4, 2, 1);
      number(g, n, x - 18 + String(have).length * 4 + 5, y);
    });
  }

  say(tag, info) {
    const key = `${tag}|${info}`;
    if (key === this.shown) return;
    this.shown = key;
    this.tag.textContent = tag;
    this.info.textContent = info;
  }

  update() {
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);
    g.fillStyle = PAPER;
    g.fillRect(4, 4, W - 8, H - 8);
    g.fillStyle = PAPER_HI;
    g.fillRect(170, 16, 140, 156);
    // Tabs: the bag, then the hammer.
    [['pack', 0], ['hammer', 1]].forEach(([name, i]) => {
      const x = GRID_X + i * 26, on = this.tab === i;
      g.fillStyle = on ? PAPER_HI : SLOT_BG;
      g.fillRect(x, 7, 24, 15);
      g.fillStyle = on ? GOLD : DIM;
      icon(g, name, x + 12, 14);
    });
    const { item, worn, recipe, slot } = this.pick;
    if (this.tab === 0) this.drawBag();
    else this.drawCraft();
    const id = recipe?.id ?? worn ?? item;
    this.drawDetail(id, recipe?.needs);
    const def = ITEMS[id];
    if (!def) return this.say(slot ? slot.name : '', slot ? 'Nothing worn here.' : '');
    const where = recipe?.bench && !this.player.rooms.house ? ' Make this inside a house.' : '';
    this.say(def.name, `${def.text ?? 'Material for crafting.'}${where}`);
  }
}
