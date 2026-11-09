// Sound: every effect in the open world, synthesised once at load in soundWorker.js (nothing is fetched,
// so it works offline) and played through a fixed pool of voices. A sound with a place is as loud as it
// is to the nearer hero (two heroes share one pair of speakers), panned for one hero, muffled with distance.
// `sfx(name, x, z, gain)` plays one; x undefined = no place (menus). Ambience (wind, night, rain, fire,
// birds, owls) and footsteps and menu sounds run from `sound.update()` in main.js's step.
// Settings: `settings.volume` and `settings.ambience` (0..10). Feature switch: FEATURES.sound.
import { FEATURES } from '../config/features.js';

const VOICES = 32;          // the pool: at most this many sounds at once
const HEAR = 6;             // a sound is gone beyond HEAR × its ref distance
const UNLOCK_EVERY = 1.5;   // seconds between tries to wake the audio after pad input
const AMB_EVERY = 0.25;     // how often the ambience works out what it should be
const STEP_SURFACE = { grass: 'step', stone: 'stepStone', water: 'stepWater', hoof: 'hoof' };

// How each sound plays. gain, ref (tiles to half volume), gap (seconds before it can play again),
// most (at once), jit (pitch spread), verb (reverb send), bus.
const BASE = { gain: 0.8, ref: 14, gap: 0.03, most: 4, jit: 0.06, verb: 0.15, bus: 'sfx' };
const CUES = {
  swing: { gain: 0.45, ref: 8, gap: 0.05, most: 3, jit: 0.1, verb: 0.05 },
  swingHeavy: { gain: 0.6, ref: 10, most: 2 },
  punch: { gain: 0.75, ref: 12, most: 3 },
  hitHeavy: { gain: 0.9, ref: 14, most: 2 },
  smash: { gain: 1, ref: 20, most: 2, verb: 0.25 },
  execute: { gain: 1, ref: 24, most: 1, jit: 0.02, verb: 0.35 },
  parry: { gain: 0.8, ref: 16, most: 2, verb: 0.3 },
  perfect: { gain: 0.85, ref: 18, most: 1, jit: 0.02, verb: 0.35 },
  block: { gain: 0.7, ref: 12, most: 2 },
  guardBreak: { gain: 0.9, ref: 16, most: 1 },
  shatter: { gain: 0.9, ref: 18, most: 2, verb: 0.3 },
  roll: { gain: 0.5, ref: 8, most: 2 },
  vanish: { gain: 0.6, ref: 10, most: 2, verb: 0.25 },
  hurt: { gain: 0.85, ref: 12, gap: 0.08, most: 2 },
  broken: { gain: 0.9, ref: 14, most: 1, verb: 0.3 },
  glint: { gain: 0.35, ref: 20, gap: 0.12, most: 2, verb: 0.3 },
  peril: { gain: 0.55, ref: 24, gap: 0.15, most: 2, verb: 0.2 },
  clash: { gain: 0.85, ref: 16, gap: 0.08, most: 2, verb: 0.3 },
  clashWin: { gain: 1, ref: 18, most: 1, verb: 0.35 },
  step: { gain: 0.32, ref: 6, gap: 0.05, most: 4, jit: 0.12, verb: 0 },
  stepStone: { gain: 0.3, ref: 6, gap: 0.05, most: 4, jit: 0.1, verb: 0.1 },
  stepWater: { gain: 0.35, ref: 6, gap: 0.05, most: 4, jit: 0.12, verb: 0 },
  hoof: { gain: 0.4, ref: 8, gap: 0.05, most: 4, jit: 0.1, verb: 0.05 },
  jump: { gain: 0.35, ref: 6, most: 2 },
  land: { gain: 0.6, ref: 10, most: 2 },
  splash: { gain: 0.6, ref: 12, gap: 0.2, most: 2 },
  foeHit: { gain: 0.5, ref: 12, gap: 0.04, most: 4, jit: 0.12 },
  foeDie: { gain: 0.7, ref: 18, gap: 0.06, most: 3, jit: 0.15 },
  foeDieBig: { gain: 0.95, ref: 30, most: 2, verb: 0.35 },
  machineBreak: { gain: 0.9, ref: 30, most: 2, verb: 0.3 },
  roar: { gain: 0.9, ref: 40, gap: 0.5, most: 1, verb: 0.35 },
  orb: { gain: 0.45, ref: 14, gap: 0.08, most: 3 },
  omen: { gain: 0.8, ref: 200, most: 1, jit: 0, verb: 0.5 },
  arrive: { gain: 1, ref: 60, most: 1, jit: 0, verb: 0.5 },
  repel: { gain: 0.95, ref: 30, most: 1, verb: 0.4 },
  unveil: { gain: 1, ref: 80, most: 1, jit: 0, verb: 0.5 },
  watcherCast: { gain: 0.55, ref: 24, gap: 0.2, most: 2, verb: 0.4 },
  boom: { gain: 1, ref: 40, gap: 0.08, most: 3, verb: 0.45 },
  blast: { gain: 0.85, ref: 28, gap: 0.06, most: 3, verb: 0.35 },
  crumble: { gain: 0.6, ref: 18, gap: 0.06, most: 3, jit: 0.15, verb: 0.25 },
  woodBreak: { gain: 0.6, ref: 18, gap: 0.06, most: 3, jit: 0.12, verb: 0.2 },
  collapse: { gain: 1, ref: 45, gap: 0.4, most: 2, verb: 0.45 },
  debris: { gain: 0.3, ref: 10, gap: 0.05, most: 3, jit: 0.2, verb: 0.1 },
  dirt: { gain: 0.6, ref: 14, gap: 0.05, most: 3, jit: 0.12 },
  chop: { gain: 0.7, ref: 16, most: 2, jit: 0.08, verb: 0.2 },
  mine: { gain: 0.7, ref: 16, most: 2, jit: 0.08, verb: 0.2 },
  siegeFire: { gain: 0.8, ref: 40, gap: 0.2, most: 2, verb: 0.3 },
  spiritShot: { gain: 0.6, ref: 14, most: 3 },
  spiritWave: { gain: 0.75, ref: 18, gap: 0.5, most: 1, verb: 0.3 },
  wrathFull: { gain: 0.5, gap: 1, most: 1, jit: 0, verb: 0.3 },
  surge: { gain: 0.85, ref: 20, gap: 1, most: 1, jit: 0, verb: 0.35 },
  cast: { gain: 0.65, ref: 18, gap: 0.05, most: 3, verb: 0.25 },
  impact: { gain: 0.9, ref: 28, gap: 0.05, most: 4, verb: 0.35 },
  wave: { gain: 0.75, ref: 28, gap: 0.1, most: 2, verb: 0.35 },
  ult: { gain: 1, ref: 60, gap: 1, most: 1, jit: 0, verb: 0.5 },
  ui: { gain: 0.55, gap: 0.03, most: 3, jit: 0.02, verb: 0, bus: 'ui' },
  'ui.confirm': { gain: 0.7, gap: 0.5, most: 1, jit: 0, verb: 0.2, bus: 'ui' },
  bird: { gain: 0.25, gap: 0.5, most: 2, jit: 0.15, verb: 0.3, bus: 'amb' },
  owl: { gain: 0.3, gap: 2, most: 1, jit: 0.04, verb: 0.5, bus: 'amb' },
  thunderFar: { gain: 0.5, gap: 2, most: 1, jit: 0.1, verb: 0.4, bus: 'amb' },
};
const cueOf = new Map();
const cue = (name) => {
  let c = cueOf.get(name);
  if (!c) cueOf.set(name, (c = { ...BASE, ...(CUES[name] ?? CUES[name.split('.')[0]]) }));
  return c;
};

// What each rumble moment (rumble.js FEELS) sounds like, and how loud.
const FELT = {
  jab: ['punch', 1], finisher: ['hitHeavy', 1], smash: ['smash', 1], execute: ['execute', 1], perfect: ['perfect', 1], parry: ['parry', 1],
  parryRow: ['perfect', 0.9], block: ['block', 1], guardBroken: ['guardBreak', 1], vanish: ['vanish', 1], peril: ['peril', 1], dodge: ['vanish', 0.6],
  hurt: ['hurt', 1], broken: ['broken', 1], shatter: ['shatter', 1], quake: ['boom', 1],
};

class Sound {
  constructor() {
    this.ctx = null;
    this.banks = new Map();    // name -> [AudioBuffer]
    this.waiting = [];         // buffers made before the audio woke
    this.voices = [];
    this.last = new Map();     // name -> time last played
    this.listeners = [];       // { x, z, yaw }
    this.volume = 0.8;
    this.ambience = 0.6;
    this.loops = {};
    this.amb = { t: 0, bird: 4, owl: 12, thunder: 6, fire: 0 };
    this.unlockWait = 0;
    this.played = 0;           // for tests: how many sounds have started
    this.ready = false;
    this.wasOpen = false;
  }

  // Starts making the sounds. Called once from main.js.
  start() {
    if (!FEATURES.sound || this.worker) return;
    const wake = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { capture: true, passive: true });
    try {
      this.worker = new Worker(new URL('./soundWorker.js', import.meta.url), { type: 'module' });
    } catch {
      return;
    }
    this.worker.onmessage = ({ data }) => {
      if (data.done) {
        this.ready = true;
        this.worker.terminate();
        return;
      }
      const buf = new AudioBuffer({ length: data.chans[0].length, numberOfChannels: data.chans.length, sampleRate: data.rate });
      data.chans.forEach((c, i) => buf.copyToChannel(c, i));
      if (!this.banks.has(data.name)) this.banks.set(data.name, []);
      this.banks.get(data.name).push(buf);
      if (data.name === 'verb' && this.verb) this.setVerb(buf);
      if (data.name.startsWith('loop.') && this.ctx) this.startLoop(data.name);
    };
    this.worker.postMessage({ rate: 44100 });
  }

  // Browsers keep audio asleep until the player presses something.
  unlock() {
    if (!FEATURES.sound) return;
    if (!this.ctx) {
      try {
        this.build(new AudioContext({ latencyHint: 'interactive' }));
      } catch {
        return;
      }
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  build(ctx) {
    this.ctx = ctx;
    const master = (this.master = ctx.createGain());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master.connect(comp).connect(ctx.destination);
    this.tap = ctx.createAnalyser();   // tests read the level here
    this.tap.fftSize = 2048;
    comp.connect(this.tap);
    this.bus = {};
    for (const b of ['sfx', 'ui', 'amb']) (this.bus[b] = ctx.createGain()).connect(master);
    this.verb = ctx.createConvolver();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.verb.connect(wet).connect(master);
    const ir = this.banks.get('verb')?.[0];
    if (ir) this.setVerb(ir);
    for (let i = 0; i < VOICES; i++) {
      const filter = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner(), send = ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = 20000;
      filter.connect(gain).connect(pan);
      pan.connect(send).connect(this.verb);
      this.voices.push({ filter, gain, pan, send, src: null, name: '', until: 0, loud: 0, bus: null });
    }
    for (const name of this.banks.keys()) if (name.startsWith('loop.')) this.startLoop(name);
    this.setVolume(this.volume, this.ambience);
  }

  // A convolver only takes a tail made at the speakers' own rate (often 48000): stretch it to fit.
  setVerb(ir) {
    const rate = this.ctx.sampleRate;
    if (ir.sampleRate !== rate) {
      const k = ir.sampleRate / rate, n = Math.floor(ir.length / k), out = new AudioBuffer({ length: n, numberOfChannels: ir.numberOfChannels, sampleRate: rate });
      for (let c = 0; c < ir.numberOfChannels; c++) {
        const src = ir.getChannelData(c), dst = out.getChannelData(c);
        for (let i = 0; i < n; i++) {
          const at = i * k, j = Math.floor(at), f = at - j;
          dst[i] = src[j] * (1 - f) + (src[j + 1] ?? 0) * f;
        }
      }
      ir = out;
    }
    try {
      this.verb.buffer = ir;
    } catch { /* no reverb, still sound */ }
  }

  setVolume(volume, ambience = this.ambience) {
    this.volume = volume;
    this.ambience = ambience;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(volume * volume, t, 0.05); // squared: the steps sound even
    this.bus.amb.gain.setTargetAtTime(ambience * ambience * 1.4, t, 0.05);
  }

  startLoop(name) {
    if (this.loops[name] || !this.ctx) return;
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    src.buffer = this.banks.get(name)[0];
    src.loop = true;
    gain.gain.value = 0;
    src.connect(gain).connect(this.bus.amb);
    src.start(0, Math.random() * src.buffer.duration);
    this.loops[name] = { src, gain, level: 0 };
  }

  // How loud a sound at (x, z) is to the nearer hero, and which way it sits from that hero's camera.
  place(x, z, ref) {
    let best = 0, pan = 0, far = 0;
    for (const l of this.listeners) {
      const d = Math.hypot(x - l.x, z - l.z), r = d / ref;
      if (r > HEAR) continue;
      const g = (1 / (1 + r * r)) * (1 - r / HEAR);
      if (g <= best) continue;
      best = g;
      far = d;
      // Screen right is (cos yaw, -sin yaw) in the world (player.js movement).
      pan = this.listeners.length > 1 || d < 1 ? 0 : ((x - l.x) * Math.cos(l.yaw) - (z - l.z) * Math.sin(l.yaw)) / d;
    }
    return { g: best, pan: pan * 0.75, far };
  }

  // A sound must never break the game: bad numbers are mended or the sound is skipped, and nothing throws.
  play(name, x, z, gain = 1, rate = 1) {
    const bank = this.banks.get(name);
    if (!FEATURES.sound || !this.ctx || this.ctx.state !== 'running' || !bank?.length || this.volume <= 0) return null;
    if (x !== undefined && !(Number.isFinite(x) && Number.isFinite(z))) return null;
    try {
      return this.start1(name, bank, x, z, Number.isFinite(gain) ? gain : 1, Number.isFinite(rate) && rate > 0 ? rate : 1);
    } catch {
      return null;
    }
  }

  start1(name, bank, x, z, gain, rate) {
    const c = cue(name), now = this.ctx.currentTime;
    if (now - (this.last.get(name) ?? -9) < c.gap) return null;
    let { g, pan, far } = x === undefined ? { g: 1, pan: 0, far: 0 } : this.place(x, z, c.ref);
    g *= c.gain * gain;
    if (!(g >= 0.004)) return null;
    // No more than `most` of one sound; the oldest of them gives way.
    let same = 0, oldest = null, free = null, weakest = null;
    for (const v of this.voices) {
      const live = v.src && v.until > now;
      if (!live) {
        free ??= v;
        continue;
      }
      if (v.name === name) {
        same++;
        if (!oldest || v.until < oldest.until) oldest = v;
      }
      const left = v.loud * (v.until - now);
      if (!weakest || left < weakest.left) weakest = { v, left };
    }
    let voice = same >= c.most ? oldest : free;
    if (!voice) {
      if (weakest.left > g * bank[0].duration) return null; // everything playing matters more
      voice = weakest.v;
    }
    this.stop(voice);
    const buf = bank[(Math.random() * bank.length) | 0], src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * c.jit);
    const t = now;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(g, t);
    voice.pan.pan.setValueAtTime(pan, t);
    voice.filter.frequency.setValueAtTime(far > 0 ? Math.max(1800, 20000 / (1 + far / (c.ref * 1.5))) : 20000, t);
    voice.send.gain.setValueAtTime(Math.min(0.9, c.verb * (1 + far / (c.ref * 3))), t);
    if (voice.bus !== c.bus) {
      voice.pan.disconnect();
      voice.pan.connect(this.bus[c.bus]);
      voice.pan.connect(voice.send);
      voice.bus = c.bus;
    }
    src.connect(voice.filter);
    src.start(t);
    voice.src = src;
    voice.name = name;
    voice.loud = g;
    voice.until = t + buf.duration / src.playbackRate.value;
    this.last.set(name, now);
    this.played++;
    return voice;
  }

  stop(voice) {
    if (!voice.src) return;
    try {
      voice.src.stop();
    } catch { /* already over */ }
    voice.src.disconnect();
    voice.src = null;
  }

  // A rumble moment (rumble.js) is also a sound.
  felt(player, feel, scale = 1) {
    const f = FELT[feel], s = player?.state;
    if (!f || !s) return;
    this.play(f[0], s.x, s.z, f[1] * Math.min(1.3, 0.55 + scale * 0.45));
  }

  // Each frame from main.js: where the heroes stand, footsteps, menus and ambience.
  update(dt, players, world) {
    if (!FEATURES.sound) return;
    try {
      this.tick(dt, players, world);
    } catch { /* sound never stops the game */ }
  }

  tick(dt, players, world) {
    this.listeners.length = players.length;
    players.forEach((p, i) => {
      const l = (this.listeners[i] ??= { x: 0, z: 0, yaw: 0 });
      l.x = p.state.x;
      l.z = p.state.z;
      l.yaw = world.viewYaw?.(p) ?? p.state.yaw;
    });
    // A pad press doesn't count as a press to the browser everywhere: keep asking.
    if ((!this.ctx || this.ctx.state !== 'running') && (this.unlockWait -= dt) <= 0 && players.some((p) => p.controls.device === 'pad' && Object.values(p.controls.just).some(Boolean))) {
      this.unlockWait = UNLOCK_EVERY;
      this.unlock();
    }
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.menus(players, world);
    if (!world.paused && !world.menu) for (const p of players) this.steps(p);
    if ((this.amb.t -= dt) <= 0) {
      this.amb.t = AMB_EVERY;
      this.ambient(AMB_EVERY, players, world);
    }
  }

  menus(players, world) {
    const open = !!(world.menu || world.gameMenu?.isOpen || world.pick?.isOpen);
    if (open !== this.wasOpen && !world.menu) this.play(open ? 'ui.open' : 'ui.close');
    this.wasOpen = open;
    if (!open) return;
    for (const p of players) {
      const j = p.controls.just;
      if (j.confirm) this.play('ui.select');
      else if (j.back) this.play('ui.back');
      else if (j.menuLeft || j.menuRight) this.play('ui.tab');
      else if (j.up || j.down || j.left || j.right) this.play('ui.move');
    }
  }

  // A footfall at each half turn of the walk (player.js `state.phase`).
  steps(p) {
    const s = p.state, k = Math.floor((s.phase ?? 0) / Math.PI);
    if (k === p.stepK) return;
    p.stepK = k;
    if (!s.moving || s.air > 0.05 || s.flying || (p.melee?.rolling ?? 0) > 0) return;
    const surface = s.riding ? 'hoof' : p.swim?.inWater || s.onWater ? 'water' : p.rooms?.house ? 'stone' : 'grass';
    this.play(STEP_SURFACE[surface], s.x, s.z, s.sprinting ? 1.2 : 0.9);
  }

  // Wind by day, crickets by night, rain under a Monsoon, fire when it burns near, birds and owls.
  ambient(dt, players, world) {
    const night = world.light?.night ?? 0, inside = players.every((p) => p.rooms?.house);
    const time = world.monsters?.time ?? 0, rain = (world.rainUntil ?? 0) > time ? 1 : 0;
    let fire = 0;
    const fires = [...(world.voxels?.fires ?? []), ...(world.scars?.fires?.() ?? [])];
    for (const f of fires) for (const l of this.listeners) fire += (f.strength ?? 0.5) / (1 + ((f.x - l.x) ** 2 + (f.z - l.z) ** 2) / 300);
    const fast = Math.max(0, ...players.map((p) => (p.state.flying ? 1 : p.state.super ? 0.8 : 0) + Math.max(0, p.state.air ?? 0) * 0.03));
    const shut = inside ? 0.35 : 1;
    this.mix('loop.wind', (0.35 + (1 - night) * 0.25 + rain * 0.2 + Math.min(0.6, fast)) * shut, 1 + Math.min(0.5, fast * 0.6));
    this.mix('loop.night', night * 0.9 * shut * (1 - rain * 0.7));
    this.mix('loop.rain', rain * 0.9 * (inside ? 0.5 : 1));
    this.mix('loop.fire', Math.min(1, fire) * 0.9);
    if (world.menu || inside) return;
    const a = this.amb;
    if ((a.bird -= dt) <= 0) {
      a.bird = 2.5 + Math.random() * 7;
      if (night < 0.35 && !rain) this.ambientShot('bird', 0.5 + Math.random() * 0.5);
    }
    if ((a.owl -= dt) <= 0) {
      a.owl = 14 + Math.random() * 20;
      if (night > 0.6 && !rain) this.ambientShot('owl', 0.6 + Math.random() * 0.4);
    }
    if ((a.thunder -= dt) <= 0) {
      a.thunder = 6 + Math.random() * 10;
      if (rain) this.ambientShot('thunderFar', 0.6 + Math.random() * 0.4);
    }
  }

  ambientShot(name, gain) {
    const v = this.play(name, undefined, undefined, gain);
    if (v) v.pan.pan.setValueAtTime(Math.random() * 1.4 - 0.7, this.ctx.currentTime);
  }

  mix(name, level, rate = 1) {
    const l = this.loops[name];
    if (!l) return;
    if (Math.abs(level - l.level) > 0.01) {
      l.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
      l.level = level;
    }
    if (Math.abs(l.src.playbackRate.value - rate) > 0.01) l.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.3);
  }
}

export const sound = new Sound();
export const sfx = (name, x, z, gain = 1, rate = 1) => sound.play(name, x, z, gain, rate);
// An element's sound: kind is cast, impact, wave or ult (soundWorker.js ELEMENTS).
const ELEMENTS = new Set(['earth', 'storm', 'void', 'fire', 'ice', 'time', 'water', 'blight', 'mind', 'night']);
export const sfxEl = (kind, element, x, z, gain = 1) => sound.play(`${kind}.${ELEMENTS.has(element) ? element : 'earth'}`, x, z, gain);
// A sound where a hero stands.
export const sfxAt = (p, name, gain = 1, rate = 1) => (p?.state ? sound.play(name, p.state.x, p.state.z, gain, rate) : null);
