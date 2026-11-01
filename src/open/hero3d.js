import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The heroes as jointed 3D figures in a clean anime style: toon-shaded, with a thin ink outline,
// a scarf that streams behind them, and one set of named poses for everything they can do.
const UPPER_LEG = 0.6, LOWER_LEG = 0.62, HIP_Y = 1.27, UPPER_ARM = 0.42, LOWER_ARM = 0.42;
const OUTLINE = 0.016;      // ink width, in model units
const EASE = 16, EASE_FAST = 42; // how quickly a joint reaches its pose
const TURN = 16;            // how quickly the body turns to face the way it's going
const GHOSTS = 12;          // afterimages behind a Superspeed runner
const GHOST_EVERY = 0.016;  // seconds between them
const RIBBON_DRAG = 0.86, RIBBON_FALL = 3.2;

export const LOOKS = [
  // A wandering lantern-bearer: spiked blue hair, long red scarf, pale coat, wrapped fists.
  {
    hair: '#2c3fc4', hairHi: '#5f7cf0', skin: '#ffd2a8', iris: '#ffb547', coat: '#efe6d4', coatDark: '#b9a88f', trim: '#2b2f45',
    scarf: '#e0344a', pants: '#2f3550', boot: '#6a3d26', wrap: '#e8d8c0', gold: '#ffb547', glow: '#ffe9a0',
  },
  // The second hero: a long pale tail, teal coat, gold scarf.
  {
    hair: '#ded6ee', hairHi: '#ffffff', skin: '#c98f66', iris: '#37c8b0', coat: '#2fa89a', coatDark: '#1c6f68', trim: '#f0b13c',
    scarf: '#f0b13c', pants: '#3a2f45', boot: '#2b2f45', wrap: '#ded6ee', gold: '#9fe8ff', glow: '#e8fbff', tail: true,
  },
];

const toonSteps = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 185, 185, 185, 255, 255, 255, 255, 255, 255, 255, 255, 255]), 4, 1);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// Ink: the same shape pushed out along its normals, drawn inside out.
const inkMaterial = (() => {
  const m = new THREE.MeshBasicMaterial({ color: '#14162a', side: THREE.BackSide, fog: true });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${OUTLINE.toFixed(3)};`);
  };
  return m;
})();

// Parts painted one color each, merged per bone so the whole figure stays a few draw calls.
function paint(geometry, color) {
  const g = geometry.index ? geometry : mergeReady(geometry), c = new THREE.Color(color), n = g.attributes.position.count;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(out, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  g.deleteAttribute('uv');
  return g;
}
function mergeReady(g) {
  const n = g.attributes.position.count;
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}

const ball = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 16, 12).scale(sx, sy, sz);
const limb = (top, bottom, length, depth = 1) => new THREE.CylinderGeometry(top, bottom, length, 12, 1).scale(1, 1, depth).translate(0, -length / 2, 0);
const spike = (r, length) => new THREE.ConeGeometry(r, length, 8).translate(0, length / 2, 0);
const up = new THREE.Vector3(0, 1, 0);
const aimed = (g, x, y, z, dx, dy, dz) => g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(dx, dy, dz).normalize())).translate(x, y, z);

// A strip of cloth or hair: a chain of points hanging from a moving anchor.
class Ribbon {
  constructor(scene, material, count, link, width) {
    Object.assign(this, { count, link, width, ready: false });
    this.now = new Float32Array(count * 3);
    this.was = new Float32Array(count * 3);
    this.positions = new Float32Array(count * 6);
    const idx = [];
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    g.setIndex(idx);
    this.normals = new Float32Array(count * 6).fill(0.57);
    g.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3));
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(anchor, side, scale, dt, wind) {
    const { now, was, count, positions } = this, link = this.link * scale, half = this.width * scale * 0.5;
    if (!this.ready) {
      this.ready = true;
      for (let i = 0; i < count; i++) {
        now.set([anchor.x, anchor.y - i * link, anchor.z], i * 3);
        was.set([anchor.x, anchor.y - i * link, anchor.z], i * 3);
      }
    }
    // Stepped in small fixed pieces, so a low frame rate can't make the cloth blow up.
    const rounds = Math.min(3, Math.ceil(dt / 0.012)), h = dt / rounds;
    for (let r = 0; r < rounds; r++) {
      now.set([anchor.x, anchor.y, anchor.z], 0);
      for (let i = 1; i < count; i++) {
        const k = i * 3;
        for (let a = 0; a < 3; a++) {
          const v = (now[k + a] - was[k + a]) * RIBBON_DRAG;
          was[k + a] = now[k + a];
          now[k + a] += v + (a === 1 ? -RIBBON_FALL * h * h * 40 : wind[a] * h * h);
        }
      }
      for (let i = 1; i < count; i++) {
        const k = i * 3, dx = now[k] - now[k - 3], dy = now[k + 1] - now[k - 2], dz = now[k + 2] - now[k - 1], d = Math.hypot(dx, dy, dz) || 1, f = link / d;
        now[k] = now[k - 3] + dx * f;
        now[k + 1] = now[k - 2] + dy * f;
        now[k + 2] = now[k - 1] + dz * f;
      }
    }
    for (let i = 0; i < count; i++) {
      const k = i * 3, w = half * (1 - (i / count) * 0.35);
      positions[i * 6] = now[k] + side.x * w;
      positions[i * 6 + 1] = now[k + 1] + side.y * w;
      positions[i * 6 + 2] = now[k + 2] + side.z * w;
      positions[i * 6 + 3] = now[k] - side.x * w;
      positions[i * 6 + 4] = now[k + 1] - side.y * w;
      positions[i * 6 + 5] = now[k + 2] - side.z * w;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// The joints a pose sets. Arms: forward swing, outward spread, elbow bend. Legs: forward swing,
// knee bend, outward spread. Angles in radians.
const blank = () => ({ waist: 0, twist: 0, chest: 0, head: 0, air: 0, ax0: 0.05, ax1: 0.05, as0: 0.12, as1: 0.12, ae0: 0.25, ae1: 0.25, lx0: 0, lx1: 0, lk0: 0.06, lk1: 0.06, ls0: 0.05, ls1: 0.05 });

function gait(p, phase, legSwing, kneeLift, armSwing, elbow, bias = 0) {
  for (const i of [0, 1]) {
    const s = i ? 1 : -1, c = Math.sin(phase) * s, swing = 0.5 + 0.5 * Math.cos(phase) * s;
    p[`lx${i}`] = c * legSwing + bias;
    p[`lk${i}`] = 0.08 + kneeLift * swing ** 1.5;
    p[`ax${i}`] = -c * armSwing;
    p[`ae${i}`] = elbow;
    p[`as${i}`] = 0.1;
  }
}
const set = (p, values) => Object.assign(p, values);
const crouch = (p, swing, knee) => set(p, { lx0: swing, lx1: swing * 0.8, lk0: knee, lk1: knee * 0.9 });

// What every motion looks like. `arm` is the punching arm, 0 or 1.
const POSES = {
  idle: (p, t) => set(p, { chest: Math.sin(t * 1.8) * 0.018, ax0: 0.04 + Math.sin(t * 1.8) * 0.02, ax1: 0.04 + Math.sin(t * 1.8) * 0.02, head: Math.sin(t * 0.6) * 0.05 }),
  walk: (p, t) => { gait(p, t * 7.5, 0.55, 0.85, 0.5, 0.35); p.waist = 0.04; },
  run: (p, t) => { gait(p, t * 12, 0.95, 1.5, 0.9, 1.45, 0.12); p.waist = 0.14; },
  dash: (p, t) => { gait(p, t * 22, 1.15, 1.8, 0, 0.2, 0.15); set(p, { ax0: -1.25, ax1: -1.25, as0: 0.2, as1: 0.2, waist: 0.2, head: -0.25 }); },
  swim: (p, t) => {
    const a = t * 7;
    set(p, { air: 1, ax0: Math.sin(a) * 1.4 + 1.5, ax1: Math.sin(a + 3.14) * 1.4 + 1.5, ae0: 0.5, ae1: 0.5, lx0: Math.sin(a * 1.3) * 0.35, lx1: -Math.sin(a * 1.3) * 0.35, head: -0.8 });
  },
  fly: (p, t) => set(p, { air: 1, ax0: 2.95, ax1: 0.1, as1: 0.3, ae0: 0.05, ae1: 0.5, lx0: 0.05, lx1: 0.2, lk0: 0.1, lk1: 0.5 + Math.sin(t * 8) * 0.05, head: -1 }),
  glide: (p) => set(p, { air: 1, ax0: 0.15, ax1: 0.15, as0: 1.45, as1: 1.45, ae0: 0.1, ae1: 0.1, lx0: 0.1, lx1: -0.15, lk0: 0.25, lk1: 0.4, head: -0.8 }),
  rising: (p) => set(p, { air: 1, ax0: 2.5, ax1: 0.4, as1: 0.3, ae0: 0.2, ae1: 0.9, lx0: 0.95, lx1: -0.12, lk0: 1.5, lk1: 0.3, head: 0.15 }),
  falling: (p, t) => set(p, { air: 1, ax0: 0.7, ax1: 0.7, as0: 1.15, as1: 1.15, ae0: 0.5, ae1: 0.5, lx0: 0.35 + Math.sin(t * 9) * 0.05, lx1: -0.2, lk0: 0.5, lk1: 0.7 }),
  landing: (p) => { crouch(p, 1.15, 1.95); set(p, { waist: 0.5, ax0: 0.6, ax1: 0.6, as0: 0.55, as1: 0.55, ae0: 0.3, ae1: 0.3, head: -0.3 }); },
  hurt: (p) => set(p, { waist: -0.25, head: 0.3, ax0: -0.3, ax1: 0.5, as0: 0.8, as1: 0.8, ae0: 0.8, ae1: 0.6, lk0: 0.3 }),
  charge: (p, t) => { crouch(p, 0.55, 1); set(p, { waist: 0.25, ax0: 0.2, ax1: 0.2, as0: 0.45, as1: 0.45, ae0: 1.7, ae1: 1.7, twist: Math.sin(t * 26) * 0.02 }); },
  gather: (p, t) => { crouch(p, 0.75, 1.3); set(p, { waist: 0.1, chest: -0.2, ax0: -0.7, ax1: -0.7, as0: 0.95, as1: 0.95, ae0: 1.5, ae1: 1.5, twist: Math.sin(t * 34) * 0.03 }); },
  peak: (p, t) => { crouch(p, 0.28, 0.45); set(p, { waist: -0.12, chest: -0.3, head: 0.35, ax0: 2.9, ax1: -0.5, as1: 0.8, ae0: 0.1, ae1: 1.5, twist: -0.3 + Math.sin(t * 40) * 0.02 }); },
  slam: (p) => { crouch(p, 1.05, 1.7); set(p, { waist: 0.75, ax0: 1.35, ax1: -0.5, as1: 0.8, ae0: 0.05, ae1: 0.7, head: -0.35 }); },
  roll: (p) => { crouch(p, 1.5, 2.3); set(p, { air: 1, waist: 0.6, head: 0.8, ax0: 1, ax1: 1, ae0: 1.9, ae1: 1.9 }); },
  guard: (p) => { crouch(p, 0.35, 0.65); set(p, { waist: 0.12, ax0: 1.15, ax1: 0.95, as0: -0.2, as1: -0.2, ae0: 2.1, ae1: 2.1, twist: 0.1 }); },
  hold: (p) => { crouch(p, 0.25, 0.4); set(p, { ax0: 3, ax1: 3, as0: 0.15, as1: 0.15, ae0: 0.4, ae1: 0.4, chest: -0.15 }); },
  throw: (p) => { set(p, { lx0: 0.55, lx1: -0.45, lk0: 0.35, lk1: 0.2, waist: 0.45, ax0: 1.5, ax1: -0.7, as1: 0.5, ae0: 0.1, ae1: 0.5, twist: 0.45 }); },
  windup: (p, t, arm) => {
    const r = `${arm}`, o = `${1 - arm}`;
    set(p, { lx0: 0.35, lx1: -0.3, lk0: 0.45, lk1: 0.4, twist: arm ? -0.55 : 0.55, waist: 0.1, [`ax${r}`]: -0.55, [`ae${r}`]: 1.9, [`as${r}`]: 0.3, [`ax${o}`]: 0.75, [`ae${o}`]: 1.5 });
  },
  punch: (p, t, arm) => {
    const r = `${arm}`, o = `${1 - arm}`;
    set(p, { lx0: 0.55, lx1: -0.5, lk0: 0.35, lk1: 0.2, twist: arm ? 0.6 : -0.6, waist: 0.2, [`ax${r}`]: 1.55, [`ae${r}`]: 0.05, [`as${r}`]: -0.12, [`ax${o}`]: -0.55, [`ae${o}`]: 1.8, [`as${o}`]: 0.2 });
  },
  uppercut: (p, t, arm) => {
    const r = `${arm}`, o = `${1 - arm}`;
    set(p, { lx0: 0.2, lx1: -0.3, lk0: 0.1, lk1: 0.25, twist: arm ? 0.35 : -0.35, waist: -0.18, chest: -0.2, head: 0.25, [`ax${r}`]: 2.85, [`ae${r}`]: 0.75, [`ax${o}`]: -0.4, [`ae${o}`]: 1.5 });
  },
};

export default class HeroModel {
  constructor(scene, look) {
    this.scene = scene;
    this.look = look;
    this.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonSteps });
    this.mesh = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = HIP_Y;
    this.body.rotation.order = 'YXZ';
    this.mesh.add(this.body);
    this.bones = {};
    this.pose = blank();
    this.goal = blank();
    this.yaw = 0;
    this.leanNow = 0;
    this.lastTime = 0;
    this.fist = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.wind = [0, 0, 0];
    this.lastPos = null;
    this.rig();
    scene.add(this.mesh);

    const cloth = new THREE.MeshToonMaterial({ color: look.scarf, gradientMap: toonSteps, side: THREE.DoubleSide });
    this.ribbons = [new Ribbon(scene, cloth, 11, 0.16, 0.22), new Ribbon(scene, cloth, 8, 0.15, 0.17)];
    if (look.tail) this.ribbons.push(new Ribbon(scene, new THREE.MeshToonMaterial({ color: look.hair, gradientMap: toonSteps, side: THREE.DoubleSide }), 10, 0.15, 0.2));

    // A star of light on the fist as the punch lands; bigger and hotter at higher stages.
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstTexture(), transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
    this.flash.visible = false;
    scene.add(this.flash);

    // Afterimages: a soft streak of the hero left hanging in the air.
    const ghost = mergeGeometries([ball(0.3).translate(0, 2.2, 0), new THREE.CapsuleGeometry(0.3, 1.4, 4, 10).translate(0, 1.2, 0)].map((g) => { g.deleteAttribute('uv'); return g; }));
    this.ghostIn = 0;
    this.ghostAt = 0;
    this.ghosts = Array.from({ length: GHOSTS }, () => {
      const g = new THREE.Mesh(ghost, new THREE.MeshBasicMaterial({ color: look.scarf, transparent: true, depthWrite: false, opacity: 0 }));
      g.visible = false;
      g.rotation.order = 'YXZ';
      scene.add(g);
      return g;
    });
  }

  bone(name, parent, x, y, z, order = 'XYZ') {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.rotation.order = order;
    parent.add(b);
    this.bones[name] = b;
    return b;
  }

  skin(bone, parts) {
    const mesh = new THREE.Mesh(mergeGeometries(parts), this.material);
    mesh.castShadow = true;
    const ink = new THREE.Mesh(mesh.geometry, inkMaterial);
    bone.add(mesh, ink);
  }

  rig() {
    const C = this.look, B = this.bones;
    const spine = this.bone('spine', this.body, 0, 0.04, 0);
    const chest = this.bone('chest', spine, 0, 0.38, 0);
    const neck = this.bone('neck', chest, 0, 0.5, 0);
    const head = this.bone('head', neck, 0, 0.06, 0);

    this.skin(this.body, [
      paint(limb(0.215, 0.22, 0.3, 0.74).translate(0, 0.14, 0), C.pants),
      paint(ball(0.225, 1, 0.8, 0.78).translate(0, -0.14, 0), C.pants),
      paint(limb(0.235, 0.235, 0.09, 0.8).translate(0, 0.06, 0), C.trim),
      paint(new THREE.BoxGeometry(0.1, 0.08, 0.04).translate(0, 0.02, 0.19), C.gold),
    ]);
    this.skin(chest, [
      paint(limb(0.27, 0.21, 0.5, 0.72).translate(0, 0.5, 0), C.coat),
      paint(limb(0.215, 0.205, 0.38, 0.74).translate(0, 0.02, 0), C.coat),
      paint(new THREE.BoxGeometry(0.08, 0.76, 0.03).translate(0, 0.1, 0.17), C.trim),
      paint(ball(0.13, 1, 1, 0.85).translate(-0.27, 0.42, 0), C.coat),
      paint(ball(0.13, 1, 1, 0.85).translate(0.27, 0.42, 0), C.coat),
    ]);
    this.skin(neck, [
      paint(new THREE.TorusGeometry(0.16, 0.085, 8, 16).rotateX(Math.PI / 2).scale(1, 1, 0.9).translate(0, 0, 0), C.scarf),
      paint(limb(0.08, 0.09, 0.14).translate(0, 0.12, 0), C.skin),
    ]);
    this.skin(head, this.headParts());

    for (const i of [0, 1]) {
      const s = i ? -1 : 1; // 0 is the left side of the body, at +x
      const thigh = this.bone(`thigh${i}`, this.body, s * 0.125, -0.12, 0);
      const shin = this.bone(`shin${i}`, thigh, 0, -UPPER_LEG, 0);
      this.skin(thigh, [paint(limb(0.14, 0.1, UPPER_LEG), C.pants)]);
      this.skin(shin, [
        paint(ball(0.1), C.pants),
        paint(limb(0.1, 0.075, 0.34), C.pants),
        paint(limb(0.098, 0.105, 0.3).translate(0, -0.3, 0), C.boot),
        paint(ball(0.11, 1, 0.62, 1.65).translate(0, -0.56, 0.07), C.boot),
      ]);
      const arm = this.bone(`arm${i}`, chest, s * 0.29, 0.42, 0);
      const fore = this.bone(`fore${i}`, arm, 0, -UPPER_ARM, 0);
      this.skin(arm, [paint(limb(0.1, 0.082, UPPER_ARM), C.coat)]);
      this.skin(fore, [
        paint(ball(0.082), C.coat),
        paint(limb(0.082, 0.066, LOWER_ARM * 0.72), C.coat),
        paint(limb(0.07, 0.07, 0.1).translate(0, -LOWER_ARM * 0.68, 0), C.coatDark),
        paint(ball(0.1, 1, 1, 1.05).translate(0, -LOWER_ARM - 0.05, 0), C.wrap),
      ]);
      this.bone(`hand${i}`, fore, 0, -LOWER_ARM - 0.05, 0);
      // The coat falls open in two tails that follow each leg.
      const tail = this.bone(`tail${i}`, this.body, s * 0.11, 0.05, -0.03);
      this.skin(tail, [paint(new THREE.CylinderGeometry(0.17, 0.23, 0.56, 10, 1, true, i ? Math.PI * 1.1 : Math.PI * 0.4, Math.PI * 0.5).scale(1, 1, 0.8).translate(0, -0.28, 0), C.coat)]);
    }
    // A little lantern swings at the hip.
    const lamp = this.bone('lamp', this.body, 0.27, 0.0, 0.03);
    const glow = new THREE.Mesh(ball(0.075, 1, 1.25, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.glow).multiplyScalar(2.4), fog: false }));
    glow.position.y = -0.17;
    this.skin(lamp, [
      paint(limb(0.012, 0.012, 0.1), C.trim),
      paint(limb(0.03, 0.095, 0.04).translate(0, -0.08, 0), C.gold),
      paint(limb(0.095, 0.05, 0.03).translate(0, -0.27, 0), C.gold),
    ]);
    lamp.add(glow);
    B.tail0.rotation.order = B.tail1.rotation.order = 'XYZ';
    this.neck = neck;
    this.chest = chest;
  }

  headParts() {
    const C = this.look, H = 0.2, parts = [
      paint(ball(0.26, 0.96, 1.05, 1).translate(0, H, 0), C.skin),
      paint(ball(0.17, 0.95, 0.9, 1).translate(0, H - 0.13, 0.05), C.skin),
    ];
    for (const s of [-1, 1]) {
      parts.push(
        paint(ball(0.055, 0.95, 1.5, 0.3).translate(s * 0.105, H - 0.01, 0.238), '#1b1c34'),
        paint(ball(0.036, 1, 1.5, 0.3).translate(s * 0.105, H - 0.03, 0.25), C.iris),
        paint(ball(0.018, 1, 1, 0.4).translate(s * 0.095, H + 0.03, 0.258), '#ffffff'),
        paint(new THREE.BoxGeometry(0.1, 0.018, 0.02).rotateZ(s * -0.14).translate(s * 0.105, H + 0.095, 0.238), C.trim),
      );
    }
    // The hair: a cap, then locks swept back by the wind.
    parts.push(paint(ball(0.285, 1, 0.98, 1.04).translate(0, H + 0.05, -0.03), C.hair));
    const locks = C.tail
      ? [[0.2, 0.2, 0.17, 0.5, -0.25, 0.8, 0.07, 0.24], [-0.2, 0.2, 0.17, -0.5, -0.25, 0.8, 0.07, 0.24], [0.06, 0.3, 0.25, 0.25, -0.45, 0.8, 0.08, 0.24], [-0.09, 0.3, 0.25, -0.2, -0.5, 0.8, 0.08, 0.25],
        [0.25, 0.07, 0.03, 0.2, -1, 0.1, 0.07, 0.42], [-0.25, 0.07, 0.03, -0.2, -1, 0.1, 0.07, 0.42]]
      : [[0, 0.3, 0.2, 0, 1, 0.75, 0.09, 0.34], [0.14, 0.27, 0.15, 0.6, 0.85, 0.6, 0.09, 0.34], [-0.14, 0.27, 0.15, -0.6, 0.85, 0.6, 0.09, 0.34],
        [0.05, 0.3, -0.05, 0.25, 1, -0.3, 0.1, 0.42], [-0.08, 0.3, -0.05, -0.3, 1, -0.25, 0.1, 0.4], [0.2, 0.2, -0.08, 0.85, 0.65, -0.35, 0.1, 0.42], [-0.2, 0.2, -0.08, -0.85, 0.65, -0.35, 0.1, 0.42],
        [0.13, 0.12, -0.22, 0.5, 0.15, -1, 0.1, 0.4], [-0.13, 0.12, -0.22, -0.5, 0.15, -1, 0.1, 0.4], [0, 0.22, -0.22, 0, 0.5, -1, 0.11, 0.42], [0.09, -0.05, -0.25, 0.35, -0.55, -0.9, 0.09, 0.32], [-0.09, -0.05, -0.25, -0.35, -0.55, -0.9, 0.09, 0.32],
        [0.24, 0.12, 0.12, 0.8, -0.3, 0.75, 0.07, 0.25], [-0.24, 0.12, 0.12, -0.8, -0.3, 0.75, 0.07, 0.25], [0.08, 0.28, 0.24, 0.35, -0.5, 0.85, 0.07, 0.24], [-0.1, 0.27, 0.24, -0.35, -0.5, 0.85, 0.07, 0.24]];
    locks.forEach(([x, y, z, dx, dy, dz, r, length], i) => parts.push(paint(aimed(spike(r, length), x, H + y, z, dx, dy, dz), i % 3 === 1 ? C.hairHi : C.hair)));
    return parts;
  }

  // What's needed each view: the figure is posed once per frame however many screens show it.
  update(x, y, z, dir, name, lean, time, { arm = 0, run = 1 } = {}) {
    const dt = Math.min(0.05, time - this.lastTime);
    if (dt <= 0) {
      this.mesh.position.set(x, y, z);
      return;
    }
    this.lastTime = time;
    const goal = Object.assign(this.goal, blank());
    POSES[name](goal, time * run, arm);
    const k = 1 - Math.exp(-dt * (name === 'punch' || name === 'windup' || name === 'uppercut' || name === 'hurt' ? EASE_FAST : EASE));
    const p = this.pose;
    for (const key in goal) p[key] += (goal[key] - p[key]) * k;
    const B = this.bones;
    // Feet stay on the ground by setting the hips to the height of the straighter leg.
    const reach = (i) => UPPER_LEG * Math.cos(p[`lx${i}`]) + LOWER_LEG * Math.cos(p[`lk${i}`] - p[`lx${i}`]);
    const stand = Math.max(reach(0), reach(1)), full = UPPER_LEG + LOWER_LEG;
    this.body.position.y = HIP_Y - (full - stand) * (1 - p.air);
    const rise = 1 - Math.exp(-dt * TURN);
    let turn = Math.atan2(dir[0], dir[1]) - this.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.yaw += turn * rise;
    this.leanNow += (lean - this.leanNow) * (name === 'roll' ? 1 : Math.min(1, dt * 14));
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = this.yaw;
    this.body.rotation.x = this.leanNow;
    B.spine.rotation.set(p.waist, p.twist * 0.5, 0);
    B.chest.rotation.set(p.chest, p.twist * 0.5, 0);
    B.head.rotation.set(p.head, -p.twist * 0.6, 0);
    for (const i of [0, 1]) {
      const s = i ? -1 : 1;
      B[`arm${i}`].rotation.set(-p[`ax${i}`], 0, s * p[`as${i}`]);
      B[`fore${i}`].rotation.x = -p[`ae${i}`];
      B[`thigh${i}`].rotation.set(-p[`lx${i}`], 0, s * p[`ls${i}`]);
      B[`shin${i}`].rotation.x = p[`lk${i}`];
      B[`tail${i}`].rotation.set(Math.max(0.02, -p[`lx${i}`] * 0.75 + 0.05), 0, s * 0.1);
    }
    B.lamp.rotation.x = Math.sin(time * 5) * 0.1 * (name === 'idle' ? 0.2 : 1) - this.leanNow;
    this.mesh.updateMatrixWorld(true);

    // The scarf hangs from the back of the neck and streams out against the motion.
    const scale = this.mesh.scale.x, m = this.lastPos ?? this.mesh.position;
    const vx = (x - m.x) / dt, vz = (z - m.z) / dt;
    this.lastPos = this.mesh.position.clone();
    this.wind[0] = -Math.max(-90, Math.min(90, vx)) * 6 + Math.sin(time * 1.3) * 18;
    this.wind[1] = 8 + Math.sin(time * 3.1) * 6;
    this.wind[2] = -Math.max(-90, Math.min(90, vz)) * 6 + Math.cos(time * 1.1) * 18;
    this.side.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.ribbons.forEach((r, i) => {
      this.anchor.set(i === 2 ? 0 : i ? 0.09 : -0.08, i === 2 ? 0.42 : 0.02, -0.21);
      (i === 2 ? B.head : this.neck).localToWorld(this.anchor);
      r.update(this.anchor, this.side, scale, dt, this.wind);
    });
  }

  // A hero who has left the game takes their cloth with them.
  show(on) {
    this.mesh.visible = on;
    for (const r of this.ribbons) r.mesh.visible = on;
  }

  // Drops an afterimage where the hero is, every few hundredths of a second.
  leaveTrail(pace, dt) {
    this.ghosts.forEach((g) => {
      g.material.opacity -= dt * 2.6;
      if (g.material.opacity <= 0) g.visible = false;
    });
    if (pace < 0.05 || (this.ghostIn -= dt) > 0) return;
    this.ghostIn = GHOST_EVERY;
    const g = this.ghosts[this.ghostAt = (this.ghostAt + 1) % GHOSTS];
    g.position.copy(this.mesh.position);
    g.rotation.set(this.leanNow, this.yaw, 0);
    g.scale.copy(this.mesh.scale);
    g.material.opacity = 0.1 + pace * 0.3;
    g.visible = true;
  }

  // pose: { t, stage, color } from the melee system, or null.
  punch(pose, arm) {
    this.flash.visible = !!pose && pose.t > 0.35 && pose.t < 0.7;
    if (!this.flash.visible) return;
    this.bones[`hand${arm}`].getWorldPosition(this.flash.position);
    this.flash.material.color.set(pose.color);
    this.flash.material.rotation = pose.t * 9;
    this.flash.scale.setScalar(1 + pose.stage * 0.7);
  }

  // Turns the figure hot red for a moment when the hero is hit.
  flinch(on) {
    this.material.emissive.set(on ? '#b02818' : '#000000');
  }
}

// An eight-point star fading to nothing. Light adds up, so black shows nothing.
function burstTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  const fill = g.createRadialGradient(0, 0, 0, 0, 0, 62);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.3, '#b0b0b0');
  fill.addColorStop(1, '#000000');
  g.fillStyle = fill;
  g.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = k % 2 ? 12 : k % 4 ? 42 : 62;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
