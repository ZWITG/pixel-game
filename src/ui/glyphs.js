import { ACTIONS } from '../systems/controls.js';

// Button prompts for keyboard and controller. Controller prompts use the PS5 face-button shapes.
export const FACE = {
  CROSS: { color: '#7cb2ff', shape: '<path d="M5.5 5.5 L12.5 12.5 M12.5 5.5 L5.5 12.5"/>' },
  CIRCLE: { color: '#ff6b81', shape: '<circle cx="9" cy="9" r="4.2"/>' },
  SQUARE: { color: '#f49ad8', shape: '<rect x="5.2" y="5.2" width="7.6" height="7.6"/>' },
  TRIANGLE: { color: '#45e0b4', shape: '<path d="M9 4.6 L13.2 12.2 L4.8 12.2 Z"/>' },
};
const PAD_LABELS = {
  CREATE: 'Create', OPTIONS: 'Options', TOUCHPAD: 'Touchpad', UP: 'D-pad', DOWN: 'D-pad',
  LEFT: 'D-pad', RIGHT: 'D-pad', FLICK_LEFT: 'R-stick', FLICK_RIGHT: 'R-stick',
};
const KEY_LABELS = {
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc', Enter: 'Enter',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
};

// A face button as SVG markup, drawn at (x, y) when `at` is given (for the controller diagram).
export function faceSvg(name, size = 16, at = null) {
  const f = FACE[name];
  const inner = `<circle cx="9" cy="9" r="8.5" fill="#1a1c2c"/><g fill="none" stroke="${f.color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${f.shape}</g>`;
  if (at) return `<svg x="${at[0] - size / 2}" y="${at[1] - size / 2}" width="${size}" height="${size}" viewBox="0 0 18 18">${inner}</svg>`;
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 18 18">${inner}</svg>`;
}

export function buttonHtml(name) {
  return FACE[name] ? faceSvg(name) : `<span class="btn">${PAD_LABELS[name] ?? name}</span>`;
}

export function keyHtml(code) {
  return `<span class="key">${KEY_LABELS[code] ?? code.replace(/^Key|^Digit/, '')}</span>`;
}

// The prompt for an action on the device the player used last ('pad' or 'keyboard').
export function prompt(action, device) {
  const map = ACTIONS[action];
  return device === 'pad' ? buttonHtml(map.pad[0]) : keyHtml(map.keys[0]);
}
