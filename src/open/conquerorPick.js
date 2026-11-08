import { CONQUERORS, svg } from './conquerors.js';
import { prompt } from '../ui/glyphs.js';

// Choosing a Conqueror: five emblems, the one in focus stands in the world, and a second
// screen makes sure, because there is no changing it afterward.
const IDS = Object.keys(CONQUERORS);

export default class ConquerorPick {
  constructor() {
    this.box = document.getElementById('pick');
    this.owner = null;
    this.at = 0;
    this.sure = false;
    this.onDone = null;
    this.box.addEventListener('click', (e) => {
      const card = e.target.closest('[data-pick]'), act = e.target.closest('[data-act]');
      if (card) {
        this.move(Number(card.dataset.pick) - this.at);
        if (this.at === Number(card.dataset.pick)) this.sure = false;
        this.draw();
      } else if (act) this.act(act.dataset.act);
    });
  }

  get isOpen() {
    return !!this.owner;
  }

  // onDone(id) runs once the choice is made.
  open(player, onDone) {
    Object.assign(this, { owner: player, onDone, at: 0, sure: false });
    this.box.hidden = false;
    this.device = null;
    player.showAs(IDS[0]);
    this.draw();
  }

  // The player choosing has left the game.
  cancel() {
    this.owner = null;
    this.box.hidden = true;
  }

  move(by) {
    this.at = (this.at + by + IDS.length) % IDS.length;
    this.owner.showAs(IDS[this.at]);
    this.draw();
  }

  act(what) {
    if (what === 'go') {
      this.sure = true;
      return this.draw();
    }
    if (what === 'no') {
      this.sure = false;
      return this.draw();
    }
    const id = IDS[this.at], done = this.onDone;
    this.owner.becomeConqueror(id);
    this.owner = null;
    this.box.hidden = true;
    return done(id);
  }

  draw() {
    const id = IDS[this.at], c = CONQUERORS[id], who = this.owner.index ? 'Player 2: ' : '', device = this.owner.controls.device;
    const p = (action) => prompt(action, device);
    this.device = device;
    const cards = IDS.map((k, i) => `<button data-pick="${i}" class="${i === this.at ? 'at' : ''}" style="color:${CONQUERORS[k].color}">${svg(CONQUERORS[k].emblem, 34)}<span>${CONQUERORS[k].name}</span></button>`).join('');
    const stats = Object.entries(c.stats).map(([name, n]) => `<div><span>${name}</span><em>${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</em></div>`).join('');
    const powers = Object.values(c.powers).map((q) => `<div class="pick-power" style="color:${c.color}">${svg(q.kind, 20)}<span>${q.name}</span></div>`).join('');
    this.box.innerHTML = `
      <div class="pick-side">
        <h1>${who}Choose your Conqueror</h1>
        <div class="pick-cards">${cards}</div>
        <h2 style="color:${c.color}">${svg(c.emblem, 30)} ${c.name}</h2>
        <p>${c.tag}</p>
        <div class="pick-stats">${stats}</div>
        <div class="pick-powers">${powers}</div>
        <p class="pick-extra">${c.extra}</p>
        ${this.sure ? `<div class="pick-sure">
          <b>Become ${c.name}?</b><span>This choice is permanent. It can never be changed for this hero.</span>
          <button data-act="yes" style="background:${c.color}">Become ${c.name}</button><button data-act="no">Go back</button>
        </div>` : ''}
      </div>
      <div class="pick-hints">${this.sure ? `${p('confirm')} Confirm&nbsp;&nbsp; ${p('back')} Go back` : `${p('confirm')} Choose&nbsp;&nbsp; ${p('left')} Change`}</div>`;
  }

  update() {
    const { just, device } = this.owner.controls;
    if (device !== this.device) this.draw();
    if (this.sure) {
      if (just.confirm) this.act('yes');
      else if (just.back) this.act('no');
      return;
    }
    // Two rows of five since v0.54.0: up and down change row.
    if (just.left) this.move(-1);
    else if (just.right) this.move(1);
    else if (just.up || just.down) this.move(5);
    else if (just.confirm) this.act('go');
  }
}
