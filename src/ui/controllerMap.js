import { FEATURES } from '../config/features.js';
import { ACTIONS } from '../systems/controls.js';
import { FACE, faceSvg, keyHtml } from './glyphs.js';

// The controls screen: a generic PS5-style controller drawing with a label for every
// button, built from the bindings in systems/controls.js so it never goes out of date.

const NAMES = {
  attack: 'Attack', spin: 'Spin slash', dodge: 'Roll', interact: 'Talk', lock: 'Lock on',
  recenter: 'Recenter camera', camera: FEATURES.topDownCamera && 'Camera view', pause: 'Controls', confirm: 'Confirm', back: 'Back',
  up: 'Menus', down: 'Menus', left: 'Shop tab', right: 'Shop tab',
};

// Where each control sits on the drawing (viewBox 800 x 300) and which side its label goes.
const SPOTS = [
  { side: 'L', title: 'L2', at: [300, 45], buttons: ['L2'] },
  { side: 'L', title: 'L1', at: [300, 62], buttons: ['L1'] },
  { side: 'L', title: 'Create', at: [337, 89], buttons: ['CREATE'] },
  { side: 'L', title: 'Touchpad', at: [400, 102], buttons: ['TOUCHPAD'] },
  { side: 'L', title: 'D-pad', at: [280, 125], buttons: ['UP', 'LEFT'], extra: ['Move'] },
  { side: 'L', title: 'Left stick', at: [335, 170], buttons: [], extra: ['Move'] },
  { side: 'R', title: 'R2', at: [500, 45], buttons: ['R2'] },
  { side: 'R', title: 'R1', at: [500, 62], buttons: ['R1'] },
  { side: 'R', title: 'Options', at: [463, 89], buttons: ['OPTIONS'] },
  { side: 'R', title: 'TRIANGLE', at: [520, 103], buttons: ['TRIANGLE'] },
  { side: 'R', title: 'CIRCLE', at: [542, 125], buttons: ['CIRCLE'] },
  { side: 'R', title: 'CROSS', at: [520, 147], buttons: ['CROSS'] },
  { side: 'R', title: 'SQUARE', at: [498, 125], buttons: ['SQUARE'] },
  { side: 'R', title: 'Right stick', at: [465, 170], buttons: [], extra: ['Turn camera', 'Click: lock on', 'Flick: switch target'] },
];
const LINE = 11;

function actionsFor(buttons) {
  const names = [];
  for (const [action, map] of Object.entries(ACTIONS)) {
    if (NAMES[action] && map.pad.some((b) => buttons.includes(b)) && !names.includes(NAMES[action])) names.push(NAMES[action]);
  }
  return names;
}

function body() {
  return `
  <path d="M305 70 L495 70 Q540 70 555 110 L590 215 Q600 255 565 262 Q540 265 525 240 L495 195 L305 195 L275 240
           Q260 265 235 262 Q200 255 210 215 L245 110 Q260 70 305 70 Z" fill="#eef1f7" stroke="#1a1c2c" stroke-width="3"/>
  <rect x="272" y="36" width="56" height="18" rx="6" fill="#c9d0de" stroke="#1a1c2c" stroke-width="2"/>
  <rect x="472" y="36" width="56" height="18" rx="6" fill="#c9d0de" stroke="#1a1c2c" stroke-width="2"/>
  <rect x="265" y="56" width="70" height="12" rx="5" fill="#dfe4ee" stroke="#1a1c2c" stroke-width="2"/>
  <rect x="465" y="56" width="70" height="12" rx="5" fill="#dfe4ee" stroke="#1a1c2c" stroke-width="2"/>
  <rect x="350" y="76" width="100" height="52" rx="8" fill="#d5dbe6" stroke="#1a1c2c" stroke-width="2"/>
  <rect x="332" y="80" width="10" height="18" rx="4" fill="#2b2f45"/>
  <rect x="458" y="80" width="10" height="18" rx="4" fill="#2b2f45"/>
  <rect x="272" y="105" width="16" height="40" rx="3" fill="#2b2f45"/>
  <rect x="260" y="117" width="40" height="16" rx="3" fill="#2b2f45"/>
  <circle cx="335" cy="170" r="20" fill="#2b2f45"/><circle cx="335" cy="170" r="13" fill="#3d4260"/>
  <circle cx="465" cy="170" r="20" fill="#2b2f45"/><circle cx="465" cy="170" r="13" fill="#3d4260"/>
  <circle cx="400" cy="160" r="7" fill="#2b2f45"/>
  ${['TRIANGLE', 'CIRCLE', 'CROSS', 'SQUARE'].map((b) => faceSvg(b, 22, SPOTS.find((s) => s.title === b).at)).join('')}`;
}

function labels(side) {
  const spots = SPOTS.filter((s) => s.side === side);
  const blocks = spots
    .map((s) => ({ ...s, lines: [...(s.extra ?? []), ...actionsFor(s.buttons)] }))
    .filter((b) => b.lines.length); // unused buttons get no label
  const height = blocks.reduce((h, b) => h + LINE * (b.lines.length + 1) + 6, 0);
  let y = (300 - height) / 2 + LINE;
  const left = side === 'L';
  const x = left ? 8 : 792, anchor = left ? 'start' : 'end', lineX = left ? 196 : 604;
  return blocks.map((b) => {
    const top = y;
    y += LINE * (b.lines.length + 1) + 6;
    const title = FACE[b.title]
      ? faceSvg(b.title, 12, [left ? x + 6 : x - 6, top - 4])
      : `<text x="${x}" y="${top}" text-anchor="${anchor}" fill="#ffcd75">${b.title}</text>`;
    const text = b.lines.map((l, i) => `<text x="${x}" y="${top + LINE * (i + 1)}" text-anchor="${anchor}" fill="#f4f4f4">${l}</text>`).join('');
    const mid = top + (LINE * b.lines.length) / 2;
    return `${title}${text}
      <path d="M${lineX} ${mid} L${b.at[0]} ${b.at[1]}" stroke="#94b0c2" stroke-width="1.2" fill="none" opacity="0.8"/>
      <circle cx="${b.at[0]}" cy="${b.at[1]}" r="2.5" fill="#ffcd75"/>`;
  }).join('');
}

export function controllerSvg() {
  return `<svg viewBox="0 0 800 300" class="pad-map" font-family="'Press Start 2P', monospace" font-size="8">
    ${body()}${labels('L')}${labels('R')}</svg>`;
}

// Keyboard and mouse list shown under the drawing.
export function keyboardHtml() {
  const keys = (action) => [...new Set(ACTIONS[action].keys)].map(keyHtml).join('');
  const rows = [
    ['Move', ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(keyHtml).join('')],
    ['Turn camera', `${keyHtml('KeyZ')}${keyHtml('KeyX')} or drag mouse`],
    ['Attack', keys('attack')], ['Spin slash', keys('spin')], ['Roll', keys('dodge')], ['Talk', keys('interact')],
    ['Lock on', keys('lock')], ['Switch target', `${keyHtml('KeyZ')}${keyHtml('KeyX')} (locked on)`],
    ['Recenter camera', keys('recenter')], FEATURES.topDownCamera && ['Camera view', keys('camera')],
    ['Controls', keys('pause')],
  ].filter(Boolean);
  return rows.map(([name, k]) => `<div><span>${name}</span><span>${k}</span></div>`).join('');
}
