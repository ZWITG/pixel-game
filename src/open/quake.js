import * as THREE from 'three';
import { height } from './terrain.js';

// The ground's answer to a Destructive Blow: boulders that lift while it gathers, then pillars
// of rock, flung stone and fissures running out through the land when it goes off.
// `might` runs 0..1, from a quick low-level blow to a full charge at the top of the skill.
const MAX_STONES = 70, MAX_PILLARS = 90;
const LIFT_RATE = 16;        // boulders per second lifting at full might
const MOST_AFLOAT = 34;
const PILLAR_RISE = 0.22;    // seconds to burst out of the ground
const PILLAR_STAY = 5;
const PILLAR_SINK = 1.4;
const CHASM_STEP = 17;       // tiles between the bowls of a fissure
const CHASM_SPEED = 0.07;    // seconds for a fissure to run one step
const ROCK = ['#7c6e72', '#94808a', '#6a5a64', '#a8968c'];

export default class Quake {
  constructor(scene, chunks) {
    this.chunks = chunks;
    this.events = [];
    this.d = new THREE.Object3D();
    this.color = new THREE.Color();
    const mat = () => new THREE.MeshLambertMaterial({ flatShading: true });
    this.stoneMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(), MAX_STONES);
    this.pillarMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 1, 1, 5).translate(0, 0.5, 0), mat(), MAX_PILLARS);
    for (const m of [this.stoneMesh, this.pillarMesh]) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.setColorAt(0, this.color.set(ROCK[0]));
      scene.add(m);
    }
    this.stones = Array.from({ length: MAX_STONES }, () => ({ on: false }));
    this.pillars = Array.from({ length: MAX_PILLARS }, () => ({ age: -1 }));
    this.pillarDirty = false;
    this.lifting = 0;
    for (let i = 0; i < MAX_PILLARS; i++) this.pillarMesh.setMatrixAt(i, this.d.matrix.makeScale(0, 0, 0));
    for (let i = 0; i < MAX_STONES; i++) this.stoneMesh.setMatrixAt(i, this.d.matrix);
  }

  after(seconds, run) {
    this.events.push({ at: seconds, run });
  }

  spareStone() {
    const i = this.stones.findIndex((s) => !s.on);
    if (i < 0) return null;
    this.stoneMesh.setColorAt(i, this.color.set(ROCK[i % ROCK.length]));
    this.stoneMesh.instanceColor.needsUpdate = true;
    return this.stones[i];
  }

  // Boulders tear loose and circle a hero gathering a blow.
  gather(dt, x, y, z, might) {
    this.lifting += dt * LIFT_RATE * might;
    while (this.lifting >= 1) {
      this.lifting -= 1;
      if (this.stones.filter((s) => s.on && s.afloat).length >= MOST_AFLOAT * might) break;
      const s = this.spareStone();
      if (!s) break;
      const a = Math.random() * 6.28, r = 5 + Math.random() * 11;
      Object.assign(s, { on: true, afloat: true, a, r, cx: x, cz: z, x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y, top: y + 2 + Math.random() * (4 + might * 9), size: 0.3 + Math.random() * (0.4 + might * 0.5), spin: Math.random() * 6 });
    }
    for (const s of this.stones) {
      if (s.on && s.afloat) {
        s.cx = x;
        s.cz = z;
      }
    }
  }

  // Throws whatever is aloft outward, or drops it if the blow never came.
  fling(x, z, speed) {
    for (const s of this.stones) {
      if (!s.on || !s.afloat) continue;
      const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz) || 1;
      Object.assign(s, { afloat: false, vx: (dx / d) * speed, vz: (dz / d) * speed, vy: speed * 0.45 });
    }
  }

  throwStones(x, y, z, count, speed) {
    for (let i = 0; i < count; i++) {
      const s = this.spareStone();
      if (!s) return;
      const a = Math.random() * 6.28, v = speed * (0.4 + Math.random() * 0.8);
      // They start clear of the hero, so none lands in front of the camera.
      Object.assign(s, { on: true, afloat: false, x: x + Math.cos(a) * 6, y: y + 1, z: z + Math.sin(a) * 6, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: v * (0.5 + Math.random()), size: 0.4 + Math.random() * 1.2, spin: Math.random() * 6 });
    }
  }

  pillar(x, z, tall, wait) {
    const p = this.pillars.find((k) => k.age < 0 && !k.waiting);
    if (!p) return;
    this.pillarMesh.setColorAt(this.pillars.indexOf(p), this.color.set(ROCK[Math.floor(Math.random() * ROCK.length)]));
    this.pillarMesh.instanceColor.needsUpdate = true;
    Object.assign(p, { age: -wait - 1e-3, waiting: true, x, y: height(x, z), z, tall, wide: tall * (0.16 + Math.random() * 0.12), turn: Math.random() * 6, stay: PILLAR_STAY + Math.random() * 2 });
  }

  // The land breaks: pillars around the blast, then fissures running outward from it.
  shatter(x, z, reach, might, canBreak, onDone) {
    const pillars = Math.round(might * might * 46);
    for (let i = 0; i < pillars; i++) {
      const a = Math.random() * 6.28, d = reach * (0.25 + Math.random() * 0.75);
      this.pillar(x + Math.cos(a) * d, z + Math.sin(a) * d, 4 + Math.random() * 12 * might, d / 90);
    }
    const rays = might > 0.6 ? Math.round(3 + might * 4) : 0, steps = Math.round(might * 7);
    let last = 0;
    for (let i = 0; i < rays; i++) {
      let a = (i / rays) * 6.28 + Math.random() * 0.5, px = x, pz = z;
      const start = reach * 0.55;
      for (let k = 0; k < steps; k++) {
        a += (Math.random() - 0.5) * 0.5;
        const d = k ? CHASM_STEP : start;
        px += Math.cos(a) * d;
        pz += Math.sin(a) * d;
        const cx = px, cz = pz, size = (11 - k * 0.8) * (0.6 + might * 0.6);
        last = Math.max(last, k * CHASM_SPEED);
        this.after(k * CHASM_SPEED + i * 0.02, () => {
          if (!canBreak(cx, cz, size)) return;
          this.chunks.deform(cx, cz, size, size * 0.55, true);
          this.pillar(cx + size * 0.6, cz, 3 + Math.random() * 6, 0);
          this.pillar(cx - size * 0.6, cz + 2, 3 + Math.random() * 6, 0);
        });
      }
    }
    this.after(last + 0.2, () => {
      if (rays) this.chunks.scatter();
      onDone();
    });
  }

  updateStones(dt) {
    const d = this.d;
    let live = false;
    this.stones.forEach((s, i) => {
      if (!s.on) return;
      live = true;
      s.spin += dt * 3;
      if (s.afloat) {
        s.a += dt * (0.8 + 6 / s.r);
        s.x = s.cx + Math.cos(s.a) * s.r;
        s.z = s.cz + Math.sin(s.a) * s.r;
        s.y += (s.top - s.y) * Math.min(1, dt * 3);
      } else {
        s.vy -= 26 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        if (s.y < height(s.x, s.z) - 1) s.on = false;
      }
      d.position.set(s.x, s.y, s.z);
      d.rotation.set(s.spin, s.spin * 0.7, 0);
      d.scale.setScalar(s.on ? s.size : 0);
      d.updateMatrix();
      this.stoneMesh.setMatrixAt(i, d.matrix);
    });
    if (live || this.stonesLive) this.stoneMesh.instanceMatrix.needsUpdate = true;
    this.stonesLive = live;
  }

  updatePillars(dt) {
    const d = this.d;
    this.pillars.forEach((p, i) => {
      if (p.age < 0 && !p.waiting) return;
      p.age += dt;
      if (p.age < 0) return;
      p.waiting = false;
      const up = Math.min(1, p.age / PILLAR_RISE), down = Math.max(0, (p.age - p.stay) / PILLAR_SINK);
      if (down >= 1) p.age = -1;
      if (this.events.length) p.y = height(p.x, p.z); // the land is still moving under it
      const show = p.age < 0 ? 0 : up * up * (3 - 2 * up) * (1 - down);
      d.position.set(p.x, p.y - 1, p.z);
      d.rotation.set(0, p.turn, 0.12);
      d.scale.set(p.wide * 2 * (show ? 1 : 0), p.tall * show, p.wide * 2 * (show ? 1 : 0));
      d.updateMatrix();
      this.pillarMesh.setMatrixAt(i, d.matrix);
      this.pillarDirty = true;
    });
    if (this.pillarDirty) this.pillarMesh.instanceMatrix.needsUpdate = true;
    this.pillarDirty = false;
  }

  update(dt) {
    for (const e of this.events) e.at -= dt;
    const due = this.events.filter((e) => e.at <= 0);
    this.events = this.events.filter((e) => e.at > 0);
    for (const e of due) e.run();
    this.updateStones(dt);
    this.updatePillars(dt);
  }
}
