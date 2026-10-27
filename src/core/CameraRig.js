import * as THREE from 'three';
import { FEATURES } from '../config/features.js';

// Camera modes:
//  'third' - close behind-the-hero view with free look (the default)
//  'top'   - angled top-down view that orbits the hero (only with FEATURES.topDownCamera)
const MODES = {
  top: { dist: 11, height: 0.5, fov: 45 },
  third: { dist: 4.2, height: 1.0, fov: 60 },
};
const TOP_PITCH = 0.95;
const THIRD_PITCH_MIN = 0.05, THIRD_PITCH_MAX = 1.15;
const LOCK_TURN = 5;       // how fast the camera swings behind the hero when locked on
const LOCK_LEAD = 0.3;     // locked on, the view shifts this share of the way toward the target...
const LOCK_LEAD_MAX = 2;   // ...but never more than this many tiles
const RECENTER_TURN = 10;
const OCCLUDE_START = 0.6;  // tiles from the hero where blocking checks begin
const OCCLUDE_STEP = 0.25;
const OCCLUDE_MIN = 1.6;    // never pull in closer than this
const OCCLUDE_MAX_PITCH = 1.2; // how high the camera may rise to see over trees

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = FEATURES.topDownCamera ? 'top' : 'third';
    this.yaw = 0;
    this.thirdPitch = 0.32;
    this.target = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.cur = { ...MODES[this.mode], pitch: this.mode === 'top' ? TOP_PITCH : this.thirdPitch };
    camera.fov = this.cur.fov;
    camera.updateProjectionMatrix();
    this.shakeLeft = 0;
    this.recenterYaw = null;
    this.occluder = null; // (x, y, z) => true if something solid and tall is there; set by Game
  }

  toggle() {
    if (FEATURES.topDownCamera) this.mode = this.mode === 'top' ? 'third' : 'top';
  }

  snap(player) {
    this.target.set(player.x, 0, player.z);
  }

  // dx/dy in radians: turn left/right and (behind view only) look up/down.
  look(dx, dy) {
    if (dx) this.recenterYaw = null;
    this.yaw -= dx;
    if (this.mode === 'third') this.thirdPitch = THREE.MathUtils.clamp(this.thirdPitch + dy, THIRD_PITCH_MIN, THIRD_PITCH_MAX);
  }

  // Converts stick/keys input (x right, y down) into a world-space direction relative to the camera.
  moveVector({ x, y }) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return { x: c * x - s * -y, z: -s * x - c * -y };
  }

  forward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  shake(seconds) {
    this.shakeLeft = seconds;
  }

  // Distance along the view line (at this pitch) to the first thing blocking it, or Infinity.
  blockedAt(pitch, maxDist, height) {
    const dx = Math.sin(this.yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(this.yaw) * Math.cos(pitch);
    for (let d = OCCLUDE_START; d < maxDist; d += OCCLUDE_STEP) {
      if (this.occluder(this.target.x + dx * d, height + dy * d, this.target.z + dz * d)) return d;
    }
    return Infinity;
  }

  // Swings the camera around to look along (x, z), e.g. the hero's facing.
  recenter(x, z) {
    this.recenterYaw = Math.atan2(-x, -z);
  }

  // `focus` is the locked-on enemy, or null.
  update(dt, player, focus = null) {
    this.goal.set(player.x, 0, player.z);
    if (focus) {
      // Stay behind the hero, facing the target, and lead the view toward it.
      const dx = focus.x - player.x, dz = focus.z - player.z;
      this.yaw += wrapAngle(Math.atan2(-dx, -dz) - this.yaw) * (1 - Math.exp(-dt * LOCK_TURN));
      const lead = Math.min(LOCK_LEAD, LOCK_LEAD_MAX / (Math.hypot(dx, dz) || 1));
      this.goal.x += dx * lead;
      this.goal.z += dz * lead;
      this.recenterYaw = null;
    } else if (this.recenterYaw !== null) {
      const diff = wrapAngle(this.recenterYaw - this.yaw);
      this.yaw += diff * (1 - Math.exp(-dt * RECENTER_TURN));
      if (Math.abs(diff) < 0.01) this.recenterYaw = null;
    }
    this.target.lerp(this.goal, 1 - Math.exp(-dt * 10));

    // Blend smoothly when switching modes.
    const want = MODES[this.mode];
    const pitch = this.mode === 'top' ? TOP_PITCH : this.thirdPitch;
    const k = 1 - Math.exp(-dt * 8);
    this.cur.dist += (want.dist - this.cur.dist) * k;
    this.cur.height += (want.height - this.cur.height) * k;
    this.cur.pitch += (pitch - this.cur.pitch) * k;
    if (Math.abs(this.cur.fov - want.fov) > 0.01) {
      this.cur.fov += (want.fov - this.cur.fov) * k;
      this.camera.fov = this.cur.fov;
      this.camera.updateProjectionMatrix();
    }

    // When a tree or building sits between the hero and the camera, first rise over it,
    // and only pull in closer if rising isn't enough. Moves in fast and eases back out.
    const ty = this.cur.height;
    let lift = this.cur.pitch, limit = this.cur.dist;
    if (this.occluder) {
      while (lift < OCCLUDE_MAX_PITCH && this.blockedAt(lift, limit, ty) < limit) lift += 0.08;
      limit = Math.max(OCCLUDE_MIN, Math.min(limit, this.blockedAt(lift, limit, ty) - OCCLUDE_STEP));
    }
    this.viewDist ??= limit;
    this.viewPitch ??= lift;
    const ease = (from, to, fast) => from + (to - from) * (1 - Math.exp(-dt * (fast ? 18 : 3)));
    this.viewDist = ease(this.viewDist, limit, limit < this.viewDist);
    this.viewPitch = ease(this.viewPitch, lift, lift > this.viewPitch);
    const p = this.viewPitch, dist = this.viewDist;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(p) * dist,
      ty + Math.sin(p) * dist,
      this.target.z + Math.cos(this.yaw) * Math.cos(p) * dist,
    );
    if (this.shakeLeft > 0) {
      this.shakeLeft -= dt;
      this.camera.position.x += (Math.random() - 0.5) * 0.15;
      this.camera.position.y += (Math.random() - 0.5) * 0.15;
    }
    this.camera.lookAt(this.target.x, ty, this.target.z);
  }
}
