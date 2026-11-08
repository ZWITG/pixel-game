import * as THREE from 'three';
import SkillMap from './skillMap.js';
import { height } from './terrain.js';
import PackPage from './packPage.js';
import { svg } from './conquerors.js';

const $ = (id) => document.getElementById(id);

// Sets a style or class only when it differs from what was last set, so an unchanged HUD costs nothing.
const seen = new WeakMap();
function put(el, key, value, apply) {
  let m = seen.get(el);
  if (!m) seen.set(el, (m = {}));
  if (m[key] === value) return;
  m[key] = value;
  apply(value);
}
const width = (el, k) => put(el, 'w', `${Math.round(k * 1000) / 10}%`, (v) => { el.style.width = v; });
const toggle = (el, name, on) => put(el, `c:${name}`, !!on, (v) => el.classList.toggle(name, v));
const NUMERALS = ['0', 'I', 'II', 'III', 'IV', 'V'];
const LOW = 0.25;             // share of health under which the HUD warns

// World HUD: short messages, the breath bar, and the skill map.
export default class WorldHud {
  constructor(prefix) {
    this.prefix = prefix;
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
    width(this.$('foe-fill'), amount);
    const post = this.$('foe-post');
    width(post.firstChild, broken ? 1 : posture);
    toggle(post, 'broken', broken);
  }

  // Spirit pips, and the hero's own Structure (hidden while it's empty).
  // Wrath under them: full, it names the buttons; in a Surge it shows the time left.
  // `meter`: a Conqueror's own gauge (the Emberlord's Heat) as { value, color, hot, label }, or null.
  setFight(spirit, posture, broken, wrath = 0, surge = 0, device = 'pad', meter = null) {
    const box = this.$('fight');
    if (!this.pips) {
      box.innerHTML = `<div class="pips">${'<i><b></b></i>'.repeat(5)}</div><div class="post"><u></u></div><div class="wrath"><u></u><span></span></div><div class="meter"><u></u><i></i><i></i><span></span></div>`;
      this.pips = [...box.querySelectorAll('.pips i')];
      this.postFill = box.querySelector('.post u');
      this.wrathBar = box.querySelector('.wrath');
      this.meterBar = box.querySelector('.meter');
    }
    put(this.meterBar, 'hidden', !meter, (v) => { this.meterBar.hidden = v; });
    if (meter) {
      width(this.meterBar.firstChild, meter.value);
      put(this.meterBar, 'c', meter.color, (v) => this.meterBar.style.setProperty('--c', v));
      toggle(this.meterBar, 'hot', meter.hot);
      if (this.meterSay !== meter.label) this.meterBar.lastChild.textContent = this.meterSay = meter.label;
      // Marks where the gauge changes (the Emberlord's white-gold and blue).
      const ticks = this.meterBar.querySelectorAll('i');
      ticks.forEach((el, i) => {
        const mark = meter.marks?.[i];
        put(el, 'mark', mark ?? null, (v) => {
          el.hidden = v === null;
          if (v !== null) el.style.left = `${v * 100}%`;
        });
      });
    }
    const full = wrath >= 1 && !surge;
    width(this.wrathBar.firstChild, surge || wrath);
    toggle(this.wrathBar, 'full', full);
    toggle(this.wrathBar, 'surge', surge > 0);
    const say = full ? `Wrath: ${device === 'pad' ? 'L1 + R1' : 'Y'}` : surge ? 'Surge' : 'Wrath';
    if (this.wrathSay !== say) this.wrathBar.lastChild.textContent = this.wrathSay = say;
    this.pips.forEach((pip, i) => {
      const k = Math.round(Math.max(0, Math.min(1, spirit - i)) * 100) / 100;
      put(pip.firstChild, 'k', k, (v) => { pip.firstChild.style.transform = `scaleX(${v})`; });
      toggle(pip, 'full', k >= 1);
    });
    width(this.postFill, broken ? 1 : posture);
    toggle(box, 'broken', broken);
    toggle(box, 'calm', posture < 0.02 && !broken);
  }

  // The nearest army in the field: its name, strength and morale (or null to hide it).
  setArmy(a) {
    const el = this.$('army');
    if (!el) return;
    put(el, 'hidden', !a, (v) => { el.hidden = v; });
    if (!a) return;
    put(el, 'name', `${a.name} · ${a.strength} strong${a.far > 150 ? ` · ${a.far} tiles off` : ''}`, (v) => { el.firstChild.textContent = v; });
    put(el, 'c', a.color, (v) => el.style.setProperty('--c', v));
    width(el.lastChild.firstChild, a.morale);
  }

  // The hero's banner: the Omega phase as a numeral and its name, a bar filling toward the next.
  setOmega(om) {
    const el = this.$('omega');
    if (!el) return;
    const info = om.info;
    put(el, 'name', info.name, (v) => { el.querySelector('span').textContent = v; });
    put(el, 'c', info.color, (v) => el.style.setProperty('--c', v));
    put(el, 'k', Math.round(om.progress * 100), (v) => { el.querySelector('s').style.width = `${v}%`; });
    put(el, 'p', om.phase, (v) => { el.querySelector('b').textContent = NUMERALS[v] ?? v; });
  }

  // Whose banner it is: the Conqueror's name, colour and emblem (or none yet).
  setHero(def) {
    const banner = this.$('omega'), lv = this.$('lv');
    put(banner, 'hero', def?.name ?? '', () => {
      banner.querySelector('em').innerHTML = def ? svg(def.emblem, 30) : '';
      const c = def?.color ?? '#9a2a2a';
      banner.style.setProperty('--hero', c);
      lv.style.setProperty('--hero', c);
      this.heroName = def?.name ?? '';
      this.drawLevel();
    });
  }

  // Edge arrows for attackers out of sight: `a` is radians clockwise from straight ahead.
  setThreats(list) {
    const box = this.$('threats');
    if (!this.arrows) this.arrows = [];
    while (this.arrows.length < list.length) this.arrows.push(box.appendChild(document.createElement('i')));
    this.arrows.forEach((el, i) => {
      const t = list[i];
      put(el, 'hidden', !t, (v) => { el.hidden = v; });
      if (!t) return;
      // Turned in steps of about a degree: finer than the eye can tell, and far fewer writes.
      const a = Math.round(t.a * 60) / 60;
      put(el, 'a', a, (v) => {
        el.style.left = `${50 + Math.sin(v) * 44}%`;
        el.style.top = `${50 - Math.cos(v) * 40}%`;
        el.style.setProperty('--a', `${v}rad`);
      });
      toggle(el, 'tell', t.tell);
      toggle(el, 'peril', t.peril);
    });
  }

  // Rally: the grey stretch after the health that hitting back wins back. Both 0..1 of max health.
  setRally(health, rally) {
    const el = this.$('hp-rally');
    if (!el) return;
    const k = (v) => Math.round(Math.max(0, v) * 1000) / 1000;
    put(el, 'hp', k(health), (v) => el.style.setProperty('--hp', v));
    put(el, 'rally', k(rally), (v) => el.style.setProperty('--rally', v));
  }

  setHealth(amount) {
    this.$('hp-fill').style.width = `${Math.max(0, amount) * 100}%`;
    // Low on health: the bar beats and the screen's edges run red.
    const low = amount > 0 && amount < LOW;
    toggle(this.$('hp'), 'low', low);
    if (!this.prefix) toggle(document.body, 'low-hp', low);
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
    this.level = level;
    this.drawLevel();
  }

  drawLevel() {
    this.$('lv').innerHTML = `${this.heroName ? `<b>${this.heroName}</b>` : ''}<span>Lv ${this.level ?? 1}</span>`;
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
