import * as THREE from 'three';
import { FEATURES } from '../config/features.js';

// Day and night. The clock runs 0..24 (hours); a whole day takes DAY_LENGTH seconds of play.
const DAY_LENGTH = 480;
const START_HOUR = 8;
const STARS = 450;
// How the world looks at key hours; hours in between are blended.
// top/horizon: sky gradient (horizon is also the fog), sun: light color and intensity,
// hemi: ambient light, night: 0 (day) .. 1 (deep night) for lamps, windows, stars and fireflies.
const KEYS = [
  { h: 0, top: '#0a0f2e', horizon: '#1f2852', sun: '#8d9be0', sunI: 0.5, hemi: 0.5, night: 1 },
  { h: 5, top: '#141a42', horizon: '#3b3a6c', sun: '#9a9ad8', sunI: 0.5, hemi: 0.55, night: 0.9 },
  { h: 6.5, top: '#4d6cb8', horizon: '#ffb48c', sun: '#ffb070', sunI: 1.7, hemi: 1.0, night: 0.25 },
  { h: 8, top: '#4a8fe0', horizon: '#cdeaff', sun: '#fff1d6', sunI: 2.6, hemi: 1.5, night: 0 },
  { h: 16.5, top: '#4a8fe0', horizon: '#cdeaff', sun: '#fff1d6', sunI: 2.6, hemi: 1.5, night: 0 },
  { h: 18.5, top: '#3d5aa6', horizon: '#ff9a6a', sun: '#ff9050', sunI: 1.7, hemi: 1.0, night: 0.25 },
  { h: 20, top: '#151a44', horizon: '#3c3062', sun: '#9a9ad8', sunI: 0.55, hemi: 0.55, night: 0.85 },
  { h: 24, top: '#0a0f2e', horizon: '#1f2852', sun: '#8d9be0', sunI: 0.5, hemi: 0.5, night: 1 },
];
const COLOR_KEYS = ['top', 'horizon', 'sun'];
for (const k of KEYS) for (const c of COLOR_KEYS) k[c] = new THREE.Color(k[c]);

export default class DayNight {
  // lights: { sun, hemi, halos, windowMat, glowMat } from Game and buildWorld.
  constructor(scene, lights) {
    this.scene = scene;
    this.lights = lights;
    this.hour = START_HOUR;
    this.day = 1;
    this.look = { top: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(), sunI: 0, hemi: 0, night: 0 };

    this.canvas = document.createElement('canvas');
    this.canvas.width = 2;
    this.canvas.height = 256;
    this.sky = new THREE.CanvasTexture(this.canvas);
    this.sky.colorSpace = THREE.SRGBColorSpace;
    scene.background = this.sky;
    this.skyKey = '';

    const pos = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const a = Math.random() * Math.PI * 2, up = 0.08 + Math.random() * 0.92;
      const flat = Math.sqrt(1 - up * up);
      pos.set([Math.cos(a) * flat * 90, up * 90, Math.sin(a) * flat * 90], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    scene.add(this.stars);
    this.apply({ x: 0, z: 0 }, null);
  }

  get night() {
    return this.look.night;
  }

  // "Morning 08:00" for the HUD.
  get label() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour % 1) * 60);
    const part = h < 5 || h >= 20 ? 'Night' : h < 8 ? 'Dawn' : h < 12 ? 'Morning' : h < 17 ? 'Day' : 'Dusk';
    return `${part} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // The clock only runs while the world does (not in menus).
  advance(dt) {
    if (!FEATURES.dayNight) return;
    this.hour += (dt / DAY_LENGTH) * 24;
    if (this.hour >= 24) {
      this.hour -= 24;
      this.day++;
    }
  }

  // Lights, sky, fog and stars for the current hour; the sun follows the hero for sharp shadows.
  apply(player, camera) {
    const h = FEATURES.dayNight ? this.hour : 12;
    let i = 0;
    while (KEYS[i + 1].h < h) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = (h - a.h) / (b.h - a.h);
    const L = this.look;
    for (const c of COLOR_KEYS) L[c].copy(a[c]).lerp(b[c], k);
    for (const n of ['sunI', 'hemi', 'night']) L[n] = a[n] + (b[n] - a[n]) * k;

    const { sun, hemi, halos, windowMat, glowMat } = this.lights;
    sun.color.copy(L.sun);
    sun.intensity = L.sunI;
    hemi.intensity = L.hemi;
    hemi.color.copy(L.horizon).lerp(new THREE.Color('#d6efff'), 0.6);
    this.scene.fog.color.copy(L.horizon);

    // Sun arcs east to west by day; the moon takes over at night.
    const day = h >= 5 && h < 20;
    const arc = day ? ((h - 5) / 15) * Math.PI : (((h < 5 ? h + 24 : h) - 20) / 9) * Math.PI;
    sun.position.set(player.x + Math.cos(arc) * 12, 3 + Math.sin(arc) * 13, player.z + 6);
    sun.target.position.set(player.x, 0, player.z);

    for (const halo of halos) halo.material.opacity = 0.2 + 0.7 * L.night;
    if (windowMat) windowMat.opacity = 0.9 * L.night;
    glowMat.color.setScalar(0.7 + 0.5 * L.night);
    this.stars.material.opacity = Math.max(0, L.night - 0.2) * 1.2;
    if (camera) this.stars.position.copy(camera.position);

    // Redraw the sky gradient only when it visibly changed.
    const key = `${L.top.getHexString()}${L.horizon.getHexString()}`;
    if (key !== this.skyKey) {
      this.skyKey = key;
      const ctx = this.canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, `#${L.top.getHexString()}`);
      grad.addColorStop(0.75, `#${L.horizon.getHexString()}`);
      grad.addColorStop(1, `#${L.horizon.getHexString()}`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2, 256);
      this.sky.needsUpdate = true;
    }
  }
}
