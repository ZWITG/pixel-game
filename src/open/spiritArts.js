import * as THREE from 'three';
import { COMBAT } from './combat.js';
import { sfxAt } from './sound.js';

// Spirit Arts: every Conqueror's ranged game, paid in Spirit. Hold L1 (Q) and press Square (J) for
// a Spirit Shot; hold Triangle (U) for the Spirit Wave, a beam that charges, then pours out until
// you let go. Numbers are in COMBAT.arts.
const FROM = new THREE.Vector3(), TO = new THREE.Vector3();

export default class SpiritArts {
  constructor(player) {
    this.p = player;
    this.shots = [];
    this.wave = null;
    this.cool = 0;
    this.warned = 0;
  }

  get fx() {
    return this.p.world.fx;
  }

  get color() {
    return this.p.powers.def?.color ?? '#9fe8ff';
  }

  // Too little Spirit: say so, but not on every press.
  short() {
    const now = performance.now();
    if (now - this.warned > 1500) this.p.hud.message('Not enough Spirit.');
    this.warned = now;
  }

  // Where the hands are: a little ahead of the chest.
  hand(out, dx, dz) {
    const s = this.p.state;
    return out.set(s.x + dx * 1.1, this.p.melee.height(s.x, s.z) + s.air + 1.6 * this.p.body.heroScale, s.z + dz * 1.1);
  }

  shot() {
    const { shot } = COMBAT.arts, { melee, powers, state } = this.p;
    if (this.cool > 0 || this.wave) return;
    if (!melee.spend(shot.cost)) return this.short();
    sfxAt(this.p, 'spiritShot');
    this.cool = shot.every;
    this.p.world.watchers?.saw(this.p, 'shot');
    const aim = powers.aim();
    state.dir = [aim.dx, aim.dz];
    this.hand(FROM, aim.dx, aim.dz);
    this.shots.push({ x: FROM.x, y: FROM.y, z: FROM.z, dx: aim.dx, dz: aim.dz, left: shot.range, target: aim.target, glow: this.fx.glow(FROM.x, FROM.y, FROM.z, 1.3, this.color, 99, 1) });
    this.p.world.vfx.burst(FROM.x, FROM.y, FROM.z, [this.color, '#ffffff'], 6, 8, { fall: 0 });
    powers.casting = 0.15;
    powers.pose = 'punch';
  }

  waveStart() {
    if (this.wave) return;
    if (!this.p.melee.spend(COMBAT.arts.wave.cost)) return this.short();
    sfxAt(this.p, 'spiritWave');
    this.wave = { t: 0, tick: 0, beam: null };
  }

  hit(e, power, react, posture) {
    const { world, melee } = this.p;
    world.work.actor = this.p;
    melee.monsters.hit(e, melee.force * power, this.p.state.x, this.p.state.z, react, posture);
    this.p.wrath?.gain(COMBAT.wrath.hit);
  }

  update(dt) {
    const { arts } = COMBAT, { melee, state, world, powers, controls } = this.p;
    this.cool = Math.max(0, this.cool - dt);
    this.shots = this.shots.filter((s) => {
      // A gentle pull toward its target, so a shot fired in a fight finds someone.
      if (s.target && !s.target.dying) {
        const d = Math.hypot(s.target.x - s.x, s.target.z - s.z) || 1, k = Math.min(1, dt * 4);
        s.dx += ((s.target.x - s.x) / d - s.dx) * k;
        s.dz += ((s.target.z - s.z) / d - s.dz) * k;
        const len = Math.hypot(s.dx, s.dz) || 1;
        s.dx /= len;
        s.dz /= len;
      }
      const step = arts.shot.speed * dt;
      s.x += s.dx * step;
      s.z += s.dz * step;
      s.left -= step;
      s.y += (melee.height(s.x, s.z) + 1.6 - s.y) * Math.min(1, dt * 6);
      s.glow.o.position.set(s.x, s.y, s.z);
      if (Math.random() < 0.6) world.vfx.burst(s.x, s.y, s.z, [this.color], 1, 2, { fall: 0, life: 0.3 });
      const e = melee.monsters.within(s.x, s.z, 1.2)[0];
      if (e) this.hit(e, arts.shot.power, 'flinch', 0.5);
      if (!e && s.left > 0) return true;
      world.vfx.burst(s.x, s.y, s.z, [this.color, '#ffffff'], 10, 10);
      s.glow.age = s.glow.life;
      s.glow.o.visible = false;
      return false;
    });
    const w = this.wave;
    if (!w) return;
    w.t += dt;
    const aim = powers.aim(), holding = (controls.padHeld.TRIANGLE || controls.held.has('KeyU')) && (controls.padHeld.L1 || controls.held.has('KeyQ'));
    state.dir = [aim.dx, aim.dz];
    powers.casting = 0.15;
    this.hand(FROM, aim.dx, aim.dz);
    if (w.t < arts.wave.charge) {
      // Gathering: light drawn in to the hands.
      powers.pose = 'gather';
      const a = Math.random() * 6.283;
      world.vfx.burst(FROM.x + Math.cos(a) * 2.5, FROM.y + (Math.random() - 0.5) * 2, FROM.z + Math.sin(a) * 2.5, [this.color, '#ffffff'], 1, 1, { fall: 0, life: 0.25 });
      this.fx.glow(FROM.x, FROM.y, FROM.z, 0.6 + w.t * 3, this.color, 0.1, 1);
      return;
    }
    powers.pose = 'punch';
    TO.set(FROM.x + aim.dx * arts.wave.reach, FROM.y, FROM.z + aim.dz * arts.wave.reach);
    if (!w.beam) {
      w.beam = world.vfx.beam(FROM, TO, arts.wave.width, this.color, arts.wave.secs);
      world.work.shake = Math.max(world.work.shake, 0.2);
      world.work.shakeAt = state;
    } else {
      w.beam.left = Math.max(w.beam.left, 0.1);
      world.vfx.aim(w.beam, FROM, TO);
    }
    world.vfx.burst(TO.x, melee.height(TO.x, TO.z) + 1, TO.z, [this.color, '#ffffff'], 2, 10);
    if ((w.tick -= dt) <= 0) {
      w.tick = arts.wave.tick;
      // Everything along the line, and whatever stands at its end.
      for (const e of melee.monsters.within(FROM.x + aim.dx * arts.wave.reach * 0.5, FROM.z + aim.dz * arts.wave.reach * 0.5, arts.wave.reach * 0.5 + 2)) {
        const along = (e.x - FROM.x) * aim.dx + (e.z - FROM.z) * aim.dz, off = Math.abs((e.x - FROM.x) * aim.dz - (e.z - FROM.z) * aim.dx);
        if (along > 0 && along < arts.wave.reach && off < arts.wave.width + e.radius) this.hit(e, arts.wave.power, 'flinch', 0.4);
      }
      world.work.actor = this.p;
      melee.blast(TO.x, TO.z, melee.force * arts.wave.power, 3, 0, this.color, null);
    }
    const firing = w.t - arts.wave.charge;
    if (firing > arts.wave.secs || (!holding && firing > arts.wave.least)) {
      world.vfx.stopBeam(w.beam);
      this.wave = null;
    }
  }
}
