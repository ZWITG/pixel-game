// Keyframed attack clips for the hero (v0.50.0). A clip is a list of keys through a move (t from 0 to 1; the
// blow lands at `hit`, matching melee.js HIT_AT 0.4 for light hits and SMASH_AT 0.5 for smashes). Each key is a
// partial pose laid over STANCE. Joint names are hero3d.js's (waist, twist, chest, head, air, ax/as/ae arm swing,
// spread and elbow, lx/lk/ls leg swing, knee and spread) plus `spin` (the whole body turns, radians) and `lift`
// (the body rises, model units). A name ending in R is the striking arm's joint, O the other arm's; S flips its sign
// with the arm (so a left and a right cross mirror). A key's `ease` shapes the way into it: 'out' snaps in fast
// (strikes), 'in' starts slow, default eases both ends. `limb` is where the strike's flash shows: 'R' the striking
// hand, 'O' the other, 'F0'/'F1' a foot.
const TAU = Math.PI * 2;

export const STANCE = { lx0: 0.32, lx1: -0.28, lk0: 0.4, lk1: 0.35, waist: 0.14, ax0: 0.95, ax1: 0.8, ae0: 1.95, ae1: 1.95, as0: 0.18, as1: 0.18 };

export const CLIPS = {
  // The rush chain: jab, cross, hook, a rising knee, and a spinning kick to end it.
  jab: { hit: 0.4, limb: 'R', keys: [
    { t: 0 },
    { t: 0.2, twistS: -0.35, axR: 0.55, aeR: 2.15, waist: 0.2, lk0: 0.5, lk1: 0.45 },
    { t: 0.4, ease: 'out', twistS: 0.55, axR: 1.6, aeR: 0.02, asR: -0.1, axO: 0.6, aeO: 2.05, lx0: 0.62, lx1: -0.5, lk0: 0.3, waist: 0.24 },
    { t: 0.62, twistS: 0.42, axR: 1.45, aeR: 0.3, axO: 0.7, aeO: 2, lx0: 0.55, lx1: -0.45, lk0: 0.32, waist: 0.2 },
    { t: 1 },
  ] },
  cross: { hit: 0.4, limb: 'R', keys: [
    { t: 0 },
    { t: 0.2, twistS: -0.5, axR: 0.4, aeR: 2.2, waist: 0.18, lk0: 0.55, lk1: 0.5, lx1: -0.35 },
    { t: 0.4, ease: 'out', twistS: 0.8, axR: 1.62, aeR: 0, asR: -0.15, axO: 0.5, aeO: 2.1, lx0: 0.7, lx1: -0.55, ls1: 0.15, lk0: 0.35, lk1: 0.12, waist: 0.3, chest: 0.08 },
    { t: 0.64, twistS: 0.6, axR: 1.45, aeR: 0.35, axO: 0.65, lx0: 0.6, lx1: -0.5, lk0: 0.35, waist: 0.24 },
    { t: 1 },
  ] },
  hook: { hit: 0.4, limb: 'R', keys: [
    { t: 0 },
    { t: 0.22, twistS: -0.65, axR: 0.85, asR: 0.95, aeR: 1.55, waist: 0.24, lk0: 0.6, lk1: 0.55 },
    { t: 0.4, ease: 'out', twistS: 0.95, axR: 1.45, asR: 0.7, aeR: 1.4, waist: 0.32, chest: 0.12, lx0: 0.55, lk0: 0.5 },
    { t: 0.62, twistS: 1.15, axR: 1.2, asR: 0.25, aeR: 1.65, waist: 0.28 },
    { t: 1 },
  ] },
  knee: { hit: 0.4, limb: 'F0', keys: [
    { t: 0 },
    { t: 0.2, ax0: 1.65, ax1: 1.65, ae0: 0.85, ae1: 0.85, as0: -0.15, as1: -0.15, lx1: -0.45, lk1: 0.2, waist: 0.05, chest: -0.1 },
    { t: 0.4, ease: 'out', lx0: 1.6, lk0: 2.35, lx1: -0.15, lk1: 0.1, ax0: 1.15, ax1: 1.15, ae0: 1.8, ae1: 1.8, waist: 0.38, chest: 0.1, lift: 0.14 },
    { t: 0.62, lx0: 1.3, lk0: 2.2, lx1: -0.1, lk1: 0.15, ax0: 1.05, ax1: 1.05, ae0: 1.8, ae1: 1.8, waist: 0.3, lift: 0.08 },
    { t: 1 },
  ] },
  spinKick: { hit: 0.4, limb: 'F0', keys: [
    { t: 0 },
    { t: 0.14, spinS: -0.35, lk0: 0.6, lk1: 0.55, waist: 0.2 },
    { t: 0.3, spinS: 2.9, lx0: 0.9, lk0: 1.7, lx1: -0.1, lk1: 0.3, ax0: 0.6, ax1: 0.6, ae0: 2, ae1: 2, waist: 0.05 },
    { t: 0.4, ease: 'out', spinS: 4.2, lx0: 1.75, lk0: 0.02, ls0: 0.35, lx1: -0.15, lk1: 0.2, waist: -0.42, chest: -0.15, ax0: -0.4, ax1: 0.7, as0: 0.6, as1: 0.5, ae0: 0.8, ae1: 1.6, lift: 0.1 },
    { t: 0.62, spinS: 5.6, lx0: 1.2, lk0: 0.5, waist: -0.2, ax0: 0.3, ax1: 0.7 },
    { t: 1, spinS: TAU },
  ] },
  // A Surge's sixth hit: both palms driven out together.
  palms: { hit: 0.4, limb: 'R', keys: [
    { t: 0 },
    { t: 0.22, ax0: 0.5, ax1: 0.5, ae0: 2.2, ae1: 2.2, as0: 0.4, as1: 0.4, waist: 0.05, chest: -0.15, lk0: 0.6, lk1: 0.55 },
    { t: 0.4, ease: 'out', ax0: 1.6, ax1: 1.6, ae0: 0.05, ae1: 0.05, as0: -0.18, as1: -0.18, waist: 0.32, chest: 0.12, lx0: 0.75, lx1: -0.55, lk0: 0.3, lk1: 0.1 },
    { t: 0.66, ax0: 1.5, ax1: 1.5, ae0: 0.25, ae1: 0.25, waist: 0.28, lx0: 0.7, lx1: -0.5 },
    { t: 1 },
  ] },
  // Light hits in the air: alternating jabs, legs tucked.
  air: { hit: 0.4, limb: 'R', keys: [
    { t: 0, air: 1, lx0: 0.6, lk0: 1.2, lx1: 0.2, lk1: 1.4 },
    { t: 0.2, air: 1, twistS: -0.4, axR: 0.45, aeR: 2.1, lx0: 0.7, lk0: 1.4, lx1: 0.3, lk1: 1.5 },
    { t: 0.4, ease: 'out', air: 1, twistS: 0.6, axR: 1.65, aeR: 0, axO: 0.5, aeO: 2, lx0: 0.5, lk0: 1.1, lx1: 0.1, lk1: 1.3, waist: 0.2 },
    { t: 1, air: 1, lx0: 0.6, lk0: 1.2, lx1: 0.2, lk1: 1.4 },
  ] },

  // Smashes.
  // Breaker: both fists raised high behind the head, then hammered down through the guard.
  breaker: { hit: 0.5, limb: 'R', keys: [
    { t: 0 },
    { t: 0.32, ax0: 2.95, ax1: 2.95, ae0: 1.3, ae1: 1.3, as0: -0.1, as1: -0.1, chest: -0.35, waist: -0.22, lk0: 0.15, lk1: 0.2, lift: 0.12 },
    { t: 0.5, ease: 'out', ax0: 1, ax1: 1, ae0: 0.15, ae1: 0.15, as0: -0.1, as1: -0.1, waist: 0.82, chest: 0.2, head: -0.2, lx0: 0.95, lk0: 1.5, lx1: -0.4, lk1: 1.1 },
    { t: 0.74, ax0: 0.9, ax1: 0.9, ae0: 0.3, ae1: 0.3, waist: 0.75, lx0: 0.9, lk0: 1.45, lx1: -0.35, lk1: 1.05 },
    { t: 1 },
  ] },
  // Launcher: a deep crouch, then a rising uppercut that carries the hero up with it.
  launcher: { hit: 0.5, limb: 'R', keys: [
    { t: 0 },
    { t: 0.28, lx0: 1.05, lk0: 1.95, lx1: 0.6, lk1: 1.6, waist: 0.55, axR: -0.5, aeR: 1.9, asR: 0.3, twistS: -0.4 },
    { t: 0.5, ease: 'out', axR: 3, aeR: 0.45, asR: -0.1, axO: -0.4, aeO: 1.5, twistS: 0.35, waist: -0.2, chest: -0.3, head: 0.25, lx0: 0.25, lk0: 0.1, lx1: -0.4, lk1: 0.6, lift: 0.45 },
    { t: 0.76, axR: 2.85, aeR: 0.6, twistS: 0.3, waist: -0.15, chest: -0.25, lx0: 0.2, lk0: 0.3, lx1: -0.3, lk1: 0.8, lift: 0.55 },
    { t: 1 },
  ] },
  // Sweep: drop low and spin a full turn with one leg swept out wide.
  sweep: { hit: 0.5, limb: 'F1', keys: [
    { t: 0 },
    { t: 0.22, lx0: 1.3, lk0: 2.1, lx1: 0.35, lk1: 1.2, waist: 0.65, ax0: 0.5, ax1: 0.5, as0: 1, as1: 1, ae0: 0.4, ae1: 0.4, spinS: -0.3 },
    { t: 0.5, ease: 'out', spinS: 3.6, lx0: 1.3, lk0: 2.1, lx1: 0.25, lk1: 0.1, ls1: 1.3, waist: 0.65, ax0: 0.5, ax1: 0.5, as0: 1, as1: 1, ae0: 0.4, ae1: 0.4, head: -0.3 },
    { t: 0.76, spinS: TAU, lx0: 1.25, lk0: 2, lx1: 0.3, lk1: 0.6, ls1: 0.6, waist: 0.6 },
    { t: 1, spinS: TAU },
  ] },
  // Wall Driver: the knee chambers high, then the heel is driven straight through.
  driver: { hit: 0.5, limb: 'F0', keys: [
    { t: 0 },
    { t: 0.3, lx0: 1.5, lk0: 2.3, lx1: -0.15, lk1: 0.15, waist: -0.08, lift: 0.05 },
    { t: 0.5, ease: 'out', lx0: 1.62, lk0: 0, lx1: -0.25, lk1: 0.2, waist: -0.45, chest: -0.2, ax0: -0.6, ax1: 0.9, ae0: 1.2, ae1: 1.6, as0: 0.5 },
    { t: 0.72, lx0: 1.5, lk0: 0.2, waist: -0.38, chest: -0.15, ax0: -0.5, ax1: 0.9 },
    { t: 1 },
  ] },
  // Ground Slam: a hop with both fists high, then down into the earth.
  slam: { hit: 0.5, limb: 'R', keys: [
    { t: 0 },
    { t: 0.3, lift: 0.9, ax0: 2.9, ax1: 2.9, ae0: 0.6, ae1: 0.6, as0: 0.2, as1: 0.2, lx0: 0.5, lk0: 1.3, lx1: 0.3, lk1: 1.5, chest: -0.3 },
    { t: 0.5, ease: 'in', lift: 0, lx0: 1.05, lk0: 1.95, lx1: 0.9, lk1: 1.8, waist: 0.85, ax0: 1.1, ax1: 1.1, ae0: 0.1, ae1: 0.1, as0: 0.1, as1: 0.1, head: -0.35 },
    { t: 0.78, lx0: 1, lk0: 1.9, lx1: 0.85, lk1: 1.75, waist: 0.8, ax0: 1.05, ax1: 1.05, ae0: 0.2, ae1: 0.2 },
    { t: 1 },
  ] },
  // Finisher: the whole body wound back, then everything put behind one straight punch.
  finisher: { hit: 0.5, limb: 'R', keys: [
    { t: 0 },
    { t: 0.3, twistS: -0.95, axR: -0.6, aeR: 1.9, asR: 0.45, lx0: 0.2, lk0: 0.8, lx1: -0.65, lk1: 0.65, waist: 0.1, chest: -0.1 },
    { t: 0.5, ease: 'out', twistS: 1.05, axR: 1.62, aeR: 0, asR: -0.15, axO: -0.9, aeO: 1.6, lx0: 0.98, lk0: 0.6, lx1: -0.78, lk1: 0.1, waist: 0.48, chest: 0.15 },
    { t: 0.76, twistS: 0.9, axR: 1.5, aeR: 0.2, axO: -0.7, lx0: 0.9, lk0: 0.6, lx1: -0.7, lk1: 0.15, waist: 0.42 },
    { t: 1 },
  ] },
  // Spike: in the air, an axe kick brought straight down.
  spike: { hit: 0.5, limb: 'F0', keys: [
    { t: 0, air: 1, lx0: 0.6, lk0: 1.2, lx1: 0.2, lk1: 1.4 },
    { t: 0.3, air: 1, lx0: 2.6, lk0: 0.05, lx1: -0.3, lk1: 1.2, ax0: 0.5, ax1: 0.5, as0: 0.9, as1: 0.9, chest: -0.3 },
    { t: 0.5, ease: 'out', air: 1, lx0: 0.1, lk0: 0.1, lx1: -0.2, lk1: 1, waist: 0.5, ax0: 0.8, ax1: 0.8, as0: 0.7, as1: 0.7 },
    { t: 1, air: 1, lx0: 0.3, lk0: 0.6, lx1: 0.1, lk1: 1 },
  ] },
};
CLIPS.execute = CLIPS.driver;
CLIPS.riposte = CLIPS.cross;

const easeOf = {
  out: (u) => 1 - (1 - u) ** 3,
  in: (u) => u * u * u,
  io: (u) => u * u * (3 - 2 * u),
};

// A clip's keys as full poses for one striking arm, worked out once.
const resolved = new Map();
function resolve(name, arm, blank) {
  const id = `${name}:${arm}`;
  if (resolved.has(id)) return resolved.get(id);
  const out = CLIPS[name].keys.map((k) => {
    const pose = Object.assign(blank(), { spin: 0, lift: 0 }, STANCE);
    for (const [key, v] of Object.entries(k)) {
      if (key === 't' || key === 'ease') continue;
      const end = key[key.length - 1], base = key.slice(0, -1);
      if (end === 'R' && base in pose) pose[`${base}${arm}`] = v;
      else if (end === 'R') pose[`${base}${arm}`] = v;
      else if (end === 'O') pose[`${base}${1 - arm}`] = v;
      else if (end === 'S') pose[base] = arm ? v : -v;
      else pose[key] = v;
    }
    return { t: k.t, ease: easeOf[k.ease ?? 'io'], pose };
  });
  resolved.set(id, out);
  return out;
}

// Fills `goal` with clip `name` at `t` (0..1) for striking arm `arm`.
export function sampleClip(goal, name, t, arm, blank) {
  const keys = resolve(name, arm, blank);
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], u = b.ease(Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1))));
  for (const key in b.pose) goal[key] = a.pose[key] + (b.pose[key] - a.pose[key]) * u;
}
