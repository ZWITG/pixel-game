import * as THREE from 'three';
import SkillMap from './skillMap.js';
import { height } from './terrain.js';
import PackPage from './packPage.js';

const $ = (id) => document.getElementById(id);

// World HUD: short messages, the breath bar, and the skill map.
export default class WorldHud {
  constructor(prefix) {
    this.$ = (id) => $(prefix + id);
    this.mapOpen = false;
    this.packOpen = false;
    this.map = new SkillMap($('skill-map'), $('skill-tag'));
    this.pack = new PackPage(this.$('pack-page'), this.$('pack-tag'), this.$('pack-info'), this.$('pack-hints'));
    this.timer = null;
    this.keepUntil = 0;
    this.point = new THREE.Vector3();
  }

  // `keep`: milliseconds nothing else may replace this message, for news that mustn't be missed.
  message(text, big = false, keep = 0) {
    if (performance.now() < this.keepUntil) return;
    this.keepUntil = performance.now() + keep;
    const el = this.$('toast');
    el.textContent = text;
    el.className = big ? 'show big' : 'show';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { el.className = ''; }, big ? 4200 : 2800);
  }

  // Clears the way for something bigger.
  hush() {
    this.$('toast').className = '';
    this.keepUntil = 0;
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

  // A full-screen flash from a huge blast.
  flash(strength) {
    const el = $('flash');
    el.style.transition = 'none';
    el.style.opacity = strength;
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 1.1s';
      el.style.opacity = 0;
    });
  }

  // The name, health and Structure of the enemy being fought.
  setFoe(name, amount, posture = 0, broken = false) {
    if (name !== this.foeName) {
      this.foeName = name;
      this.$('foe').hidden = !name;
      this.$('foe-name').textContent = name;
    }
    if (!name) return;
    this.$('foe-fill').style.width = `${amount * 100}%`;
    const post = this.$('foe-post');
    post.firstChild.style.width = `${(broken ? 1 : posture) * 100}%`;
    post.classList.toggle('broken', broken);
  }

  // Spirit pips, and the hero's own Structure (hidden while it's empty).
  // Wrath under them: full, it names the buttons; in a Surge it shows the time left.
  // `meter`: a Conqueror's own gauge (the Emberlord's Heat) as { value, color, hot, label }, or null.
  setFight(spirit, posture, broken, wrath = 0, surge = 0, device = 'pad', meter = null) {
    const box = this.$('fight');
    if (!this.pips) {
      box.innerHTML = `<div class="pips">${'<i><b></b></i>'.repeat(5)}</div><div class="post"><u></u></div><div class="wrath"><u></u><span></span></div><div class="meter"><u></u><span></span></div>`;
      this.pips = [...box.querySelectorAll('.pips i')];
      this.postFill = box.querySelector('.post u');
      this.wrathBar = box.querySelector('.wrath');
      this.meterBar = box.querySelector('.meter');
    }
    this.meterBar.hidden = !meter;
    if (meter) {
      this.meterBar.firstChild.style.width = `${meter.value * 100}%`;
      this.meterBar.style.setProperty('--c', meter.color);
      this.meterBar.classList.toggle('hot', !!meter.hot);
      if (this.meterSay !== meter.label) this.meterBar.lastChild.textContent = this.meterSay = meter.label;
    }
    const full = wrath >= 1 && !surge;
    this.wrathBar.firstChild.style.width = `${(surge || wrath) * 100}%`;
    this.wrathBar.classList.toggle('full', full);
    this.wrathBar.classList.toggle('surge', surge > 0);
    const say = full ? (device === 'pad' ? 'L1 + R1' : 'Y') : '';
    if (this.wrathSay !== say) this.wrathBar.lastChild.textContent = this.wrathSay = say;
    this.pips.forEach((pip, i) => {
      const k = Math.max(0, Math.min(1, spirit - i));
      pip.firstChild.style.transform = `scaleX(${k})`;
      pip.classList.toggle('full', k >= 1);
    });
    this.postFill.style.width = `${(broken ? 1 : posture) * 100}%`;
    box.classList.toggle('broken', broken);
    box.classList.toggle('calm', posture < 0.02 && !broken);
  }

  // Edge arrows for attackers out of sight: `a` is radians clockwise from straight ahead.
  setThreats(list) {
    const box = this.$('threats');
    if (!this.arrows) this.arrows = [];
    while (this.arrows.length < list.length) this.arrows.push(box.appendChild(document.createElement('i')));
    this.arrows.forEach((el, i) => {
      const t = list[i];
      el.hidden = !t;
      if (!t) return;
      el.style.left = `${50 + Math.sin(t.a) * 44}%`;
      el.style.top = `${50 - Math.cos(t.a) * 40}%`;
      el.style.setProperty('--a', `${t.a}rad`);
      el.classList.toggle('tell', t.tell);
    });
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

  setLevel(level) {
    this.$('lv').textContent = `Lv ${level}`;
  }

  setGoal(text, color) {
    if (text === this.goal) return;
    this.goal = text;
    const el = this.$('goal');
    el.textContent = text;
    el.style.color = color ?? '';
  }

  // The word and button for what the hero could do right now.
  setAction(html) {
    if (html === this.action) return;
    this.action = html;
    this.$('act').innerHTML = html;
  }

  get open() {
    return this.mapOpen || this.packOpen || this.marketOpen;
  }

  toggle(skills, body) {
    this.mapOpen = !this.mapOpen;
    $('skills').hidden = !this.mapOpen;
    if (this.mapOpen) this.map.open(skills, body);
  }

  togglePack(player) {
    this.packOpen = !this.packOpen;
    this.$('pack').hidden = !this.packOpen;
    if (this.packOpen) this.pack.open(player);
  }

  closeAll(player) {
    if (this.mapOpen) this.toggle();
    if (this.packOpen) this.togglePack(player);
  }
}
