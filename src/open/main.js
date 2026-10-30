import * as THREE from 'three';
import Controls from '../systems/controls.js';
import { HERO_LOOK } from '../art/looks.js';
import { makeHumanoid, walkPose } from '../render/models.js';
import { height, PLACES, SPAWN, WORLD } from './terrain.js';
import Chunks from './chunks.js';
import { addLandmarks } from './landmarks.js';
import { skyMaterial, waterMaterial, shared } from './materials.js';

// World prototype: proves the look and the scale before the game's systems move here.
const PIXEL = Number(new URLSearchParams(location.search).get('px') ?? 2); // screen pixels per game pixel
const RUN = 6, SPRINT = 16;

const TIMES = {
  morning: { top: '#6f9bd8', mid: '#bcd2ea', low: '#efe0cc', fog: '#c6d3e0', sun: [0.5, 0.42, 0.6], sunCol: '#fff0d0', light: 2.8, amb: 1.8, density: 0.00055 },
  dusk: { top: '#7f7fb8', mid: '#b79ac4', low: '#f0b4b8', fog: '#c0a4c6', sun: [-0.55, 0.13, 0.82], sunCol: '#ffc4b0', light: 2.4, amb: 1.9, density: 0.0007 },
  mist: { top: '#7f94a4', mid: '#a4b4bc', low: '#c0ccce', fog: '#b0bec4', sun: [0.3, 0.6, 0.4], sunCol: '#f4f0e4', light: 1.5, amb: 1.7, density: 0.0016 },
  night: { top: '#0c1436', mid: '#1c2a58', low: '#384a78', fog: '#26345c', sun: [0.4, 0.6, -0.5], sunCol: '#b8c8ff', light: 1.3, amb: 1.5, density: 0.0009 },
};

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated';
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c0a4c6', 0.0007);
const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.3, 9000);
const hemi = new THREE.HemisphereLight('#ffffff', '#7a6a70', 1.4);
const sun = new THREE.DirectionalLight('#fff', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
scene.add(hemi, sun, sun.target);

const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMaterial());
sky.frustumCulled = false;
scene.add(sky);

const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 3, WORLD * 3).rotateX(-Math.PI / 2), waterMaterial());
water.position.set(WORLD / 2, 0, WORLD / 2);
scene.add(water);

const chunks = new Chunks(scene);
const marks = addLandmarks(scene);
const controls = new Controls(renderer.domElement);

const hero = makeHumanoid(HERO_LOOK, { sword: true });
hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
scene.add(hero.group);

const state = { x: SPAWN.x, z: SPAWN.z, yaw: 2.6, pitch: 0.16, phase: 0, walk: 0, time: 0, lit: '' };
const tmp = new THREE.Vector3();

function setTime(name) {
  const t = TIMES[name];
  const u = sky.material.uniforms;
  u.uTop.value.set(t.top);
  u.uMid.value.set(t.mid);
  u.uLow.value.set(t.low);
  u.uSunCol.value.set(t.sunCol);
  u.uSun.value.set(...t.sun).normalize();
  scene.fog.color.set(t.fog);
  scene.fog.density = t.density;
  sun.color.set(t.sunCol);
  sun.intensity = t.light;
  hemi.intensity = t.amb;
  hemi.color.set(t.mid);
  state.time = name;
}

function resize() {
  renderer.setSize(Math.ceil(innerWidth / PIXEL), Math.ceil(innerHeight / PIXEL), false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function nearestPlace() {
  let best = null, d = 1e9;
  for (const p of Object.values(PLACES)) {
    const k = Math.hypot(state.x - p.x, state.z - p.z) - p.r;
    if (k < d) { d = k; best = p; }
  }
  return `${best.name} ${d > 0 ? `· ${Math.round(d)} m away` : ''}`;
}

function step(dt) {
  dt = Math.min(dt, 0.05);
  shared.uTime.value += dt;
  controls.update(dt);
  const look = controls.look();
  state.yaw -= look.x;
  state.pitch = THREE.MathUtils.clamp(state.pitch + look.y, -0.25, 1.2);

  const m = controls.move(), amount = Math.min(1, Math.hypot(m.x, m.y));
  if (amount > 0.05) {
    const sprint = controls.held.has('ShiftLeft') || controls.padHeld.R2;
    const s = Math.sin(state.yaw), c = Math.cos(state.yaw), speed = (sprint ? SPRINT : RUN) * amount;
    const wx = c * m.x + s * m.y, wz = -s * m.x + c * m.y;
    const nx = state.x + wx * speed * dt, nz = state.z + wz * speed * dt;
    const rise = height(nx, nz) - height(state.x, state.z), dist = Math.hypot(nx - state.x, nz - state.z);
    if (rise / Math.max(dist, 1e-3) < 1.4 && height(nx, nz) > -1.2) {
      state.x = nx;
      state.z = nz;
    }
    hero.group.rotation.y = Math.atan2(wx, wz);
    state.phase += dt * (sprint ? 16 : 11);
  }
  state.walk += ((amount > 0.05 ? 1 : 0) - state.walk) * Math.min(1, dt * 12);
  walkPose(hero, state.phase, state.walk);
  if (hero.cape) hero.cape.rotation.x = 0.06 + state.walk * 0.5;
  const y = height(state.x, state.z);
  hero.group.position.set(state.x, Math.max(y, -0.9), state.z);

  chunks.update(state.x, state.z);

  const dist = 7, cp = Math.cos(state.pitch);
  tmp.set(state.x + Math.sin(state.yaw) * cp * dist, y + 1.7 + Math.sin(state.pitch) * dist, state.z + Math.cos(state.yaw) * cp * dist);
  tmp.y = Math.max(tmp.y, height(tmp.x, tmp.z) + 0.8);
  camera.position.copy(tmp);
  camera.lookAt(state.x, y + 1.7, state.z);
  if (state.drone) {
    // Preview only: a raised camera aimed at a landmark.
    const [up, lx, ly, lz] = state.drone;
    camera.position.set(state.x, y + up, state.z);
    camera.lookAt(lx, ly, lz);
  }

  const dir = sky.material.uniforms.uSun.value;
  sun.target.position.set(state.x, y, state.z);
  sun.position.copy(sun.target.position).addScaledVector(dir, 180);
  sky.position.copy(camera.position);
  water.position.x = camera.position.x;
  water.position.z = camera.position.z;
  marks.crystals.material.opacity = 0.7 + Math.sin(shared.uTime.value * 1.4) * 0.3;
  for (const isle of marks.isles) isle.position.y += Math.sin(shared.uTime.value * 0.3 + isle.userData.bob) * 0.02;

  renderer.render(scene, camera);
  const text = `${nearestPlace()}   |   ${(state.x / 1000).toFixed(2)} km, ${(state.z / 1000).toFixed(2)} km   |   height ${Math.round(y)}`;
  if (text !== state.lit) document.getElementById('where').textContent = state.lit = text;
}

// Previews: stand somewhere, look at something, at a time of day.
function goto(x, z, lookX, lookZ, time) {
  state.x = x;
  state.z = z;
  state.yaw = Math.atan2(x - lookX, z - lookZ);
  if (time) setTime(time);
  chunks.update(x, z);
  while (chunks.pending) chunks.update(x, z);
  step(0.016);
}
const SHOTS = {
  1: [3650, 4600, 4300, 4120, 'dusk'],
  2: [5050, 3350, 5900, 2700, 'morning'],
  3: [2420, 3800, 2000, 3200, 'mist'],
  4: [5650, 5420, 6300, 5700, 'dusk'],
  5: [3000, 2300, 3500, 800, 'morning'],
  6: [2940, 5470, 2900, 5300, 'night'],
};
addEventListener('keydown', (e) => {
  const s = SHOTS[e.key];
  if (s) goto(...s);
});

setTime('dusk');
window.__world = { step, goto, SHOTS, setTime, state, renderer, chunks };
let last = performance.now();
const loop = (now) => {
  step((now - last) / 1000);
  last = now;
  requestAnimationFrame(loop);
};
goto(SPAWN.x, SPAWN.z, PLACES.spire.x, PLACES.spire.z, 'dusk');
requestAnimationFrame(loop);
