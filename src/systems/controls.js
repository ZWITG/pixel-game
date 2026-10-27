import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';

// One place for all input: keyboard and gamepad (standard layout, e.g. Xbox/PlayStation).
// Call update() once per frame, then read `just` (pressed this frame) and move().
const PAD = { A: 0, B: 1, X: 2, Y: 3, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEADZONE = 0.25;

const ACTIONS = {
  attack: { keys: ['SPACE', 'J'], pad: ['X'] },
  interact: { keys: ['E'], pad: ['Y'] },
  padA: { keys: [], pad: ['A'] },       // A talks when next to someone, otherwise attacks
  confirm: { keys: ['E', 'SPACE', 'ENTER'], pad: ['A'] },
  back: { keys: ['ESC', 'Q'], pad: ['B'] },
  up: { keys: ['W', 'UP'], pad: ['UP', 'STICK_UP'] },
  down: { keys: ['S', 'DOWN'], pad: ['DOWN', 'STICK_DOWN'] },
  restart: { keys: ['R'], pad: ['START', 'A'] },
};

const KEY_NAMES = 'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,E,ENTER,ESC,Q,R';

export function getPad() {
  if (!FEATURES.gamepad || !navigator.getGamepads) return null;
  return [...navigator.getGamepads()].find((p) => p && p.connected) ?? null;
}

export default class Controls {
  constructor(scene) {
    this.keys = scene.input.keyboard.addKeys(KEY_NAMES);
    this.padHeld = {};
    this.just = {};
  }

  readPad() {
    const pad = getPad();
    const state = {};
    if (!pad) return state;
    for (const [name, i] of Object.entries(PAD)) state[name] = !!pad.buttons[i]?.pressed;
    state.stickX = Math.abs(pad.axes[0] ?? 0) > DEADZONE ? pad.axes[0] : 0;
    state.stickY = Math.abs(pad.axes[1] ?? 0) > DEADZONE ? pad.axes[1] : 0;
    state.STICK_UP = state.stickY < -0.5;
    state.STICK_DOWN = state.stickY > 0.5;
    return state;
  }

  update() {
    // Every key is checked once per frame so presses never go stale.
    const keyJust = {};
    for (const [name, key] of Object.entries(this.keys)) keyJust[name] = Phaser.Input.Keyboard.JustDown(key);

    const pad = this.readPad();
    const padJust = {};
    for (const name of Object.keys(PAD).concat('STICK_UP', 'STICK_DOWN')) padJust[name] = !!pad[name] && !this.padHeld[name];
    this.padHeld = pad;

    for (const [action, map] of Object.entries(ACTIONS)) {
      this.just[action] = map.keys.some((k) => keyJust[k]) || map.pad.some((b) => padJust[b]);
    }
  }

  // Movement direction, each axis -1..1.
  move() {
    const k = this.keys, p = this.padHeld;
    let x = (k.D.isDown || k.RIGHT.isDown || p.RIGHT ? 1 : 0) - (k.A.isDown || k.LEFT.isDown || p.LEFT ? 1 : 0);
    let y = (k.S.isDown || k.DOWN.isDown || p.DOWN ? 1 : 0) - (k.W.isDown || k.UP.isDown || p.UP ? 1 : 0);
    if (!x && !y && (p.stickX || p.stickY)) {
      x = p.stickX;
      y = p.stickY;
    }
    return { x, y };
  }
}
