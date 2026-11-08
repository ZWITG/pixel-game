import { stagger, standDown } from './foes.js';
import { COMBAT } from './combat.js';

// The Watchers: beings of the Conquerors' own kind, the world's answer to a hero who won't stop.
// They come from Omega phase 3, march with armies from phase 4 and in pairs at phase 5. They fight
// with powers of their own, and they learn how YOU fight.
//
// How they learn (a habit model, as fighting games' shadow AIs do; not a hierarchy of foes):
//   `saw()` records what the hero does as small counts that fade with time (`habits`): where the
//   chain ends in a smash, which powers, which way they roll, parry timing, Breakouts, range, and
//   the order of the last two actions (to guess the next one). Near a Watcher, or in a Trial, it
//   counts 3x. Each counter in COUNTERS reads the model; its `fit` is how well it applies, and
//   its weight (per Watcher) rises when it worked and falls when it didn't. Insight (0..5) rises
//   with every Watcher fight and caps how much of the model they use; no counter ever fires more
//   than MOST_CHANCE of the time, and each still leaves a window (a Perfect parry, a Vanish).
//   Hit by one element too often in one fight, a Watcher grows a ward against it: vary your kit.
// Watchers don't rank up, promote each other or remember fights as stories: they share one model
// of how you fight. `world.watchers`; saved to `lumen.watchers`; `profile()` exports the model.
export const WATCHERS = {
  // `rite`: the move it only shows Unveiled, below half health (v0.54.0).
  lantern: { name: 'The Lantern', element: 'light', color: '#fff0a0', text: 'Light: blinding flashes, light-speed steps and beams. Unveiled, it calls down Judgement.', powers: ['flash', 'beam', 'step'], rite: 'Judgement', omen: 'The sky goes white. Something is watching.' },
  anchor: { name: 'The Anchor', element: 'gravity', color: '#a88aff', text: 'Gravity: pins you to the ground, pulls you in, crushes a guard. Unveiled, it makes a Collapse.', powers: ['pin', 'pull', 'crush'], rite: 'Collapse', omen: 'The ground groans. Everything feels heavier.' },
  hush: { name: 'The Hush', element: 'sound', color: '#8fd8ff', text: 'Sound: silences your powers and answers blows with shockwaves. Unveiled, it brings Dead Air.', powers: ['silence', 'shock', 'step'], rite: 'Dead Air', omen: 'Every sound in the world stops.' },
  echo: { name: 'The Echo', element: 'mirror', color: null, text: 'Mirror: takes your own element and fights with your own habits. Unveiled, it turns Your Own Hand on you.', powers: ['mimic', 'beam', 'step'], rite: 'Your Own Hand', omen: 'Your shadow moves before you do.' },
  thornwarden: { name: 'The Thornwarden', element: 'blood-root', color: '#e0445a', text: 'Blood-root: drains you, roots you in place, heals from the land. Unveiled, it grows a Thicket.', powers: ['root', 'drain', 'bloom'], rite: 'Thicket', omen: 'The roots under you are drinking.' },
};
export const ORDER = Object.keys(WATCHERS);

// What each counter is, and how well it fits the habits it has read (0..1).
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const share = (o, k) => (sum(o) >= 4 ? (o[k] ?? 0) / sum(o) : 0);
const top = (o) => Object.entries(o).reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
const topShare = (o) => (sum(o) >= 4 ? top(o)[1] / sum(o) : 0);
export const COUNTERS = {
  read: { name: 'Reads the hit you smash on', fit: (h) => topShare(h.smashAt) },
  feint: { name: 'Holds its blows to beat an early guard', fit: (h) => Math.min(1, share(h.parry, 'early') * 1.6) },
  trap: { name: 'Casts where you roll', fit: (h) => topShare(h.dodge) },
  sidestep: { name: 'Steps aside from your powers', fit: (h) => Math.min(1, share(h.acts, 'power') * 2.5) },
  close: { name: 'Closes in when you keep away', fit: (h) => Math.min(1, share(h.range, 'far') + share(h.acts, 'shot') * 1.5) },
  bait: { name: 'Waits out your Breakout', fit: (h) => share(h.breakout, 'yes') },
  guess: { name: 'Guesses your next move', fit: (h, w) => w.guess().sure },
};

const SAVE_KEY = 'lumen.watchers';
const FIRST = 90, EVERY = [0, 0, 0, 360, 300, 240];   // seconds until one comes, by Omega phase
const COME_FROM = 45;              // tiles out a Watcher arrives from
const WATCH = 60;                  // tiles: near a Watcher, what the hero does counts 3x
const FIGHTING = 40;               // a foe this close: the hero is fighting and habits count
const FADE_EVERY = 30, FADE = 0.97;  // seconds, and how much a habit keeps each time
const MOST_INSIGHT = 5, INSIGHT_KILL = 0.5, INSIGHT_SEEN = 0.25;
const INSIGHT_FLOOR = 2;           // even the first one met has been watching (v0.54.0)
const MOST_CHANCE = 0.8;           // no counter is ever certain
const JUDGE = 2.5;                 // seconds after a counter before it's judged
const WARD_AFTER = 5, WARD_CUT = 0.4;  // power hits of one element in a fight, and what the ward leaves
const TRIAL_R = 45;                // tiles: the Trial's ring
const READ = 0.7;                  // seconds a Watcher's guard reads blows
const MOST_LIVE = 2;
// Dread (v0.54.0): how a Watcher comes, and its second form below half health.
const OMEN = 3.2;                  // seconds of warning before it lands
const UNVEIL_AT = 0.5, UNVEIL_SIZE = 1.3, UNVEIL_PACE = 0.7;   // health share, growth, and how much shorter its pauses get
const DREAD_REACH = 26;            // tiles: inside this, the air around it pulses
const OFF_READ = 0.35;             // its read on a smash that isn't your favourite, as a share of the full chance
// Repel: pressed by blow after blow, it flashes and throws out a shockwave. Roll or parry it.
const PRESSURE_HITS = 4, PRESSURE_GAP = 0.9, REPEL_TELL = 0.28, REPEL_REACH = 7, REPEL_KEEP = 0.35;
// Its own blows. tell: warning, time: the strike, lunge: tiles a second, reach or area.
const BLOWS = {
  cut: { tell: 0.36, time: 0.22, lunge: 15, reach: 3.6, power: 1, again: 1 },
  rush: { tell: 0.3, time: 0.18, lunge: 11, reach: 3.4, power: 0.7, again: 2 },
  crush: { tell: 0.8, time: 0.25, lunge: 9, area: 10, power: 1.9, heavy: true },
  quick: { tell: 0.26, time: 0.18, lunge: 20, reach: 3.6, power: 0.9 },
};
const TELL = 0.65;                 // seconds of warning before a power
const ACTS = ['jab', 'smash', 'power', 'dodge', 'guard', 'shot', 'breakout'];

function fresh() {
  return { smashAt: {}, power: {}, dodge: {}, parry: {}, breakout: {}, range: {}, acts: {}, next: {}, opener: {} };
}

export default class Watchers {
  constructor(world) {
    this.world = world;
    this.live = [];
    this.marks = [];
    this.waves = [];
    this.omens = [];
    this.next = FIRST;
    this.last = [];
    this.fadeIn = FADE_EVERY;
    this.trial = null;
    this.habits = fresh();
    this.weights = {};
    this.insight = 0;
    this.met = {};
    this.frozen = false;
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (saved) Object.assign(this, { habits: { ...fresh(), ...saved.habits }, weights: saved.weights ?? {}, insight: saved.insight ?? 0, met: saved.met ?? {}, frozen: !!saved.frozen });
    } catch { /* a clean slate */ }
    addEventListener('pagehide', () => this.save());
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ habits: this.habits, weights: this.weights, insight: this.insight, met: this.met, frozen: this.frozen }));
    } catch { /* kept for this visit */ }
  }

  get monsters() {
    return this.world.monsters;
  }

  get time() {
    return this.monsters.time;
  }

  // ---- what the hero does ----
  // `act` is one of ACTS; `info` says more (which hit a smash came on, which power, which way a roll went).
  saw(p, act, info) {
    if (this.frozen || !this.world.players.includes(p)) return;
    const { x, z } = p.state, near = this.monsters.within(x, z, FIGHTING);
    if (!near.length && !this.trial) return;
    const k = this.trial || this.live.some((e) => Math.hypot(e.x - x, e.z - z) < WATCH) ? 3 : 1, h = this.habits;
    const add = (o, key) => { o[key] = (o[key] ?? 0) + k; };
    add(h.acts, act);
    if (act === 'smash') add(h.smashAt, info);
    if (act === 'power') add(h.power, info);
    if (act === 'dodge') add(h.dodge, info);
    if (act === 'guard') add(h.parry, info);
    if (act === 'breakout') add(h.breakout, 'yes');
    // The order of actions: after these two, what came next.
    if (this.last.length === 2) {
      const key = this.last.join('>');
      h.next[key] ??= {};
      add(h.next[key], act);
    }
    this.last = [...this.last, act].slice(-2);
  }

  // The hero's most likely next move, and how sure the model is (0..1).
  guess() {
    const seen = this.habits.next[this.last.join('>')];
    if (!seen || sum(seen) < 4) return { act: null, sure: 0 };
    const [act, n] = top(seen);
    return { act, sure: n / sum(seen) };
  }

  // Which way a roll went, from the foe's side: toward it, away, or to one side.
  rollWay(p, x, z) {
    const e = this.monsters.within(p.state.x, p.state.z, FIGHTING)[0];
    if (!e || Math.hypot(x, z) < 0.1) return 'back';
    const fx = e.x - p.state.x, fz = e.z - p.state.z, d = Math.hypot(fx, fz) || 1, l = Math.hypot(x, z);
    const dot = (fx * x + fz * z) / (d * l), cross = (fx * z - fz * x) / (d * l);
    return dot > 0.5 ? 'in' : dot < -0.5 ? 'back' : cross > 0 ? 'left' : 'right';
  }

  weight(type, id) {
    return this.weights[type]?.[id] ?? 1;
  }

  // The chance a counter fires for this Watcher: how well it fits, by Insight and what it learned.
  chance(e, id) {
    const w = e.watch;
    return Math.min(MOST_CHANCE, COUNTERS[id].fit(this.habits, this) * (Math.max(INSIGHT_FLOOR, w.insight) / MOST_INSIGHT) * this.weight(w.type, id) * (w.unveiled ? 1.25 : 1));
  }

  // Rolls for a counter; if it fires, it's remembered and judged a moment later.
  tries(e, id) {
    if (Math.random() >= this.chance(e, id)) return false;
    const p = e.foe;
    e.watch.trying.push({ id, at: this.time, hp: e.hp, heroHp: p?.hp ?? 0, won: false });
    p?.hud.float(COUNTERS[id].name.split(' ').slice(0, 2).join(' ') + '…', e.x, e.group.position.y + 7, e.z, e.watch.color);
    return true;
  }

  // ---- arrivals ----
  // The next Watcher to send: one not yet met first, then in turn.
  pick() {
    const unmet = ORDER.filter((t) => !this.met[t]);
    return unmet.length ? unmet[0] : ORDER[Math.floor(Math.random() * ORDER.length)];
  }

  // An omen first (v0.54.0): the sky takes its colour, the ground shakes, its name is called, and
  // a ring marks where it will land. Then it comes down hard.
  summon(hero, type = this.pick()) {
    const a = Math.random() * 6.283, x = hero.state.x + Math.cos(a) * 18, z = hero.state.z + Math.sin(a) * 18;
    const W = WATCHERS[type], color = W.color ?? hero.powers.def?.color ?? '#c8c8ff';
    this.omens.push({ hero, type, x, z, left: OMEN, ring: 0, color });
    this.world.vfx?.tint(color, 0.35, OMEN + 1.5, 0.4);
    for (const p of this.world.players) {
      p.hud.herald?.(W.name, this.met[type] ? 'It remembers how you fight.' : W.omen, color);
      p.hud.flash?.(0.25);
    }
    this.world.work.shake = Math.max(this.world.work.shake ?? 0, 0.25);
    this.world.work.shakeAt = hero.state;
  }

  arrive(hero, type = this.pick(), { insight = this.insight, trial = false, at = null } = {}) {
    const a = Math.random() * 6.283, d = trial ? 22 : COME_FROM;
    const x = at?.x ?? hero.state.x + Math.cos(a) * d, z = at?.z ?? hero.state.z + Math.sin(a) * d;
    const m = this.monsters, e = m.add(type, x, z, m.danger(x, z), false);   // adopted in Monsters.add
    Object.assign(e.watch, { insight: Math.min(MOST_INSIGHT, insight), trial });
    const W = WATCHERS[type];
    this.world.vfx?.burst(x, e.group.position.y + 3, z, [e.watch.color, '#ffffff'], 40, 12);
    this.world.vfx?.shock(x, e.group.position.y, z, 16, e.watch.color, 0.8);
    if (!trial) {
      this.met[type] = true;
      if (!at) for (const p of this.world.players) p.hud.message(`${W.name} has come.`, true, 3000);
      // It lands like a falling star: everything near is thrown down.
      if (at) {
        const y = e.group.position.y;
        this.world.vfx?.shock(x, y, z, 22, e.watch.color, 1);
        this.world.fx?.pillar(x, y, z, 3, e.watch.color, 0.6);
        this.world.work.shake = Math.max(this.world.work.shake ?? 0, 0.7);
        for (const p of this.world.players) {
          if (Math.hypot(p.state.x - x, p.state.z - z) < 9 && !p.rooms.house) m.hurt(p, e.def.damage * 0.6, x, z, { heavy: true, from: e });
        }
        e.mode = 'rest';
        e.until = this.time + 1.1;
      }
    }
    return e;
  }

  // Any Watcher that enters the world (sent, in an army, in a Trial) is run from here.
  adopt(e, hero, { insight = this.insight, trial = false } = {}) {
    if (e.watch) return;
    const W = WATCHERS[e.kind], color = W.color ?? hero?.powers.def?.color ?? '#c8c8ff';
    e.watch = { type: e.kind, insight: Math.min(MOST_INSIGHT, insight), trial, color, hits: {}, ward: null, trying: [], cool: 0, next: this.time + 0.6, power: 0, bloomHits: 0 };
    e.baseGlow.set('#000000');   // their own lit parts glow; the body keeps its colours
    e.windupGlow = e.baseGlow.clone().set(color).multiplyScalar(0.45);   // the warning before a blow, in its own colour
    // The Echo's light takes the hero's colour.
    if (e.kind === 'echo') for (const g of e.model.glows ?? []) g.material.color.set(color).multiplyScalar(2.4);
    e.mode = 'hunt';
    e.until = 0;
    e.moves = [];
    e.think = (t) => this.think(e, t);
    this.live.push(e);
    this.met[e.kind] = true;
  }

  // ---- how one fights ----
  think(e, t) {
    const m = this.monsters, hero = m.player, w = e.watch, p = e.foe;
    if (hero.dead || !p || e.mode === 'held') {
      if (e.mode !== 'held') e.vel.set(0, 0);
      return;
    }
    const dist = Math.hypot(hero.x - e.x, hero.z - e.z), dx = (hero.x - e.x) / (dist || 1), dz = (hero.z - e.z) / (dist || 1);
    const angry = e.hp < e.maxHp * 0.5;
    const wait = (mode, secs) => { e.mode = mode; e.until = t + secs; };
    // Below half health it drops its shell and shows what it is (once).
    if (angry && !w.unveiled && !e.dying && e.mode !== 'strike') return this.unveil(e, t);
    if (e.mode === 'reeling' || e.mode === 'recover' || e.mode === 'rest' || e.mode === 'read') {
      e.vel.set(0, 0);
      if (e.mode === 'read' && (e.pulse = (e.pulse ?? 0) - 1 / 60) <= 0) {
        e.pulse = 0.3;
        this.world.vfx?.shock(e.x, e.group.position.y + 1, e.z, e.radius + 4, w.color, 0.3);
      }
      if (t >= e.until) {
        standDown(e);
        e.mode = 'hunt';
      }
      return;
    }
    if (e.mode === 'bloom') {
      e.vel.set(0, 0);
      if ((e.pulse = (e.pulse ?? 0) - 1 / 60) <= 0) {
        e.pulse = 0.3;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015);
        this.world.vfx?.burst(e.x, e.group.position.y + 1, e.z, ['#5fae62', w.color], 6, 4, { up: 1.2 });
      }
      if (t >= e.until) e.mode = 'hunt';
      return;
    }
    if (e.mode === 'backoff') {
      e.vel.set(-dx, -dz).multiplyScalar(e.def.chaseSpeed);
      if (t >= e.until) this.blow(e, 'quick', t);
      return;
    }
    if (e.mode === 'tell') {
      e.vel.set(0, 0);
      e.state = 'windup';
      if (t >= e.until) {
        const b = BLOWS[e.move];
        e.state = 'roam';
        e.landed = false;
        e.thrallsHit = false;
        e.vel.set(dx, dz).multiplyScalar(b.lunge);
        wait('strike', b.time);
        if (b.area) m.quakeAt(e, b.area);
      }
      return;
    }
    if (e.mode === 'strike') {
      const b = BLOWS[e.move];
      if (!e.landed && p.state.air < 3 && Math.hypot(p.state.x - e.x, p.state.z - e.z) < (b.area ?? b.reach) + e.radius) {
        e.landed = true;
        const was = p.hp;
        m.hurt(p, e.def.damage * b.power, e.x, e.z, { heavy: b.heavy, from: e });
        // Landed: those who Breakout when pressed are waited out.
        if (p.hp < was && this.tries(e, 'bait')) {
          wait('backoff', 0.7);
          return;
        }
      }
      if (t < e.until) return;
      e.vel.set(0, 0);
      if (e.left > 0) {
        e.left--;
        wait('tell', b.tell * 0.6);
        return;
      }
      wait('recover', angry ? 0.25 : 0.4);
      return;
    }
    if (e.mode === 'cast') {
      e.vel.set(0, 0);
      e.state = 'windup';
      if (t >= e.until) {
        e.state = 'roam';
        this.cast(e, e.power, t, angry);
      }
      return;
    }
    // Hunting: hold a fighting distance and circle, until it's time to act.
    e.mode = 'hunt';
    const want = 8, out = dist - want;
    if ((e.strafeIn = (e.strafeIn ?? 0) - 1 / 60) <= 0) {
      e.strafeIn = 1 + Math.random() * 1.5;
      e.strafe = Math.random() < 0.5 ? 1 : -1;
    }
    const side = e.strafe ?? 1;
    e.vel.set(dx * Math.sign(out) * Math.min(1, Math.abs(out) / 3) - dz * side * 0.8, dz * Math.sign(out) * Math.min(1, Math.abs(out) / 3) + dx * side * 0.8).multiplyScalar(dist > 20 ? e.def.chaseSpeed * 1.3 : e.def.speed * 1.3);
    // Right up against it, it doesn't wait for its moment.
    if (t < w.next - (dist < 6 ? 0.5 : 0)) return;
    w.next = t + ((angry ? 0.55 : 0.8) + Math.random() * 0.4) * (w.unveiled ? UNVEIL_PACE : 1);
    const W = WATCHERS[w.type];
    if (w.unveiled && t >= w.riteAt && dist < 30) {
      w.riteAt = t + 8 + Math.random() * 3;
      return this.rite(e, t);
    }
    // What it expects the hero to do next decides what it does.
    const g = this.guess();
    if (g.act && dist < 10 && (g.act === 'jab' || g.act === 'smash') && this.tries(e, 'guess')) return this.readStance(e, t, READ);
    if (dist > 16) {
      if (this.tries(e, 'close')) return this.step(e, t);
      if (dist > 40) return undefined;
      return this.begin(e, Math.random() < 0.5 ? 'beam' : W.powers[w.power++ % W.powers.length], t, angry);
    }
    if (Math.random() < (dist < 5 ? 0.7 : 0.4)) {
      const kind = w.type === 'anchor' && Math.random() < 0.35 ? 'crush' : Math.random() < 0.5 ? 'rush' : 'cut';
      return this.blow(e, kind, t);
    }
    return this.begin(e, W.powers[w.power++ % W.powers.length], t, angry);
  }

  // A blow, with its warning; a hero who guards early may find it held back a moment (a feint).
  blow(e, kind, t) {
    const b = BLOWS[kind], m = this.monsters;
    e.move = kind;
    e.left = (kind === 'rush' && e.watch.type === 'echo' ? this.favouriteChain() - 1 : b.again ?? 0) + (e.watch.unveiled && !b.heavy ? 1 : 0);
    e.mode = 'tell';
    e.until = t + b.tell;
    e.vel.set(0, 0);
    m.warn(e, b);
    if (this.tries(e, 'feint')) {
      e.until += 0.35;
      m.quake.after(b.tell, () => e.foe?.hud.float('!', e.x, e.group.position.y + 6, e.z, '#ffd24a'));
    }
  }

  // The Echo throws as many hits as the hero likes to before smashing.
  favouriteChain() {
    const [n] = top(this.habits.smashAt);
    return Math.max(1, Math.min(5, Number(n) || 3));
  }

  readStance(e, t, secs) {
    e.mode = 'read';
    e.until = t + secs;
    e.pulse = 0;
    e.vel.set(0, 0);
  }

  // A light-speed step: to the hero's side, then a quick strike.
  step(e, t) {
    const p = e.foe, s = p.state, a = Math.atan2(e.z - s.z, e.x - s.x) + (Math.random() < 0.5 ? 1.2 : -1.2);
    this.blinkTo(e, s.x + Math.cos(a) * 4, s.z + Math.sin(a) * 4);
    this.blow(e, 'quick', t);
  }

  blinkTo(e, x, z) {
    const vfx = this.world.vfx, y = e.group.position.y;
    vfx?.burst(e.x, y + 2, e.z, [e.watch.color, '#ffffff'], 14, 6);
    e.group.position.x = x;
    e.group.position.z = z;
    e.group.position.y = this.monsters.groundY(x, z);
    vfx?.burst(x, e.group.position.y + 2, z, [e.watch.color, '#ffffff'], 14, 6);
  }

  begin(e, power, t, angry) {
    const m = this.monsters, area = { flash: 12, pull: 4, silence: 6, drain: 11, bloom: 0, crush: 9 }[power];
    if (power === 'step') return this.step(e, t);
    if (power === 'crush') return this.blow(e, 'crush', t);
    if (power === 'shock') return this.readStance(e, t, 1.4);
    if (power === 'bloom' && e.hp > e.maxHp * 0.85) return this.blow(e, 'cut', t);
    e.power = power;
    e.mode = 'cast';
    e.until = t + TELL * (angry ? 0.75 : 1);
    m.warn(e, { heavy: true, area });
    if (power === 'pull') e.foe.melee.ring(e.foe.state.x, e.foe.state.y, e.foe.state.z, 5, e.watch.color);
    return undefined;
  }

  // Where the hero is likely to roll to, if it reads their rolls.
  rollSpot(e, s) {
    const [way] = top(this.habits.dodge), dx = s.x - e.x, dz = s.z - e.z, d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d, V = { in: [-ux, -uz], back: [ux, uz], left: [uz, -ux], right: [-uz, ux] }[way];
    return V ? { x: s.x + V[0] * 8, z: s.z + V[1] * 8 } : null;
  }

  // Marks on the ground that go off after `delay`; `then(p)` for a hero caught in one.
  mark(e, x, z, r, delay, power, then = null) {
    const y = this.monsters.groundY(x, z);
    for (const p of this.world.players) p.melee.ring(x, y, z, r, e.watch.color);
    this.marks.push({ e, x, z, r, at: delay, power, then });
  }

  // Marks at the hero, and where it thinks they'll roll.
  marksAt(e, r, delay, power, then) {
    const s = e.foe.state;
    this.mark(e, s.x, s.z, r, delay, power, then);
    if (this.tries(e, 'trap')) {
      const spot = this.rollSpot(e, s);
      if (spot) this.mark(e, spot.x, spot.z, r, delay + 0.15, power, then);
    }
  }

  cast(e, power, t, angry) {
    const p = e.foe, s = p.state, m = this.monsters, w = e.watch, y = e.group.position.y, vfx = this.world.vfx;
    const rest = (secs) => { e.mode = 'rest'; e.until = t + secs * (angry ? 0.45 : 0.65) * (w.unveiled ? UNVEIL_PACE : 1); };
    if (power === 'flash') {
      vfx?.shock(e.x, y, e.z, 12 + e.radius, w.color, 0.35);
      vfx?.burst(e.x, y + 3, e.z, ['#ffffff', w.color], 40, 16);
      for (const q of this.world.players) {
        if (Math.hypot(q.state.x - e.x, q.state.z - e.z) < 12 + e.radius && q.state.air < 3) {
          m.hurt(q, e.def.damage * 1.2, e.x, e.z, { from: e });
          q.hud.flash(0.6);
        }
      }
      return rest(1.2);
    }
    if (power === 'rite') return this.riteGoes(e, t, rest);
    if (power === 'beam' || power === 'mimic') {
      const dx = s.x - e.x, dz = s.z - e.z, d = Math.hypot(dx, dz) || 1;
      if (power === 'mimic') {
        // The hero's own element, where they stand and where they'd roll.
        const el = p.powers.def?.element;
        if (el) this.world.fx?.impact(el, s.x, m.groundY(s.x, s.z), s.z, 6);
        this.marksAt(e, 6, 0.55, 1.3, null);
        return rest(1);
      }
      for (let k = 1; k <= 10; k++) this.mark(e, e.x + (dx / d) * (e.radius + k * 5), e.z + (dz / d) * (e.radius + k * 5), 3.5, 0.35 + k * 0.05, 1);
      return rest(1.2);
    }
    if (power === 'pin') {
      this.marksAt(e, 7, 0.9, 1.1, (q) => {
        q.slowUntil = this.time + 2.5;
        q.state.air = 0;
        q.hud.float('Pinned!', q.state.x, q.state.y + 3.4, q.state.z, w.color);
      });
      return rest(1.4);
    }
    if (power === 'root') {
      this.marksAt(e, 6, 0.9, 1, (q) => {
        q.rootUntil = this.time + 1.6;
        q.hud.float('Rooted!', q.state.x, q.state.y + 3.4, q.state.z, w.color);
      });
      return rest(1.4);
    }
    if (power === 'pull') {
      // Dragged in, unless rolling or Vanishing; then a crushing blow.
      if (!(p.melee.rolling > 0) && Math.hypot(s.x - e.x, s.z - e.z) < 40) {
        this.pulls = { p, e, left: 0.35 };
        p.hud.float('Pulled!', s.x, s.y + 3.4, s.z, w.color);
      }
      return this.blow(e, 'crush', t);
    }
    if (power === 'silence') {
      this.waves.push({ e, x: e.x, z: e.z, r: e.radius, hit: new Set() });
      vfx?.shock(e.x, y, e.z, 50, w.color, 1.1);
      return rest(1.2);
    }
    if (power === 'drain') {
      this.drains = { e, left: 1.6, tick: 0, beam: null };
      return rest(1.8);
    }
    if (power === 'bloom') {
      e.mode = 'bloom';
      e.until = t + 2.4;
      e.watch.bloomHits = 0;
      e.foe.hud.float('Bloom', e.x, y + 6, e.z, '#5fae62');
    }
    return undefined;
  }

  // ---- Unveiled (v0.54.0): its second form ----
  unveil(e, t) {
    const w = e.watch, W = WATCHERS[w.type], m = this.monsters, y = e.group.position.y, vfx = this.world.vfx;
    w.unveiled = true;
    w.riteAt = t + 1.4;
    e.group.scale.multiplyScalar(UNVEIL_SIZE);
    e.radius *= UNVEIL_SIZE;
    e.posture = 0;
    e.brokenUntil = 0;
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.08);
    e.mode = 'rest';
    e.until = t + 0.8;
    e.vel.set(0, 0);
    e.windupGlow?.set(w.color).multiplyScalar(0.9);
    vfx?.shock(e.x, y, e.z, 30, w.color, 1.2);
    vfx?.shock(e.x, y + 2, e.z, 14, '#ffffff', 0.5);
    vfx?.burst(e.x, y + 3, e.z, [w.color, '#ffffff', '#000000'], 60, 22);
    vfx?.tint(w.color, 0.45, 2.5, 0.6);
    this.world.work.shake = Math.max(this.world.work.shake ?? 0, 0.8);
    this.world.work.slow = Math.max(this.world.work.slow ?? 0, 0.5);
    for (const p of this.world.players) {
      p.hud.herald?.(`${W.name} unveiled`, `Beware ${W.rite}`, w.color);
      if (Math.hypot(p.state.x - e.x, p.state.z - e.z) < 12 && !p.rooms.house) m.hurt(p, e.def.damage * 0.5, e.x, e.z, { heavy: true, from: e });
    }
  }

  // The rite starts: a long, loud warning, then riteGoes() in cast().
  rite(e, t) {
    const w = e.watch, W = WATCHERS[w.type];
    e.power = 'rite';
    e.mode = 'cast';
    e.until = t + TELL * 1.4;
    e.vel.set(0, 0);
    this.monsters.warn(e, { heavy: true, area: 14 });
    e.foe?.hud.float(`${W.rite}!`, e.x, e.group.position.y + 8, e.z, w.color);
    this.world.vfx?.shock(e.x, e.group.position.y, e.z, 10, w.color, TELL * 1.4);
    return undefined;
  }

  riteGoes(e, t, rest) {
    const p = e.foe, s = p.state, w = e.watch, m = this.monsters, vfx = this.world.vfx, y = e.group.position.y;
    if (w.type === 'lantern') {
      // Judgement: columns of light in a widening spiral around you, then one at your feet.
      for (let i = 0; i < 14; i++) {
        const a = i * 0.9, r = 3 + i * 0.9;
        this.mark(e, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, 3.5, 0.35 + i * 0.09, 1.1);
      }
      this.mark(e, s.x, s.z, 5, 1.75, 2.2);
      vfx?.tint('#fff6d0', 0.4, 2, 0);
      return rest(1.6);
    }
    if (w.type === 'anchor') {
      // Collapse: a point of crushing weight drags you in; the ring around it falls, then the heart.
      this.pulls = { p, e, left: 1.1, hard: true };
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.283;
        this.mark(e, e.x + Math.cos(a) * 9, e.z + Math.sin(a) * 9, 3.6, 0.7, 1.1);
      }
      this.mark(e, e.x, e.z, 7 + e.radius, 1.3, 2.4, (q) => { q.slowUntil = this.time + 2; });
      vfx?.shock(e.x, y, e.z, 20, w.color, 1.3);
      return rest(1.8);
    }
    if (w.type === 'hush') {
      // Dead Air: no power answers you for a while, and three waves follow.
      for (const q of this.world.players) {
        if (Math.hypot(q.state.x - e.x, q.state.z - e.z) > 40) continue;
        for (const pid of q.powers.loadout) if (pid) q.powers.waits[pid] = Math.max(q.powers.waits[pid] ?? 0, 5);
        q.hud.float('Dead Air', q.state.x, q.state.y + 3.6, q.state.z, w.color);
      }
      for (let k = 0; k < 3; k++) this.waves.push({ e, x: e.x, z: e.z, r: e.radius - k * 16, hit: new Set() });
      vfx?.shock(e.x, y, e.z, 50, w.color, 1.6);
      return rest(1.6);
    }
    if (w.type === 'echo') {
      // Your Own Hand: your own element, three times, where you stand and where you would roll.
      const el = p.powers.def?.element;
      for (let k = 0; k < 3; k++) {
        m.quake.after(k * 0.4, () => {
          if (e.dying || !e.foe) return;
          if (el) this.world.fx?.impact(el, e.foe.state.x, m.groundY(e.foe.state.x, e.foe.state.z), e.foe.state.z, 7);
          this.marksAt(e, 6.5, 0.5, 1.3, null);
        });
      }
      return rest(1.8);
    }
    // Thicket: rooted at once, then rings of thorns closing in.
    if (Math.hypot(s.x - e.x, s.z - e.z) < 30) {
      p.rootUntil = this.time + 1.6;
      p.hud.float('Rooted!', s.x, s.y + 3.4, s.z, w.color);
    }
    [[8, 0.6], [4.5, 1], [0, 1.4]].forEach(([r, at]) => {
      const n = r ? 10 : 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283;
        this.mark(e, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, r ? 3 : 4.5, at, 1);
      }
    });
    this.drains = { e, left: 2.2, tick: 0.8, beam: null };
    return rest(1.8);
  }

  // ---- blows reaching a Watcher (monsters.hit) ----
  // Returns what's left of the blow: 0 if it read it, less behind a ward.
  struck(e, actor) {
    const w = e.watch, t = this.time;
    if (!w) return 1;
    const melee = actor.melee, act = melee.active;
    // A read: its guard turns the blow, then it answers at once.
    if (act && e.mode !== 'reeling' && !(e.brokenUntil > t) && e.mode !== 'strike') {
      const smash = act.kind === 'smash' && act.name !== 'execute' && act.name !== 'finisher';
      const fav = Number(top(this.habits.smashAt)[0]);
      // Which smash it is says how many hits came before it (COMBAT.order).
      const reads = e.mode === 'read' || (smash && COMBAT.order.indexOf(act.name) === fav && this.tries(e, 'read'))
        || (smash && Math.random() < OFF_READ && this.tries(e, 'read'));
      if (reads) {
        for (const x of w.trying) if (x.at > t - 0.1) x.won = true;
        const s = actor.state;
        actor.hud.float('Read!', e.x, e.group.position.y + 5, e.z, w.color);
        actor.flinch = 0.45;
        melee.active = null;
        this.monsters.work.stop = 0.1;
        this.world.vfx?.burst(e.x, e.group.position.y + 2, e.z, ['#ffffff', w.color], 18, 8);
        // The Hush answers with a shockwave.
        if (w.type === 'hush' && Math.hypot(s.x - e.x, s.z - e.z) < 9) this.monsters.hurt(actor, e.def.damage * 0.8, e.x, e.z, { from: e });
        this.blow(e, w.unveiled ? 'rush' : 'quick', t);
        return 0;
      }
    }
    // Blow after blow with no answer: it Repels. What lands while it gathers itself counts for less.
    if (act && e.mode !== 'reeling' && !(e.brokenUntil > t)) {
      w.pressure = (t - (w.pressedAt ?? -9) < PRESSURE_GAP ? w.pressure ?? 0 : 0) + 1;
      w.pressedAt = t;
      if (w.repelAt > t) return REPEL_KEEP;
      if (w.pressure >= PRESSURE_HITS - (w.unveiled ? 1 : 0) && e.mode !== 'strike') {
        w.pressure = 0;
        this.repel(e, actor, t);
        return REPEL_KEEP;
      }
    }
    if (e.mode === 'bloom' && ++w.bloomHits >= 3) {
      stagger(e, 1, t, true);
      actor.hud.float('Bloom broken!', e.x, e.group.position.y + 5, e.z, '#5fae62');
    }
    // Powers of one element, again and again: it wards against it.
    const el = act ? 'body' : actor.powers?.def?.element ?? 'body';
    if (el === 'body') return 1;
    w.hits[el] = (w.hits[el] ?? 0) + 1;
    if (w.hits[el] >= WARD_AFTER && !w.ward) {
      w.ward = el;
      w.dome = this.world.vfx?.dome(e.x, e.group.position.y + 3, e.z, w.color);
      actor.hud.message(`${WATCHERS[w.type].name} wards itself against ${el}. Change your attack.`, true, 3500);
    }
    return w.ward === el ? WARD_CUT : 1;
  }

  // A flash, then a shockwave that throws the hero back (through melee.defend, so a parry or a
  // roll beats it), and a blow to follow.
  repel(e, p, t) {
    const w = e.watch, m = this.monsters, vfx = this.world.vfx;
    w.repelAt = t + REPEL_TELL;
    e.vel.set(0, 0);
    vfx?.burst(e.x, e.group.position.y + 3, e.z, ['#ffffff', w.color], 24, 6, { up: 0.6, life: 0.3 });
    this.world.fx?.glow(e.x, e.group.position.y + 3, e.z, e.radius * 4, w.color, REPEL_TELL, 1.8);
    p.hud.float('Repel!', e.x, e.group.position.y + 6, e.z, w.color);
    m.quake.after(REPEL_TELL, () => {
      if (e.dying || !m.list.includes(e)) return;
      vfx?.shock(e.x, e.group.position.y, e.z, REPEL_REACH + e.radius, w.color, 0.4);
      this.world.work.shake = Math.max(this.world.work.shake ?? 0, 0.35);
      for (const q of this.world.players) {
        const dx = q.state.x - e.x, dz = q.state.z - e.z, d = Math.hypot(dx, dz) || 1;
        if (d > REPEL_REACH + e.radius || q.rooms.house || q.state.air > 3) continue;
        const was = q.hp;
        m.hurt(q, e.def.damage * 0.7, e.x, e.z, { heavy: true, from: e });
        if (q.hp < was) {
          q.state.x += (dx / d) * 4;
          q.state.z += (dz / d) * 4;
          q.melee.active = null;
        }
      }
      if (e.mode === 'hunt' || e.mode === 'rest' || e.mode === 'recover') this.blow(e, w.unveiled ? 'rush' : 'cut', this.time);
    });
  }

  // ---- the end of one ----
  killed(e) {
    const w = e.watch;
    if (!w) return;
    this.drop(e);
    if (w.trial) {
      for (const p of this.world.players) p.hud.message(`Trial won: ${WATCHERS[w.type].name} at Insight ${w.insight}.`, true, 4000);
      this.endTrial(false);
      return;
    }
    this.insight = Math.min(MOST_INSIGHT, this.insight + INSIGHT_KILL);
    const hero = this.monsters.work.actor;
    if (this.world.players.includes(hero)) {
      this.world.omega?.deed('watcher');
      hero.bag.gold += 150;
      hero.hud.message(`${WATCHERS[w.type].name} falls. The others saw it. Insight ${this.insight.toFixed(1)}. +150 gold`, true, 5000);
    }
    this.save();
  }

  drop(e) {
    this.live = this.live.filter((x) => x !== e);
    if (e.watch?.dome) this.world.vfx?.shape(e.watch.dome, 0, 0);
    if (this.drains?.e === e) this.endDrain();
  }

  endDrain() {
    if (this.drains?.beam) this.world.vfx?.stopBeam(this.drains.beam);
    this.drains = null;
  }

  // ---- the Trial: any Watcher met, at a chosen Insight, in a ring of light ----
  startTrial(p, type, insight) {
    if (this.trial) this.endTrial(false);
    const s = p.state;
    const e = this.arrive(p, type, { insight, trial: true });
    this.trial = { p, e, x: s.x, z: s.z, ring: 0 };
    p.hud.message(`Trial: ${WATCHERS[type].name} at Insight ${insight}. Leave the ring to end it. What you do here trains them too.`, true, 5000);
  }

  endTrial(say = true) {
    const T = this.trial;
    if (!T) return;
    this.trial = null;
    if (this.monsters.list.includes(T.e) && !T.e.dying) {
      this.drop(T.e);
      this.monsters.removeEnemy(T.e);
    }
    if (say) T.p.hud.message('The Trial is over.', true);
  }

  // A hero brought down in a Trial is spared.
  spare(p) {
    if (this.trial?.p !== p) return false;
    p.hp = p.body.maxHealth * 0.5;
    p.hud.message('The Watcher lowers its hand. Trial lost.', true, 4000);
    this.endTrial(false);
    return true;
  }

  pose(e, dt, t) {
    const M = e.model;
    if (!M.orbit || e.dying) return;
    M.orbit.rotation.y += dt * (e.kind === 'anchor' ? 0.7 : 1.5);
    if (M.hover) M.root.position.y = M.hover + Math.sin(t * 2.2 + e.phase) * 0.04;
    const [R, L] = M.arms, mode = e.mode;
    if (mode === 'cast' || mode === 'bloom') {
      R.rotation.set(-2.5, 0, -0.35);
      L.rotation.set(-2.5, 0, 0.35);
    } else if (mode === 'tell') {
      R.rotation.set(0.9, 0, -0.5);
      L.rotation.set(-0.7, 0, 0.4);
    } else if (mode === 'strike') {
      R.rotation.set(-1.7, 0, 0.2);
      L.rotation.set(0.5, 0, 0.2);
    } else if (mode === 'read') {
      R.rotation.set(-1.4, 0.7, 0);
      L.rotation.set(-1.4, -0.7, 0);
    }
    if (M.torso) M.torso.rotation.y = mode === 'tell' ? 0.35 : mode === 'strike' ? -0.3 : 0;
  }

  // ---- the menu's Watchers page ----
  report() {
    const h = this.habits, lines = [];
    const pc = (v) => `${Math.round(v * 100)}%`;
    if (sum(h.smashAt) >= 4) lines.push(`You smash after ${top(h.smashAt)[0]} hit${top(h.smashAt)[0] === '1' ? '' : 's'} (${pc(topShare(h.smashAt))})`);
    if (sum(h.dodge) >= 4) lines.push(`You roll ${{ in: 'in toward a foe', back: 'away', left: 'to the left', right: 'to the right' }[top(h.dodge)[0]]} (${pc(topShare(h.dodge))})`);
    if (sum(h.parry) >= 4) lines.push(`Parries: ${pc(share(h.parry, 'perfect'))} Perfect, ${pc(share(h.parry, 'early'))} too early`);
    if (sum(h.range) >= 4) lines.push(`You like to fight ${top(h.range)[0]} (${pc(topShare(h.range))})`);
    if (sum(h.power) >= 4) lines.push(`Your favourite power is ${this.powerName(top(h.power)[0])} (${pc(topShare(h.power))})`);
    if (sum(h.breakout) >= 4) lines.push(`When caught in a combo, you Breakout ${pc(share(h.breakout, 'yes'))} of the time`);
    const g = this.guess();
    if (g.act) lines.push(`After ${this.last.join(', then ')}, you usually ${g.act} (${pc(g.sure)})`);
    const counters = Object.keys(COUNTERS).map((id) => ({ id, name: COUNTERS[id].name, fit: COUNTERS[id].fit(h, this), w: ORDER.reduce((a, t) => a + this.weight(t, id), 0) / ORDER.length }))
      .sort((a, b) => b.fit * b.w - a.fit * a.w);
    return { lines, counters };
  }

  powerName(pid) {
    const def = this.world.players[0].powers.def;
    return def?.powers[pid]?.name ?? pid;
  }

  forget() {
    this.habits = fresh();
    this.weights = {};
    this.last = [];
    this.save();
  }

  // Debug: the whole model, for `__world.watchers.profile()`.
  profile() {
    return JSON.parse(JSON.stringify({ insight: this.insight, frozen: this.frozen, met: this.met, habits: this.habits, weights: this.weights, guess: this.guess(), report: this.report() }));
  }

  // ---- every frame ----
  update(dt) {
    const om = this.world.omega, players = this.world.players, hero = players[0], m = this.monsters, t = this.time;
    // Ones that left (too far behind, or removed) count as seen.
    for (const e of [...this.live]) {
      if (m.list.includes(e)) continue;
      this.drop(e);
      if (!e.dying && !e.watch.trial) this.insight = Math.min(MOST_INSIGHT, this.insight + INSIGHT_SEEN);
    }
    // Sent from Scourge on; at Omega, in pairs.
    if (om && om.phase >= 3 && !this.trial && !hero.rooms.house && !this.omens.length && !this.live.some((e) => !e.watch.trial) && (this.next -= dt) <= 0) {
      this.next = EVERY[Math.min(om.phase, 5)];
      const n = om.phase >= 5 ? MOST_LIVE : 1;
      const first = this.pick();
      for (let i = 0; i < n; i++) this.summon(hero, i ? ORDER.filter((x) => x !== first)[Math.floor(Math.random() * (ORDER.length - 1))] : first);
    }
    // Omens counting down to a landing.
    for (const o of this.omens) {
      o.left -= dt;
      if ((o.ring -= dt) <= 0) {
        o.ring = 0.5;
        for (const p of players) p.melee.ring(o.x, m.groundY(o.x, o.z), o.z, 9, o.color);
        this.world.vfx?.shock(o.x, m.groundY(o.x, o.z), o.z, 4 + (OMEN - o.left) * 3, o.color, 0.5);
      }
      if (o.left <= 0) this.arrive(o.hero, o.type, { at: o });
    }
    this.omens = this.omens.filter((o) => o.left > 0);
    // Dread: near one, the air pulses in its colour; Unveiled, the sky stays dark.
    for (const e of this.live) {
      const w = e.watch;
      if (w.trial || e.dying || (w.pulseIn = (w.pulseIn ?? 0) - dt) > 0) continue;
      w.pulseIn = w.unveiled ? 0.8 : 1.4;
      if (!players.some((p) => Math.hypot(p.state.x - e.x, p.state.z - e.z) < DREAD_REACH)) continue;
      this.world.vfx?.shock(e.x, e.group.position.y + 0.2, e.z, e.radius + (w.unveiled ? 7 : 4), w.color, 0.6);
      if (w.unveiled) this.world.vfx?.tint(w.color, 0.22, 1.2, 0.5);
    }
    // The model fades, so it follows how you fight now.
    if ((this.fadeIn -= dt) <= 0) {
      this.fadeIn = FADE_EVERY;
      const fade = (o) => { for (const k of Object.keys(o)) if (typeof o[k] === 'number') o[k] *= FADE; else fade(o[k]); };
      fade(this.habits);
      // How far away the hero fights, while fighting.
    }
    for (const p of players) {
      const foe = m.within(p.state.x, p.state.z, FIGHTING)[0];
      if (foe && (p.rangeIn = (p.rangeIn ?? 0) - dt) <= 0) {
        p.rangeIn = 1;
        const d = Math.hypot(foe.x - p.state.x, foe.z - p.state.z) - foe.radius;
        if (!this.frozen) this.habits.range[d < 6 ? 'near' : d < 16 ? 'middle' : 'far'] = (this.habits.range[d < 6 ? 'near' : d < 16 ? 'middle' : 'far'] ?? 0) + 1;
      }
      // Pressed in a combo and didn't Breakout.
      if (p.flinch > 0) p.pressed = true;
      else if (p.pressed) {
        p.pressed = false;
        if (!this.frozen && this.live.length && this.live.some((e) => Math.hypot(e.x - p.state.x, e.z - p.state.z) < WATCH)) this.habits.breakout.no = (this.habits.breakout.no ?? 0) + 1;
      }
    }
    // Bodies: orbiting parts, a slow hover, and poses over the walk (wind-up, cast, strike, a reading guard).
    for (const e of this.live) this.pose(e, dt, t);
    // Judge the counters tried: did the hero lose more than the Watcher did?
    for (const e of this.live) {
      const w = e.watch, p = e.foe;
      if (w.dome) this.world.vfx?.shape(w.dome, e.radius * 2.6, 0.18 + Math.sin(t * 6) * 0.05), w.dome.mesh.position.set(e.x, e.group.position.y + 3, e.z);
      w.trying = w.trying.filter((x) => {
        if (t - x.at < JUDGE) return true;
        if (!p || this.frozen) return false;
        const score = (x.heroHp - p.hp) / p.body.maxHealth - (x.hp - e.hp) / e.maxHp + (x.won ? 0.3 : 0);
        const W = (this.weights[w.type] ??= {});
        W[x.id] = Math.max(0.2, Math.min(3, (W[x.id] ?? 1) + (score > 0 ? 0.15 : -0.1)));
        return false;
      });
    }
    // Marks going off.
    for (const k of this.marks) {
      if ((k.at -= dt) > 0) continue;
      const y = m.groundY(k.x, k.z);
      this.world.fx?.pillar(k.x, y, k.z, k.r * 0.5, k.e.watch.color, 0.35);
      this.world.vfx?.burst(k.x, y + 1, k.z, [k.e.watch.color, '#ffffff'], 10, 7);
      for (const p of players) {
        if (p.rooms.house || p.state.air > 2 || Math.hypot(p.state.x - k.x, p.state.z - k.z) > k.r) continue;
        const was = p.hp;
        m.hurt(p, k.e.def.damage * k.power, k.x, k.z, { from: k.e });
        if (p.hp < was) k.then?.(p);
      }
    }
    this.marks = this.marks.filter((k) => k.at > 0);
    // The Hush's silencing wave: jump it, or your powers go quiet.
    for (const v of this.waves) {
      v.r += 40 * dt;
      for (const p of players) {
        const d = Math.hypot(p.state.x - v.x, p.state.z - v.z);
        if (v.hit.has(p) || Math.abs(d - v.r) > 2.5 || p.state.air > 1.5 || p.rooms.house) continue;
        v.hit.add(p);
        const was = p.hp;
        m.hurt(p, v.e.def.damage * 0.7, v.x, v.z, { from: v.e });
        if (p.hp < was) {
          for (const pid of p.powers.loadout) if (pid) p.powers.waits[pid] = Math.max(p.powers.waits[pid] ?? 0, 4);
          p.hud.float('Silenced!', p.state.x, p.state.y + 3.4, p.state.z, v.e.watch.color);
        }
      }
    }
    this.waves = this.waves.filter((v) => v.r < 50);
    // The Anchor's pull.
    if (this.pulls) {
      const { p, e } = this.pulls, s = p.state, d = Math.hypot(e.x - s.x, e.z - s.z);
      if (d > e.radius + 3) {
        const k = Math.min(1, dt * (this.pulls.hard ? 9 : 6));
        s.x += (e.x - s.x) * k * 0.5;
        s.z += (e.z - s.z) * k * 0.5;
      }
      if ((this.pulls.left -= dt) <= 0) this.pulls = null;
    }
    // The Thornwarden's drain: a tether that bleeds you and mends it, while you stay close.
    if (this.drains) {
      const D = this.drains, e = D.e, p = e.foe;
      if (!p || e.dying || (D.left -= dt) <= 0 || Math.hypot(p.state.x - e.x, p.state.z - e.z) > 14) this.endDrain();
      else {
        const from = e.group.position.clone().setY(e.group.position.y + 3), to = { x: p.state.x, y: p.state.y + 1.5, z: p.state.z };
        const at = from.clone().set(to.x, to.y, to.z);
        if (!D.beam) D.beam = this.world.vfx?.beam(from, at, 0.5, e.watch.color, 2);
        else this.world.vfx?.aim(D.beam, from, at);
        if ((D.tick -= dt) <= 0) {
          D.tick = 0.4;
          const was = p.hp;
          m.hurt(p, e.def.damage * 0.3, e.x, e.z, { from: e });
          if (p.hp < was) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02);
        }
      }
    }
    // The Trial's ring, and leaving it.
    const T = this.trial;
    if (T) {
      const s = T.p.state;
      if ((T.ring -= dt) <= 0) {
        T.ring = 1.2;
        T.p.melee.ring(T.x, m.groundY(T.x, T.z), T.z, TRIAL_R, T.e.watch.color);
      }
      if (Math.hypot(s.x - T.x, s.z - T.z) > TRIAL_R + 4 || !m.list.includes(T.e)) this.endTrial();
    }
  }
}

export { ACTS };
