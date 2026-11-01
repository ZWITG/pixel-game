import { PLACES, TOWNS } from './terrain.js';

// A strip across the top of the view: the four winds, the next goal, and towns close enough to
// walk to. It replaces reading coordinates, so the world itself stays the thing to look at.
const SPAN = 1.7;          // radians from the middle of the strip to its edge
const EVERY = 0.08;        // seconds between updates
const TOWN_SIGHT = 900;    // tiles a town shows from
const TITLE_AT = 0.8;      // how far inside a place's edge, as a share of its radius, its name shows
const WINDS = [['N', 0], ['E', -Math.PI / 2], ['S', Math.PI], ['W', Math.PI / 2]];
const MAX_TOWNS = 4;
const LABEL_GAP = 0.5;     // radians kept between two labels
const SHOWN = [...Object.values(PLACES), ...TOWNS];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default class Compass {
  constructor(prefix) {
    this.box = document.getElementById(`${prefix}compass`);
    this.title = document.getElementById(`${prefix}place`);
    this.wait = 0;
    this.here = null;
    const add = (className, text) => {
      const el = document.createElement('span');
      el.className = className;
      el.textContent = text;
      this.box.appendChild(el);
      return el;
    };
    this.winds = WINDS.map(([name, at]) => ({ el: add('wind', name), at }));
    this.towns = Array.from({ length: MAX_TOWNS }, () => add('town', ''));
    this.goal = add('goal-mark', '');
    this.pin = add('pin-mark', '');
  }

  // Big words across the middle: the name of a place, or of a land, with a line under it.
  announce(name, under = '') {
    this.title.innerHTML = under ? `${name}<small>${under}</small>` : name;
    this.title.className = '';
    void this.title.offsetWidth; // restarts the animation
    this.title.className = 'show';
  }

  put(el, bearing, yaw) {
    const k = wrap(yaw - bearing) / SPAN, on = Math.abs(k) < 1;
    el.style.display = on ? '' : 'none';
    if (on) {
      el.style.left = `${50 + k * 50}%`;
      el.style.opacity = 1 - k * k * k * k;
    }
  }

  update(p, yaw, dt) {
    if ((this.wait -= dt) > 0) return;
    this.wait = EVERY;
    const { x, z } = p.state, inside = !!p.rooms.house;
    this.box.hidden = inside;
    if (inside) return;
    for (const w of this.winds) this.put(w.el, w.at, yaw);
    const bearing = (t) => Math.atan2(x - t.x, z - t.z);
    const near = SHOWN.map((t) => [Math.hypot(x - t.x, z - t.z), t]).sort((a, b) => a[0] - b[0]);
    const taken = [];
    this.towns.forEach((el, i) => {
      const [d, t] = near[i], at = bearing(t);
      // Places in one line of sight would print over each other: only the closest gets a label.
      const show = d < TOWN_SIGHT && d > t.r * TITLE_AT && !taken.some((b) => Math.abs(wrap(b - at)) < LABEL_GAP);
      if (show) taken.push(at);
      el.style.display = show ? '' : 'none';
      if (!show) return;
      if (el.textContent !== t.name) el.textContent = t.name;
      this.put(el, bearing(t), yaw);
    });
    const { site, siteDist } = p, goal = this.goal;
    goal.style.display = site ? '' : 'none';
    if (site) {
      const text = `◆ ${Math.round(siteDist)} m`;
      if (goal.textContent !== text) goal.textContent = text;
      goal.style.color = site.cat.color;
      this.put(goal, bearing(site), yaw);
    }
    this.pin.style.display = p.pin ? '' : 'none';
    if (p.pin) {
      const text = `⚑ ${Math.round(Math.hypot(x - p.pin.x, z - p.pin.z))} m`;
      if (this.pin.textContent !== text) this.pin.textContent = text;
      this.put(this.pin, bearing(p.pin), yaw);
    }
    // Stepping into a named place brings its name up for a moment.
    const [d, place] = near.find(([dist, t]) => dist < t.r * TITLE_AT) ?? [];
    if (d !== undefined && place !== this.here) {
      this.announce(place.name);
    }
    this.here = place ?? this.here;
  }
}
