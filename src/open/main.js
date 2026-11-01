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
import Quake from './quake.js';
import StartMenu, { loadSettings } from './startMenu.js';
import GameMenu from './gameMenu.js';
import ConquerorPick from './conquerorPick.js';
import { PowerFx } from './powers.js';
import { CONQUERORS } from './conquerors.js';

// World prototype: proves the look and the scale before the game's systems move here.
const FOV = 52;
const RUSH_FOV = 10;       // the view stretches with speed
const RUSH_PULL = 2.5;     // and drops back this many tiles
const RUSH_TRACK = 40;     // how much harder it follows the ground
const SPLIT_FOV = 72;      // a half-height picture needs a wider lens to show as much
const SPLIT_PULL = 0.35;   // and the camera sits this much further back
const SPLIT_RUN = 3;       // plus this many tiles while the hero is on the move
const QUERY = new URLSearchParams(location.search);
// What the picture gives up, in turn, to hold the frame rate: smoothing first, then resolution.
const LEVELS = [{ scale: 1, aa: 4 }, { scale: 1, aa: 0 }, { scale: 0.85, aa: 0 }, { scale: 0.72, aa: 0 }, { scale: 0.6, aa: 0 }, { scale: 0.5, aa: 0 }];
const SLOW = 0.021, FAST = 0.0178;        // seconds per frame that lower or raise the resolution
const PAUSED_FRAME = 0.1;                 // a frame this long is a hidden tab or a stall, not slowness
const SCALE_WAIT = 2.5;                   // seconds between changes, since each one costs a hitch
const CAMERA_DIST = 9.5;   // tiles behind the hero
const CAMERA_GROWTH = 5;   // extra distance per unit of hero scale, so a huge hero still fits
const CAMERA_LIFT = 7;     // how fast the camera follows the ground up and down
const LOOK_HEIGHT = 1.9;   // the point followed, above the feet
const AIM_ABOVE = 1.3;     // the camera aims this far over that, so the hero stands low in frame
const HILL_SAMPLES = 8;
const WALL_SAMPLES = 12;
const WALL_GAP = 0.8;      // how close it may pass a wall, in tiles
const WALL_RISE = 5;       // tiles it rises when a wall forces it in
const HIGH_UP = 22;        // tiles up, clear of every wall
const HOP = 4;             // tiles up before the camera follows into the air
const TELEPORT = 25;       // tiles moved in one frame that count as a jump
const MAX_SHAKE = 0.45;
const SHAKE_REACH = 70;
const MAX_HILL_LIFT = 9;   // tiles the camera may climb to see over ground behind the hero
const CAVE_LIGHT = 0.12;   // how much daylight reaches a cave
const ROOM_CAMERA = 5.5;   // camera distance indoors
const SPOT_KEY = 'lumen.spot', SPOT_EVERY = 10; // where the hero stands, and seconds between saves
const QUALITY_LEVEL = { high: 0, balanced: 2, fast: 4 };
const TITLE_BACK = 6.5, TITLE_SIDE = 3; // tiles behind and to the side of the hero in the title shot
const SPLIT_AT = 30, MERGE_AT = 20; // tiles apart; the gap keeps it from flickering at the edge
const SPLIT_HEIGHT = 7;   // a big difference in height splits too
const SPLIT_TIME = 0.6;   // seconds to slide between one view and two
const SPLIT_RUSH = 3;     // how much quicker that is for a hero at top speed or in flight
const SPLIT_SETTLE = 1;   // seconds before it can change back, so it never flickers
const SHIFT = 0.25;       // how far each picture slides, as a share of the screen height
const LEAVE_HOLD = 2;     // seconds P2 holds OPTIONS to leave

const SUN_REACH = 85;      // tiles of shadow each way from the hero

const TIMES = {
  day: { top: '#3674cc', mid: '#86b6e6', low: '#dfe6e6', fog: '#c6dae8', sun: [0.25, 0.85, 0.42], sunCol: '#fff6e6', cloud: '#ffffff', light: 3, amb: 2.1, density: 0.00036, shaft: 0.08, shadow: '#2a3a6a', sat: 1.08, bloom: 0.12, night: 0 },
  morning: { top: '#3f7fd0', mid: '#8fbce6', low: '#e6e4d8', fog: '#c9d8e2', sun: [0.5, 0.42, 0.6], sunCol: '#fff0d6', cloud: '#fbf8f2', light: 2.9, amb: 2, density: 0.00042, shaft: 0.25, shadow: '#2a3a6a', sat: 1.08, bloom: 0.16, night: 0 },
  dusk: { top: '#4a5ba8', mid: '#c48aa8', low: '#f8bc94', fog: '#dcaea2', sun: [-0.55, 0.26, 0.82], sunCol: '#ffb88a', cloud: '#f8cdb8', light: 3.1, amb: 1.9, density: 0.00062, shaft: 0.55, shadow: '#5a2a6a', sat: 1.12, bloom: 0.3, night: 0.15 },
  mist: { top: '#7f94a4', mid: '#a4b4bc', low: '#c0ccce', fog: '#b4c2c6', sun: [0.3, 0.6, 0.4], sunCol: '#f4f0e4', cloud: '#d6dedd', light: 1.6, amb: 2.2, density: 0.0021, shaft: 0.3, shadow: '#2a4a5a', sat: 1, bloom: 0.2, night: 0 },
  night: { top: '#060b24', mid: '#101c46', low: '#22325e', fog: '#1a2648', sun: [0.4, 0.6, -0.5], sunCol: '#b8c8ff', cloud: '#2a3a68', light: 1.2, amb: 1.25, density: 0.0007, shaft: 0, shadow: '#1a2a6a', sat: 1.05, bloom: 0.4, night: 1 },
};

// The turn of a day: each stop has a share of the day, and the sky blends between them.
const DAY_LENGTH = 960;     // seconds
const CLOCK = [['night', 0], ['night', 0.18], ['morning', 0.3], ['day', 0.46], ['day', 0.6], ['dusk', 0.74], ['night', 0.84], ['night', 1]];
const TIME_EVERY = 0.4;     // seconds between sky updates
const MIST_HOLD = 180;      // seconds a bank of mist stays before the day moves on
const QUIET_AFTER = 14000;  // ms the button list stays up after the last change of device

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping; // post.js shapes the picture itself
renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c0a4c6', 0.0007);
const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.3, 9000);
const hemi = new THREE.HemisphereLight('#ffffff', '#8a7f78', 1.4);
const sun = new THREE.DirectionalLight('#fff', 2.4);
sun.castShadow = true;
sun.shadow.autoUpdate = false; // redrawn every other frame, which the eye can't tell from every frame
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -SUN_REACH, right: SUN_REACH, top: SUN_REACH, bottom: -SUN_REACH, near: 1, far: 400 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
scene.add(hemi, sun, sun.target);

const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMaterial());
sky.frustumCulled = false;
scene.add(sky);

const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 3, WORLD * 3).rotateX(-Math.PI / 2), waterMaterial({ plane: true }));
water.frustumCulled = false;
water.position.set(WORLD / 2, -0.06, WORLD / 2);
scene.add(water);

const chunks = new Chunks(scene, renderer);
const marks = addLandmarks(scene);
addTowns(scene, marks);
const work = new Work(scene, chunks, marks);
const players = [];
const monsters = new Monsters(scene, work, players);
const shared2 = { yaw: 0, pitch: 0.2, recenter: null }; // the camera both heroes steer while together
const world = { scene, renderer, chunks, work, monsters, marks, players, shared: shared2, together: false, paused: false, time: 'morning', clock: 0.3, clockHold: 0, setTime, travel, splash };

world.fx = new PowerFx(scene);
world.pick = new ConquerorPick();
world.sites = new Sites(scene, monsters, work, players);
world.people = new People(scene, world);
world.quake = new Quake(scene, chunks);
monsters.quake = world.quake;
// The Spirit Tree stops the world. So does the Satchel when playing alone, but in co-op it only
// fills its owner's half: the other hero plays on, and both can have theirs open.
world.checkPause = () => {
  world.paused = world.menu || world.pick.isOpen || world.gameMenu.isOpen || players.some((p) => p.hud.mapOpen) || (players.length === 1 && p1.hud.packOpen);
};
world.viewYaw = (p) => (world.together ? shared2.yaw : p.state.yaw);

const views = [{ camera, post: new Post(renderer, scene, camera) }];
const splitView = new SplitView();
const split = { amount: 0, wait: 0, normal: new THREE.Vector2(0, -1) }; // 0 one picture, 1 fully split; P1 on top
let extra = null; // the second player: kept when they leave, so their sprite and HUD are reused

const p1 = new Player(0, world);
p1.controls.locks = true;
players.push(p1);
work.actor = p1;
p1.hud.camera = camera;
p1.hud.setHealth(1);
const state = p1.state;
const tmp = new THREE.Vector3();
const stopWatch = { stop: 0, promptDevice: null, padStatus: '', leaving: 0, joinHeld: {}, sky: 0, quietAt: performance.now() + QUIET_AFTER };

function blend(a, b, k) {
  const mixColor = (key) => new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), k);
  const out = {};
  for (const key of Object.keys(a)) out[key] = typeof a[key] === 'string' ? mixColor(key) : typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * k : a[key].map((v, i) => v + (b[key][i] - v) * k);
  return out;
}

function skyAt(clock) {
  const next = CLOCK.findIndex(([, at]) => at > clock), [from, start] = CLOCK[next - 1], [to, end] = CLOCK[next], k = (clock - start) / (end - start);
  return blend(TIMES[from], TIMES[to], k * k * (3 - 2 * k));
}

// Jumps to a time of day; mist holds the clock for a while.
function setTime(name) {
  world.time = name;
  world.clockHold = name === 'mist' ? MIST_HOLD : 0;
  const stop = CLOCK.find(([n]) => n === name);
  if (stop) world.clock = name === 'night' ? 0.05 : stop[1];
  applySky(TIMES[name]);
}

function moveClock(dt) {
  if (world.clockHold > 0) {
    world.clockHold -= dt;
    return;
  }
  world.clock = (world.clock + dt / DAY_LENGTH) % 1;
  if ((stopWatch.sky -= dt) > 0) return;
  stopWatch.sky = TIME_EVERY;
  applySky(skyAt(world.clock));
}

function applySky(t) {
  const u = sky.material.uniforms;
  u.uTop.value.set(t.top);
  u.uMid.value.set(t.mid);
  u.uLow.value.set(t.low);
  u.uSunCol.value.set(t.sunCol);
  u.uCloud.value.set(t.cloud);
  u.uSun.value.set(...t.sun).normalize();
  u.uFog.value.set(t.fog);
  u.uNight.value = t.night;
  shared.uSunDir.value.copy(u.uSun.value);
  shared.uSunCol.value.set(t.sunCol);
  shared.uSkyTop.value.set(t.mid);
  shared.uSkyLow.value.set(t.fog);
  shared.uNight.value = t.night;
  scene.fog.color.set(t.fog);
  scene.fog.density = t.density;
  sun.color.set(t.sunCol);
  sun.intensity = t.light;
  hemi.intensity = t.amb;
  hemi.color.set(t.mid);
  for (const v of views) v.post.setTime(t);
  world.light = t;
  monsters.nightfall = t.night > 0.6;
}

// Holds the frame rate on any machine by trading resolution for speed, never the other way.
const settings = loadSettings();
const pace = { level: Number(QUERY.get('level') ?? QUALITY_LEVEL[settings.quality] ?? 0), avg: FAST, wait: SCALE_WAIT, held: 0 };
function holdPace(dt) {
  if (QUERY.has('level') || settings.quality !== 'auto' || dt > PAUSED_FRAME) return;
  pace.avg += (dt - pace.avg) * 0.05;
  pace.wait -= dt;
  if (pace.wait > 0) return;
  const down = pace.avg > SLOW && pace.level < LEVELS.length - 1, up = pace.avg < FAST && pace.level > 0 && pace.level > pace.held;
  if (!down && !up) return;
  // A level that proved too slow stays off limits for a good while.
  pace.held = down ? pace.level + 1 : pace.held;
  pace.level += down ? 1 : -1;
  pace.wait = down ? SCALE_WAIT : SCALE_WAIT * 8;
  if (down) setTimeout(() => { pace.held = 0; }, 60000);
  resize();
}

function setQuality(id) {
  pace.level = QUALITY_LEVEL[id] ?? 0;
  pace.held = 0;
  resize();
}

function resize() {
  const { scale, aa } = LEVELS[pace.level], k = scale * Math.min(devicePixelRatio, 1.5);
  const w = Math.ceil(innerWidth * k), h = Math.ceil(innerHeight * k);
  renderer.setSize(w, h, false);
  for (const v of views) {
    v.camera.aspect = innerWidth / innerHeight;
    v.camera.updateProjectionMatrix();
    v.post.resize(w, h, aa);
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

// Every button in play, for the bar along the bottom and the Controls page.
function buttonRows(usePad) {
  const btn = buttonHtml, key = keyHtml, p = (action) => prompt(action, usePad ? 'pad' : 'keyboard');
  return [
    [usePad ? btn('L-stick') : `${key('KeyW')}${key('KeyA')}${key('KeyS')}${key('KeyD')}`, 'Move'],
    [usePad ? btn('R-stick') : key('Drag'), 'Look'],
    [usePad ? btn('R2') : key('ShiftLeft'), 'Sprint'],
    [p('jump'), 'Jump'],
    [p('punch'), PUNCHES[p1.melee.stage].name],
    [p('grab'), 'Grab'],
    [p('guard'), 'Guard'],
    [p('roll'), 'Roll'],
    [p('target'), 'Lock on'],
    [p('pack'), 'Satchel'],
    [usePad ? btn('D-pad') : `${key('Digit1')}${key('Digit2')}${key('Digit3')}${key('Digit4')}`, 'Powers'],
    [p('pause'), 'Menu'],
  ];
}

// Button prompts follow the device used last.
function renderPrompts() {
  const { controls, melee } = p1, pad = controls.pad, two = players.length > 1;
  const names = (c) => `${(c.pad?.id || 'Controller').split(' (')[0]}`;
  const status = two ? `P1 ${names(p1.controls)}  ·  P2 ${names(extra.controls)}`
    : pad ? `${names(controls)} connected${FEATURES.coop ? '  ·  Player 2: press OPTIONS on a second controller' : ''}`
      : 'No controller yet: press any button on it';
  if (status !== stopWatch.padStatus) {
    document.getElementById('pad-status').textContent = stopWatch.padStatus = status;
    stopWatch.quietAt = performance.now() + QUIET_AFTER;
  }
  const d = controls.device, key_ = `${d}${melee.stage}`;
  document.body.classList.toggle('quiet', settings.hints === 'off' || (settings.hints === 'auto' && performance.now() > stopWatch.quietAt));
  if (key_ === stopWatch.promptDevice) return;
  stopWatch.promptDevice = key_;
  stopWatch.quietAt = performance.now() + QUIET_AFTER;
  const usePad = d === 'pad', btn = buttonHtml, key = keyHtml;
  const p = (action) => prompt(action, d);
  document.getElementById('help').innerHTML = buttonRows(usePad).map(([k, label]) => `${k} ${label}`).join('&nbsp;&nbsp; ');
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
    applySky(world.light);
  }
  extra.hero.show(true);
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
  if (!extra.powers.def) world.pick.open(extra, () => {});
}

function leave() {
  if (world.gameMenu.owner === extra) world.gameMenu.close();
  if (world.pick.owner === extra) world.pick.cancel();
  extra.hud.closeAll(extra);
  if (extra.rooms.house) extra.rooms.leave(extra.state);
  players.pop();
  world.checkPause();
  extra.hero.show(false);
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
  if (!FEATURES.coop || world.menu) return;
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
  p.camAir = (p.camAir ?? 0) + ((s.air > HOP ? s.air : 0) - (p.camAir ?? 0)) * Math.min(1, dt * 14);
  const lookY = p.camY + p.camAir + LOOK_HEIGHT * big, inside = !!p.rooms.house;
  // Eased, so starting and stopping don't bump the camera.
  p.camRun = (p.camRun ?? 0) + ((s.moving ? 1 : 0) - (p.camRun ?? 0)) * Math.min(1, dt * 2);
  const room = players.length > 1 ? split.amount : 0;
  const far = inside ? ROOM_CAMERA : (CAMERA_DIST + (big - 1) * CAMERA_GROWTH) * (1 + SPLIT_PULL * room) + p.camRun * SPLIT_RUN * room + rush * RUSH_PULL;
  const cx = s.x + Math.sin(s.yaw) * cp * far, cy = lookY + Math.sin(s.pitch) * far, cz = s.z + Math.cos(s.yaw) * cp * far;
  const need = inside ? 0 : clearance(s.x, lookY, s.z, cx, cy, cz);
  // Backed against a wall, it moves in and rises to look down past the shoulder.
  const open = inside || s.air > HIGH_UP ? 1 : solidStop(s.x, s.z, cx, cz), lift = Math.min(need, MAX_HILL_LIFT) + (1 - open) * WALL_RISE;
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
  const high = (p) => Math.max(p.state.y, 0) + p.state.air;
  const apart = a.rooms.house || b.rooms.house || Math.abs(high(a) - high(b)) > SPLIT_HEIGHT;
  split.wait = Math.max(0, split.wait - dt);
  if (world.together && (apart || span > SPLIT_AT)) {
    world.together = false;
    split.wait = SPLIT_SETTLE;
    a.state.yaw = b.state.yaw = shared2.yaw;
    a.state.pitch = b.state.pitch = shared2.pitch;
  } else if (!world.together && !apart && span < MERGE_AT && !split.wait) {
    world.together = true;
    split.wait = SPLIT_SETTLE;
    shared2.yaw = a.state.yaw;
    shared2.pitch = a.state.pitch;
  }
  const goal = world.together ? 0 : 1;
  const quick = dt * (1 + Math.max(a.state.pace ?? 0, b.state.pace ?? 0, a.state.flying || b.state.flying ? 1 : 0) * SPLIT_RUSH) / SPLIT_TIME;
  split.amount += THREE.MathUtils.clamp(goal - split.amount, -quick, quick);
}

function setLens(cam, fov) {
  if (cam.fov === fov) return;
  cam.fov = fov;
  cam.updateProjectionMatrix();
}

// The title shot: over the hero's shoulder toward the Spire, drifting very slowly. Choosing a
// Conqueror, the camera comes round to the front, with the hero standing to the right.
function titleView() {
  const [dx, dz] = state.dir, len = Math.hypot(dx, dz) || 1, ax = dx / len, az = dz / len, time = shared.uTime.value;
  if (world.pick.isOpen) {
    const y0 = Math.max(state.y, 0), big = p1.body.heroScale;
    camera.position.set(state.x + ax * 6.4 * big - az * 2.3 * big, y0 + 1.9 * big, state.z + az * 6.4 * big + ax * 2.3 * big);
    camera.lookAt(state.x - az * 2.3 * big, y0 + 1.35 * big, state.z + ax * 2.3 * big);
    setLens(camera, FOV);
    return;
  }
  const drift = Math.sin(time * 0.08) * 0.8, y = Math.max(state.y, 0);
  camera.position.set(state.x - ax * TITLE_BACK + az * (TITLE_SIDE + drift), y + 2.6 + Math.sin(time * 0.11) * 0.15, state.z - az * TITLE_BACK - ax * (TITLE_SIDE + drift));
  camera.lookAt(state.x + ax * 60 - az * -16, y + 13, state.z + az * 60 + ax * -16);
  setLens(camera, FOV);
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
      tmp.y += (p.camY + p.camAir + 1.4 * p.body.heroScale - p.camLook.y) * k;
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
      v.camera.position.addScaledVector(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), Math.min(MAX_SHAKE + work.rumble * 0.1, work.shake));
    }
  });
  if (world.menu) titleView();
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
  // Snapped to the shadow map's texels, so shadow edges hold still while the hero moves.
  const texel = (SUN_REACH * 2) / sun.shadow.mapSize.x;
  sun.target.position.set(Math.round(p.state.x / texel) * texel, Math.round(p.state.y / texel) * texel, Math.round(p.state.z / texel) * texel);
  sun.position.copy(sun.target.position).addScaledVector(dir, 180);
  sun.shadow.needsUpdate = split.amount > 0 || (stopWatch.frame = (stopWatch.frame ?? 0) + 1) % 2 === 0;
  sky.position.copy(v.camera.position);
  water.position.x = v.camera.position.x;
  water.position.z = v.camera.position.z;
  v.post.indoors = !!p.rooms.house;
  hemi.intensity = world.light.amb * (p.rooms.house?.dark ? CAVE_LIGHT : 1);
  v.post.render(dir);
}

function step(dt) {
  holdPace(dt);
  dt = Math.min(dt, 0.05);
  // Hit-stop: the world all but freezes for an instant, so a heavy blow feels heavy.
  if (work.stop > 0) {
    work.stop -= dt;
    dt *= 0.08;
  }
  shared.uTime.value += dt;
  windTime.value = shared.uTime.value;
  for (const p of players) p.controls.update(dt);
  const begin = world.menu && !world.pick.isOpen ? menu.update(dt) : null;
  if (world.pick.isOpen) world.pick.update();
  else if (world.gameMenu.isOpen) world.gameMenu.update(dt);
  joinOrLeave(dt);
  renderPrompts();
  world.checkPause();
  if (players.length > 1) updateSplit(dt);
  for (const p of players) {
    p.update(dt);
    if (FEATURES.compass && settings.compass) p.compass.update(p, world.viewYaw(p), dt);
  }
  if (!world.paused && FEATURES.dayCycle) moveClock(dt);

  chunks.update(players.map((p) => [p.state.x, p.state.z]));
  aimCameras(dt);

  if (!world.paused) {
    if (FEATURES.monsters) monsters.update(dt);
    if (FEATURES.sites) world.sites.update(dt);
    world.people.update(dt);
    for (const p of players) p.melee.update(dt, p.state);
    work.update(dt);
    world.quake.update(dt);
  }

  const dir = sky.material.uniforms.uSun.value;
  marks.crystals.material.opacity = 0.7 + Math.sin(shared.uTime.value * 1.4) * 0.3;
  for (const isle of marks.isles) isle.position.y += Math.sin(shared.uTime.value * 0.3 + isle.userData.bob) * 0.02;

  for (const r of rings) {
    r.age += dt;
    r.ring.material.opacity = Math.max(0, 0.8 - r.age * 1.2);
    r.ring.scale.setScalar(1 + r.age * 2.5);
  }
  if (!world.menu) keepSpot(dt);
  if (begin) beginGame(begin);
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
}

// Saves where the hero stands, and the hour, so Continue picks up right there.
function saveSpot() {
  if (world.menu || p1.rooms.house) return;
  try {
    localStorage.setItem(SPOT_KEY, JSON.stringify({ x: state.x, z: state.z, dir: state.dir, clock: world.clock }));
  } catch { /* no storage: the hero simply starts from the shore */ }
}

function keepSpot(dt) {
  if ((stopWatch.spot = (stopWatch.spot ?? SPOT_EVERY) - dt) > 0) return;
  stopWatch.spot = SPOT_EVERY;
  saveSpot();
}

function beginGame(how) {
  menu.hide();
  // A new hero chooses a Conqueror first, with the world still waiting behind the screen.
  if (how === 'new' && !p1.powers.def) {
    document.body.classList.add('title');
    world.pick.open(p1, () => beginGame('new'));
    return;
  }
  world.menu = false;
  let spot = null;
  try {
    spot = how === 'continue' ? JSON.parse(localStorage.getItem(SPOT_KEY)) : null;
  } catch { /* an unreadable spot just means the shore */ }
  if (spot) {
    world.clock = spot.clock;
    applySky(skyAt(spot.clock));
    goto(spot.x, spot.z, spot.x + spot.dir[0], spot.z + spot.dir[1]);
  } else {
    setTime('morning');
    goto(SPAWN.x, SPAWN.z, PLACES.spire.x, PLACES.spire.z);
  }
  p1.hud.message(spot ? 'Welcome back.' : 'The Lantern Spire stands across the water.', true);
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
  chunks.settle();
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
const fresh = sessionStorage.getItem('lumen.fresh');
sessionStorage.removeItem('lumen.fresh');
const menu = new StartMenu(p1, settings, { onQuality: setQuality, rows: buttonRows });
world.menu = !QUERY.has('play');
document.getElementById('start').hidden = !world.menu || !!fresh;
document.body.classList.toggle('title', world.menu);
if (!world.menu) menu.hide();
// Settings the title screen and the menu in play both change.
function applySettings() {
  setQuality(settings.quality);
  document.body.classList.toggle('no-compass', !settings.compass);
}
function toTitle() {
  saveSpot();
  location.reload();
}
world.gameMenu = new GameMenu({ world, settings, applySettings, rows: buttonRows, toTitle });
document.body.classList.toggle('no-compass', !settings.compass);
addEventListener('pagehide', saveSpot);
setTime(world.menu ? 'dusk' : 'morning');
window.__world = { menu, players, world, split, views, join, leave, monsters, height, PUNCHES, work, marks, melee: p1.melee, bag: p1.bag, rooms: p1.rooms, body: p1.body, controls: p1.controls, skills: p1.skills, swim: p1.swim, hud: p1.hud, camera, step, goto, SHOTS, setTime, state, renderer, chunks };
let last = performance.now();
const loop = (now) => {
  step((now - last) / 1000);
  last = now;
  requestAnimationFrame(loop);
};
goto(SPAWN.x, SPAWN.z, PLACES.spire.x, PLACES.spire.z);
if (CONQUERORS[QUERY.get('play')] && !p1.powers.def) p1.becomeConqueror(QUERY.get('play'));
if (fresh) beginGame('new');
requestAnimationFrame(loop);
