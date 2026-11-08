// Attack tells (v0.45.0): a glint on a foe winding up. Gold: block it or parry it. Red (a heavy blow): it breaks a
// guard, so dodge, Vanish or Perfect parry. The glint pops when the wind-up starts and flares again the moment the
// strike begins, for timing a parry. A red one also rings the ground, gives a short rumble and, the first time,
// says what it means. Called from monsters.warn; animated from monsters.update. Off switch: FEATURES.tells.
import * as THREE from 'three';
import { FEATURES } from '../config/features.js';
import { rumble } from './rumble.js';

const POOL = 12;
const POP = 0.09, HOLD = 0.32, FADE = 0.2;   // seconds: grow, stay, shrink after the first pop
const FLARE = 0.22;                          // seconds the second flare lasts
const SIZE = { gold: 1.2, red: 1.6 };        // tiles across at full size
const PARK = -9999;                          // where an idle glint waits (kept in the scene so its shader stays built)

// A four-pointed star with a soft core, drawn once.
function starTexture(core, edge, ring) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), m = 64;
  const glow = g.createRadialGradient(m, m, 0, m, m, 60);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.18, core);
  glow.addColorStop(0.5, edge + '55');
  glow.addColorStop(1, edge + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  for (const [w, h] of [[6, 62], [62, 6]]) {
    g.beginPath();
    g.moveTo(m - w, m);
    g.lineTo(m, m - h);
    g.lineTo(m + w, m);
    g.lineTo(m, m + h);
    g.closePath();
    g.fill();
  }
  if (ring) {
    g.strokeStyle = ring;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(m, m, 40, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default class Tells {
  constructor(scene) {
    const mat = (map) => new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mats = { gold: mat(starTexture('#ffe38a', '#ffb300')), red: mat(starTexture('#ff7060', '#ff1a1a', '#ff3a2a')) };
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const s = new THREE.Sprite(this.mats.gold);
      s.position.set(0, PARK, 0);
      s.renderOrder = 20;
      s.frustumCulled = false;
      scene.add(s);
      this.pool.push({ sprite: s, e: null, age: 9, flareAt: 0, flared: true, size: 1 });
    }
    this.toldPeril = new WeakSet(); // heroes who have been told what red means
  }

  // A foe starts a wind-up. `strikeAt`: when the strike begins (monsters.time), for the second flare.
  show(e, heavy, hero, strikeAt, time) {
    if (!FEATURES.tells) return;
    const g = this.pool.find((x) => x.e === e) ?? this.pool.find((x) => !x.e) ?? this.pool.reduce((a, b) => (a.age > b.age ? a : b));
    const kind = heavy ? 'red' : 'gold';
    g.e = e;
    g.age = 0;
    g.flareAt = strikeAt ?? 0;
    g.mode = e.mode;
    g.flareFrom = undefined;
    g.flared = !strikeAt || strikeAt <= time;
    g.size = SIZE[kind] * Math.max(1, Math.sqrt(e.group.scale.x || 1));
    g.sprite.material = this.mats[kind];
    if (!heavy || !hero) return;
    rumble(hero, 'peril');
    if (!this.toldPeril.has(hero)) {
      this.toldPeril.add(hero);
      hero.hud.message('Red flash: it breaks your guard. Dodge, Vanish or Perfect parry it.', false, 3500);
    }
  }

  update(dt, time) {
    for (const g of this.pool) {
      const { e, sprite } = g;
      if (!e) continue;
      g.age += dt;
      if (!g.flared && time >= g.flareAt) {
        g.flared = true;
        g.age = Math.max(g.age, POP + HOLD + FADE); // the first pop is over by now
        g.flareFrom = g.age;
      } else if (!g.flared && e.mode !== g.mode) {
        // Interrupted (parried, staggered, grabbed): no strike is coming, so it just fades.
        g.flared = true;
        g.age = Math.max(g.age, POP + HOLD);
      }
      let k;
      if (g.flareFrom !== undefined) {
        const f = (g.age - g.flareFrom) / FLARE;
        k = f < 0.25 ? 0.65 + 0.65 * (f / 0.25) : 1.3 * (1 - (f - 0.25) / 0.75);
      } else if (g.age < POP) k = g.age / POP;
      else if (g.age < POP + HOLD) k = 1 - ((g.age - POP) / HOLD) * 0.35;
      else if (!g.flared) k = 0.65; // still winding up: it stays lit until the strike
      else k = 0.65 * (1 - (g.age - POP - HOLD) / FADE);
      if (k <= 0 || e.dying || !e.group.parent) {
        g.e = null;
        g.flareFrom = undefined;
        sprite.position.set(0, PARK, 0);
        continue;
      }
      // At the head, a little toward the foe it's fighting, so it reads in front of the body.
      const hero = e.foe?.state, s = e.group.scale.x || 1, up = 0.9 + 1.1 * s;
      let ox = 0, oz = 0;
      if (hero) {
        const dx = hero.x - e.x, dz = hero.z - e.z, d = Math.hypot(dx, dz) || 1;
        ox = (dx / d) * (e.radius ?? 0.5) * 0.8;
        oz = (dz / d) * (e.radius ?? 0.5) * 0.8;
      }
      sprite.position.set(e.x + ox, e.group.position.y + up, e.z + oz);
      sprite.scale.setScalar(g.size * k);
      sprite.material.rotation = time * 1.5;
    }
  }
}
