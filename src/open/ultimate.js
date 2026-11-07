import * as THREE from 'three';
import { COMBAT } from './combat.js';

// Wrath, Surge and the ultimates. Wrath fills from fighting (COMBAT.wrath); full, L1 + R1 together
// lets loose the Conqueror's ultimate, or held for a second starts Surge. An ultimate is a short
// scene in beats: `ULTIMATES[id].beats` run at their times, `tick` every frame between. The hero
// can't be touched while it plays. These are the first versions; each Conqueror's own update makes
// its ultimate grow (see docs/combat-upgrade-plan.md).
const SURGE_HOLD = 1;        // seconds of holding L1 + R1 for Surge instead
const POWER = 30;            // an ultimate's blow at its heart, in the hero's might (about 30% of a ruler)
const v3 = new THREE.Vector3();

const ULTIMATES = {
  titan: {
    name: 'Upheaval', secs: 2.6, color: '#e8964a', tint: '#d8a070', reach: 40,
    start(u) {
      // It grows with the Titan: wider and harder as Mastery rises.
      u.reach = Math.min(70, 30 + u.p.powers.mastery * 1.5);
      u.might = 1 + u.p.powers.mastery * 0.015;
      u.lift = u.foes(u.reach);
      for (const e of u.lift) Object.assign(e, { rise: 22 + Math.random() * 8, air: Math.max(e.air, 0.01), hang: 0 });
      u.pose('gather');
    },
    tick(u, t) {
      const { state } = u.p, fx = u.world.fx;
      u.pose(t < 1.3 ? 'gather' : 'slam');
      u.world.work.shake = Math.max(u.world.work.shake, 0.15 + Math.min(1, t) * 0.35);
      u.world.work.shakeAt = state;
      // The land tears up in a widening ring and everything on it is carried skyward.
      if (t < 1.3 && Math.random() < 0.9) {
        const a = Math.random() * 6.283, d = 6 + t * u.reach * 0.65 * Math.random();
        const x = state.x + Math.cos(a) * d, z = state.z + Math.sin(a) * d;
        fx.rock(x, u.ground(x, z), z, 0.9 + Math.random() * 1.4, 2.4);
        u.world.smoke?.dust(x, u.ground(x, z) + 0.5, z, '#a89070', 1.5, 4);
      }
      if (t > 0.5 && t < 1.3) for (const e of u.lift) if (!e.dying && e.air > 6) Object.assign(e, { hang: u.time + 0.1, rise: 0 });
    },
    beats: [
      [1.3, (u) => { for (const e of u.lift) if (!e.dying) Object.assign(e, { hang: 0, rise: -70 }); }],
      [1.55, (u) => {
        const { state, melee } = u.p;
        u.strike(state.x, state.z, POWER * u.might, u.reach, 0, 'knockdown');
        if (!u.p.rooms.house) melee.tear(state.x, state.z, u.reach * 0.4, 24);
        u.world.quake.throwStones(state.x, u.ground(state.x, state.z), state.z, 28, 24);
        u.world.vfx.shock(state.x, u.ground(state.x, state.z), state.z, u.reach + 2, '#ffd2a0', 0.7);
        u.boom(0.9);
      }],
    ],
  },
  storm: {
    name: 'Stormwyrm', secs: 3.4, color: '#ffe25a', tint: '#5a6a9a', reach: 55,
    start(u) {
      const { state } = u.p;
      // The serpent's road: down out of the clouds, through every foe in reach, then back up.
      // Bigger under the Stormcaller's own clouds, or after gathering them in the last minute, and with Mastery.
      const p = u.p, gathered = p.powers.gathered !== undefined && u.time - p.powers.gathered < 60;
      u.boost = (gathered ? 1.5 : 1) * (1 + p.powers.mastery * 0.01);
      const foes = u.foes(this.reach * u.boost).sort((a, b) => Math.atan2(a.x - state.x, a.z - state.z) - Math.atan2(b.x - state.x, b.z - state.z)).slice(0, Math.round(14 * u.boost));
      const ground = u.ground(state.x, state.z);
      u.path = [new THREE.Vector3(state.x, ground + 50, state.z), ...foes.map((e) => new THREE.Vector3(e.x, e.group.position.y + 2, e.z))];
      if (u.path.length < 4) for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283;
        u.path.push(new THREE.Vector3(state.x + Math.cos(a) * 20, ground + 4, state.z + Math.sin(a) * 20));
      }
      u.path.push(new THREE.Vector3(state.x, ground + 60, state.z));
      u.head = u.path[0].clone();
      u.leg = 1;
      u.struck = new Set();
      u.body = [];
      u.trail = u.world.vfx.trail((out) => out.copy(u.head), '#fff48a', 3.2, this.secs);
      u.pose('peak');
    },
    tick(u, t, dt) {
      const fx = u.world.fx, speed = 70;
      u.pose(t < 0.6 ? 'peak' : 'gather');
      if (t < 0.5 || u.leg >= u.path.length) return;
      let move = speed * dt;
      while (move > 0 && u.leg < u.path.length) {
        const to = u.path[u.leg], d = u.head.distanceTo(to);
        if (d <= move) {
          u.head.copy(to);
          move -= d;
          u.leg++;
        } else {
          u.head.addScaledVector(v3.copy(to).sub(u.head).normalize(), move);
          move = 0;
        }
      }
      // A body of lightning trailing the head, and bolts down to anything it passes over.
      u.body.unshift(u.head.clone());
      u.body.length = Math.min(u.body.length, 10);
      for (let i = 1; i < u.body.length; i++) fx.lightning(u.body[i - 1], u.body[i], i < 3 ? '#ffffff' : '#fff48a', 0.5 - i * 0.03, 0.12);
      for (const e of u.foes(7, u.head)) {
        if (u.struck.has(e)) continue;
        u.struck.add(e);
        u.strike(e.x, e.z, POWER * 0.5 * u.boost, 6, 0, 'launch');
        fx.impact('storm', e.x, u.ground(e.x, e.z), e.z, 4);
      }
      u.world.vfx.burst(u.head.x, u.head.y, u.head.z, ['#fff48a', '#ffffff', '#a8c8ff'], 3, 14, { fall: 0.2 });
    },
    beats: [
      [2.9, (u) => {
        const { x, z } = u.aim();
        u.strike(x, z, POWER * u.boost, 25 * u.boost, 4, 'knockdown');
        u.world.fx.impact('storm', x, u.ground(x, z), z, 12);
        u.world.vfx.shock(x, u.ground(x, z), z, 28, '#fff6c0', 0.5);
        u.boom(0.7);
      }],
    ],
  },
  void: {
    name: 'The Hollow Opens', secs: 3.2, color: '#b06aff', tint: '#3a1a5a', reach: 40,
    start(u) {
      const { state } = u.p, len = Math.hypot(...state.dir) || 1;
      u.rift = { x: state.x - (state.dir[0] / len) * 7, z: state.z - (state.dir[1] / len) * 7 };
      u.rift.y = u.ground(u.rift.x, u.rift.z) + 6;
      u.world.fx.hole(u.rift.x, u.rift.y, u.rift.z, 6, this.secs);
      // Everyone in the Hollow pours out for twenty seconds, and everything killed meanwhile rises too.
      const n = u.p.powers.kitDef?.openHollow?.(u.p.powers, u.rift.x, u.rift.z, 20) ?? 0;
      if (n) u.p.hud.message(`The Hollow opens: ${n} pour out.`, true, 2500);
      u.pose('gather');
    },
    tick(u, t, dt) {
      const { rift } = u, fx = u.world.fx;
      // Everything near is dragged toward the tear and bled as it goes.
      for (const e of u.foes(this.reach)) {
        if (!e.boss) e.vel.set(rift.x - e.x, rift.z - e.z).multiplyScalar(1.6);
        e.knockUntil = u.time + 0.1;
      }
      if ((u.bleed = (u.bleed ?? 0) - dt) <= 0) {
        u.bleed = 0.3;
        for (const e of u.foes(this.reach)) u.p.powers.sting(e, u.p.body.might * 1.2);
      }
      if (Math.random() < 0.8) {
        const a = Math.random() * 6.283, d = 4 + Math.random() * 12;
        fx.flame(rift.x + Math.cos(a) * d, u.ground(rift.x, rift.z), rift.z + Math.sin(a) * d, 3 + Math.random() * 3, 0.7, 1);
      }
      u.world.vfx.burst(rift.x, rift.y, rift.z, ['#b06aff', '#2a0a40'], 2, 8, { fall: -0.3 });
      u.pose(t < 2.6 ? 'gather' : 'slam');
    },
    beats: [
      [2.7, (u) => {
        const { rift } = u;
        u.strike(rift.x, rift.z, POWER, 22, 3, 'fly');
        u.world.fx.impact('void', rift.x, u.ground(rift.x, rift.z), rift.z, 10);
        u.world.vfx.shock(rift.x, u.ground(rift.x, rift.z), rift.z, 26, '#c87aff', 0.5);
        u.boom(0.7);
      }],
    ],
  },
  ember: {
    name: 'Second Sun', secs: 3.1, color: '#ff7a2a', tint: '#ffe0a0', mood: 0.35, reach: 35,
    start(u) {
      const { state, powers } = u.p, t = u.time;
      // It feeds on the Emberlord's Heat and on every Brand in reach, and grows with Mastery.
      let brands = 0;
      for (const e of u.foes(this.reach)) if (e.brandedUntil > t) brands += e.brands ?? 0;
      u.grow = Math.min(2, (1 + (powers.heat ?? 0) / 100 * 0.6 + brands * 0.05) * (1 + powers.mastery * 0.01));
      powers.heat = 0;
      powers.overheat = false;
      u.sun = u.world.fx.glow(state.x, state.y + 14, state.z, 2, '#ffd27a', -1, 1);
      u.sun.life = 99;
      u.core = u.world.fx.shell('fire', 1);
      u.pose('peak');
    },
    tick(u, t) {
      const { state, melee } = u.p, fx = u.world.fx;
      // Up into the sky, and a sun swelling over the hero's raised hand.
      if (t < 1.9) {
        melee.hover = 0.3;
        state.air = Math.min(12, state.air + 0.25);
        const size = 1 + Math.min(1, t / 1.8) * 8 * Math.min(1.8, u.grow ?? 1), y = state.y + state.air + 6 + size;
        u.at = new THREE.Vector3(state.x, y, state.z);
        u.size = size;
        u.pose('peak');
      } else {
        // Thrown: an arc from the hand down to the aim.
        const k = Math.min(1, (t - 1.9) / 0.5), to = u.target ??= u.aim();
        const ty = u.ground(to.x, to.z);
        u.at.set(state.x + (to.x - state.x) * k, (state.y + state.air + 6 + u.size) * (1 - k) + ty * k + Math.sin(k * Math.PI) * 6, state.z + (to.z - state.z) * k);
        u.pose('punch');
      }
      u.sun.o.position.copy(u.at);
      u.sun.o.scale.setScalar(u.size * 4.5);
      if (u.core) {
        u.core.o.position.copy(u.at);
        u.core.o.scale.setScalar(u.size * 0.9);
        u.core.o.rotation.y += 0.05;
      }
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.283, b = Math.random() * 3.14;
        fx.flame(u.at.x + Math.cos(a) * Math.sin(b) * u.size, u.at.y + Math.cos(b) * u.size - u.size, u.at.z + Math.sin(a) * Math.sin(b) * u.size, u.size * 0.9, 0.35, 0);
      }
      u.world.vfx.burst(u.at.x, u.at.y, u.at.z, ['#fff0b0', '#ff9a3a', '#ff5a1a'], 3, u.size * 2, { fall: 0.1 });
    },
    beats: [
      [2.4, (u) => {
        const to = u.target ?? u.aim(), y = u.ground(to.x, to.z);
        u.strike(to.x, to.z, POWER * (u.grow ?? 1), 35 * Math.min(1.8, u.grow ?? 1), 12, 'fly');
        u.p.powers.scar({ rank: 4 }, to.x, to.z, 30, 6);
        u.world.fx.impact('fire', to.x, y, to.z, 16);
        u.world.vfx.shock(to.x, y, to.z, 40, '#fff0c0', 0.7);
        u.world.smoke?.column(to.x, y, to.z, 3, 14);
        u.sun.age = u.sun.life;
        u.sun.o.visible = false;
        if (u.core) u.core.o.visible = false;
        u.boom(1);
      }],
    ],
  },
  frost: {
    name: 'Stillness', secs: 5, color: '#8fe0ff', tint: '#cfeaff', reach: 45, gray: 0.7,
    start(u) {
      const { state } = u.p;
      // It grows with the Frostwarden: wider with Mastery.
      u.reach = Math.min(70, this.reach + u.p.powers.mastery * 0.8);
      u.dome = u.world.vfx.dome(state.x, u.ground(state.x, state.z), state.z, '#bfeaff');
      u.still = u.foes(u.reach);
      u.pose('slam');
    },
    tick(u, t) {
      const r = u.reach ?? this.reach, grow = Math.min(1, t / 0.5);
      u.world.vfx.shape(u.dome, r * (1 - (1 - grow) ** 3), t < 4.2 ? 0.9 : Math.max(0, 1 - (t - 4.2) * 2));
      // Inside, time has stopped for everything but the Frostwarden.
      for (const e of u.foes(r)) {
        if (!u.still.includes(e)) u.still.push(e);
        if (t < 4) e.frozenUntil = u.time + 0.1;
      }
      for (const o of u.world.monsters.orbs) if (Math.hypot(o.orb.position.x - u.dome.mesh.position.x, o.orb.position.z - u.dome.mesh.position.z) < r && t < 4) o.life += 1 / 60, o.held = true;
      if (t < 0.6) u.pose('slam');
    },
    beats: [
      [4, (u) => {
        // Then all of it shatters at once.
        for (const e of u.still) {
          if (e.dying) continue;
          e.frozenUntil = 0;
          u.strike(e.x, e.z, POWER * 0.6, 4, 0, 'launch', e);
          u.world.fx.impact('ice', e.x, u.ground(e.x, e.z), e.z, 4);
        }
        const { x, z } = u.dome.mesh.position;
        u.world.vfx.shock(x, u.ground(x, z), z, (u.reach ?? 45) + 1, '#ffffff', 0.6);
        u.boom(0.8);
      }],
    ],
  },
};

export default class Wrath {
  constructor(player) {
    this.p = player;
    this.wrath = 0;
    this.surge = 0;           // seconds of Surge left
    this.ult = null;          // the ultimate playing
    this.hold = 0;
  }

  get world() {
    return this.p.world;
  }

  get time() {
    return this.world.monsters.time;
  }

  get full() {
    return this.wrath >= 1;
  }

  gain(amount) {
    if (this.surge > 0 || this.ult || !this.p.powers.def) return;
    amount *= this.world.omega?.wrathFactor() ?? 1; // feared, the hero's Wrath runs higher
    const was = this.full;
    this.wrath = Math.min(1, this.wrath + amount);
    if (!was && this.full) this.p.hud.message('Wrath is full! L1 + R1: ultimate. Hold them: Surge.', true);
  }

  // The live foes within `r` of a point (the hero by default).
  foes(r, at = this.p.state) {
    return this.world.monsters.within(at.x, at.z, r);
  }

  ground(x, z) {
    return this.p.melee.height(x, z);
  }

  aim() {
    const a = this.p.powers.aim();
    return a.target ? { x: a.target.x, z: a.target.z } : { x: this.p.state.x + a.dx * 22, z: this.p.state.z + a.dz * 22 };
  }

  pose(name) {
    this.p.powers.casting = 0.2;
    this.p.powers.pose = name;
  }

  // A blow of `power` times the hero's might, out from (x, z).
  strike(x, z, power, reach, crater, react, target = null) {
    this.world.work.actor = this.p;
    this.p.melee.blast(x, z, this.p.body.might * power, reach, crater, ULTIMATES[this.p.powers.id]?.color ?? '#ffffff', target, react, true, 3);
  }

  // The moment it lands: everything at once.
  boom(size) {
    const { work } = this.world;
    work.shake = Math.max(work.shake, size);
    work.shakeAt = this.p.state;
    work.stop = 0.12;
    work.impact = COMBAT.impact * 1.5;
    work.rumble = size * 2;
    this.p.hud.flash(0.3 + size * 0.4);
  }

  canStart() {
    const { p } = this;
    return p.powers.def && !p.rooms.house && !p.hud.open && !this.world.paused && !this.ult && p.melee.broken <= 0 && !p.swim.inWater;
  }

  start() {
    const def = ULTIMATES[this.p.powers.id];
    if (!def || !this.canStart()) return;
    this.wrath = 0;
    this.ult = { def, t: 0, beat: 0 };
    Object.assign(this, { lift: null, path: null, rift: null, sun: null, core: null, target: null, dome: null, still: null, bleed: 0 });
    const { p } = this;
    p.guard = Math.max(p.guard, def.secs + 1.5);
    p.melee.active = null;
    p.hud.message(def.name, true, 2500);
    this.world.vfx.tint(def.tint, def.mood ?? 0.55, def.secs, def.gray ?? 0);
    this.world.work.slow = Math.max(this.world.work.slow, 0.35);
    this.world.work.lines = 0.4;
    def.start(this);
  }

  startSurge() {
    if (!this.canStart()) return;
    const { p } = this, color = p.powers.def.color;
    this.wrath = 0;
    this.surge = COMBAT.surge.secs;
    p.hud.message('Surge!', true, 2000);
    this.world.vfx.shock(p.state.x, this.ground(p.state.x, p.state.z), p.state.z, 16, color, 0.5);
    this.world.vfx.burst(p.state.x, p.state.y + 1.5, p.state.z, [color, '#ffffff'], 60, 18);
    this.world.work.shake = Math.max(this.world.work.shake, 0.3);
    this.world.work.impact = COMBAT.impact;
  }

  update(dt) {
    const { p } = this, c = p.controls;
    // L1 + R1: let go before a second for the ultimate; hold on for Surge.
    const both = !p.hud.open && ((c.padHeld.L1 && c.padHeld.R1) || c.held.has('KeyY'));
    if (both && this.full && !this.ult) {
      this.hold += dt;
      if (this.hold >= SURGE_HOLD) {
        this.hold = -99;
        this.startSurge();
      }
    } else if (!both) {
      if (this.hold > 0 && this.full) this.start();
      this.hold = 0;
    }
    if (this.surge > 0) {
      this.surge -= dt;
      p.melee.gain(COMBAT.surge.spirit * dt);
      // Power pours off the hero.
      if (Math.random() < 0.7) {
        const a = Math.random() * 6.283;
        this.world.vfx.burst(p.state.x + Math.cos(a) * 0.8, p.state.y + p.state.air + 0.4 + Math.random() * 2.4, p.state.z + Math.sin(a) * 0.8, [p.powers.def?.color ?? '#ffffff', '#ffffff'], 1, 3, { up: 2, fall: -0.4, life: 0.5 });
      }
      if (this.surge <= 0) p.hud.message('The Surge fades.');
    }
    p.hero.glow = this.surge > 0 ? p.powers.def?.look.glow : null;
    p.hero.glowAmount = this.surge > 0 ? 0.25 + Math.sin(this.time * 9) * 0.1 : 0;
    p.cine = Math.max(0, (p.cine ?? 0) + ((this.ult ? 1 : 0) - (p.cine ?? 0)) * Math.min(1, dt * 3));
    const u = this.ult;
    if (!u) return;
    u.t += dt;
    p.state.yaw += dt * 0.35; // the camera swings slowly round while it plays
    u.def.tick(this, u.t, dt);
    while (u.beat < u.def.beats.length && u.t >= u.def.beats[u.beat][0]) u.def.beats[u.beat++][1](this);
    if (u.t >= u.def.secs) {
      this.ult = null;
      for (const e of this.still ?? []) e.frozenUntil = 0;
      if (this.sun) this.sun.o.visible = false;
      if (this.core) this.core.o.visible = false;
    }
  }
}

export { ULTIMATES };
