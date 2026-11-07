import { GOODS } from './economy.js';
import { ITEMS } from './items.js';
import { itemOf } from './caravans.js';
import { TIERS, tierOf } from './settlements.js';
import { prompt } from '../ui/glyphs.js';

// Trading, with a town's market or with traders met on the road. A town buys and sells at its
// own prices less a margin, so carrying grain from where it's cheap to where it's short pays,
// and buying a place out of food is a way to starve it.
const MARGIN = 0.12;          // a market buys this much under its price and sells this much over
const BULK = 5;

export default class Market {
  constructor(player, prefix) {
    this.player = player;
    this.at = 0;
    this.box = document.createElement('div');
    this.box.className = 'market';
    this.box.id = `${prefix}market`;
    this.box.hidden = true;
    document.body.appendChild(this.box);
  }

  get isOpen() {
    return !this.box.hidden;
  }

  open(view) {
    this.view = view;
    this.at = 0;
    this.box.hidden = false;
    this.player.hud.marketOpen = true;
    this.player.world.checkPause();
    this.draw();
  }

  close() {
    this.box.hidden = true;
    this.player.hud.marketOpen = false;
    this.player.world.checkPause();
  }

  get rows() {
    const { place, run, menu } = this.view;
    if (menu) return menu.rows;
    if (place) return Object.keys(GOODS).filter((g) => ITEMS[itemOf(g)]);
    const c = this.player.world.caravans, econ = this.player.world.realm.economy;
    return [
      { label: `Buy their load: ${Math.floor(run.qty)} ${GOODS[run.good].name.toLowerCase()} at ${Math.round(run.buy * 1.25)} gold each`, act: () => c.buyLoad(run, this.player) },
      { label: `Demand a toll (they're carrying about ${Math.round(econ.worthOf(run))} gold of goods)`, act: () => c.extort(run, this.player), done: true },
      { label: `Offer to guard them to ${run.to.name}`, act: () => c.escort(run, this.player), done: true },
      { label: 'Leave them be', act: () => {}, done: true },
    ];
  }

  price(g, selling) {
    // Towns that fear the hero charge more (the Omega Level).
    return Math.max(1, Math.round(this.view.place.price[g] * (selling ? 1 - MARGIN : (1 + MARGIN) * (this.player.world.omega?.priceFactor() ?? 1))));
  }

  handle(just) {
    const rows = this.rows;
    if (just.back) return this.close();
    if (just.up) this.at = (this.at + rows.length - 1) % rows.length;
    if (just.down) this.at = (this.at + 1) % rows.length;
    if (this.view.run || this.view.menu) {
      if (just.confirm || just.interact) {
        const row = rows[this.at], view = this.view;
        row.act();
        if (this.view !== view) return undefined; // it opened another screen
        if (row.done || (view.run && !this.player.world.realm.economy.runs.includes(view.run))) return this.close();
      }
    } else {
      const g = rows[this.at];
      if (just.confirm || just.interact) this.buy(g, 1);
      else if (just.right) this.buy(g, BULK);
      else if (just.punch) this.sell(g, 1);
      else if (just.left) this.sell(g, BULK);
    }
    return this.draw();
  }

  buy(g, count) {
    const { bag, hud } = this.player, s = this.view.place, item = itemOf(g);
    let got = 0;
    for (let i = 0; i < count; i++) {
      const cost = this.price(g, false);
      if (s.stock[g] < 1 || bag.gold < cost || !bag.add(item, 1)) break;
      bag.gold -= cost;
      s.stock[g] -= 1;
      s.price[g] = this.player.world.realm.economy.priceOf(s, g);
      got++;
    }
    bag.save();
    if (!got) hud.message(s.stock[g] < 1 ? 'They have none left.' : bag.gold < this.price(g, false) ? 'You can\'t afford it.' : 'You can carry no more.');
  }

  sell(g, count) {
    const { bag, hud } = this.player, s = this.view.place, item = itemOf(g);
    let sold = 0;
    for (let i = 0; i < count && (bag.items[item] ?? 0) > 0; i++) {
      bag.remove(item, 1);
      bag.gold += this.price(g, true);
      s.stock[g] += 1;
      s.price[g] = this.player.world.realm.economy.priceOf(s, g);
      sold++;
    }
    bag.save();
    if (!sold) hud.message(`You have no ${ITEMS[item].name.toLowerCase()} to sell.`);
  }

  draw() {
    const { bag, controls } = this.player, p = (a) => prompt(a, controls.device), { place, menu } = this.view, run = this.view.run ?? menu;
    const head = menu
      ? `<h2>${menu.title}</h2><p>${menu.sub} · you have <b>${Math.round(bag.gold)} gold</b></p>`
      : place
      ? `<h2>${place.name} market</h2><p>${TIERS[tierOf(place.pop)].name} of ${Math.round(place.pop)} · prosperity ${Math.round(place.prosperity * 100)}% · you have <b>${Math.round(bag.gold)} gold</b> · carrying ${Math.round(bag.weight)} of ${Math.round(this.player.body.carry)}</p>`
      : `<h2>${run.kind} bound for ${run.to.name}</h2><p>From ${run.from.name}, carrying ${Math.floor(run.qty)} ${GOODS[run.good].name.toLowerCase()} · you have <b>${Math.round(bag.gold)} gold</b></p>`;
    const rows = this.rows.map((row, i) => {
      if (run) return `<div class="row ${i === this.at ? 'at' : ''}"><span>${row.label}</span></div>`;
      const g = row, n = Math.floor(place.stock[g]), mine = bag.items[itemOf(g)] ?? 0, ratio = place.price[g] / GOODS[g].base;
      const mood = ratio > 1.8 ? 'dear' : ratio < 0.6 ? 'cheap' : '';
      return `<div class="row ${i === this.at ? 'at' : ''}"><i style="background:${GOODS[g].color}"></i><span>${GOODS[g].name}</span><em class="${mood}">${mood}</em><u>${n} here</u><b>buy ${this.price(g, false)}g</b><b>sell ${this.price(g, true)}g</b><u>you ${mine}</u></div>`;
    }).join('');
    const hints = run ? `${p('confirm')} Choose&nbsp;&nbsp; ${p('back')} Leave` : `${p('confirm')} Buy 1&nbsp;&nbsp; ${p('right')} Buy ${BULK}&nbsp;&nbsp; ${p('punch')} Sell 1&nbsp;&nbsp; ${p('left')} Sell ${BULK}&nbsp;&nbsp; ${p('back')} Close`;
    this.box.innerHTML = `<div class="market-box">${head}<div class="rows">${rows}</div><div class="hints">${hints}</div></div>`;
  }
}
