import { FEATURES } from '../config/features.js';

// One place for all input: keyboard, mouse and gamepad (standard layout, e.g. Xbox/PlayStation).
// Call update(dt) once per frame, then read `just` (pressed this frame), move() and look().
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEADZONE = 0.25;
const LOOK_SPEED = 2.6;     // radians per second from stick or keys
const MOUSE_SPEED = 0.006;  // radians per pixel of mouse drag

const ACTIONS = {
  attack: { keys: ['Space', 'KeyJ'], pad: ['X'] },
  interact: { keys: ['KeyE'], pad: ['Y'] },
  padA: { keys: [], pad: ['A'] },       // A talks when next to someone, otherwise attacks
  confirm: { keys: ['KeyE', 'Space', 'Enter'], pad: ['A'] },
  back: { keys: ['Escape', 'KeyQ'], pad: ['B'] },
  up: { keys: ['KeyW', 'ArrowUp'], pad: ['UP', 'STICK_UP'] },
  down: { keys: ['KeyS', 'ArrowDown'], pad: ['DOWN', 'STICK_DOWN'] },
  restart: { keys: ['KeyR'], pad: ['START', 'A'] },
  camera: { keys: ['KeyV'], pad: ['BACK', 'R3'] },
};
const NO_SCROLL = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

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

    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.queued.add(e.code);
      this.held.add(e.code);
      if (NO_SCROLL.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
    dragTarget.addEventListener('mousedown', () => { this.mouse.dragging = true; });
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
    return state;
  }

  update(dt) {
    const keyJust = this.queued;
    this.queued = new Set();

    const pad = this.readPad();
    const padJust = {};
    for (const name of [...Object.keys(PAD), 'STICK_UP', 'STICK_DOWN']) padJust[name] = !!pad[name] && !this.padHeld[name];
    this.padHeld = pad;

    for (const [action, map] of Object.entries(ACTIONS)) {
      this.just[action] = map.keys.some((k) => keyJust.has(k)) || map.pad.some((b) => padJust[b]);
    }

    const h = this.held;
    let lx = (pad.lookX || 0) * LOOK_SPEED * dt + this.mouse.dx * MOUSE_SPEED;
    const ly = (pad.lookY || 0) * LOOK_SPEED * dt + this.mouse.dy * MOUSE_SPEED;
    if (h.has('KeyZ') || pad.LB) lx -= LOOK_SPEED * dt;
    if (h.has('KeyX') || pad.RB) lx += LOOK_SPEED * dt;
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
