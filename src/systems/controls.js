import { FEATURES } from '../config/features.js';

// One place for all input: keyboard, mouse and gamepad.
// Buttons use PS5 names. Browsers report every standard gamepad in this order,
// so other pads work too (Xbox A = Cross, B = Circle, X = Square, Y = Triangle, LB = L1...).
// Call update(dt) once per frame, then read `just` (pressed this frame), move() and look().
export const PAD = {
  CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5, L2: 6, R2: 7,
  CREATE: 8, OPTIONS: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, PS: 16, TOUCHPAD: 17,
};
// Stick pushes that count as button presses. FLICK_* are right-stick flicks.
const STICK_EDGES = ['STICK_UP', 'STICK_DOWN', 'STICK_LEFT', 'STICK_RIGHT', 'FLICK_LEFT', 'FLICK_RIGHT'];
const DEADZONE = 0.25;
const FLICK = 0.6;
const LOOK_SPEED = 2.6;     // radians per second from the right stick or Z / X
const MOUSE_SPEED = 0.006;  // radians per pixel of mouse drag

// The control scheme. The first key and first button of each action are shown in prompts.
export const ACTIONS = {
  // World
  attack: { keys: ['Space', 'KeyJ'], pad: ['SQUARE', 'R1'] },
  spin: { keys: ['KeyF', 'KeyL'], pad: ['R2', 'TRIANGLE'] },
  dodge: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], pad: ['CIRCLE'] },
  interact: { keys: ['KeyE'], pad: ['CROSS'] },
  lock: { keys: ['KeyQ', 'Tab'], pad: ['L2', 'R3'] },
  targetLeft: { keys: ['KeyZ'], pad: ['FLICK_LEFT'] },   // while locked on; otherwise Z / X turn the camera
  targetRight: { keys: ['KeyX'], pad: ['FLICK_RIGHT'] },
  recenter: { keys: ['KeyV'], pad: ['L1'] },                      // swing the camera behind the hero
  camera: { keys: ['KeyC'], pad: ['TOUCHPAD', 'CREATE'] },         // switch view (only with FEATURES.topDownCamera)
  pause: { keys: ['Escape', 'KeyP'], pad: ['OPTIONS'] },
  restart: { keys: ['KeyR'], pad: ['CROSS', 'OPTIONS'] },
  // Menus
  confirm: { keys: ['KeyE', 'Space', 'Enter'], pad: ['CROSS'] },
  back: { keys: ['Escape', 'KeyQ'], pad: ['CIRCLE'] },
  up: { keys: ['KeyW', 'ArrowUp'], pad: ['UP', 'STICK_UP'] },
  down: { keys: ['KeyS', 'ArrowDown'], pad: ['DOWN', 'STICK_DOWN'] },
  left: { keys: ['KeyA', 'ArrowLeft'], pad: ['LEFT', 'STICK_LEFT', 'L1'] },
  right: { keys: ['KeyD', 'ArrowRight'], pad: ['RIGHT', 'STICK_RIGHT', 'R1'] },
};
const NO_DEFAULT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']; // keys the browser shouldn't act on

export function getPad() {
  if (!FEATURES.gamepad || !navigator.getGamepads) return null;
  return [...navigator.getGamepads()].find((p) => p && p.connected) ?? null;
}

const axis = (v) => (Math.abs(v ?? 0) > DEADZONE ? v : 0);

export default class Controls {
  constructor(dragTarget) {
    this.held = new Set();
    this.queued = new Set(); // keys pressed since the last update, so quick taps are never missed
    this.padHeld = {};
    this.just = {};
    this.lookDelta = { x: 0, y: 0 };
    this.mouse = { dx: 0, dy: 0, dragging: false };
    this.device = 'keyboard'; // last used: 'keyboard' or 'pad' (prompts follow it)

    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.queued.add(e.code);
      this.held.add(e.code);
      this.device = 'keyboard';
      if (NO_DEFAULT.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
    dragTarget.addEventListener('mousedown', () => {
      this.mouse.dragging = true;
      this.device = 'keyboard';
    });
    window.addEventListener('mouseup', () => { this.mouse.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouse.dragging) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
  }

  readPad() {
    const pad = getPad();
    const state = {};
    if (!pad) return state;
    for (const [name, i] of Object.entries(PAD)) state[name] = !!pad.buttons[i]?.pressed;
    state.stickX = axis(pad.axes[0]);
    state.stickY = axis(pad.axes[1]);
    state.lookX = axis(pad.axes[2]);
    state.lookY = axis(pad.axes[3]);
    state.STICK_UP = state.stickY < -0.5;
    state.STICK_DOWN = state.stickY > 0.5;
    state.STICK_LEFT = state.stickX < -0.5;
    state.STICK_RIGHT = state.stickX > 0.5;
    state.FLICK_LEFT = state.lookX < -FLICK;
    state.FLICK_RIGHT = state.lookX > FLICK;
    return state;
  }

  update(dt) {
    const keyJust = this.queued;
    this.queued = new Set();

    const pad = this.readPad();
    const padJust = {};
    for (const name of [...Object.keys(PAD), ...STICK_EDGES]) padJust[name] = !!pad[name] && !this.padHeld[name];
    this.padHeld = pad;
    if (Object.keys(PAD).some((b) => pad[b]) || pad.stickX || pad.stickY || pad.lookX || pad.lookY) this.device = 'pad';

    for (const [action, map] of Object.entries(ACTIONS)) {
      this.just[action] = map.keys.some((k) => keyJust.has(k)) || map.pad.some((b) => padJust[b]);
    }

    // Camera turning: right stick, mouse drag, or Z / X on the keyboard.
    const h = this.held;
    let lx = (pad.lookX || 0) * LOOK_SPEED * dt + this.mouse.dx * MOUSE_SPEED;
    const ly = (pad.lookY || 0) * LOOK_SPEED * dt + this.mouse.dy * MOUSE_SPEED;
    if (h.has('KeyZ')) lx -= LOOK_SPEED * dt;
    if (h.has('KeyX')) lx += LOOK_SPEED * dt;
    this.lookDelta = { x: lx, y: ly };
    this.mouse.dx = this.mouse.dy = 0;
  }

  // Movement on screen axes (x right, y down), each -1..1.
  move() {
    const h = this.held, p = this.padHeld;
    let x = (h.has('KeyD') || h.has('ArrowRight') || p.RIGHT ? 1 : 0) - (h.has('KeyA') || h.has('ArrowLeft') || p.LEFT ? 1 : 0);
    let y = (h.has('KeyS') || h.has('ArrowDown') || p.DOWN ? 1 : 0) - (h.has('KeyW') || h.has('ArrowUp') || p.UP ? 1 : 0);
    if (!x && !y && (p.stickX || p.stickY)) {
      x = p.stickX;
      y = p.stickY;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  look() {
    return this.lookDelta;
  }
}
