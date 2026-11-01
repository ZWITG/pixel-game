import * as THREE from 'three';
import { PAD } from '../systems/controls.js';
import { prompt, buttonHtml, keyHtml } from '../ui/glyphs.js';
import { height, PLACES, SPAWN, WORLD, TOWNS } from './terrain.js';
import Chunks from './chunks.js';
import { addLandmarks } from './landmarks.js';
import { addTowns, People } from './towns.js';
import { skyMaterial, waterMaterial, shared } from './materials.js';
import { windTime } from '../render/wind.js';
import { focus } from './foliage.js';
import Post from './post.js';
import { FEATURES } from '../config/features.js';
import Work from './work.js';
import { PUNCHES } from './melee.js';
import Monsters from './monsters.js';
import Player from './player.js';
import SplitView from './splitView.js';
import Sites from './sites.js';

// World prototype: proves the look and the scale before the game's systems move here.
const FOV = 52;
const RUSH_FOV = 10;       // the view stretches with speed
const RUSH_PULL = 2.5;     // and drops back this many tiles
const RUSH_TRACK = 40;     // how much harder it follows the ground
const SPLIT_FOV = 72;      // a half-height picture needs a wider lens to show as much
const SPLIT_PULL = 0.35;   // and the camera sits this much further back
const SPLIT_RUN = 3;       // plus this many tiles while the hero is on the move
const PIXEL = Number(new URLSearchParams(location.search).get('px') ?? 1.5); // screen pixels per game pixel
const CAMERA_DIST = 9.5;   // tiles behind the hero
const CAMERA_GROWTH = 5;   // extra distance per unit of hero scale, so a huge hero still fits
const CAMERA_LIFT = 7;     // how fast the camera follows the ground up and down
const LOOK_HEIGHT = 1.9;   // the point followed, above the feet
const AIM_ABOVE = 1.3;     // the camera aims this far over that, so the hero stands low in frame
const HILL_SAMPLES = 8;
const WALL_SAMPLES = 12;
const WALL_GAP = 0.8;      // how close it may pass a wall, in tiles
const WALL_RISE = 5;       // tiles it rises when a wall forces it in
const HOP = 4;             // tiles up before the camera follows into the air
const TELEPORT = 25;       // tiles moved in one frame that count as a jump
const MAX_SHAKE = 0.45;
const SHAKE_REACH = 70;
const MAX_HILL_LIFT = 9;   // tiles the camera may climb to see over ground behind the hero
const CAVE_LIGHT = 0.12;   // how much daylight reaches a cave
const ROOM_CAMERA = 5.5;   // camera distance indoors
const SPLIT_AT = 30, MERGE_AT = 20; // tiles apart; the gap keeps it from flickering at the edge
const SPLIT_HEIGHT = 14;  // a big difference in height splits too
const SPLIT_TIME = 0.6;   // seconds to slide between one view and two
const SHIFT = 0.25;       // how far each picture slides, as a share of the screen height
const LEAVE_HOLD = 2;     // seconds P2 holds OPTIONS to leave

const TIMES = {
  morning: { top: '#6f9bd8', mid: '#bcd2ea', low: '#efe0cc', fog: '#c6d3e0', sun: [0.5, 0.42, 0.6], sunCol: '#fff0d0', cloud: '#f6f2ea', light: 2.8, amb: 1.8, density: 0.0007, shaft: 0.35, shadow: '#2a3a6a', sat: 1.2, bloom: 0.22 },
  dusk: { top: '#7f7fb8', mid: '#b79ac4', low: '#f0b4b8', fog: '#c0a4c6', sun: [-0.55, 0.13, 0.82], sunCol: '#ffc4b0', cloud: '#f4cdd2', light: 2.4, amb: 1.9, density: 0.0011, shaft: 0.8, shadow: '#5a2a6a', sat: 1.25, bloom: 0.4 },
  mist: { top: '#7f94a4', mid: '#a4b4bc', low: '#c0ccce', fog: '#b0bec4', sun: [0.3, 0.6, 0.4], sunCol: '#f4f0e4', cloud: '#d6dedd', light: 1.5, amb: 1.7, density: 0.003, shaft: 0.5, shadow: '#2a4a5a', sat: 1.1, bloom: 0.25 },
  night: { top: '#0c1436', mid: '#1c2a58', low: '#384a78', fog: '#26345c', sun: [0.4, 0.6, -0.5], sunCol: '#b8c8ff', cloud: '#34457a', light: 1.3, amb: 1.5, density: 0.0012, shaft: 0, shadow: '#1a2a6a', sat: 1.1, bloom: 0.5 },
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
const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.3, 9000);
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
addTowns(scene, marks);
const work = new Work(scene, chunks, marks);
const players = [];
const monsters = new Monsters(scene, work, players);
const shared2 = { yaw: 0, pitch: 0.2, recenter: null }; // the camera both heroes steer while together
const world = { scene, renderer, chunks, work, monsters, marks, players, shared: shared2, together: false, paused: false, time: 'dusk', setTime, travel, splash };

world.sites = new Sites(scene, monsters, work, players);
world.people = new People(scene, world);
// The Spirit Tree stops the world. So does the Satchel when playing alone, but in co-op it only
// fills its owner's half: the other hero plays on, and both can have theirs open.
world.checkPause = () => {
  world.paused = players.some((p) => p.hud.mapOpen) || (players.length === 1 && p1.hud.packOpen);
};
world.viewYaw = (p) => (world.together ? shared2.yaw : p.state.yaw);

const views = [{ camera, post: new Post(renderer, scene, camera) }];
const splitView = new SplitView();
const split = { amount: 0, normal: new THREE.Vector2(0, -1) }; // 0 one picture, 1 fully split; P1 on top
let extra = null; // the second player: kept when they leave, so their sprite and HUD are reused

const p1 = new Player(0, world);
p1.controls.locks = true;
players.push(p1);
work.actor = p1;
p1.hud.camera = camera;
p1.hud.setHealth(1);
const state = p1.state;
const tmp = new THREE.Vector3();
const stopWatch = { stop: 0, lit: '', promptDevice: null, padStatus: '', leaving: 0, joinHeld: {} };

function setTime(name) {
  const t = TIMES[name];
  const u = sky.material.uniforms;
  u.uTop.value.set(t.top);
  u.uMid.value.set(t.mid);
  u.uLow.value.set(t.low);
  u.uSunCol.value.set(t.sunCol);
  u.uCloud.value.set(t.cloud);
  u.uSun.value.set(...t.sun).normalize();
  scene.fog.color.set(t.fog);
  scene.fog.density = t.density;
  sun.color.set(t.sunCol);
  sun.intensity = t.light;
  hemi.intensity = t.amb;
  hemi.color.set(t.mid);
  for (const v of views) v.post.setTime(t);
  world.time = name;
  monsters.nightfall = name === 'night';
}

function resize() {
  const w = Math.ceil(innerWidth / PIXEL), h = Math.ceil(innerHeight / PIXEL);
  renderer.setSize(w, h, false);
  for (const v of views) {
    v.camera.aspect = innerWidth / innerHeight;
    v.camera.updateProjectionMatrix();
    v.post.resize(w, h);
  }
}
addEventListener('resize', resize);
resize();

function nearestPlace() {
  let best = null, d = 1e9;
  for (const p of [...Object.values(PLACES), ...TOWNS]) {
    const k = Math.hypot(state.x - p.x, state.z - p.z) - p.r;
    if (k < d) { d = k; best = p; }
  }
  return `${best.name} ${d > 0 ? `· ${Math.round(d)} m away` : ''}`;
}

// Rings on the water around a swimmer, more of them for a flailing beginner.
const rings = Array.from({ length: 6 }, () => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false }));
  ring.position.y = 0.03;
  scene.add(ring);
  return { ring, age: 9 };
});
function splash(p, dt) {
  if ((p.ringTimer -= dt) > 0) return;
  p.ringTimer = p.swim.flailing ? 0.2 : 0.5;
  const r = rings.reduce((a, b) => (a.age > b.age ? a : b));
  r.age = 0;
  r.ring.position.x = p.state.x;
  r.ring.position.z = p.state.z;
}

// Button prompts follow the device used last.
function renderPrompts() {
  const { controls, melee } = p1, pad = controls.pad, two = players.length > 1;
  const names = (c) => `${(c.pad?.id || 'Controller').split(' (')[0]}`;
  const status = two ? `P1 ${names(p1.controls)}  ·  P2 ${names(extra.controls)}`
    : pad ? `${names(controls)} connected${FEATURES.coop ? '  ·  Player 2: press OPTIONS on a second controller' : ''}`
      : 'No controller yet: press any button on it';
  if (status !== stopWatch.padStatus) document.getElementById('pad-status').textContent = stopWatch.padStatus = status;
  const d = controls.device, key_ = `${d}${melee.stage}`;
  if (key_ === stopWatch.promptDevice) return;
  stopWatch.promptDevice = key_;
  const usePad = d === 'pad', btn = buttonHtml, key = keyHtml;
  const p = (action) => prompt(action, d);
  document.getElementById('help').innerHTML = [
    [usePad ? btn('L-stick') : `${key('KeyW')}${key('KeyA')}${key('KeyS')}${key('KeyD')}`, 'Move'],
    [usePad ? btn('R-stick') : key('Drag'), 'Look'],
    [usePad ? btn('R2') : key('ShiftLeft'), 'Sprint'],
    [p('jump'), 'Jump'],
    [p('punch'), PUNCHES[melee.stage].name],
    [p('recenter'), 'Recenter'],
    [p('camera'), 'Travel'],
    [p('pack'), 'Satchel'],
    [p('pause'), 'Spirit Tree'],
  ].map(([k, label]) => `${k} ${label}`).join('&nbsp;&nbsp; ');
  document.getElementById('map-hints').innerHTML = `${usePad ? btn('D-pad') : `${key('KeyW')}${key('KeyA')}${key('KeyS')}${key('KeyD')}`} Move&nbsp;&nbsp; ${p('back')} Close`;
}

// Touchpad: both heroes go together.
function travel(who) {
  stopWatch.stop = stopWatch.stop % 6 + 1;
  state.drone = null;
  goto(...SHOTS[stopWatch.stop]);
  who.hud.message(nearestPlace().split(' ·')[0], true);
}

function join() {
  if (!extra) {
    extra = new Player(1, world);
    const camera2 = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.3, 9000);
    extra.hud.camera = camera2;
    views.push({ camera: camera2, post: new Post(renderer, scene, camera2) });
    resize();
    setTime(world.time);
  }
  extra.hero.mesh.visible = true;
  extra.state.x = state.x + 2.5;
  extra.state.z = state.z + 1;
  extra.state.dir = [...state.dir];
  players.push(extra);
  shared2.yaw = state.yaw;
  shared2.pitch = state.pitch;
  world.together = true;
  document.body.classList.add('two');
  extra.hp = extra.body.maxHealth;
  extra.hud.setHealth(1);
  p1.hud.message('Player 2 joined!', true);
  extra.hud.message('Hello, Player 2!', true);
}

function leave() {
  extra.hud.closeAll(extra);
  if (extra.rooms.house) extra.rooms.leave(extra.state);
  players.pop();
  world.checkPause();
  extra.hero.mesh.visible = false;
  extra.controls.padIndex = null;
  p1.controls.avoid = null;
  state.yaw = shared2.yaw;
  state.pitch = shared2.pitch;
  world.together = false;
  split.amount = 0;
  views[0].camera.clearViewOffset();
  camera.fov = FOV;
  camera.updateProjectionMatrix();
  document.body.classList.remove('two');
  p1.hud.message('Player 2 left.');
}

// A second pad pressing OPTIONS joins in; holding it down leaves again.
const OPTIONS = PAD.OPTIONS;
function joinOrLeave(dt) {
  if (!FEATURES.coop) return;
  if (players.length > 1) {
    stopWatch.leaving = extra.controls.padHeld.OPTIONS ? stopWatch.leaving + dt : 0;
    if (stopWatch.leaving > LEAVE_HOLD) {
      stopWatch.leaving = 0;
      leave();
    }
    return;
  }
  const mine = p1.controls.pad;
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad || !pad.connected) continue;
    const down = !!pad.buttons[OPTIONS]?.pressed, was = stopWatch.joinHeld[pad.index];
    stopWatch.joinHeld[pad.index] = down;
    // A virtual twin of P1's own pad presses in step with it, and must not count as a new player.
    if (!down || was || pad.index === mine?.index || mine?.buttons[OPTIONS]?.pressed) continue;
    join();
    extra.controls.padIndex = pad.index;
    extra.controls.padHeld = { OPTIONS: true };
    p1.controls.avoid = pad.index;
    return;
  }
}

// How much higher the far end of a sight line must be to clear the ground along it.
function clearance(ax, ay, az, bx, by, bz) {
  let lift = 0;
  for (let i = 1; i <= HILL_SAMPLES; i++) {
    const t = i / HILL_SAMPLES;
    const over = height(ax + (bx - ax) * t, az + (bz - az) * t) + 0.7 - (ay + (by - ay) * t);
    if (over > 0) lift = Math.max(lift, over / t);
  }
  return lift;
}

// How far along the line from a to b the camera can go before a wall or landmark, 0..1.
function solidStop(ax, az, bx, bz) {
  for (let i = 1; i <= WALL_SAMPLES; i++) {
    const t = i / WALL_SAMPLES, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    for (const s of marks.solids) {
      if (s.off) continue;
      const inside = s.r ? Math.hypot(x - s.x, z - s.z) < s.r + WALL_GAP
        : x > s.x0 - WALL_GAP && x < s.x1 + WALL_GAP && z > s.z0 - WALL_GAP && z < s.z1 + WALL_GAP;
      if (inside) return (i - 1) / WALL_SAMPLES;
    }
  }
  return 1;
}

// One hero's own camera: behind and above, looking past them so they stand low in the frame
// rather than hiding the way ahead. It eases after the hero, and climbs over hills behind them,
// only moving in if it can't get high enough.
function personal(p, dt) {
  const s = p.state, big = p.body.heroScale, cp = Math.cos(s.pitch), eyeY = Math.max(s.y, -0.3);
  // A long jump in position (travel, waking up, doors) starts the camera fresh, not catching up.
  if (Math.hypot(s.x - (p.camX ?? s.x), s.z - (p.camZ ?? s.z)) > TELEPORT) p.camY = p.camLift = p.camDist = undefined;
  p.camX = s.x;
  p.camZ = s.z;
  // At speed it holds a steadier height and tracks the ground harder, so hills don't throw it.
  const rush = p.camRush = (p.camRush ?? 0) + ((s.pace ?? 0) - (p.camRush ?? 0)) * Math.min(1, dt * 4);
  p.camY = p.camY === undefined || Math.abs(p.camY - eyeY) > 30 ? eyeY : p.camY + (eyeY - p.camY) * Math.min(1, dt * (CAMERA_LIFT + rush * RUSH_TRACK));
  // A jump leaves the camera where it is; real flight takes it along.
  p.camAir = (p.camAir ?? 0) + ((s.air > HOP ? s.air : 0) - (p.camAir ?? 0)) * Math.min(1, dt * 6);
  const lookY = p.camY + p.camAir + LOOK_HEIGHT * big, inside = !!p.rooms.house;
  // Eased, so starting and stopping don't bump the camera.
  p.camRun = (p.camRun ?? 0) + ((s.moving ? 1 : 0) - (p.camRun ?? 0)) * Math.min(1, dt * 2);
  const room = players.length > 1 ? split.amount : 0;
  const far = inside ? ROOM_CAMERA : (CAMERA_DIST + (big - 1) * CAMERA_GROWTH) * (1 + SPLIT_PULL * room) + p.camRun * SPLIT_RUN * room + rush * RUSH_PULL;
  const cx = s.x + Math.sin(s.yaw) * cp * far, cy = lookY + Math.sin(s.pitch) * far, cz = s.z + Math.cos(s.yaw) * cp * far;
  const need = inside ? 0 : clearance(s.x, lookY, s.z, cx, cy, cz);
  // Backed against a wall, it moves in and rises to look down past the shoulder.
  const open = inside ? 1 : solidStop(s.x, s.z, cx, cz), lift = Math.min(need, MAX_HILL_LIFT) + (1 - open) * WALL_RISE;
  // Quick to rise for a hill, slow to settle back, so it doesn't pump.
  p.camLift = (p.camLift ?? lift) + (lift - (p.camLift ?? lift)) * Math.min(1, dt * (lift > (p.camLift ?? lift) ? 10 - rush * 6 : 2));
  const want = Math.min(need > MAX_HILL_LIFT ? far * Math.max(0.45, MAX_HILL_LIFT / need) : far, far * Math.max(0.18, open));
  p.camDist = (p.camDist ?? want) + (want - (p.camDist ?? want)) * Math.min(1, dt * (want < (p.camDist ?? want) ? 10 : 2.5));
  const d = p.camDist;
  tmp.set(s.x + Math.sin(s.yaw) * cp * d, lookY + Math.sin(s.pitch) * d + p.camLift, s.z + Math.cos(s.yaw) * cp * d);
  // At speed the bumps underfoot go past too quickly to follow, so the height is smoothed out.
  p.camHigh = rush > 0.02 ? (p.camHigh ?? tmp.y) + (tmp.y - (p.camHigh ?? tmp.y)) * Math.min(1, dt * (14 - rush * 6)) : tmp.y;
  tmp.y = p.camHigh;
  if (inside) p.rooms.clampCamera(tmp, s.x, s.z);
  else tmp.y = Math.max(tmp.y, height(tmp.x, tmp.z) + 0.8, 0.8);
  p.camPos.copy(tmp);
  p.camLook.set(s.x, lookY + AIM_ABOVE * Math.min(1, d / CAMERA_DIST) + (s.air - p.camAir) * 0.5, s.z);
}

// One camera behind both heroes, pulling back as they drift apart.
const sharedPos = new THREE.Vector3(), sharedLook = new THREE.Vector3();
function together(a, b, span, dt) {
  const { yaw, pitch } = shared2, far = CAMERA_DIST + span * 0.8, cp = Math.cos(pitch);
  const x = (a.state.x + b.state.x) / 2, z = (a.state.z + b.state.z) / 2, eye = (a.camY + a.camAir + b.camY + b.camAir) / 2 + LOOK_HEIGHT;
  const reachX = x + Math.sin(yaw) * cp * far, reachZ = z + Math.cos(yaw) * cp * far;
  const dist = far * Math.max(0.4, solidStop(x, z, reachX, reachZ));
  sharedPos.set(x + Math.sin(yaw) * cp * dist, eye + Math.sin(pitch) * dist, z + Math.cos(yaw) * cp * dist);
  // The shared view climbs over hills the same way a hero's own does.
  const lift = Math.min(MAX_HILL_LIFT, clearance(x, eye, z, sharedPos.x, sharedPos.y, sharedPos.z));
  shared2.lift = (shared2.lift ?? lift) + (lift - (shared2.lift ?? lift)) * Math.min(1, dt * (lift > (shared2.lift ?? lift) ? 10 : 2));
  sharedPos.y = Math.max(sharedPos.y + shared2.lift, height(sharedPos.x, sharedPos.z) + 0.8, 0.8);
  sharedLook.set(x, eye + AIM_ABOVE, z);
}

// The adaptive split: one shared view when close, sliding to two views as the heroes part.
function updateSplit(dt) {
  const [a, b] = players;
  const span = Math.hypot(a.state.x - b.state.x, a.state.z - b.state.z);
  const apart = a.rooms.house || b.rooms.house || Math.abs(a.state.y - b.state.y) > SPLIT_HEIGHT;
  if (world.together && (apart || span > SPLIT_AT)) {
    world.together = false;
    a.state.yaw = b.state.yaw = shared2.yaw;
    a.state.pitch = b.state.pitch = shared2.pitch;
  } else if (!world.together && !apart && span < MERGE_AT) {
    world.together = true;
    shared2.yaw = a.state.yaw;
    shared2.pitch = a.state.pitch;
  }
  const goal = world.together ? 0 : 1;
  split.amount += THREE.MathUtils.clamp(goal - split.amount, -dt / SPLIT_TIME, dt / SPLIT_TIME);
}

function setLens(cam, fov) {
  if (cam.fov === fov) return;
  cam.fov = fov;
  cam.updateProjectionMatrix();
}

function aimCameras(dt) {
  const [a, b] = players;
  personal(a, dt);
  if (!b) {
    camera.position.copy(a.camPos);
    camera.lookAt(a.camLook);
    setLens(camera, FOV + a.camRush * RUSH_FOV);
  } else {
    personal(b, dt);
    together(a, b, Math.hypot(a.state.x - b.state.x, a.state.z - b.state.z), dt);
    const k = split.amount * split.amount * (3 - 2 * split.amount);
    views.forEach((v, i) => {
      const p = players[i];
      v.camera.position.lerpVectors(sharedPos, p.camPos, k);
      // In a half-height picture the hero stands in the middle, not low in the frame.
      tmp.lerpVectors(sharedLook, p.camLook, k);
      tmp.y += (p.state.y + 1.4 * p.body.heroScale - p.camLook.y) * k;
      v.camera.lookAt(tmp);
      // Slide each picture so its hero stands in the middle of their half, not on the line.
      setLens(v.camera, FOV + (SPLIT_FOV - FOV) * k + p.camRush * RUSH_FOV);
      const w = v.camera.aspect, side = (i ? 1 : -1) * k * SHIFT;
      if (k > 0) v.camera.setViewOffset(w, 1, -side * split.normal.x, side * split.normal.y, w, 1);
      else v.camera.clearViewOffset();
    });
  }
  // A blow shakes the screens near it, not a partner on the far side of the world.
  const source = work.shakeAt ?? a.state;
  views.forEach((v, i) => {
    const s = (players[i] ?? a).state;
    if (work.shake && Math.hypot(s.x - source.x, s.z - source.z) < SHAKE_REACH) {
      v.camera.position.addScaledVector(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), Math.min(MAX_SHAKE, work.shake));
    }
  });
  if (state.drone) {
    // Preview only: a raised camera aimed at a landmark.
    const [up, lx, ly, lz] = state.drone;
    camera.position.set(state.x, state.y + up, state.z);
    camera.lookAt(lx, ly, lz);
  }
}

function renderView(v, p, dir) {
  const time = shared.uTime.value;
  for (const hero of players) hero.pose(v.camera, time);
  // Sharing a view, both heroes stay visible. Split, only this view's hero matters; clearing a
  // sight line to a partner far away would carve a tunnel through the forest.
  for (const [i, u] of [focus.uFocus, focus.uFocus2].entries()) {
    const s = (split.amount > 0 ? p : players[i] ?? p).state;
    u.value.set(s.x, s.y + 1.4 + s.air, s.z);
  }
  sun.target.position.set(p.state.x, p.state.y, p.state.z);
  sun.position.copy(sun.target.position).addScaledVector(dir, 180);
  sky.position.copy(v.camera.position);
  water.position.x = v.camera.position.x;
  water.position.z = v.camera.position.z;
  v.post.indoors = !!p.rooms.house;
  hemi.intensity = TIMES[world.time].amb * (p.rooms.house?.dark ? CAVE_LIGHT : 1);
  v.post.render(dir);
}

function step(dt) {
  dt = Math.min(dt, 0.05);
  // Hit-stop: the world all but freezes for an instant, so a heavy blow feels heavy.
  if (work.stop > 0) {
    work.stop -= dt;
    dt *= 0.08;
  }
  shared.uTime.value += dt;
  windTime.value = shared.uTime.value;
  for (const p of players) p.controls.update(dt);
  joinOrLeave(dt);
  renderPrompts();
  world.checkPause();
  if (players.length > 1) updateSplit(dt);
  for (const p of players) p.update(dt);

  chunks.update(players.map((p) => [p.state.x, p.state.z]));
  aimCameras(dt);

  if (!world.paused) {
    if (FEATURES.monsters) monsters.update(dt);
    if (FEATURES.sites) world.sites.update(dt);
    world.people.update(dt);
    for (const p of players) p.melee.update(dt, p.state);
    work.update(dt);
  }

  const dir = sky.material.uniforms.uSun.value;
  marks.crystals.material.opacity = 0.7 + Math.sin(shared.uTime.value * 1.4) * 0.3;
  for (const isle of marks.isles) isle.position.y += Math.sin(shared.uTime.value * 0.3 + isle.userData.bob) * 0.02;

  for (const r of rings) {
    r.age += dt;
    r.ring.material.opacity = Math.max(0, 0.8 - r.age * 1.2);
    r.ring.scale.setScalar(1 + r.age * 2.5);
  }
  if (world.skipRender) return;
  const [a, b] = players;
  if (b && split.amount > 0) {
    views.forEach((v, i) => {
      v.post.toScreen = false;
      renderView(v, players[i], dir);
    });
    splitView.render(renderer, views[0].post.output, views[1].post.output, split.normal, split.amount, camera.aspect);
  } else {
    views[0].post.toScreen = true;
    renderView(views[0], a, dir);
  }
  const text = p1.rooms.house ? 'Inside a house' : `${nearestPlace()}   |   ${(state.x / 1000).toFixed(2)} km, ${(state.z / 1000).toFixed(2)} km   |   height ${Math.round(state.y)}`;
  if (text !== stopWatch.lit) document.getElementById('where').textContent = stopWatch.lit = text;
}

// Previews: stand somewhere, look at something, at a time of day.
function goto(x, z, lookX, lookZ, time) {
  state.x = x;
  state.z = z;
  state.yaw = Math.atan2(x - lookX, z - lookZ);
  state.dir = [lookX - x, lookZ - z];
  shared2.yaw = state.yaw;
  if (players[1]) {
    Object.assign(players[1].state, { x: x + 2.5, z: z + 1, yaw: state.yaw, dir: [...state.dir] });
  }
  if (time) setTime(time);
  const points = players.map((p) => [p.state.x, p.state.z]);
  chunks.update(points);
  while (chunks.pending) chunks.update(points);
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
window.__world = { players, world, split, views, join, leave, monsters, height, PUNCHES, work, marks, melee: p1.melee, bag: p1.bag, rooms: p1.rooms, body: p1.body, controls: p1.controls, skills: p1.skills, swim: p1.swim, hud: p1.hud, camera, step, goto, SHOTS, setTime, state, renderer, chunks };
let last = performance.now();
const loop = (now) => {
  step((now - last) / 1000);
  last = now;
  requestAnimationFrame(loop);
};
goto(SPAWN.x, SPAWN.z, PLACES.spire.x, PLACES.spire.z, 'dusk');
requestAnimationFrame(loop);
