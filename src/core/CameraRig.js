import * as THREE from 'three';

// Two camera modes:
//  'top'   - angled top-down view that orbits the hero
//  'third' - close behind-the-hero view with free look
const MODES = {
  top: { dist: 11, height: 0.5, fov: 45 },
  third: { dist: 4.2, height: 1.0, fov: 60 },
};
const TOP_PITCH = 0.95;
const THIRD_PITCH_MIN = 0.05, THIRD_PITCH_MAX = 1.15;

export default class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'top';
    this.yaw = 0;
    this.thirdPitch = 0.32;
    this.target = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.cur = { ...MODES.top, pitch: TOP_PITCH };
    this.shakeLeft = 0;
  }

  toggle() {
    this.mode = this.mode === 'top' ? 'third' : 'top';
  }

  snap(player) {
    this.target.set(player.x, 0, player.z);
  }

  // dx/dy in radians: turn left/right and (behind view only) look up/down.
  look(dx, dy) {
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

  update(dt, player) {
    this.goal.set(player.x, 0, player.z);
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

    const { dist, height, pitch: p } = this.cur;
    const ty = height;
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
