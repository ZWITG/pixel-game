// Every sound in the game, made here from nothing: oscillators, filtered noise and envelopes, rendered once
// into sample arrays when the game loads, off the main thread. No files to fetch, so it works offline.
// sound.js asks for them with { rate } and gets back one message per sound: { name, chans: [Float32Array] }.
// def(name, variations, peak, (v) => Float32Array | [left, right]) adds one. Order is priority: what a
// fight needs first, loops last.

let SR = 44100;
let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pm = (k) => (rnd() * 2 - 1) * k; // ± k
const TAU = Math.PI * 2;
const len = (s) => Math.max(1, Math.floor(s * SR));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- building blocks: each returns a new Float32Array ----------
// An envelope: attack a seconds, then exponential decay with time constant d (0 = hold), cut at dur.
const envAt = (t, a, d, dur) => {
  const up = a > 0 ? Math.min(1, t / a) : 1;
  const down = d > 0 ? Math.exp(-Math.max(0, t - a) / d) : 1;
  const tail = Math.min(1, (dur - t) / 0.006); // no click at the cut
  return up * down * Math.max(0, tail);
};

// Glide from f0 to f1: exponential, reaching f1 at `g` seconds (or over the whole sound).
const glide = (f0, f1, g, t) => (f0 === f1 ? f0 : f0 * Math.pow(f1 / f0, Math.min(1, t / g)));

const wave = {
  sine: (p) => Math.sin(p * TAU),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  saw: (p) => 2 * (p % 1) - 1,
  sq: (p) => ((p % 1) < 0.5 ? 1 : -1),
};

// A tone: { dur, f: [f0, f1], g: glide secs, type, a, d, vib: [rate, depth fraction], am: [rate, depth], drive }
function tone(o) {
  const n = len(o.dur), out = new Float32Array(n), w = wave[o.type ?? 'sine'], [f0, f1 = f0] = o.f;
  const g = o.g ?? o.dur, [vr, vd] = o.vib ?? [0, 0], [ar, ad] = o.am ?? [0, 0], a = o.a ?? 0.002, d = o.d ?? 0;
  let ph = o.phase ?? rnd();
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = glide(f0, f1, g, t) * (1 + (vd ? Math.sin(t * vr * TAU) * vd : 0));
    ph += f / SR;
    let s = w(ph) * envAt(t, a, d, o.dur);
    if (ad) s *= 1 - ad * (0.5 + 0.5 * Math.sin(t * ar * TAU));
    out[i] = s;
  }
  return o.drive ? drive(out, o.drive) : out;
}

// The state-variable filter (topology-preserving): mode 'lp' | 'bp' | 'hp'. cut(t) is the cutoff in Hz.
function svf(x, cut, q = 0.7, mode = 'lp') {
  const out = new Float32Array(x.length), k = 1 / q;
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  for (let i = 0; i < x.length; i++) {
    if ((i & 15) === 0) {
      const fc = clamp(typeof cut === 'function' ? cut(i / SR) : cut, 20, SR * 0.45), g = Math.tan((Math.PI * fc) / SR);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 * k : x[i] - k * v1 - v2;
  }
  return out;
}

const white = (n) => {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rnd() * 2 - 1;
  return a;
};

// Filtered noise: { dur, f: [c0, c1, c2?] (cutoff path), g, q, mode, a, d, am }
function hiss(o) {
  const n = len(o.dur), [c0, c1 = c0, c2] = o.f, g = o.g ?? o.dur;
  const cut = c2 === undefined ? (t) => glide(c0, c1, g, t) : (t) => (t < g ? glide(c0, c1, g, t) : glide(c1, c2, o.dur - g, t - g));
  const out = svf(white(n), cut, o.q ?? 0.7, o.mode ?? 'lp'), a = o.a ?? 0.002, d = o.d ?? 0, [ar, ad] = o.am ?? [0, 0];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] *= envAt(t, a, d, o.dur) * (ad ? 1 - ad * (0.5 + 0.5 * Math.sin(t * ar * TAU)) : 1);
  }
  return o.drive ? drive(out, o.drive) : out;
}

// A swell that rises to its peak at `peak` seconds and falls away by the end (a whoosh's shape).
function swell(x, peak, sharp = 2) {
  const dur = x.length / SR;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, k = t < peak ? t / peak : 1 - (t - peak) / (dur - peak);
    x[i] *= Math.pow(clamp(k, 0, 1), sharp);
  }
  return x;
}

function drive(x, k) {
  const norm = Math.tanh(k);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) / norm;
  return x;
}

// Inharmonic partials: a bell, a blade, a struck stone. ratios with their own decays.
function bell(dur, f, ratios = [1, 2.76, 5.4, 8.93], d = 0.4, a = 0.001) {
  const n = len(dur), out = new Float32Array(n);
  ratios.forEach((r, k) => add(out, tone({ dur, f: [f * r * (1 + pm(0.004))], a, d: d / (1 + k * 0.6) }), 1 / (1 + k * 0.7)));
  return out;
}

// Short clicks and grains at random times: crackle, gravel, rain. { dur, rate (per sec), f: band, q, d (each), fade }
function grains(o) {
  const n = len(o.dur), src = new Float32Array(n), d = o.d ?? 0.004;
  const count = Math.round(o.rate * o.dur);
  for (let k = 0; k < count; k++) {
    const t = o.shape ? o.shape(rnd()) * o.dur : rnd() * o.dur, at = Math.floor(t * SR), amp = (o.amp ?? 1) * (0.25 + rnd() * 0.75) * (o.fade ? Math.exp(-t / o.fade) : 1);
    const m = Math.min(n - at, len(d * (0.5 + rnd())));
    for (let i = 0; i < m; i++) src[at + i] += (rnd() * 2 - 1) * amp * Math.exp((-i / SR) / (d * 0.3));
  }
  return o.f ? svf(src, o.f, o.q ?? 1, o.mode ?? 'bp') : src;
}

// Pitched blips that rise: bubbles in water.
function bubbles(dur, count, lo, hi, d = 0.03) {
  const out = new Float32Array(len(dur));
  for (let k = 0; k < count; k++) {
    const f = lo + rnd() * (hi - lo), b = tone({ dur: d * 2.5, f: [f, f * 1.8], a: 0.002, d });
    add(out, b, 0.3 + rnd() * 0.5, rnd() * (dur - d * 2.5));
  }
  return out;
}

// Pings: shards of glass, ice and sparkle. count random high sines over dur.
function pings(dur, count, lo, hi, d = 0.08, spread = 1) {
  const out = new Float32Array(len(dur));
  for (let k = 0; k < count; k++) add(out, tone({ dur: d * 4, f: [lo + rnd() * (hi - lo)], a: 0.001, d: d * (0.4 + rnd()) }), 0.2 + rnd() * 0.6, rnd() * Math.max(0, dur * spread - d * 4));
  return out;
}

// Detuned saws through a filter path: pads, drones, choirs.
function pad(dur, freqs, cut, o = {}) {
  const out = new Float32Array(len(dur));
  for (const f of freqs) for (const det of [-0.006, 0, 0.007]) add(out, tone({ dur, f: [f * (1 + det), f * (1 + det) * (o.bend ?? 1)], type: 'saw', a: o.a ?? 0.2, d: o.d ?? 0, vib: o.vib }), 1 / freqs.length);
  return svf(out, cut, o.q ?? 0.9, o.mode ?? 'lp');
}

function add(out, x, gain = 1, at = 0) {
  const o = Math.floor(at * SR), m = Math.min(x.length, out.length - o);
  for (let i = 0; i < m; i++) out[o + i] += x[i] * gain;
  return out;
}

const silence = (dur) => new Float32Array(len(dur));

// ---------- reusable pieces ----------
const thump = (f0 = 120, f1 = 45, d = 0.1, dur = d * 4) => tone({ dur, f: [f0, f1], g: d * 1.2, a: 0.001, d });
const click = (f = 3000, d = 0.006) => hiss({ dur: d * 5, f: [f], mode: 'hp', d });
const crunch = (f = 1500, d = 0.05, q = 1) => hiss({ dur: d * 4, f: [f], q, mode: 'bp', d, drive: 2.5 });
const whoosh = (dur, lo, hi, q = 1.2, peak = 0.45) => swell(hiss({ dur, f: [lo, hi, lo], g: dur * peak, q, mode: 'bp' }), dur * peak, 1.6);
const rumbleTail = (dur, c0 = 400, c1 = 60, d = dur * 0.35) => hiss({ dur, f: [c0, c1], g: dur * 0.6, d, a: 0.004, q: 0.8 });
const riser = (dur, lo, hi) => {
  const out = swell(hiss({ dur, f: [lo, hi], q: 2, mode: 'bp', g: dur }), dur * 0.97, 2.2);
  add(out, swell(tone({ dur, f: [lo * 0.25, hi * 0.12], type: 'saw' }), dur * 0.97, 2.5), 0.25);
  return out;
};

function boom(dur = 1.6, size = 1) {
  const out = silence(dur);
  add(out, click(2200, 0.01), 0.6);
  add(out, crunch(900, 0.06), 0.7);
  add(out, tone({ dur, f: [70 * (1.2 - size * 0.2), 24], g: 0.5, a: 0.002, d: 0.32 * size, drive: 1.6 }), 1);
  add(out, hiss({ dur, f: [2400, 60], g: dur * 0.5, a: 0.003, d: 0.35 * size, q: 0.6 }), 0.9);
  add(out, grains({ dur: dur * 0.8, rate: 50, f: 1200, q: 0.8, fade: 0.35 * size, d: 0.01 }), 0.5);
  return drive(out, 1.4);
}

// Debris: a stone structure breaking. size 0..1.
function crumble(dur = 0.6, size = 0.5) {
  const out = silence(dur);
  add(out, thump(110, 45, 0.08), 0.7 * size + 0.2);
  add(out, crunch(1100, 0.06), 0.5);
  add(out, grains({ dur, rate: 70 + 60 * size, f: (t) => 2600 - t * 1500, q: 0.9, fade: dur * 0.3, d: 0.006 }), 0.9);
  add(out, grains({ dur, rate: 30, f: 500, q: 0.8, fade: dur * 0.35, d: 0.02 }), 0.6 * size);
  return out;
}

function woodBreak(dur = 0.7) {
  const out = silence(dur);
  for (let k = 0; k < 4; k++) add(out, crunch(900 + rnd() * 1800, 0.02 + rnd() * 0.03, 2), 0.6, rnd() * 0.18);
  add(out, thump(140, 60, 0.07), 0.6);
  add(out, svf(tone({ dur: 0.45, f: [95, 70], type: 'saw', a: 0.03, d: 0.15, vib: [23, 0.2] }), 700, 2, 'bp'), 0.35, 0.05);
  add(out, grains({ dur, rate: 40, f: 1600, q: 1, fade: 0.2, d: 0.008 }), 0.5);
  return out;
}

// ---------- the elements: cast, impact, wave ----------
const ELEMENTS = {
  earth: {
    cast: () => {
      const o = silence(0.6);
      add(o, swell(hiss({ dur: 0.6, f: [140, 520], q: 0.8 }), 0.35, 1.2), 1);
      add(o, grains({ dur: 0.6, rate: 60, f: 900, q: 0.8, d: 0.01, shape: (r) => Math.sqrt(r) }), 0.5);
      add(o, tone({ dur: 0.6, f: [55, 70], a: 0.15, d: 0.3 }), 0.6);
      return o;
    },
    impact: () => {
      const o = boom(1.2, 0.8);
      add(o, grains({ dur: 1.1, rate: 90, f: (t) => 1800 - t * 900, q: 0.8, fade: 0.4, d: 0.012 }), 0.7, 0.03);
      add(o, crunch(600, 0.08), 0.6);
      return o;
    },
    wave: () => {
      const o = silence(1.4);
      add(o, swell(hiss({ dur: 1.4, f: [90, 320, 90], g: 0.6, q: 0.7, am: [9, 0.5] }), 0.5, 1), 1);
      add(o, grains({ dur: 1.3, rate: 70, f: 1200, q: 0.8, d: 0.012, fade: 0.8 }), 0.6);
      add(o, tone({ dur: 1.4, f: [48, 36], a: 0.08, d: 0.6 }), 0.5);
      return o;
    },
  },
  storm: {
    cast: () => {
      const n = len(0.45), o = new Float32Array(n);
      let ph = 0, f = 400;
      for (let i = 0; i < n; i++) {
        if (i % 140 === 0) f = 150 + rnd() * 1800;
        ph += f / SR;
        o[i] = wave.saw(ph) * envAt(i / SR, 0.004, 0.12, 0.45);
      }
      const z = svf(o, 600, 0.7, 'hp');
      add(z, grains({ dur: 0.45, rate: 220, f: 4000, q: 0.7, mode: 'hp', d: 0.002, fade: 0.15 }), 0.8);
      return drive(z, 2);
    },
    impact: () => {
      const o = silence(2.2);
      add(o, drive(hiss({ dur: 0.12, f: [5000, 1200], mode: 'hp', d: 0.025 }), 3), 1);
      add(o, grains({ dur: 0.3, rate: 300, f: 3000, q: 0.6, d: 0.003, fade: 0.08 }), 0.8);
      // the thunder: a low roll that comes and goes
      const roll = hiss({ dur: 2.1, f: [700, 70], g: 1.2, a: 0.02, d: 0.7, q: 0.6 });
      for (let i = 0, amp = 1, next = 0; i < roll.length; i++) {
        if (i >= next) {
          next = i + len(0.05 + rnd() * 0.18);
          amp = 0.35 + rnd() * 0.65;
        }
        roll[i] *= amp;
      }
      add(o, svf(roll, 900), 1.6, 0.03);
      add(o, tone({ dur: 1, f: [60, 30], a: 0.002, d: 0.3 }), 0.6);
      return drive(o, 1.3);
    },
    wave: () => {
      const o = grains({ dur: 0.9, rate: 260, f: (t) => 2500 + t * 2000, q: 0.6, d: 0.003 });
      add(o, swell(hiss({ dur: 0.9, f: [300, 1200], q: 1.4, mode: 'bp' }), 0.3), 0.8);
      add(o, svf(tone({ dur: 0.9, f: [120, 80], type: 'saw', d: 0.4, am: [60, 0.9] }), 1200), 0.5);
      return drive(o, 1.5);
    },
  },
  void: {
    cast: () => {
      const o = swell(hiss({ dur: 0.5, f: [200, 3200], q: 1.3, g: 0.5 }), 0.46, 2.5);
      add(o, tone({ dur: 0.5, f: [40, 80], a: 0.2, d: 0.3 }), 0.8);
      add(o, swell(tone({ dur: 0.5, f: [600, 1400], type: 'tri' }), 0.45, 3), 0.15);
      return o;
    },
    impact: () => {
      const o = silence(1.2);
      add(o, tone({ dur: 1.2, f: [240, 28], g: 0.45, a: 0.002, d: 0.35, drive: 1.8 }), 1);
      add(o, tone({ dur: 1.2, f: [252, 30], g: 0.5, a: 0.002, d: 0.3 }), 0.6);
      add(o, hiss({ dur: 1.1, f: [2400, 90], g: 0.4, d: 0.25, q: 2 }), 0.7);
      add(o, swell(hiss({ dur: 0.35, f: [300, 2000], q: 2, mode: 'bp' }), 0.33, 2), 0.5);
      return o;
    },
    wave: () => {
      const o = pad(1.1, [55, 58.3], (t) => 300 + Math.sin(t * 7) * 200 + 400, { a: 0.05, d: 0.5, bend: 0.7, q: 3 });
      add(o, swell(hiss({ dur: 1.1, f: [1800, 200], q: 3, mode: 'bp' }), 0.2), 0.4);
      return o;
    },
  },
  fire: {
    cast: () => {
      const o = swell(hiss({ dur: 0.45, f: [300, 2600], q: 0.8, g: 0.3 }), 0.18, 1.3);
      add(o, grains({ dur: 0.45, rate: 50, f: 3000, q: 1, d: 0.004, fade: 0.25 }), 0.5);
      add(o, tone({ dur: 0.4, f: [90, 55], a: 0.02, d: 0.12 }), 0.4);
      return o;
    },
    impact: () => {
      const o = silence(1.1);
      add(o, thump(100, 40, 0.12), 0.9);
      add(o, swell(hiss({ dur: 1.0, f: [500, 1800, 400], g: 0.15, q: 0.9 }), 0.12, 0.9), 1.1);
      add(o, grains({ dur: 1.0, rate: 45, f: 2600, q: 1.2, d: 0.006, fade: 0.5 }), 0.8);
      add(o, crunch(700, 0.05), 0.5);
      return drive(o, 1.4);
    },
    wave: () => {
      const o = swell(hiss({ dur: 1.1, f: [400, 1300, 500], g: 0.4, q: 0.8, am: [8, 0.4] }), 0.35, 1);
      add(o, grains({ dur: 1.1, rate: 40, f: 2800, q: 1.2, d: 0.006 }), 0.6);
      return o;
    },
  },
  ice: {
    cast: () => {
      const o = pings(0.5, 18, 3000, 8000, 0.05);
      add(o, bell(0.5, 2600, [1, 2.4, 4.1], 0.2), 0.4);
      add(o, swell(hiss({ dur: 0.5, f: [4000, 9000], mode: 'hp' }), 0.3), 0.25);
      return o;
    },
    impact: () => {
      const o = silence(0.9);
      add(o, drive(hiss({ dur: 0.08, f: [3500], mode: 'hp', d: 0.02 }), 3), 0.9);
      add(o, tone({ dur: 0.3, f: [1600, 380], g: 0.12, d: 0.06, type: 'tri' }), 0.4);
      add(o, crunch(2400, 0.05, 1.5), 0.6);
      add(o, pings(0.8, 30, 2500, 7500, 0.07, 0.7), 0.8, 0.02);
      add(o, thump(120, 60, 0.07), 0.5);
      return o;
    },
    wave: () => {
      const o = grains({ dur: 1, rate: 280, f: (t) => 3000 + t * 3000, q: 1.2, d: 0.004, shape: (r) => r });
      add(o, pings(1, 22, 3000, 8000, 0.06), 0.6);
      add(o, swell(hiss({ dur: 1, f: [2000, 6000], mode: 'hp' }), 0.6), 0.3);
      return o;
    },
  },
  time: {
    cast: () => {
      const o = silence(0.65);
      for (let k = 0; k < 4; k++) add(o, hiss({ dur: 0.03, f: [k % 2 ? 2100 : 3200], q: 8, mode: 'bp', d: 0.006 }), 1, k * 0.09);
      add(o, swell(tone({ dur: 0.6, f: [500, 1500], type: 'tri', vib: [6, 0.01] }), 0.55, 2), 0.25, 0.05);
      add(o, pings(0.6, 8, 2000, 4000, 0.1), 0.25);
      return o;
    },
    impact: () => {
      const o = silence(1.4);
      // a bell played backwards, then struck
      const rev = bell(0.5, 660, [1, 2.01, 3.5, 5.2], 0.25).reverse();
      add(o, rev, 0.8);
      add(o, bell(1.2, 660, [1, 2.01, 3.5, 5.2], 0.5), 0.7, 0.49);
      add(o, thump(90, 40, 0.15), 0.6, 0.49);
      add(o, pings(0.8, 10, 1500, 3500, 0.15), 0.3, 0.5);
      return o;
    },
    wave: () => {
      const n = len(1.1), o = new Float32Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR, f = 440 * (1 + Math.sin(t * TAU * (7 - t * 5.5)) * 0.04) * (1 - t * 0.25);
        ph += f / SR;
        o[i] = (wave.tri(ph) * 0.6 + wave.sine(ph * 2.0) * 0.3) * envAt(t, 0.05, 0.5, 1.1);
      }
      add(o, whoosh(1.1, 300, 1600, 1), 0.6);
      return o;
    },
  },
  water: {
    cast: () => {
      const o = swell(hiss({ dur: 0.55, f: [200, 1600], q: 0.9 }), 0.4, 1.4);
      add(o, bubbles(0.55, 10, 300, 900, 0.025), 0.6);
      return o;
    },
    impact: () => {
      const o = silence(1.1);
      add(o, thump(110, 50, 0.08), 0.7);
      add(o, hiss({ dur: 1, f: [400, 2600, 500], g: 0.07, q: 1.1, mode: 'bp', a: 0.003, d: 0.25 }), 1.3);
      add(o, hiss({ dur: 0.9, f: [5000, 2500], mode: 'hp', a: 0.01, d: 0.2 }), 0.35);
      add(o, bubbles(1, 22, 250, 1100, 0.03), 0.6, 0.05);
      return o;
    },
    wave: () => {
      const o = swell(hiss({ dur: 1.4, f: [150, 900, 300], g: 0.6, q: 0.8, am: [1.5, 0.3] }), 0.6, 1.1);
      add(o, swell(hiss({ dur: 1.4, f: [3000, 6000], mode: 'hp' }), 0.7), 0.3);
      add(o, bubbles(1.4, 14, 200, 700, 0.035), 0.4);
      return o;
    },
  },
  blight: {
    cast: () => {
      const o = svf(tone({ dur: 0.55, f: [110, 95], type: 'saw', a: 0.05, d: 0.3, am: [38, 0.9] }), 900, 2, 'bp');
      add(o, swell(hiss({ dur: 0.55, f: [1800, 3500], q: 1.5, mode: 'bp' }), 0.3), 0.5);
      add(o, bubbles(0.55, 8, 90, 260, 0.04), 0.5);
      return o;
    },
    impact: () => {
      const o = silence(1.1);
      add(o, hiss({ dur: 0.4, f: [600, 140], g: 0.25, q: 4, mode: 'bp', a: 0.002, d: 0.1, drive: 3 }), 1);
      add(o, thump(90, 40, 0.1), 0.6);
      add(o, bubbles(1, 18, 70, 280, 0.05), 0.7, 0.05);
      add(o, svf(tone({ dur: 1, f: [180, 160], type: 'saw', a: 0.1, d: 0.35, am: [44, 0.9], vib: [5, 0.03] }), 1100, 3, 'bp'), 0.35, 0.1);
      return o;
    },
    wave: () => {
      const o = svf(hiss({ dur: 1.2, f: [2000], q: 2, mode: 'bp', a: 0.2, d: 0.6 }), 2600, 1, 'bp');
      for (const f of [170, 205, 240]) add(o, svf(tone({ dur: 1.2, f: [f, f * 0.9], type: 'saw', a: 0.15, d: 0.5, am: [40 + rnd() * 10, 0.9], vib: [4 + rnd() * 3, 0.04] }), 1200, 2.5, 'bp'), 0.3);
      return o;
    },
  },
  mind: {
    cast: () => {
      const o = silence(0.6);
      for (const f of [440, 443.5]) add(o, tone({ dur: 0.6, f: [f, f * 1.5], g: 0.5, a: 0.08, d: 0.25, am: [7, 0.7] }), 0.4);
      add(o, swell(tone({ dur: 0.6, f: [880, 1760], vib: [9, 0.01] }), 0.5, 2), 0.2);
      return o;
    },
    impact: () => {
      const o = silence(1.1);
      for (const f of [300, 302.5, 449]) add(o, tone({ dur: 1, f: [f, f * 0.5], g: 0.6, a: 0.005, d: 0.3, am: [11, 0.6] }), 0.4);
      add(o, swell(hiss({ dur: 0.3, f: [300, 3000], q: 2, mode: 'bp' }), 0.28, 2), 0.4);
      add(o, thump(80, 45, 0.12), 0.5, 0.28);
      return o;
    },
    wave: () => {
      const o = silence(1.1);
      for (const [f, r] of [[330, 5], [495, 6.5], [660, 8]]) add(o, tone({ dur: 1.1, f: [f], a: 0.1, d: 0.5, vib: [r, 0.035] }), 0.3);
      add(o, whoosh(1.1, 400, 2000, 2), 0.3);
      return o;
    },
  },
  night: {
    cast: () => {
      const o = swell(hiss({ dur: 0.55, f: [200, 900], q: 0.9 }), 0.35, 1.3);
      add(o, pad(0.55, [55, 82.4], 500, { a: 0.1, d: 0.3 }), 0.5);
      return o;
    },
    impact: () => {
      const o = silence(1.1);
      add(o, tone({ dur: 1, f: [95, 32], g: 0.3, a: 0.002, d: 0.25, drive: 1.5 }), 1);
      add(o, hiss({ dur: 1, f: [1600], q: 3, mode: 'bp', a: 0.01, d: 0.3, am: [13, 0.7] }), 0.4);
      add(o, pad(1, [41.2, 61.7], 400, { a: 0.02, d: 0.4 }), 0.5);
      return o;
    },
    wave: () => {
      const o = pad(1.3, [41.2, 61.7, 82.4], (t) => 200 + Math.sin((t / 1.3) * Math.PI) * 700, { a: 0.1, d: 0.7 });
      add(o, swell(hiss({ dur: 1.3, f: [1400, 2200], q: 2.5, mode: 'bp', am: [9, 0.6] }), 0.5), 0.35);
      return o;
    },
  },
};

// A Conqueror's ultimate: a long rise, the element's blow made huge, and the land answering.
function ultimate(el) {
  const o = silence(3.4), up = 1.25;
  add(o, riser(up, 200, 3000), 0.7);
  add(o, pad(up, [55, 82.4, 110], (t) => 200 + t * 1200, { a: up * 0.9 }), 0.35);
  const hit = ELEMENTS[el].impact();
  add(o, hit, 1, up);
  add(o, ELEMENTS[el].wave(), 0.6, up + 0.25);
  add(o, boom(2.0, 1.2), 0.9, up);
  return drive(o, 1.2);
}

// ---------- ambience loops (seamless: the tail is crossfaded into the head) ----------
function loop(dur, make, fade = 0.5) {
  const x = make(dur + fade), n = len(dur), f = len(fade), out = x.slice(0, n);
  for (let i = 0; i < f; i++) {
    const k = i / f;
    out[i] = x[n + i] * Math.cos(k * Math.PI * 0.5) + x[i] * Math.sin(k * Math.PI * 0.5);
  }
  return out;
}
const stereo = (make) => [make(), make()];

const wind = (dur) => {
  const x = white(len(dur)), w1 = 0.11 + rnd() * 0.05, w2 = 0.27 + rnd() * 0.1;
  const out = svf(x, (t) => 300 + 220 * Math.sin(t * TAU * w1) + 140 * Math.sin(t * TAU * w2 + 1), 1.4, 'bp');
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] *= 0.6 + 0.3 * Math.sin(t * TAU * w1 * 0.7 + 2) + 0.1 * Math.sin(t * TAU * w2 * 1.3);
  }
  return add(out, svf(white(len(dur)), 180), 0.8);
};

const crickets = (dur) => {
  const out = new Float32Array(len(dur));
  for (let c = 0; c < 3; c++) {
    const f = 3900 + rnd() * 900, every = 0.45 + rnd() * 0.35, pulses = 3 + Math.floor(rnd() * 3), gap = 0.032 + rnd() * 0.01, amp = 0.25 + rnd() * 0.3;
    for (let t = rnd() * every; t < dur; t += every * (0.85 + rnd() * 0.3)) {
      if (rnd() < 0.12) continue;
      for (let k = 0; k < pulses; k++) add(out, tone({ dur: 0.022, f: [f], a: 0.004, d: 0.008 }), amp, t + k * gap);
    }
  }
  add(out, svf(white(len(dur)), 220), 0.2);
  return out;
};

const rainLoop = (dur) => {
  const out = svf(white(len(dur)), 2600, 0.5, 'bp');
  for (let i = 0; i < out.length; i++) out[i] *= 0.35;
  add(out, svf(white(len(dur)), 500), 0.5);
  add(out, grains({ dur, rate: 260, f: (t) => 2500 + Math.sin(t * 40) * 1500, q: 2, d: 0.006 }), 0.7);
  add(out, grains({ dur, rate: 40, f: 900, q: 3, d: 0.02 }), 0.5);
  return out;
};

const fireLoop = (dur) => {
  const out = svf(white(len(dur)), (t) => 500 + Math.sin(t * 2.3) * 150, 0.8);
  for (let i = 0; i < out.length; i++) out[i] *= 0.5 + 0.25 * Math.sin((i / SR) * TAU * 0.7);
  add(out, grains({ dur, rate: 22, f: 2600, q: 1.3, d: 0.006 }), 1.2);
  add(out, grains({ dur, rate: 5, f: 1200, q: 1, d: 0.02 }), 1);
  return out;
};

// ---------- the list ----------
const R = {};
const def = (name, count, peak, fn) => (R[name] = [count, peak, fn]);

// fighting
def('swing', 4, 0.6, () => whoosh(0.2 + pm(0.03), 450 + pm(80), 2400 + pm(400), 1.4, 0.55));
def('swingHeavy', 3, 0.7, () => add(whoosh(0.36, 220, 1400, 1, 0.6), swell(tone({ dur: 0.36, f: [70, 110], type: 'tri' }), 0.22), 0.3));
def('punch', 4, 0.9, () => {
  const o = silence(0.3);
  add(o, thump(150 + pm(20), 55, 0.07), 1);
  add(o, crunch(1800 + pm(400), 0.025), 0.55);
  add(o, click(4000, 0.004), 0.5);
  add(o, hiss({ dur: 0.15, f: [900], d: 0.04 }), 0.4);
  return o;
});
def('hitHeavy', 3, 0.95, () => {
  const o = silence(0.5);
  add(o, thump(120, 40, 0.13, 0.5), 1);
  add(o, crunch(1300 + pm(300), 0.05), 0.7);
  add(o, hiss({ dur: 0.4, f: [1400, 200], d: 0.1 }), 0.6);
  add(o, click(3500, 0.005), 0.5);
  return drive(o, 1.6);
});
def('smash', 3, 1, () => {
  const o = silence(0.9);
  add(o, thump(110, 34, 0.2, 0.9), 1);
  add(o, crunch(1000 + pm(200), 0.07), 0.8);
  add(o, click(3000, 0.006), 0.6);
  add(o, rumbleTail(0.8, 1500, 90, 0.18), 0.8);
  add(o, grains({ dur: 0.7, rate: 60, f: 1500, q: 0.8, fade: 0.2, d: 0.008 }), 0.4, 0.02);
  return drive(o, 1.8);
});
def('execute', 2, 1, () => {
  const o = silence(1.6);
  add(o, thump(100, 26, 0.35, 1.5), 1);
  add(o, crunch(800, 0.09), 0.9);
  add(o, click(2500, 0.008), 0.7);
  add(o, bell(1.4, 210 + pm(10), [1, 2.76, 5.4, 8.93], 0.6), 0.45);
  add(o, rumbleTail(1.5, 1200, 50, 0.4), 0.8);
  return drive(o, 1.8);
});
def('parry', 3, 0.85, () => {
  const o = silence(0.7);
  add(o, click(5000, 0.004), 0.8);
  add(o, bell(0.7, 1100 + pm(80), [1, 2.32, 4.25, 6.63], 0.28), 0.9);
  add(o, hiss({ dur: 0.08, f: [6000], mode: 'hp', d: 0.02 }), 0.4);
  return o;
});
def('perfect', 2, 0.85, () => {
  const o = silence(1.2);
  add(o, click(6000, 0.004), 0.8);
  add(o, bell(1.1, 1650, [1, 2.32, 4.25, 6.63], 0.55), 0.8);
  add(o, tone({ dur: 1.2, f: [3300, 3400], a: 0.002, d: 0.5 }), 0.25);
  add(o, pings(0.6, 14, 4000, 9000, 0.06), 0.35, 0.05);
  add(o, swell(hiss({ dur: 0.5, f: [3000, 9000], mode: 'hp' }), 0.1), 0.2);
  return o;
});
def('block', 3, 0.8, () => {
  const o = silence(0.3);
  add(o, thump(190 + pm(20), 85, 0.06), 1);
  add(o, hiss({ dur: 0.2, f: [900], d: 0.05 }), 0.6);
  add(o, tone({ dur: 0.15, f: [330 + pm(30)], type: 'tri', d: 0.04 }), 0.3);
  return o;
});
def('guardBreak', 2, 0.95, () => {
  const o = silence(0.8);
  add(o, drive(hiss({ dur: 0.12, f: [1200], mode: 'hp', d: 0.04 }), 3), 0.9);
  add(o, tone({ dur: 0.4, f: [620, 110], g: 0.25, type: 'sq', d: 0.1 }), 0.25);
  add(o, thump(130, 40, 0.15), 0.9);
  add(o, pings(0.5, 16, 2500, 7000, 0.06), 0.4);
  return drive(o, 1.3);
});
def('shatter', 2, 0.9, () => {
  const o = silence(0.8);
  add(o, thump(140, 50, 0.08), 0.6);
  add(o, hiss({ dur: 0.5, f: [4000], mode: 'hp', d: 0.12 }), 0.5);
  add(o, pings(0.5, 40, 2000, 7500, 0.08), 0.9);
  add(o, crunch(2600, 0.04, 2), 0.5);
  return o;
});
def('roll', 3, 0.55, () => {
  const o = swell(hiss({ dur: 0.32, f: [300, 1300, 350], g: 0.12, q: 0.8 }), 0.1, 1);
  add(o, grains({ dur: 0.3, rate: 70, f: 1100, q: 0.8, d: 0.006 }), 0.35);
  return o;
});
def('vanish', 2, 0.7, () => {
  const o = swell(hiss({ dur: 0.22, f: [800, 7000], mode: 'hp', g: 0.2 }), 0.19, 3);
  add(o, swell(tone({ dur: 0.2, f: [1800, 5200], g: 0.2 }), 0.18, 3), 0.25);
  add(o, hiss({ dur: 0.1, f: [3000], mode: 'bp', q: 2, d: 0.02 }), 0.3, 0.19);
  return o;
});
def('hurt', 3, 0.9, () => {
  const o = silence(0.45);
  add(o, thump(130, 48, 0.1), 1);
  add(o, hiss({ dur: 0.25, f: [800, 300], d: 0.06 }), 0.6);
  add(o, crunch(1500, 0.03), 0.4);
  // a grunt: a short buzz through two vowel bands
  const g = tone({ dur: 0.22, f: [150 + pm(15), 100], type: 'saw', a: 0.015, d: 0.07 });
  add(o, add(svf(g, 650, 4, 'bp'), svf(g, 1150, 5, 'bp'), 0.6), 0.5, 0.01);
  return o;
});
def('broken', 1, 0.95, () => {
  const o = silence(1.3);
  add(o, drive(hiss({ dur: 0.15, f: [900], mode: 'hp', d: 0.05 }), 3), 0.9);
  add(o, thump(110, 30, 0.25, 1), 1);
  add(o, svf(tone({ dur: 1.2, f: [70, 45], type: 'saw', a: 0.02, d: 0.4 }), 400), 0.6);
  add(o, pings(0.5, 12, 2000, 5000, 0.08), 0.3);
  return o;
});
def('glint', 2, 0.5, () => add(tone({ dur: 0.35, f: [2800 + pm(100)], a: 0.002, d: 0.08 }), tone({ dur: 0.35, f: [4200], d: 0.05 }), 0.4));
def('peril', 2, 0.7, () => {
  const o = silence(0.5);
  add(o, svf(add(tone({ dur: 0.45, f: [196], type: 'saw', a: 0.01, d: 0.15 }), tone({ dur: 0.45, f: [208], type: 'saw', a: 0.01, d: 0.15 })), 1100), 0.7);
  add(o, tone({ dur: 0.3, f: [1900], d: 0.07 }), 0.35);
  return o;
});
def('clash', 2, 0.9, () => {
  const o = silence(0.7);
  add(o, bell(0.7, 620 + pm(30), [1, 2.2, 3.9, 5.7], 0.25), 0.8);
  add(o, hiss({ dur: 0.6, f: [2500], q: 1.5, mode: 'bp', a: 0.01, d: 0.2, am: [32, 0.9] }), 0.5);
  add(o, thump(150, 70, 0.07), 0.6);
  return o;
});
def('clashWin', 1, 1, () => {
  const o = silence(1);
  add(o, bell(1, 520, [1, 2.2, 3.9, 5.7], 0.45), 0.8);
  add(o, thump(110, 35, 0.2, 0.8), 1);
  add(o, whoosh(0.4, 300, 2000, 1.2, 0.2), 0.6);
  return drive(o, 1.4);
});

// moving
def('step', 5, 0.35, () => {
  const o = hiss({ dur: 0.12, f: [700 + pm(200), 300], d: 0.03 });
  add(o, thump(90, 60, 0.02, 0.1), 0.5);
  add(o, grains({ dur: 0.1, rate: 90, f: 1800, q: 0.8, d: 0.004, fade: 0.04 }), 0.4);
  return o;
});
def('stepStone', 4, 0.35, () => {
  const o = click(2600 + pm(400), 0.005);
  add(o, hiss({ dur: 0.1, f: [1200 + pm(200)], q: 1.5, mode: 'bp', d: 0.02 }), 0.8);
  add(o, thump(220, 120, 0.015, 0.08), 0.5);
  return o;
});
def('stepWater', 4, 0.4, () => {
  const o = hiss({ dur: 0.3, f: [600, 2200, 700], g: 0.04, q: 1.1, mode: 'bp', d: 0.07 });
  add(o, bubbles(0.3, 4, 400, 1100, 0.02), 0.4);
  return o;
});
def('hoof', 3, 0.45, () => add(thump(170 + pm(20), 70, 0.04, 0.15), click(2000, 0.006), 0.5));
def('jump', 2, 0.4, () => add(swell(hiss({ dur: 0.2, f: [400, 1600], q: 1, mode: 'bp' }), 0.08), grains({ dur: 0.1, rate: 80, f: 1500, d: 0.004 }), 0.4));
def('land', 2, 0.8, () => {
  const o = silence(0.5);
  add(o, thump(100, 40, 0.12), 1);
  add(o, hiss({ dur: 0.35, f: [900, 300], d: 0.09 }), 0.7);
  add(o, grains({ dur: 0.35, rate: 80, f: 1400, q: 0.8, fade: 0.1, d: 0.006 }), 0.5);
  return o;
});
def('splash', 2, 0.8, () => {
  const o = hiss({ dur: 0.8, f: [300, 3000, 600], g: 0.06, q: 1, mode: 'bp', d: 0.2 });
  add(o, bubbles(0.8, 16, 300, 1200, 0.03), 0.6);
  add(o, thump(90, 50, 0.06), 0.5);
  return o;
});

// foes
def('foeHit', 4, 0.8, () => {
  const o = silence(0.3);
  add(o, thump(105 + pm(15), 45, 0.07), 1);
  add(o, hiss({ dur: 0.18, f: [520, 240], q: 3, mode: 'bp', d: 0.04, drive: 2 }), 0.6);
  return o;
});
def('foeDie', 3, 0.85, () => {
  const o = silence(1);
  const growl = tone({ dur: 0.8, f: [170 + pm(30), 55], g: 0.7, type: 'saw', a: 0.03, d: 0.3, vib: [17, 0.06] });
  add(o, add(svf(growl, 520, 3, 'bp'), svf(growl, 900, 4, 'bp'), 0.5), 0.8);
  add(o, thump(110, 40, 0.15), 0.7, 0.05);
  add(o, hiss({ dur: 0.6, f: [800, 200], d: 0.15 }), 0.4, 0.05);
  return drive(o, 1.4);
});
def('foeDieBig', 2, 1, () => {
  const o = silence(1.8);
  const growl = tone({ dur: 1.4, f: [110, 38], g: 1.2, type: 'saw', a: 0.05, d: 0.5, vib: [11, 0.08] });
  add(o, add(svf(growl, 380, 3, 'bp'), svf(growl, 700, 4, 'bp'), 0.6), 0.9);
  add(o, boom(1.6, 0.8), 0.7, 0.35);
  return drive(o, 1.3);
});
def('machineBreak', 2, 0.95, () => {
  const o = woodBreak(1.3);
  add(o, woodBreak(0.9), 0.7, 0.2);
  add(o, thump(80, 35, 0.25, 1), 0.9, 0.15);
  return o;
});
def('roar', 2, 0.9, () => {
  const o = silence(1.4);
  const g = tone({ dur: 1.3, f: [95, 75], type: 'saw', a: 0.12, d: 0.6, vib: [7, 0.08], am: [31, 0.5] });
  add(o, add(svf(g, 420, 2, 'bp'), svf(g, 800, 3, 'bp'), 0.6), 1);
  add(o, swell(hiss({ dur: 1.3, f: [600], q: 1, mode: 'bp' }), 0.4), 0.6);
  return drive(o, 2);
});
def('orb', 2, 0.5, () => add(whoosh(0.4, 300, 1200, 1.4, 0.3), tone({ dur: 0.4, f: [180, 260], a: 0.05, d: 0.2, am: [24, 0.5] }), 0.5));

// Watchers
def('omen', 1, 0.9, () => {
  const o = silence(3.2);
  add(o, pad(3.2, [55, 55.4, 82.4], (t) => 200 + t * 220, { a: 1.6, d: 0, q: 2 }), 0.9);
  add(o, bell(1.6, 330, [1, 2.01, 3.5, 5.2], 0.6).reverse(), 0.5, 1.5);
  add(o, tone({ dur: 3.1, f: [1250, 880], a: 1, d: 1.4, vib: [5, 0.015] }), 0.12, 0.1);
  add(o, swell(hiss({ dur: 3.1, f: [400, 2400], q: 3, mode: 'bp' }), 2.8, 2), 0.35);
  return o;
});
def('arrive', 1, 1, () => {
  const o = silence(2.2);
  add(o, boom(1.6, 0.9), 0.9);
  for (const f of [330, 440, 495]) add(o, bell(2, f, [1, 2.01, 3.5], 0.7), 0.25);
  add(o, pings(1.2, 18, 2500, 6000, 0.12), 0.2, 0.1);
  return o;
});
def('repel', 2, 0.95, () => {
  const o = silence(1.1);
  add(o, swell(hiss({ dur: 0.35, f: [200, 1800], q: 2, mode: 'bp' }), 0.33, 2), 0.6);
  add(o, tone({ dur: 0.8, f: [80, 38], g: 0.3, a: 0.002, d: 0.22, drive: 1.6 }), 1, 0.33);
  add(o, hiss({ dur: 0.6, f: [3000, 300], g: 0.3, d: 0.12 }), 0.8, 0.33);
  add(o, bell(0.7, 500, [1, 2.4, 4.1], 0.3), 0.4, 0.33);
  return o;
});
def('unveil', 1, 1, () => {
  const o = silence(3);
  const choir = pad(1.9, [110, 138.6, 165], (t) => 500 + t * 400, { a: 1.2, bend: 1.5, vib: [5, 0.008], q: 1.5 });
  add(o, add(svf(choir, 750, 3, 'bp'), svf(choir, 1150, 4, 'bp'), 0.8), 1.2);
  add(o, riser(1.85, 300, 4000), 0.5);
  add(o, drive(hiss({ dur: 0.15, f: [1500], mode: 'hp', d: 0.04 }), 3), 0.8, 1.85);
  add(o, boom(1.1, 0.8), 0.8, 1.85);
  return o;
});
def('watcherCast', 2, 0.6, () => {
  const o = pings(0.6, 10, 1200, 3000, 0.12);
  add(o, swell(tone({ dur: 0.6, f: [620, 930], vib: [6, 0.02] }), 0.4), 0.4);
  add(o, swell(hiss({ dur: 0.6, f: [800, 2600], q: 3, mode: 'bp' }), 0.4), 0.4);
  return o;
});

// blasts and breaking
def('boom', 2, 1, () => boom(1.8 + pm(0.15), 1));
def('blast', 2, 0.95, () => boom(1.0, 0.6));
def('crumble', 4, 0.85, () => crumble(0.55 + pm(0.08), 0.5 + pm(0.3)));
def('woodBreak', 3, 0.85, () => woodBreak(0.7));
def('collapse', 2, 1, () => {
  const o = silence(2.8);
  add(o, rumbleTail(2.6, 500, 50, 0.9), 1.1);
  for (let k = 0; k < 6; k++) add(o, crumble(0.6, 0.4 + rnd() * 0.6), 0.6, rnd() * 1.6);
  add(o, thump(80, 30, 0.4, 1.4), 0.8, 0.1);
  return drive(o, 1.3);
});
def('debris', 3, 0.4, () => grains({ dur: 0.25, rate: 40, f: 2000, q: 1, fade: 0.08, d: 0.006 }));
def('dirt', 3, 0.7, () => add(hiss({ dur: 0.3, f: [900, 300], d: 0.07 }), thump(100, 50, 0.06), 0.7));
def('chop', 3, 0.8, () => {
  const o = tone({ dur: 0.25, f: [380 + pm(40), 340], type: 'tri', d: 0.05 });
  add(o, hiss({ dur: 0.1, f: [1600], q: 1.5, mode: 'bp', d: 0.02 }), 0.7);
  add(o, thump(150, 70, 0.04), 0.7);
  return o;
});
def('mine', 3, 0.8, () => {
  const o = bell(0.35, 2300 + pm(200), [1, 2.7, 4.6], 0.07);
  add(o, click(4000, 0.004), 0.6);
  add(o, thump(160, 80, 0.04), 0.6);
  add(o, grains({ dur: 0.2, rate: 60, f: 2500, d: 0.004, fade: 0.06 }), 0.4);
  return o;
});
def('siegeFire', 2, 0.85, () => {
  const o = silence(0.9);
  add(o, svf(tone({ dur: 0.3, f: [80, 60], type: 'saw', a: 0.02, d: 0.1, vib: [30, 0.3] }), 600, 2, 'bp'), 0.5);
  add(o, thump(90, 40, 0.12), 0.9, 0.2);
  add(o, crunch(700, 0.05), 0.5, 0.2);
  add(o, whoosh(0.5, 200, 900, 1, 0.3), 0.6, 0.25);
  return o;
});

// Spirit, Wrath
def('spiritShot', 2, 0.7, () => {
  const o = tone({ dur: 0.35, f: [500, 1400], g: 0.08, type: 'tri', d: 0.1 });
  add(o, whoosh(0.35, 800, 4000, 1.5, 0.2), 0.6);
  add(o, thump(140, 70, 0.04), 0.4);
  return o;
});
def('spiritWave', 1, 0.8, () => {
  const o = pad(1.4, [220, 330, 440], (t) => 800 + t * 2000, { a: 0.1, d: 0.7 });
  add(o, swell(hiss({ dur: 1.4, f: [2000, 5000], q: 1.5, mode: 'bp' }), 0.3), 0.5);
  return o;
});
def('wrathFull', 1, 0.6, () => {
  const o = silence(1);
  [392, 494, 587, 784].forEach((f, k) => add(o, tone({ dur: 0.8, f: [f], type: 'tri', a: 0.005, d: 0.3 }), 0.4, k * 0.06));
  add(o, pings(0.8, 10, 3000, 7000, 0.1), 0.2, 0.2);
  return o;
});
def('surge', 1, 0.9, () => {
  const o = riser(0.9, 300, 4000);
  add(o, pad(0.9, [110, 165, 220], (t) => 400 + t * 3000, { a: 0.6 }), 0.5);
  add(o, boom(0.9, 0.5), 0.6, 0.85);
  return o;
});

// the elements, by name: cast.fire, impact.fire, wave.fire, ult.fire
for (const [el, set] of Object.entries(ELEMENTS)) {
  def(`cast.${el}`, 2, 0.7, set.cast);
  def(`impact.${el}`, 2, 0.95, set.impact);
  def(`wave.${el}`, 1, 0.8, set.wave);
}
for (const el of Object.keys(ELEMENTS)) def(`ult.${el}`, 1, 1, () => ultimate(el));

// the menus
def('ui.move', 2, 0.35, () => add(tone({ dur: 0.05, f: [1700 + pm(60)], d: 0.012 }), click(5000, 0.002), 0.3));
def('ui.tab', 2, 0.4, () => add(hiss({ dur: 0.06, f: [2400], q: 1.2, mode: 'bp', d: 0.015 }), tone({ dur: 0.06, f: [1200], d: 0.015 }), 0.5));
def('ui.select', 1, 0.5, () => {
  const o = silence(0.3);
  add(o, bell(0.2, 660, [1, 2, 3], 0.06), 1);
  add(o, bell(0.22, 990, [1, 2, 3], 0.08), 1, 0.06);
  return o;
});
def('ui.back', 1, 0.45, () => {
  const o = silence(0.3);
  add(o, bell(0.18, 700, [1, 2, 3], 0.05), 1);
  add(o, bell(0.2, 470, [1, 2, 3], 0.07), 1, 0.06);
  return o;
});
def('ui.open', 1, 0.45, () => {
  const o = whoosh(0.3, 500, 2500, 1, 0.5);
  [523, 659, 784].forEach((f, k) => add(o, tone({ dur: 0.35, f: [f], type: 'tri', a: 0.01, d: 0.12 }), 0.35, k * 0.03));
  return o;
});
def('ui.close', 1, 0.4, () => {
  const o = whoosh(0.25, 2000, 500, 1, 0.3);
  [784, 659, 523].forEach((f, k) => add(o, tone({ dur: 0.3, f: [f], type: 'tri', a: 0.01, d: 0.08 }), 0.3, k * 0.03));
  return o;
});
def('ui.confirm', 1, 0.7, () => {
  const o = silence(1.4);
  for (const f of [196, 247, 294, 392]) add(o, bell(1.3, f, [1, 2, 3, 4.2], 0.5), 0.3);
  add(o, boom(1, 0.5), 0.35);
  return o;
});

// ambience one-shots
def('bird', 4, 0.35, () => {
  const o = silence(0.7), base = 2600 + rnd() * 1800, notes = 2 + Math.floor(rnd() * 4);
  for (let k = 0; k < notes; k++) {
    const f = base * (0.85 + rnd() * 0.3), d = 0.04 + rnd() * 0.06;
    add(o, tone({ dur: d * 1.4, f: [f, f * (0.8 + rnd() * 0.5)], a: 0.004, d: d * 0.5, vib: [70, 0.03] }), 0.6, k * (0.09 + rnd() * 0.05));
  }
  return o;
});
def('owl', 2, 0.35, () => {
  const o = silence(1.4);
  const hoot = (at, dur) => add(o, add(tone({ dur, f: [410, 370], a: 0.06, d: 0, vib: [6, 0.01] }), swell(hiss({ dur, f: [400], q: 4, mode: 'bp' }), dur * 0.3), 0.3), 0.8, at);
  hoot(0, 0.3);
  hoot(0.5, 0.5);
  return o;
});
def('thunderFar', 2, 0.6, () => svf(ELEMENTS.storm.impact(), 500));

// loops last
def('loop.wind', 1, 0.5, () => stereo(() => loop(7, wind)));
def('loop.night', 1, 0.4, () => stereo(() => loop(6, crickets, 0.3)));
def('loop.rain', 1, 0.5, () => stereo(() => loop(5, rainLoop)));
def('loop.fire', 1, 0.5, () => stereo(() => loop(4, fireLoop)));
// The room the world plays in: a dark, decaying stereo tail for the reverb.
def('verb', 1, 0.5, () => stereo(() => {
  const n = len(2.4), x = white(n);
  const out = svf(x, (t) => 7000 * Math.exp(-t * 1.6) + 300);
  for (let i = 0; i < n; i++) out[i] *= Math.exp((-i / SR) * 2.6) * Math.min(1, i / (SR * 0.01));
  return out;
}));

function normalize(chans, peak) {
  let m = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  const k = m > 0 ? peak / m : 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= k;
  return chans;
}

self.onmessage = ({ data }) => {
  SR = data.rate ?? 44100;
  let n = 0;
  for (const [name, [count, peak, fn]] of Object.entries(R)) {
    for (let v = 0; v < count; v++) {
      seed = 1 + n++ * 7919;
      const made = fn(v);
      const chans = normalize(Array.isArray(made) ? made : [made], peak);
      self.postMessage({ name, chans, rate: SR }, chans.map((c) => c.buffer));
    }
  }
  self.postMessage({ done: true });
};

export const NAMES = Object.keys(R); // for tests
