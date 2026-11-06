import { PLACES, TOWNS, WORLD } from './terrain.js';
import { prompt } from '../ui/glyphs.js';
import { QUALITY, saveSettings } from './startMenu.js';
import { svg, MAX_RANK } from './powers.js';
import { NATIONS, nationAt, COUNTRY } from './nations.js';
import { DOCTRINES } from './doctrines.js';
import { TIERS, tierOf } from './settlements.js';
import { GOODS } from './economy.js';
import { SKILLS } from './skills.js';

// The menu in play: one row of icon tabs over the map, the Spirit Tree, the Satchel, the
// buttons and the settings. Add a tab by adding an entry to TABS and a case in `show`.
const SVG = (d, size = 26) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${d}"/></svg>`;
const SHAPES = {
  map: 'M2 6.500 8.500 3l7 3.500L22 3v14.500L15.500 21l-7-3.500L2 21zM8 5.500v10.700l-4 2.200V7.600zm2 0v10.800l4 2V8zm6 2.400v10.400l4-2.100V5.700z',
  powers: 'M13 1.500s1.200 4.300-1.800 7.300S6 13.800 6 16.800a6.200 6.200 0 0 0 12.400.200c0-3.500-2.300-6.300-3.200-8.500-.2 1.700-.8 2.800-1.900 3.300.8-3.600.6-7.700-.3-10.300z',
  skills: 'M12 2l7 9h-4l5 7h-6v4h-4v-4H4l5-7H5z',
  nations: 'M5 2h2v20H5zm3 1h12l-3 4.500L20 12H8z',
  crown: 'M2 7l5 5 5-8 5 8 5-5-2 13H4z',
  satchel: 'M8 8V6.500a4 4 0 0 1 8 0V8h3.200L21 21.500H3L4.800 8zm2 0h4V6.500a2 2 0 0 0-4 0zm.5 4v3h3v-3z',
  controls: 'M7 6.500h10a5 5 0 0 1 5 4.800l.8 6.400a3 3 0 0 1-5.300 2.200L16 18H8l-1.500 1.900a3 3 0 0 1-5.300-2.200l.8-6.400a5 5 0 0 1 5-4.800zM6.500 9v2h-2v2h2v2h2v-2h2v-2h-2V9zM16 12.500a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600zm2.500-3a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600z',
  settings: 'M10.300 2h3.400l.5 2.600 1.900.8 2.200-1.500 2.400 2.400-1.500 2.200.8 1.900 2.600.5v3.400l-2.600.5-.8 1.900 1.500 2.200-2.400 2.400-2.200-1.500-1.900.8-.5 2.600h-3.400l-.5-2.600-1.900-.8-2.200 1.500-2.400-2.400 1.500-2.200-.8-1.900L1.400 13.700v-3.400L4 9.800l.8-1.900L3.300 5.700l2.400-2.400 2.200 1.500 1.900-.8zM12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7z',
  city: 'M3 21V8h3v3h3V8h6v3h3V8h3v13h-7v-5a2 2 0 0 0-4 0v5z',
  kingdom: 'M2 21V10l3 2 3-6 4 4 4-4 3 6 3-2v11zM12 13a2 2 0 0 0-2 2v6h4v-6a2 2 0 0 0-2-2z',
  town: 'M8 4 1 11h2v10h5v-5h2v5h3V11h1zM17 9l-3 3v9h9v-9h-1z',
  hamlet: 'M12 7l-8 7h2v7h12v-7h2z',
  gifts: 'M12 2l2.6 6.6L22 9.4l-5.4 4.8 1.6 7.3L12 17.7l-6.2 3.8 1.6-7.3L2 9.4l7.4-.8z',
  cart: 'M2 8h13v8H2zM15 11h4l3 3v2h-7zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  fort: 'M3 21V9l2-4 2 4v2h2V9l3-5 3 5v2h2V9l2-4 2 4v12h-6v-5h-6v5z',
  village: 'M12 3 2 12h3v9h5v-6h4v6h5v-9h3z',
  bandit: 'M12 4 2 20h7l3-6 3 6h7z',
  keep: 'M7 21V9L5 7V3h3v2h2V3h4v2h2V3h3v4l-2 2v12z',
  lair: 'M12 2a9 9 0 0 0-6 15.700V21h3v-2h2v2h2v-2h2v2h3v-3.300A9 9 0 0 0 12 2zM8.500 14a2.500 2.500 0 1 1 0-5 2.500 2.500 0 0 1 0 5zm7 0a2.500 2.500 0 1 1 0-5 2.500 2.500 0 0 1 0 5z',
  landmark: 'M12 2l3 7 7 .7-5.300 4.700 1.600 7.100L12 17.800l-6.300 3.700 1.600-7.100L2 9.700 9 9z',
  goal: 'M12 2 22 12 12 22 2 12z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
};
const TABS = [['map', 'Map'], ['nations', 'Nations'], ['powers', 'Powers'], ['gifts', 'Gifts'], ['skills', 'Skills'], ['satchel', 'Satchel'], ['controls', 'Controls'], ['settings', 'Settings']];
export const SATCHEL_TAB = 5;
const TERRITORY = 128;      // cells across the map's overlay of borders
const POWER_COLS = 4, DIRS = ['up', 'right', 'down', 'left'], DIR_NAMES = ['Up', 'Right', 'Down', 'Left'];
// What a place is short of and has plenty of, for the map.
function marketLine(economy, s) {
  const { short, cheap } = economy.outlook(s), name = (g) => GOODS[g].name.toLowerCase();
  return `${short.length ? ` · short of ${short.map(name).join(', ')}` : ''}${cheap.length ? ` · cheap ${cheap.map(name).join(', ')}` : ''}`;
}

const KINDS = {
  crown: ['#ffd98a', 'Seat of a nation'], kingdom: ['#ffe7b0', 'Kingdom'], city: ['#ffe7b0', 'City'], town: ['#ffd9a0', 'Town'], village: ['#ffd9a0', 'Village'], hamlet: ['#e8ddc8', 'Hamlet or homestead'],
  fort: ['#ff8f7f', 'Fort'], bandit: ['#ff8f7f', 'Bandit camp'], keep: ['#d8d0c8', 'Ruined keep'], lair: ['#ff4a6a', 'Lair'], landmark: ['#9fe8ff', 'Landmark'], goal: ['#ffffff', 'Place you have found'], cart: ['#ffe7a0', 'Trader on the road'], pin: ['#ffe15a', 'Your pin'],
};
// The icon and size for each tier of a settlement, from homestead to kingdom.
const TIER_ICONS = [['hamlet', 0.72], ['hamlet', 0.84], ['village', 1], ['town', 1.1], ['city', 1.26], ['kingdom', 1.5]];
const SCAR_COLORS = [['burn', '#ff7a2a', 'Burning'], ['char', '#1a1412', 'Ash'], ['frost', '#dff4ff', 'Frost and ice'], ['rot', '#7a2ac8', 'Rot']];
const YOURS = '#f7efdf';
const HINTS = [['Auto', 'auto'], ['Always', 'always'], ['Off', 'off']];
const ZOOMS = [1, 2.4, 5];
const CURSOR_SPEED = 0.55;  // screens per second
const NEAR_PX = 22;         // how close the cursor must be to read a place
const ICON = 22;            // size of a map icon, in screen pixels
const PIN_REACHED = 14;     // tiles from a pin that clear it
const SURVEY_AFTER = 2500;  // ms after load before the map starts drawing itself

const paths = Object.fromEntries(Object.entries(SHAPES).map(([k, d]) => [k, new Path2D(d)]));
const LANDMARKS = Object.values(PLACES).filter((p) => p.name !== PLACES.lake.name);

export default class GameMenu {
  // actions: { world, settings, onQuality, applySettings, rows, toTitle }
  constructor(actions) {
    Object.assign(this, actions);
    this.box = document.getElementById('menu');
    this.page = document.getElementById('menu-page');
    this.hints = document.getElementById('menu-hints');
    this.tabs = document.getElementById('menu-tabs');
    this.mapBox = document.getElementById('menu-map');
    this.canvas = document.getElementById('menu-canvas');
    this.g = this.canvas.getContext('2d');
    this.owner = null;
    this.tab = 0;
    this.zoom = 0;
    this.at = 0;
    this.sure = false;
    this.cursor = null;
    this.chart = document.createElement('canvas');
    this.lands = document.createElement('canvas');
    this.lands.width = this.lands.height = TERRITORY;
    this.landsOf = -1;
    this.charted = 0;
    this.tabs.innerHTML = TABS.map(([id, label], i) => `<button data-tab="${i}">${SVG(SHAPES[id])}<span>${label}</span></button>`).join('');
    this.tabs.addEventListener('click', (e) => {
      const at = e.target.closest('[data-tab]');
      if (at) this.show(Number(at.dataset.tab));
    });
    document.getElementById('menu-legend').innerHTML = Object.entries(KINDS).map(([k, [color, label]]) => `<div><i style="color:${color}">${SVG(SHAPES[k], 18)}</i>${label}</div>`).join('')
      + `<p class="legend-note">Colors show who holds a place. Pale is yours.</p>`
      + SCAR_COLORS.map(([, color, label]) => `<div><u style="background:${color}"></u>${label}</div>`).join('');
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect(), k = this.canvas.width / r.width, [ox, oy, s] = this.view();
      this.cursor = { x: (((e.clientX - r.left) * k - ox) / s) * WORLD, z: (((e.clientY - r.top) * k - oy) / s) * WORLD };
    });
    this.page.addEventListener('click', (e) => {
      const at = e.target.closest('[data-at]'), card = e.target.closest('[data-card]'), slot = e.target.closest('[data-slot]');
      if (at) {
        this.at = Number(at.dataset.at);
        this.choose(1);
      } else if (card) {
        this.at = Number(card.dataset.card);
        this.assigning = false;
        this.drawPage();
      } else if (slot && this.assigning) this.place(Number(slot.dataset.slot));
    });
    setTimeout(() => this.survey(), SURVEY_AFTER);
  }

  // The chart is drawn once, off to the side, and fills in strip by strip.
  survey() {
    const w = new Worker(new URL('./mapWorker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data: { row, rows, size, data } }) => {
      if (!this.charted) this.chart.width = this.chart.height = size;
      this.chart.getContext('2d').putImageData(new ImageData(data, size, rows), 0, row);
      this.charted = row + rows;
      if (this.charted >= size) w.terminate();
    };
    w.postMessage(0);
  }

  get isOpen() {
    return !!this.owner;
  }

  open(player, tab) {
    this.owner = player;
    this.box.hidden = false;
    document.body.classList.add('in-menu');
    this.cursor = { x: player.state.x, z: player.state.z };
    this.world.checkPause();
    this.show(tab ?? this.tab);
  }

  // Leaves whatever page the old tab had open.
  leaveTab() {
    const { hud } = this.owner;
    if (hud.mapOpen) hud.toggle();
    if (hud.packOpen) hud.togglePack(this.owner);
  }

  close() {
    const p = this.owner;
    this.leaveTab();
    this.owner = null;
    this.box.hidden = true;
    document.body.classList.remove('in-menu');
    for (const key of Object.keys(p.controls.just)) p.controls.just[key] = false; // the press that closed it isn't also a jump
    this.world.checkPause();
  }

  show(tab) {
    const p = this.owner, id = TABS[tab][0];
    this.leaveTab();
    this.tab = tab;
    this.sure = false;
    this.at = 0;
    this.device = p.controls.device;
    [...this.tabs.children].forEach((el, i) => el.classList.toggle('at', i === tab));
    this.mapBox.hidden = id !== 'map';
    this.page.hidden = id !== 'controls' && id !== 'settings' && id !== 'powers' && id !== 'gifts' && id !== 'nations';
    this.assigning = false;
    if (id === 'skills') p.hud.toggle(p.skills.all(), p.body);
    if (id === 'satchel') {
      p.hud.togglePack(p);
      const key = (action) => prompt(action, p.controls.device);
      p.hud.pack.hints.innerHTML = `${key('confirm')} Use, wear or craft&nbsp;&nbsp; ${key('punch')} Drop&nbsp;&nbsp; ${key('pack')} Bag or Craft&nbsp;&nbsp; ${key('back')} Close`;
    }
    this.world.checkPause();
    if (id === 'map') this.fit();
    this.drawPage();
    this.drawHints();
  }

  fit() {
    const r = this.canvas.getBoundingClientRect(), k = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * k));
    this.canvas.height = Math.max(1, Math.round(r.height * k));
    this.scale = k;
  }

  drawHints() {
    const p = (action) => prompt(action, this.device), id = TABS[this.tab][0];
    document.getElementById('menu-prev').innerHTML = p('menuLeft');
    document.getElementById('menu-next').innerHTML = p('menuRight');
    const pin = this.owner.pin;
    const own = { map: `${p('confirm')} ${pin ? 'Remove pin' : 'Drop pin'}&nbsp;&nbsp; ${p('punch')} Zoom&nbsp;&nbsp;`, satchel: '', powers: '', controls: '', settings: `${p('confirm')} Change&nbsp;&nbsp;` }[id];
    if (id === 'powers') this.hints.innerHTML = this.assigning ? `${p('left')} ${p('up')} ${p('right')} ${p('down')} Pick a button&nbsp;&nbsp; ${p('back')} Cancel` : `${p('confirm')} Equip&nbsp;&nbsp; ${p('back')} Close`;
    else this.hints.innerHTML = id === 'skills' || id === 'satchel' ? '' : `${own ?? ''}${p('back')} Close`;
  }

  options() {
    const { settings } = this, choice = (list, key) => list.find(([id]) => id === key);
    return [
      { label: 'Graphics', value: choice(QUALITY, settings.quality)[1], note: choice(QUALITY, settings.quality)[2], step: (d) => this.cycle('quality', QUALITY.map(([id]) => id), d) },
      { label: 'Button hints', value: HINTS.find(([, id]) => id === settings.hints)[0], note: 'The list along the bottom of the screen', step: (d) => this.cycle('hints', HINTS.map(([, id]) => id), d) },
      { label: 'Compass', value: settings.compass ? 'On' : 'Off', note: 'Goals, towns and your pin', step: () => this.flip('compass') },
      { label: 'Return to title', value: this.sure ? 'Press again' : '', note: 'Your hero and where you stand are saved', step: () => this.leaveGame(), action: true },
    ];
  }

  cycle(key, list, d) {
    const n = list.length;
    this.settings[key] = list[(list.indexOf(this.settings[key]) + d + n) % n];
    this.saveAndApply();
  }

  flip(key) {
    this.settings[key] = !this.settings[key];
    this.saveAndApply();
  }

  saveAndApply() {
    saveSettings(this.settings);
    this.applySettings();
    this.drawPage();
  }

  leaveGame() {
    if (this.sure) return this.toTitle();
    this.sure = true;
    return this.drawPage();
  }

  drawPage() {
    const id = TABS[this.tab][0];
    if (id === 'controls') {
      const pad = this.owner.controls.device === 'pad';
      this.page.innerHTML = `<div class="menu-rows">${this.rows(pad).map(([key, label]) => `<div>${key}<span>${label}</span></div>`).join('')}</div>`;
    }
    if (id === 'powers') this.drawPowers();
    if (id === 'gifts') this.drawGifts();
    if (id === 'nations') this.drawNations();
    if (id === 'settings') {
      this.page.innerHTML = this.options().map((o, i) => `<button data-at="${i}" class="${i === this.at ? 'at' : ''}"><b>${o.label}</b><small>${o.note}</small><em>${o.action ? o.value : `‹ ${o.value} ›`}</em></button>`).join('');
    }
  }

  choose(d) {
    this.options()[this.at].step(d);
  }

  // Who still stands, how close each is to breaking, and where each ruler sits.
  drawNations() {
    const { nations } = this.world, cards = NATIONS.map((n) => {
      const r = nations.report(n), { realm } = this.world, force = realm.of(n.id), d = DOCTRINES[n.id], state = r.fallen ? 'Conquered' : r.open ? 'Ruler exposed' : force.stance;
      const fill = r.fallen ? 100 : Math.round((r.done / Math.max(1, r.need)) * 100), power = r.fallen ? 0 : Math.round(realm.strength(n.id) * 100);
      const places = realm.placesOf(n.id).length, captain = force.captains.find((c) => c.alive), econ = realm.economy.report(n.id);
      return `<div class="nation ${r.fallen ? 'fallen' : ''}" style="--c:${n.color}">
        <i>${SVG(r.fallen ? SHAPES.nations : SHAPES.crown, 34)}</i>
        <div><b>${n.name}<small> · Level ${n.level}</small></b><span>${d.title}: ${d.style}</span>
        <div class="nation-bar"><u style="width:${fill}%"></u></div>
        <em>${state}${r.fallen || r.open ? '' : ` · ${r.done} of ${r.need} strongholds broken`}</em>
        ${r.fallen ? '' : `<span>Strength ${power}% · ${Math.round(force.troops)} troops · ${places} settlements${captain ? ` · ${captain.title ?? 'Captain'} ${captain.name}` : ''}</span>`}
        ${r.fallen || !econ ? '' : `<span>Treasury ${Math.round(force.gold)}g, ${econ.income >= 0 ? '+' : ''}${Math.round(econ.income)}g a day · Prosperity ${Math.round(econ.prosperity * 100)}% · ${econ.food < 0.6 ? 'Hungry' : econ.food < 0.9 ? 'Short of food' : 'Fed'} · ${Math.round(econ.arms)} arms in store · ${econ.runs} trade runs</span>`}</div>
      </div>`;
    }).join('');
    const { realm } = this.world, count = nations.fallen.size, line = count === NATIONS.length ? 'The country is yours. Something has noticed.' : 'Break a nation\'s strongholds to expose its ruler, then bring the ruler down. They will not wait for you.';
    const news = realm.news.slice(0, 12).map((e) => `<div><i style="background:${e.color}"></i><u>Day ${e.day}</u> ${e.text}</div>`).join('') || '<div>Nothing has happened yet.</div>';
    this.page.innerHTML = `<div class="nations-page"><h2>${COUNTRY}: ${count} of ${NATIONS.length} nations conquered · Day ${realm.day}</h2><p>${line}</p><div class="nation-grid">${cards}</div><h3>Chronicle</h3><div class="chronicle">${news}</div></div>`;
  }

  // The Conqueror's eight powers, and the D-pad cross they're worn on.
  drawPowers() {
    const set = this.owner.powers, c = set.def;
    if (!c) {
      this.page.innerHTML = '';
      return;
    }
    const ids = Object.keys(c.powers), pid = ids[this.at], def = c.powers[pid], rank = set.rank(pid), open = set.open(pid);
    const slots = DIRS.map((dir, i) => {
      const worn = set.loadout[i];
      return `<div data-slot="${i}" class="cross-${dir} ${this.assigning ? 'choosing' : ''}" style="color:${c.color}" title="${worn ? c.powers[worn].name : ''}">${worn ? svg(c.powers[worn].kind, 30) : ''}</div>`;
    }).join('');
    const pips = (id) => Array.from({ length: MAX_RANK + 1 }, (_, i) => `<i class="${i <= set.rank(id) ? 'on' : ''}"></i>`).join('');
    const cards = ids.map((id, i) => {
      const q = c.powers[id], ok = set.open(id), worn = set.loadout.indexOf(id);
      return `<button data-card="${i}" class="${i === this.at ? 'at' : ''} ${ok ? '' : 'locked'}" style="--c:${c.color}">
        ${svg(ok ? q.kind : 'lock', 34)}<b>${q.name}</b><span class="pips">${ok ? pips(id) : `Mastery ${q.mastery}`}</span>${worn >= 0 ? `<em>${DIR_NAMES[worn]}</em>` : ''}
      </button>`;
    }).join('');
    const skill = this.owner.skills.all().find((s) => s.id === set.skillOf(pid));
    const stats = `<div class="power-bar"><i style="width:${Math.round((skill?.progress ?? 0) * 100)}%;background:${c.color}"></i></div>`;
    this.page.innerHTML = `<div class="powers-page">
      <div class="powers-head" style="color:${c.color}">${svg(c.emblem, 34)}<div><b>${c.name}</b><span>Mastery ${set.mastery}</span></div></div>
      <div class="powers-main">
        <div class="cross">${slots}</div>
        <div class="power-grid">${cards}</div>
      </div>
      <div class="power-info"><b>${def.name}</b>${open ? `<span>Rank ${rank + 1} of ${MAX_RANK + 1}</span>` : `<span>Opens at Mastery ${def.mastery}. You are at ${set.mastery}.</span>`}<p>${def.text}</p>${open ? stats : ''}</div>
    </div>`;
  }

  // What this Conqueror's nature has made of the shared skills, and the discipline only it earns.
  drawGifts() {
    const p = this.owner, c = p.powers.def, own = p.nature.own;
    if (!own) {
      this.page.innerHTML = '';
      return;
    }
    const d = own.discipline, level = p.skills.level(d.id), skill = p.skills.all().find((s) => s.id === d.id);
    const rows = own.twists.map((t) => {
      const on = p.nature.has(t.id), need = p.nature.named(SKILLS[t.skill]);
      return `<div class="gift ${on ? 'on' : ''}" style="--c:${c.color}"><b>${t.name}</b><span>${on ? need.name : `${need.name}: reach ${need.levels[t.at - 1].title}`}</span><p>${t.text}</p></div>`;
    }).join('');
    this.page.innerHTML = `<div class="powers-page">
      <div class="powers-head" style="color:${c.color}">${svg(c.emblem, 34)}<div><b>${c.name}</b><span>What your nature does to your skills</span></div></div>
      <div class="gifts">${rows}</div>
      <div class="power-info"><b>${d.name}</b><span>${level ? `Level ${level} of ${skill.levels.length}` : 'Not yet earned'}. ${d.taught} to train it.</span><p>${d.text}</p><div class="power-bar"><i style="width:${Math.round(skill.progress * 100)}%;background:${c.color}"></i></div></div>
    </div>`;
  }

  place(slot) {
    const set = this.owner.powers, pid = Object.keys(set.def.powers)[this.at];
    set.wear(pid, slot);
    this.assigning = false;
    this.drawPage();
    this.drawHints();
  }

  updatePowers(just) {
    const set = this.owner.powers;
    if (!set.def) return;
    if (this.assigning) {
      const dir = DIRS.findIndex((d) => just[d]);
      if (dir >= 0) this.place(dir);
      return;
    }
    const n = Object.keys(set.def.powers).length, before = this.at;
    if (just.left) this.at = (this.at + n - 1) % n;
    if (just.right) this.at = (this.at + 1) % n;
    if (just.up || just.down) this.at = (this.at + POWER_COLS) % n;
    if (this.at !== before) this.drawPage();
    if (just.confirm) {
      const pid = Object.keys(set.def.powers)[this.at];
      if (!set.open(pid)) return;
      this.assigning = true;
      this.drawPage();
      this.drawHints();
    }
  }

  // Runs while the menu is open, in place of the owner's own input.
  update(dt) {
    const p = this.owner, { controls, hud } = p, { just } = controls, id = TABS[this.tab][0];
    if (this.assigning && just.back) {
      this.assigning = false;
      this.drawPage();
      this.drawHints();
      return undefined;
    }
    if (just.back || just.pause) return this.close();
    if (just.menuLeft || just.menuRight) return this.show((this.tab + (just.menuRight ? 1 : TABS.length - 1)) % TABS.length);
    if (controls.device !== this.device) {
      this.device = controls.device;
      this.drawHints();
      this.drawPage();
    }
    if (id === 'powers') this.updatePowers(just);
    else if (id === 'skills') {
      hud.map.handle(just);
      hud.map.update(dt);
    } else if (id === 'satchel') {
      // L1 and R1 belong to the tabs here, so Triangle swaps between Bag and Craft.
      hud.pack.handle({ ...just, packTab: just.pack });
      hud.pack.update();
    } else if (id === 'settings') {
      const n = this.options().length;
      if (just.up || just.down) {
        this.at = (this.at + (just.down ? 1 : n - 1)) % n;
        this.sure = false;
        this.drawPage();
      } else if (just.confirm) this.choose(1);
      else if ((just.left || just.right) && !this.options()[this.at].action) this.choose(just.right ? 1 : -1);
    } else if (id === 'map') this.updateMap(dt, just);
    return undefined;
  }

  // Where the whole world sits on the canvas: [left, top, size].
  view() {
    const { width: w, height: h } = this.canvas, s = Math.min(w, h) * ZOOMS[this.zoom];
    const place = (at, room) => (s <= room ? (room - s) / 2 : Math.min(0, Math.max(room - s, room / 2 - at * s)));
    return [place(this.cursor.x / WORLD, w), place(this.cursor.z / WORLD, h), s];
  }

  // Everything on the map, read fresh from the living world each time it's drawn.
  marks() {
    const { nations, realm, sites } = this.world, out = [], nameOf = (id) => (id === 'hero' ? 'yours' : id === 'free' ? 'free folk' : NATIONS.find((n) => n.id === id).name);
    for (const t of TOWNS) {
      if (t.kind === 'bandit' || t.kind === 'keep') out.push({ ...t, icon: t.kind, info: `${t.name}, ${t.kind === 'keep' ? 'a ruined keep' : 'a bandit camp'}` });
    }
    for (const t of LANDMARKS) out.push({ ...t, icon: 'landmark' });
    for (const s of sites.list) {
      if (!s.done && s.seen && !TOWNS.some((t) => t.name === s.cat.name) && s.key !== 'fort') out.push({ x: s.x, z: s.z, name: s.cat.name, icon: 'goal', color: s.cat.color });
    }
    // Every settlement as it is today: its size, and whose it is.
    for (const s of realm.settlements) {
      const tier = tierOf(s.pop), owner = NATIONS.find((n) => n.id === s.owner), [icon, size] = TIER_ICONS[tier];
      out.push({ x: s.x, z: s.z, name: s.name, icon, size, color: owner?.color ?? (s.owner === 'hero' ? YOURS : KINDS[icon][0]), info: `${s.name}, ${TIERS[tier].name.toLowerCase()} of ${Math.round(s.pop)}, ${nameOf(s.owner)}${s.stock ? ` · prosperity ${Math.round(s.prosperity * 100)}%${marketLine(realm.economy, s)}` : ''}` });
    }
    // Merchants on the road, and what they carry.
    for (const r of realm.economy.runs) {
      const [x, z] = realm.economy.where(r);
      out.push({ x, z, name: r.kind, icon: 'cart', size: 0.62, color: NATIONS.find((n) => n.id === r.owner)?.color ?? KINDS.cart[0], info: `${r.kind} of ${Math.round(r.qty)} ${GOODS[r.good].name.toLowerCase()}, ${r.from.name} to ${r.to.name}` });
    }
    for (const o of realm.outposts) {
      if (!o.done) out.push({ x: o.x, z: o.z, name: o.name, icon: 'fort', color: NATIONS.find((n) => n.id === o.nation).color, info: `${o.name}, held by ${nameOf(o.nation)}` });
    }
    // The seats come last, so they're always on top: the ruler, and how close they are to falling.
    for (const n of NATIONS) {
      const r = nations.report(n), lair = TOWNS.find((t) => t.name === n.seat).kind === 'lair';
      if (r.fallen) out.push({ x: n.x, z: n.z, name: n.seat, icon: lair ? 'lair' : 'crown', color: '#8a8690', size: 1.2, info: `${n.seat}, conquered` });
      else out.push({ x: n.x, z: n.z, name: n.seat, icon: 'crown', color: n.color, size: 1.5, open: r.open, info: `${n.ruler}, ${n.seat}: ${r.open ? 'exposed' : `${r.done} of ${r.need} strongholds broken`}` });
    }
    if (this.owner.pin) out.push({ ...this.owner.pin, name: 'Your pin', icon: 'pin' });
    return out;
  }

  // Ash, frost and rot where powers have marked the land near the heroes.
  drawScars(ox, oy, s) {
    const { g } = this, size = Math.max(2, (3 / WORLD) * s);
    for (const c of this.world.scars.cells.values()) {
      const scar = c.burn > 0 ? 0 : c.frost > 0.2 ? 2 : c.rot > 0.2 ? 3 : c.char > 0.2 ? 1 : -1;
      if (scar < 0) continue;
      g.fillStyle = SCAR_COLORS[scar][1];
      g.fillRect(ox + (c.x / WORLD) * s - size / 2, oy + (c.z / WORLD) * s - size / 2, size, size);
    }
  }

  updateMap(dt, just) {
    const p = this.owner, m = p.controls.move(true), span = WORLD / ZOOMS[this.zoom], c = this.cursor;
    c.x = Math.max(0, Math.min(WORLD, c.x + m.x * span * CURSOR_SPEED * dt));
    c.z = Math.max(0, Math.min(WORLD, c.z + m.y * span * CURSOR_SPEED * dt));
    if (just.punch) this.zoom = (this.zoom + 1) % ZOOMS.length;
    if (just.confirm) {
      p.pin = p.pin ? null : { x: c.x, z: c.z };
      this.drawHints();
    }
    this.drawMap();
  }

  icon(name, x, y, color, size = ICON) {
    const { g } = this, k = (size * this.scale) / 24;
    g.save();
    g.translate(x - 12 * k, y - 12 * k);
    g.scale(k, k);
    g.lineJoin = 'round';
    g.lineWidth = 3.4;
    g.strokeStyle = '#141a28';
    g.stroke(paths[name]);
    g.fillStyle = color;
    g.fill(paths[name], 'evenodd');
    g.restore();
  }

  // Every nation's land as a wash of its color, redrawn when a nation falls.
  drawLands() {
    const { nations } = this.world, g = this.lands.getContext('2d');
    const key = `${nations.fallen.size}-${this.world.realm.bordersOf}`;
    if (this.landsOf === key) return;
    this.landsOf = key;
    g.clearRect(0, 0, TERRITORY, TERRITORY);
    const cell = WORLD / TERRITORY;
    for (let j = 0; j < TERRITORY; j++) for (let i = 0; i < TERRITORY; i++) {
      const n = nationAt((i + 0.5) * cell, (j + 0.5) * cell);
      if (!n) continue;
      g.globalAlpha = nations.isFallen(n) ? 0.1 : 0.34;
      g.fillStyle = nations.isFallen(n) ? '#f7efdf' : n.color;
      g.fillRect(i, j, 1, 1);
    }
    g.globalAlpha = 1;
  }

  drawMap() {
    const { g, canvas: { width: w, height: h }, scale, owner } = this, [ox, oy, s] = this.view(), to = (a) => (a / WORLD) * s;
    g.fillStyle = '#143a5c';
    g.fillRect(0, 0, w, h);
    if (this.charted) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(this.chart, 0, 0, this.chart.width, this.charted, ox, oy, s, (this.charted / this.chart.height) * s);
    }
    this.drawLands();
    g.drawImage(this.lands, ox, oy, s, s);
    this.drawScars(ox, oy, s);
    const marks = this.marks(), c = this.cursor, cx = ox + to(c.x), cy = oy + to(c.z);
    let nearest = null, best = NEAR_PX * scale;
    for (const t of marks) {
      const x = ox + to(t.x), y = oy + to(t.z);
      if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
      // A ruler who can be reached burns brighter, ringed and pulsing.
      if (t.open) {
        g.strokeStyle = t.color;
        g.lineWidth = 2.5 * scale;
        g.beginPath();
        g.arc(x, y, (19 + Math.sin(performance.now() * 0.006) * 4) * scale, 0, 6.3);
        g.stroke();
      }
      this.icon(t.icon, x, y, t.color ?? KINDS[t.icon][0], ICON * (t.size ?? 1));
      const d = Math.hypot(x - cx, y - cy);
      if (d < best) {
        best = d;
        nearest = t;
      }
    }
    if (ZOOMS[this.zoom] > 1) {
      g.font = `700 ${13 * scale}px 'Zen Maru Gothic', sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 3 * scale;
      g.strokeStyle = '#141a28';
      g.fillStyle = '#fff6e0';
      for (const t of marks) {
        const x = ox + to(t.x), y = oy + to(t.z) + 26 * scale;
        g.strokeText(t.name, x, y);
        g.fillText(t.name, x, y);
      }
    }
    g.textAlign = 'center';
    g.font = `700 ${15 * scale}px 'Zen Maru Gothic', sans-serif`;
    g.lineWidth = 4 * scale;
    g.strokeStyle = '#141a28';
    for (const n of NATIONS) {
      const x = ox + to(n.x), y = oy + to(n.z) - 18 * scale, fallen = this.world.nations.isFallen(n);
      g.fillStyle = fallen ? '#f7efdf' : n.color;
      g.strokeText(n.name, x, y);
      g.fillText(n.name, x, y);
    }
    // Every hero, as an arrow pointing the way they face.
    this.world.players.forEach((p, i) => {
      const x = ox + to(p.state.x), y = oy + to(p.state.z), a = Math.atan2(p.state.dir[0], -p.state.dir[1]), r = 11 * scale;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(0, -r * 1.3);
      g.lineTo(r, r);
      g.lineTo(0, r * 0.45);
      g.lineTo(-r, r);
      g.closePath();
      g.lineWidth = 3 * scale;
      g.strokeStyle = '#141a28';
      g.stroke();
      g.fillStyle = i ? '#5fd8c0' : '#ff6f6f';
      g.fill();
      g.restore();
    });
    g.strokeStyle = '#fff6e0';
    g.lineWidth = 1.6 * scale;
    g.beginPath();
    g.arc(cx, cy, 12 * scale, 0, 6.3);
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.moveTo(cx + ax * 7 * scale, cy + ay * 7 * scale);
      g.lineTo(cx + ax * 18 * scale, cy + ay * 18 * scale);
    }
    g.stroke();
    const here = nearest ?? { name: this.charted < this.chart.height ? 'Charting the world…' : '' };
    const away = nearest ? Math.round(Math.hypot(nearest.x - owner.state.x, nearest.z - owner.state.z)) : 0;
    const text = here.name ? `${here.info ?? here.name}${nearest ? ` · ${away} m` : ''}` : '';
    if (text !== this.label) document.getElementById('menu-place').textContent = this.label = text;
  }
}

// Clears a pin once its hero gets there.
export function reachPin(p) {
  if (p.pin && Math.hypot(p.pin.x - p.state.x, p.pin.z - p.state.z) < PIN_REACHED) p.pin = null;
}
