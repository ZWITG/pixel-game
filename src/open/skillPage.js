import SkillMap from './skillMap.js';

const $ = (id) => document.getElementById(id);

// World HUD: short messages, the breath bar, and the skill map.
export default class WorldHud {
  constructor() {
    this.open = false;
    this.map = new SkillMap($('skill-map'), $('skill-tag'));
    this.timer = null;
  }

  message(text, big = false) {
    const el = $('toast');
    el.textContent = text;
    el.className = big ? 'show big' : 'show';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { el.className = ''; }, big ? 4200 : 2800);
  }

  setBreath(amount) {
    const bar = $('breath');
    bar.hidden = amount === null;
    if (amount !== null) $('breath-fill').style.width = `${Math.max(0, amount) * 100}%`;
  }

  // A quick dark blink while the hero is carried back to shore.
  gasp() {
    const el = $('blink');
    el.className = 'on';
    setTimeout(() => { el.className = ''; }, 90);
  }

  // A small note that rises and fades when an attribute grows; several can stack.
  gain(attribute, value) {
    const el = document.createElement('div');
    el.textContent = `${attribute.name} ${value}`;
    el.style.color = attribute.color;
    $('gains').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  toggle(skills, body) {
    this.open = !this.open;
    $('skills').hidden = !this.open;
    if (this.open) this.map.open(skills, body);
  }
}
