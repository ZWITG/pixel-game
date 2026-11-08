// Foe animations (v0.52.0): how a monster's body moves through a fight, on top of its walk (Enemy.animate) and
// the reactions monsters.update already gives it (squash on a hit, rearing at its target, knocked flat, the
// Broken sway). Wind-up (foes.js `tell`), strike, recovery, staggered and Broken each have a pose, timed by the
// length the mode was set for. Human foes move their arms, head and body; beasts, slimes and boars have no arms, so
// they squash down into a wind-up and stretch out into the lunge. Off switch: FEATURES.foeAnim.
import { FEATURES } from '../config/features.js';

const ease = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.max(0, Math.min(1, u));

// How far through its current mode a foe is, 0..1: the length is noted when the mode (or its end) changes.
function progress(e, t) {
  if (e.animMode !== e.mode || e.animUntil !== e.until) {
    e.animMode = e.mode;
    e.animUntil = e.until;
    e.animLen = Math.max(0.05, (e.until ?? t) - t);
  }
  return clamp01(1 - ((e.until ?? t) - t) / e.animLen);
}

// The way each kind of move winds up: the weapon arm's swing back (negative is up and forward), the other arm,
// and how far the body leans (positive is forward).
const WIND = {
  swipe: { arm: -2.6, side: 0.35, other: -0.5, lean: -0.18 },
  flurry: { arm: -1.9, side: 0.2, other: -0.9, lean: -0.08 },
  hop: { arm: -1.2, side: 0.1, other: -1.2, lean: 0.25, crouch: 0.5 },
  charge: { arm: 0.9, side: 0.4, other: 0.9, lean: 0.4, crouch: 0.4 },
  burst: { arm: -2.2, side: 0.9, other: -2.2, lean: -0.15 },
  slam: { arm: -2.9, side: 0.15, other: -2.9, lean: -0.25 },
};
const STRIKE = {
  swipe: { arm: -0.2, side: -0.3, other: 0.3, lean: 0.35 },
  flurry: { arm: -1.5, side: -0.1, other: -0.3, lean: 0.25 },
  hop: { arm: -1.6, side: 0, other: -1.6, lean: 0.35 },
  charge: { arm: 1.1, side: 0.5, other: 1.1, lean: 0.55 },
  burst: { arm: -1.2, side: 1.4, other: -1.2, lean: 0 },
  slam: { arm: -0.5, side: 0.1, other: -0.5, lean: 0.55, crouch: 0.6 },
};

export function animateFoe(e, t) {
  if (!FEATURES.foeAnim || e.dying || e.watch || e.def.keepAway || e.evolving !== undefined) return;
  const m = e.model, root = m.root;
  if (!root) return;
  const broken = e.brokenUntil > t, down = e.downUntil > t;
  if (down) return; // lying flat is monsters.update's
  const human = e.def.model === 'human' && m.arms?.length === 2;
  const guarding = e.guardUntil > t && t >= (e.guardFrom ?? 0);
  const recoil = Math.sin((e.recoil ?? 0) * Math.PI);
  progress(e, t);

  if (human) {
    let pose = null, k = 1, lean = 0, head = 0, crouch = 0;
    if (broken) {
      // Slumped forward, arms hanging, head down.
      pose = { arm: 0.15, side: 0.2, other: 0.2, lean: 0.4 };
      head = 0.5;
      crouch = 0.4;
    } else if (e.mode === 'tell') {
      pose = WIND[e.move] ?? WIND.swipe;
      k = ease(progress(e, t));
      head = -0.15 * k;
    } else if ((e.mode === 'strike' && STRIKE[e.move]) || e.mode === 'charging') {
      // The strike: swung through fast, from where the wind-up left off.
      const move = e.mode === 'charging' ? 'charge' : e.move, u = clamp01(progress(e, t) * 2.2), a = WIND[move], b = STRIKE[move];
      pose = { arm: a.arm + (b.arm - a.arm) * u, side: a.side + (b.side - a.side) * u, other: a.other + (b.other - a.other) * u, lean: a.lean + (b.lean - a.lean) * u, crouch: (b.crouch ?? 0) * u };
    } else if (e.mode === 'recover') {
      pose = { arm: 0.25, side: 0.15, other: 0.2, lean: 0.18 };
      k = 1 - ease(progress(e, t));
      head = 0.2 * k;
    } else if (e.mode === 'reeling') {
      // Staggered: thrown back, arms flung out.
      pose = { arm: -0.9, side: 0.9, other: -0.7, lean: -0.3 };
      k = clamp01((e.until - t) * 2);
      head = -0.3 * k;
    }
    if (pose) {
      lean = pose.lean * k;
      crouch = (pose.crouch ?? crouch) * k;
      if (!guarding) {
        m.arms[0].rotation.set(pose.arm * k, 0, (pose.side ?? 0) * k);
        m.arms[1].rotation.set(pose.other * k, 0, -(pose.side ?? 0) * 0.5 * k);
      }
      if (crouch && m.legs?.length === 2) {
        m.legs[0].rotation.x = -crouch * 0.7;
        m.legs[1].rotation.x = crouch * 0.5;
      }
      root.rotation.x = lean - recoil * 0.35;
      if (m.head) m.head.rotation.x = head + recoil * -0.4;
    } else if (recoil) {
      root.rotation.x -= recoil * 0.35;
      if (m.head) m.head.rotation.x = -recoil * 0.4;
    } else if (m.head) m.head.rotation.x = 0;
    return;
  }

  // Beasts, slimes and boars: squash into the wind-up, stretch into the lunge.
  if (e.recoil > 0) return; // the hit squash has the scale this frame
  const base = e.def.model === 'slime' || e.def.model === 'mushroom' ? root.scale.y : e.rootScale ?? root.scale.y;
  let sy = 1, sxz = 1, lean = null;
  if (e.mode === 'tell') {
    const k = ease(progress(e, t));
    sy = 1 - 0.2 * k;
    sxz = 1 + 0.12 * k;
    lean = -0.28 * k;
  } else if (e.mode === 'strike' || e.mode === 'charging') {
    const k = Math.sin(clamp01(progress(e, t)) * Math.PI);
    sy = 1 + 0.12 * k;
    sxz = 1 - 0.08 * k;
    lean = 0.35 * k;
  } else if (e.mode === 'reeling' && !broken) {
    root.rotation.z = Math.sin(t * 24) * 0.12 * clamp01((e.until - t) * 2);
  }
  if (sy !== 1) root.scale.set(base * sxz, base * sy, base * sxz);
  if (lean !== null) root.rotation.x = lean;
}
