import * as THREE from 'three';
import SkillMap from './skillMap.js';
import { height } from './terrain.js';
import { ITEMS } from './work.js';

const $ = (id) => document.getElementById(id);

// World HUD: short messages, the breath bar, and the skill map.
export default class WorldHud {
  constructor(prefix) {
    this.$ = (id) => $(prefix + id);
    this.open = false;
    this.map = new SkillMap($('skill-map'), $('skill-tag'));
    this.timer = null;
    this.point = new THREE.Vector3();
  }

  message(text, big = false) {
    const el = this.$('toast');
    el.textContent = text;
    el.className = big ? 'show big' : 'show';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { el.className = ''; }, big ? 4200 : 2800);
  }

  setBreath(amount) {
    const bar = this.$('breath');
    bar.hidden = amount === null;
    if (amount !== null) this.$('breath-fill').style.width = `${Math.max(0, amount) * 100}%`;
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
    this.$('gains').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  setHealth(amount) {
    this.$('hp-fill').style.width = `${Math.max(0, amount) * 100}%`;
  }

  // What monsters call for their damage numbers; `y` is above the ground there.
  floatText(x, y, z, text, color) {
    this.float(text, x, height(x, z) + y * 3, z, color);
  }

  // A number that pops up over a point in the world.
  float(text, x, y, z, color) {
    const p = this.point.set(x, y, z).project(this.camera);
    if (p.z > 1) return;
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.cssText = `left:${(p.x * 0.5 + 0.5) * 100}%;top:${(0.5 - p.y * 0.5) * 100}%;color:${color}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  // The word and button for what the hero could do right now.
  setAction(html) {
    if (html === this.action) return;
    this.action = html;
    this.$('act').innerHTML = html;
  }

  setBag(bag) {
    const held = Object.entries(bag.items).filter(([, n]) => n);
    this.$('bag').innerHTML = held.length ? `${held.map(([id, n]) => `<span style="color:${ITEMS[id].color}">${ITEMS[id].name} ${n}</span>`).join('&nbsp;&nbsp;')}&nbsp;&nbsp;${bag.weight}/${Math.floor(bag.body.carry)}` : '';
  }

  toggle(skills, body) {
    this.open = !this.open;
    $('skills').hidden = !this.open;
    if (this.open) this.map.open(skills, body);
  }
}
