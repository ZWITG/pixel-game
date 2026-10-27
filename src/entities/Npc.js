import { FEATURES } from '../config/features.js';
import { LOOKS } from '../art/looks.js';
import { makeHumanoid, walkPose } from '../render/models.js';

const WALK_SPEED = 1.1;  // tiles per second
const STOP_NEAR = 2.2;   // villagers stop and look at the hero when this close

// A villager. Data comes from data/npcs.js: `wander` (tiles) lets them stroll around their spot,
// `route` walks them between listed tiles in order, `speed` overrides the walking speed.
export default class Npc {
  constructor(game, def, spot) {
    this.game = game;
    this.def = def;
    this.model = makeHumanoid(LOOKS[def.look]);
    this.group = this.model.group;
    this.home = { x: spot.tx + 0.5, z: spot.ty + 0.5 };
    this.group.position.set(this.home.x, 0, this.home.z);
    game.scene.add(this.group);
    this.radius = 0.25;
    this.phase = Math.random() * Math.PI * 2;
    this.walkPhase = 0;
    this.walkAmount = 0;
    this.target = null;
    this.waitUntil = 1 + Math.random() * 3;
    this.routeIndex = 0;
    // Solid area so the hero and monsters walk around villagers. It moves with them.
    this.solid = { x0: 0, x1: 0, z0: 0, z1: 0, owner: this };
    this.syncSolid();
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  rect() {
    return this.solid;
  }

  syncSolid() {
    Object.assign(this.solid, { x0: this.x - 0.25, x1: this.x + 0.25, z0: this.z - 0.25, z1: this.z + 0.25 });
  }

  face(x, z) {
    this.group.rotation.y = Math.atan2(x - this.x, z - this.z);
  }

  // Runs while the world does: stroll, or stop for the hero.
  update(dt) {
    const game = this.game, p = game.player, t = game.time;
    let moving = false;
    if (Math.hypot(p.x - this.x, p.z - this.z) < STOP_NEAR) {
      this.face(p.x, p.z);
    } else if (this.target) {
      const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, (this.def.speed ?? WALK_SPEED) * dt);
      const x0 = this.x, z0 = this.z;
      game.collision.move(this, (dx / d) * step, (dz / d) * step);
      if (d < 0.08 || Math.hypot(this.x - x0, this.z - z0) < step * 0.3) {
        // Arrived, or something is in the way: rest a moment.
        this.target = null;
        this.waitUntil = t + 2 + Math.random() * 4;
      } else {
        moving = true;
        this.group.rotation.y = Math.atan2(dx, dz);
      }
    } else if (t > this.waitUntil && FEATURES.wanderingVillagers) {
      this.target = this.pickTarget();
      if (!this.target) this.waitUntil = t + 3;
    }
    this.walkAmount += ((moving ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 10);
    if (moving) this.walkPhase += dt * 8 * ((this.def.speed ?? WALK_SPEED) / WALK_SPEED);
    this.syncSolid();
  }

  pickTarget() {
    const { route, wander } = this.def;
    if (route) {
      const [tx, ty] = route[this.routeIndex++ % route.length];
      return { x: tx + 0.5, z: ty + 0.5 };
    }
    if (!wander) return null;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * wander;
      const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
      if (!this.game.collision.blocked(x, z, this.radius, false, this) && this.game.inVillage(x, z)) return { x, z };
    }
    return null;
  }

  animate(t) {
    const m = this.model;
    if (this.walkAmount > 0.05) {
      walkPose(m, this.walkPhase, this.walkAmount);
      m.root.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.03 * this.walkAmount;
      m.head.rotation.y = 0;
      return;
    }
    const breathe = Math.sin(t * 2 + this.phase);
    m.legs[0].rotation.x = m.legs[1].rotation.x = 0;
    m.root.position.y = Math.max(0, breathe) * 0.015;
    m.arms[0].rotation.set(breathe * 0.08, 0, 0);
    m.arms[1].rotation.set(-breathe * 0.08, 0, 0);
    m.head.rotation.y = Math.sin(t * 0.5 + this.phase) * 0.25;
  }
}
