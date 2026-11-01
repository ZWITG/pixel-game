import { version } from '../../package.json';
import { prompt } from '../ui/glyphs.js';

// The title screen: the world itself behind a short list. Everything is steered with the same
// actions as the rest of the game, so controller, keyboard and mouse all work the same way.
const SPLASH_MS = 3400;     // the studio logo stays this long from the page opening; a button skips it
const SPLASH_HOLD = 900;    // and at least this long once the game is ready, however slow the load
const SPLASH_FADE = 700;
const FADE = 0.4;          // seconds to fade to black on the way into the game
const SETTINGS_KEY = 'lumen.settings', KEEP = 'lumen.old.';
export const QUALITY = [['auto', 'Auto', 'Keeps the game smooth on its own'], ['high', 'High', 'Sharpest picture'], ['balanced', 'Balanced', 'A little softer, much faster'], ['fast', 'Fast', 'For an older computer']];

const DEFAULTS = { quality: 'auto', hints: 'auto', compass: true };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* it still applies for this visit */ }
}

// A hero worth continuing has chosen a Conqueror.
function hasHero() {
  try {
    return !!JSON.parse(localStorage.getItem('lumen.conqueror'))?.id;
  } catch {
    return false;
  }
}

// Starts over. The last hero is put aside rather than destroyed, in case this was a slip.
function eraseHero() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('lumen.') || key === SETTINGS_KEY || key.startsWith(KEEP) || key.startsWith('lumen.legend.')) continue;
      localStorage.setItem(KEEP + key.slice(6), localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    localStorage.setItem('lumen.skills', '{}'); // or the launcher's copy of a save would come back
    sessionStorage.setItem('lumen.fresh', '1');
    Storage.prototype.setItem = () => {};       // what's still in memory must not save on the way out
  } catch { /* storage is blocked: nothing was kept anyway */ }
}

export default class StartMenu {
  constructor(player, settings, { onQuality, rows }) {
    Object.assign(this, { player, settings, onQuality, rows });
    this.box = document.getElementById('start');
    this.splash = document.getElementById('splash');
    this.splashUntil = Math.max(SPLASH_MS, performance.now() + SPLASH_HOLD);
    this.list = document.getElementById('start-list');
    this.hints = document.getElementById('start-hints');
    document.getElementById('start-version').textContent = `v${version}`;
    this.saved = hasHero();
    this.leaving = 0;
    this.device = null;
    this.result = null;
    this.goto('main');
    this.list.addEventListener('pointermove', (e) => {
      const at = e.target.closest('[data-at]');
      if (at && Number(at.dataset.at) !== this.at) this.select(Number(at.dataset.at));
    });
    this.list.addEventListener('click', (e) => {
      const at = e.target.closest('[data-at]');
      if (!at) return;
      this.select(Number(at.dataset.at));
      this.choose();
    });
  }

  pages() {
    const { saved, settings } = this;
    return {
      main: [
        ...(saved ? [{ label: 'Continue', run: () => this.leave('continue') }] : []),
        { label: 'New Game', run: () => (saved ? this.goto('erase', 1) : this.leave('new')) },
        { label: 'Controls', run: () => this.goto('controls') },
        { label: 'Graphics', run: () => this.goto('graphics', QUALITY.findIndex(([id]) => id === settings.quality)) },
      ],
      erase: [
        { label: 'Start over', danger: true, run: () => { eraseHero(); location.reload(); } },
        { label: 'Keep my hero', run: () => this.goto('main') },
      ],
      graphics: QUALITY.map(([id, label, note]) => ({ label, note, on: id === settings.quality, run: () => this.setQuality(id) })),
      controls: [],
    };
  }

  setQuality(id) {
    this.settings.quality = id;
    saveSettings(this.settings);
    this.onQuality(id);
    this.draw();
  }

  goto(page, at = 0) {
    this.page = page;
    this.at = at;
    this.draw();
  }

  draw() {
    const { page, player: { controls: { device } } } = this, items = this.pages()[page];
    this.items = items;
    this.device = device;
    const heading = { erase: 'Start a new hero?', graphics: 'Graphics', controls: 'Controls' }[page];
    const lead = page === 'erase' ? '<p class="start-note">Your current hero is put aside, and this game starts from the beginning.</p>' : '';
    const rows = page === 'controls' ? `<div class="start-rows">${this.rows(device === 'pad').map(([key, label]) => `<div>${key}<span>${label}</span></div>`).join('')}</div>` : '';
    this.list.innerHTML = `${heading ? `<h2>${heading}</h2>` : ''}${lead}${rows}${items.map((item, i) => `
      <button data-at="${i}" class="${[i === this.at ? 'at' : '', item.on ? 'on' : '', item.danger ? 'danger' : ''].join(' ')}">
        <b>${item.label}</b>${item.note ? `<small>${item.note}</small>` : ''}
      </button>`).join('')}`;
    const p = (action) => prompt(action, device);
    this.hints.innerHTML = page === 'controls' ? `${p('back')} Back` : `${p('confirm')} Select${page === 'main' ? '' : `&nbsp;&nbsp; ${p('back')} Back`}`;
  }

  select(at) {
    this.at = at;
    for (const el of this.list.querySelectorAll('button')) el.classList.toggle('at', Number(el.dataset.at) === at);
  }

  choose() {
    this.items[this.at]?.run();
  }

  leave(result) {
    this.result = result;
    this.leaving = FADE;
    document.getElementById('blink').className = 'fading';
  }

  // Returns 'continue' or 'new' on the frame the game should begin.
  update(dt) {
    if (this.leaving > 0) {
      this.leaving -= dt;
      return this.leaving <= 0 ? this.result : null;
    }
    const { just, device } = this.player.controls, n = this.items.length;
    if (this.splash) {
      if (performance.now() > this.splashUntil || just.confirm || just.back) this.endSplash();
      return null;
    }
    if (device !== this.device) this.draw();
    if (just.back && this.page !== 'main') this.goto('main');
    else if (n && just.up) this.select((this.at + n - 1) % n);
    else if (n && just.down) this.select((this.at + 1) % n);
    else if (n && just.confirm) this.choose();
    return null;
  }

  // Lifts the studio logo off the title screen, which has been ready behind it.
  endSplash() {
    const { splash } = this;
    this.splash = null;
    splash.classList.add('out');
    setTimeout(() => { splash.hidden = true; }, SPLASH_FADE);
  }

  hide() {
    if (this.splash) this.endSplash();
    this.box.hidden = true;
    document.body.classList.remove('title');
    document.getElementById('blink').className = '';
  }
}
