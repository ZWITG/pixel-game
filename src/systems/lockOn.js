import * as THREE from 'three';
import { makeLockMarker } from '../render/models.js';

const LOCK_RANGE = 9;     // tiles: how far away a new target can be
const BREAK_RANGE = 13;   // the lock drops when the target gets this far away
const FRONT_WEIGHT = 3;   // tiles of distance one radian off-center is worth when picking a target

// Lock-on targeting: picks an enemy, keeps the hero and camera facing it,
// switches left/right, and moves on to the next enemy when the target dies.
export default class LockOn {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.marker = makeLockMarker();
    this.marker.group.visible = false;
    game.scene.add(this.marker.group);
  }

  set(target) {
    this.target = target;
    this.marker.group.visible = !!target;
  }

  clear() {
    this.set(null);
  }

  // Locks onto the best enemy, or unlocks. With nothing in range, swings the camera behind the hero.
  toggle() {
    if (this.target) return this.clear();
    const best = this.pickBest();
    if (best) this.set(best);
    else this.game.rig.recenter(this.game.player.facing.x, this.game.player.facing.y);
  }

  // Switches to the nearest enemy to the left (dir -1) or right (dir 1) of the current target.
  cycle(dir) {
    if (!this.target) return;
    const current = this.sideAngle(this.target);
    let best = null, bestGap = Infinity;
    for (const e of this.inRange()) {
      if (e === this.target) continue;
      const gap = (this.sideAngle(e) - current) * dir;
      if (gap > 0 && gap < bestGap) {
        best = e;
        bestGap = gap;
      }
    }
    if (best) this.set(best);
  }

  // Drops or replaces the target when it dies or gets too far away.
  update() {
    const t = this.target;
    if (!t) return;
    if (t.dying) this.set(this.pickBest());
    else if (this.distance(t) > BREAK_RANGE) this.clear();
  }

  animate(time) {
    const t = this.target, m = this.marker;
    if (!t) return;
    m.group.position.set(t.x, 0, t.z);
    m.diamond.position.y = 1.05 + Math.sin(time * 5) * 0.06;
    m.diamond.rotation.y = time * 3;
    m.ring.rotation.y = time * 1.5;
    m.ring.scale.setScalar(1 + Math.sin(time * 6) * 0.06);
  }

  inRange() {
    return this.game.enemies.filter((e) => !e.dying && this.distance(e) <= LOCK_RANGE);
  }

  distance(e) {
    return Math.hypot(e.x - this.game.player.x, e.z - this.game.player.z);
  }

  // Close enemies in front win: in front of the camera (behind view) or the hero (top-down).
  pickBest() {
    const { player: p, rig } = this.game;
    const look = rig.mode === 'third' ? rig.forward() : { x: p.facing.x, z: p.facing.y };
    let best = null, bestScore = Infinity;
    for (const e of this.inRange()) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      const angle = Math.acos(THREE.MathUtils.clamp((dx * look.x + dz * look.z) / d, -1, 1));
      const score = d + angle * FRONT_WEIGHT;
      if (score < bestScore) {
        best = e;
        bestScore = score;
      }
    }
    return best;
  }

  // Angle of an enemy left (-) or right (+) of the camera's view, measured from the hero.
  sideAngle(e) {
    const { player: p, rig } = this.game;
    const f = rig.forward();
    const dx = e.x - p.x, dz = e.z - p.z;
    return Math.atan2(dx * -f.z + dz * f.x, dx * f.x + dz * f.z);
  }
}
