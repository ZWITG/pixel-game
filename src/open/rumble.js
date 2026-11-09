// Controller rumble: each fighting moment has its own feel on the hero's own pad (PS5 DualSense or any
// standard pad with a vibrationActuator). A stronger effect isn't cut short by a weaker one. Settings switch:
// `settings.rumble` (main.js sets `haptics.on`); feature switch: FEATURES.rumble.
import { FEATURES } from '../config/features.js';
import { sound } from './sound.js';

export const haptics = { on: true };

// [milliseconds, strong (low, heavy motor), weak (high, sharp motor)]
export const FEELS = {
  jab: [45, 0.05, 0.3],          // a light blow lands
  finisher: [90, 0.35, 0.5],     // the last blow of a chain
  smash: [150, 0.7, 0.45],
  execute: [320, 1, 0.8],
  perfect: [110, 0.25, 1],       // a Perfect parry: sharp and bright
  parry: [80, 0.15, 0.75],
  parryRow: [130, 0.55, 1],      // the second, third... parry in a row (scaled up the row)
  block: [70, 0.45, 0.1],        // a dull thud
  guardBroken: [260, 0.9, 0.4],
  vanish: [60, 0, 0.5],
  peril: [90, 0.4, 0.15],        // a foe winds up a blow that breaks a guard
  dodge: [35, 0, 0.25],
  hurt: [140, 0.6, 0.25],        // scaled by how hard the blow was
  broken: [380, 1, 0.6],         // the hero's own Structure gives way
  shatter: [240, 0.9, 1],        // a foe's Structure breaks
  quake: [600, 1, 0.7],          // an ultimate or a huge blast
};

const playing = new WeakMap(); // pad id -> { until, power }

export function rumble(player, feel, scale = 1) {
  sound.felt(player, feel, scale);
  if (!FEATURES.rumble || !haptics.on) return;
  const controls = player?.controls;
  if (!controls || controls.device !== 'pad') return;
  const pad = controls.pad, act = pad?.vibrationActuator;
  if (!act?.playEffect) return;
  const [ms, strong, weak] = FEELS[feel] ?? FEELS.jab;
  const k = Math.max(0, Math.min(1, scale)), power = Math.max(strong, weak) * k, now = performance.now();
  const key = controls; // one record per hero's controls (pads are new objects each poll)
  const last = playing.get(key);
  if (last && now < last.until && last.power > power) return;
  playing.set(key, { until: now + ms, power });
  try {
    act.playEffect('dual-rumble', {
      startDelay: 0, duration: ms, strongMagnitude: strong * k, weakMagnitude: weak * k,
    })?.catch?.(() => {});
  } catch { /* a pad that can't rumble */ }
}
