import * as THREE from 'three';
import { height, PLACES, TOWNS } from './terrain.js';
import { addWind } from '../render/wind.js';

// The six nations that hold the world. Each rules the land nearest its seat. To conquer one,
// break enough of its strongholds to expose its ruler, then bring the ruler down at the seat.
// `share`: how much of its strongholds must fall. Add a nation by adding an entry.
export const NATIONS = [
  { id: 'aurel', name: 'The Aurel Crown', level: 42, seat: 'Aurelgate', ruler: 'High Marshal Verane', color: '#e8c050', sway: 1.45, word: 'The Aurel Crown has fallen', tribute: { force: 0.1 } },
  { id: 'thorn', name: 'The Thorn League', level: 30, seat: 'Thornmere', ruler: 'Sable, the Thorn Queen', color: '#5fae62', sway: 0.9, word: 'The Thorn League lies broken', tribute: { speed: 0.04 } },
  { id: 'frost', name: 'The Frostwall', level: 55, seat: 'The Frozen Throne', ruler: 'The Rime King', color: '#9fe8ff', word: 'The Frozen Throne stands empty', tribute: { health: 25 } },
  { id: 'cinder', name: 'The Cinder Reach', level: 20, seat: 'The Ember Caldera', ruler: 'Emberhorn', color: '#ff7a3a', word: 'The Cinder Reach burns no more', tribute: { force: 0.1 } },
  { id: 'mire', name: 'The Drowned Court', level: 12, seat: 'The Drowned Hollow', ruler: 'The Mirewyrm', color: '#a8d84a', word: 'The Drowned Court is silent', tribute: { guard: 0.06 } },
  { id: 'bone', name: 'The Bone Waste', level: 5, seat: 'The Gravepit', ruler: 'Gravemaw the Colossus', color: '#d8c8a8', word: 'The Bone Waste bows', tribute: { health: 25 } },
].map((n) => {
  const T = TOWNS.find((t) => t.name === n.seat);
  return { ...n, x: T.x, z: T.z, base: n.sway ?? 1 };
});
export const COUNTRY = 'The Country of Vael';
const SAVE_KEY = 'lumen.nations';
const SHARE = 0.6, MIN_NEEDED = 2;   // of a nation's strongholds that must fall
const STRONGHOLD = ['camp', 'den', 'bandit', 'keep', 'fort']; // taken by destroying their works (raze.js)
const FREE_LAKE = 840, FREE_HOLLOW = 420; // the middle of the world belongs to no one
const YOURS = '#f7efdf';
const BANNERS = 2;           // per town
const WATCH = 0.5;           // seconds between checks of which land a hero is on
const SEAL_SAY = 12;         // seconds between reminders at a sealed ruler
const FALL_SECS = 6500;      // ms the great words stay up

// Which nation holds a point, or null for free land.
export function nationAt(x, z) {
  if (Math.hypot(x - PLACES.lake.x, z - PLACES.lake.z) < FREE_LAKE || Math.hypot(x - PLACES.hollow.x, z - PLACES.hollow.z) < FREE_HOLLOW) return null;
  const pull = (n) => Math.hypot(x - n.x, z - n.z) / (n.sway ?? 1); // a strong nation holds more land
  return NATIONS.reduce((a, b) => (pull(b) < pull(a) ? b : a));
}

export default class Nations {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.fallen = new Set();
    try {
      for (const id of JSON.parse(localStorage.getItem(SAVE_KEY)) ?? []) this.fallen.add(id);
    } catch { /* a new world */ }
    const sites = world.sites;
    this.state = NATIONS.map((n) => {
      const seat = sites.list.find((s) => s.cat.name === n.seat);
      const holds = sites.list.filter((s) => STRONGHOLD.includes(s.key) && nationAt(s.x, s.z) === n);
      return { n, seat, holds, need: 0, said: 0, open: false };
    });
    this.refreshAll();
    sites.sealed = (site, p) => this.sealed(site, p);
    sites.finished = (site, p) => this.finished(site, p);
    this.seen = new Map();
    this.wait = 0;
    this.big = document.getElementById('conquest');
    this.raiseBanners();
  }

  // What it takes to break a nation changes as it builds new forts or retakes old ones.
  refresh(s) {
    s.need = Math.min(s.holds.length, Math.max(MIN_NEEDED, Math.ceil(s.holds.length * SHARE)));
    s.open = this.broken(s) >= s.need;
  }

  refreshAll() {
    for (const s of this.state) this.refresh(s);
  }

  claim(id, site) {
    const s = this.get(id);
    s.holds.push(site);
    this.refresh(s);
  }

  get(id) {
    return this.state.find((s) => s.n.id === id);
  }

  broken(s) {
    return s.holds.filter((h) => h.done).length;
  }

  isFallen(n) {
    return !!n && this.fallen.has(n.id);
  }

  // True once every nation has fallen: the door to what comes after.
  get allFallen() {
    return this.fallen.size === NATIONS.length;
  }

  // A ruler can't be reached until their strongholds have fallen.
  sealed(site, p) {
    const s = this.state.find((x) => x.seat === site);
    if (!s || s.open) return false;
    if (performance.now() - s.said > SEAL_SAY * 1000) {
      s.said = performance.now();
      p.hud.message(`${s.n.ruler} is out of reach. Break ${s.need - this.broken(s)} more of ${s.n.name}'s strongholds.`, true);
    }
    return true;
  }

  finished(site, p) {
    const fallen = this.state.find((s) => s.seat === site);
    if (fallen) return this.conquer(fallen, p);
    const s = this.state.find((x) => x.holds.includes(site));
    if (!s || this.fallen.has(s.n.id)) return undefined;
    const done = this.broken(s);
    if (!s.open && done >= s.need) {
      s.open = true;
      p.hud.message(`${s.n.name} is exposed! ${s.n.ruler} waits at ${s.n.seat}.`, true, 5000);
    } else if (!s.open) p.hud.message(`${s.n.name} weakens: ${done} of ${s.need} strongholds broken.`, true);
    return undefined;
  }

  conquer(s, p) {
    this.fallen.add(s.n.id);
    this.world.omega?.deed('nation');
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify([...this.fallen]));
    } catch { /* it lasts for this visit */ }
    for (const h of this.world.players) {
      for (const [name, n] of Object.entries(s.n.tribute)) h.bag.perks[name] = (h.bag.perks[name] ?? 0) + n;
      h.bag.save();
    }
    this.world.realm.fall(s.n.id);
    this.proclaim(this.allFallen ? `${COUNTRY} has fallen` : s.n.word, this.allFallen ? 'And something has noticed.' : `${this.fallen.size} of ${NATIONS.length} nations conquered`, s.n.color);
    this.raiseBanners();
    this.world.work.shake = 0.5;
    this.world.work.shakeAt = p.state;
  }

  proclaim(line, under, color) {
    const { big } = this;
    for (const p of this.world.players) p.hud.hush();
    big.innerHTML = `<b style="color:${color}">${line}</b><span>${under}</span>`;
    big.className = '';
    void big.offsetWidth; // restarts the animation
    big.className = 'show';
    clearTimeout(this.bigTimer);
    this.bigTimer = setTimeout(() => { big.className = ''; }, FALL_SECS);
  }

  // Colors change hands: a fallen nation's towns fly the conqueror's pale banner.
  raiseBanners() {
    if (!this.cloth) {
      const towns = TOWNS.map((T) => [T, nationAt(T.x, T.z)]).filter(([, n]) => n);
      const count = towns.length * BANNERS;
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 16, 6).translate(0, 8, 0), new THREE.MeshLambertMaterial({ color: '#3a2c22' }), count);
      const flag = new THREE.PlaneGeometry(3.4, 6, 4, 4).translate(1.8, 12.4, 0);
      this.cloth = new THREE.InstancedMesh(flag, addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }), { from: 9, amount: 0.05 }), count);
      const d = new THREE.Object3D();
      towns.forEach(([T], i) => {
        for (let k = 0; k < BANNERS; k++) {
          const a = i * 1.7 + k * 3.14, r = T.kind === 'city' ? 40 : T.kind === 'village' ? 22 : T.r * 0.5, x = T.x + Math.cos(a) * r, z = T.z + (T.kind === 'city' ? 60 + k * 8 : Math.sin(a) * r);
          d.position.set(x, height(x, z) - 0.2, z);
          d.rotation.y = a;
          d.updateMatrix();
          pole.setMatrixAt(i * BANNERS + k, d.matrix);
          this.cloth.setMatrixAt(i * BANNERS + k, d.matrix);
        }
      });
      this.towns = towns;
      for (const m of [pole, this.cloth]) {
        m.frustumCulled = false;
        m.castShadow = true;
        this.scene.add(m);
      }
    }
    const c = new THREE.Color();
    this.towns.forEach(([, n], i) => {
      for (let k = 0; k < BANNERS; k++) this.cloth.setColorAt(i * BANNERS + k, c.set(this.fallen.has(n.id) ? YOURS : n.color));
    });
    this.cloth.instanceColor.needsUpdate = true;
    this.changed = (this.changed ?? 0) + 1;
  }

  // Crossing a border says so.
  update(dt) {
    if ((this.wait -= dt) > 0) return;
    this.wait = WATCH;
    for (const p of this.world.players) {
      if (p.rooms.house) continue;
      const n = nationAt(p.state.x, p.state.z), was = this.seen.get(p);
      if (n === was) continue;
      this.seen.set(p, n);
      if (was === undefined) continue;
      p.compass.announce(n ? n.name : 'Free land', n ? (this.isFallen(n) ? 'Yours by conquest' : `Held by ${n.ruler}`) : 'No banner flies here');
    }
  }

  // The live picture of one nation, for the map and the Nations tab.
  report(n) {
    const s = this.state.find((x) => x.n === n), fallen = this.fallen.has(n.id), done = this.broken(s);
    return { fallen, open: s.open, done: Math.min(done, s.need), need: s.need, seat: s.seat };
  }
}
