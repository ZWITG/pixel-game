import * as THREE from 'three';
import { LOOKS } from '../art/looks.js';
import { toon, paint, ball, limb, spike, block, aimed, skin, shine } from './kit.js';

// Every person who isn't a hero. They share one skeleton and animation (Enemy.js and walkPose
// expect `legs`, `arms`, `root`, `head`) but each kind has its own shape, so a soldier, a smith
// and an assassin read at a glance from far away. Add one by adding an outfit to OUTFITS.
const INK = 0.009;
const CLOTH = 16;           // how much a robe flares
const HIP = 0.34, SHOULDER = 0.62, NECK = 0.68, HEAD = 0.88;

// Each outfit gets the figure's parts lists: { body, head, arm: [right, left], leg: [r, l] } and
// its colors. `build` sets the body: bulk (width), tall, big (head), lean (forward stoop).
const OUTFITS = {
  // ---- townsfolk ----
  merchant: {
    build: { bulk: 1.18, big: 1 },
    dress(F, C) {
      F.body.push(paint(limb(0.2, 0.25, 0.24, 0.84).translate(0, 0.52, 0), C.tunic));
      F.head.push(paint(new THREE.CylinderGeometry(0.3, 0.33, 0.03, 16).translate(0, 0.14, 0), '#c8a058'), paint(limb(0.13, 0.16, 0.13).translate(0, 0.27, 0), '#c8a058'));
      F.body.push(paint(block(0.3, 0.32, 0.17).translate(0, 0.56, -0.2), '#7a5230'), paint(block(0.36, 0.05, 0.2).translate(0, 0.74, -0.2), '#5a3a22'));
    },
  },
  kid: {
    build: { bulk: 0.86, big: 1.34 },
    dress(F, C) {
      F.head.push(paint(ball(0.06).translate(-0.13, 0.15, 0), C.hairShine), paint(ball(0.06).translate(0.13, 0.15, 0), C.hairShine));
      F.body.push(paint(new THREE.TorusGeometry(0.1, 0.03, 6, 12).rotateX(Math.PI / 2).translate(0, 0.68, 0), '#ffcd75'));
    },
  },
  smith: {
    build: { bulk: 1.34, big: 0.95, arms: 1.5 },
    dress(F, C) {
      F.body.push(paint(block(0.32, 0.44, 0.03).translate(0, 0.45, 0.17), '#3a2a1f'));
      F.arm[0].push(paint(limb(0.018, 0.018, 0.32).translate(0, -0.2, 0.08).rotateX(1.2), '#5a3a22'), paint(block(0.16, 0.1, 0.1).translate(0, -0.22, 0.34), '#566c86'));
      F.head.push(paint(block(0.3, 0.05, 0.03).translate(0, 0.02, 0.15), '#333c57'));
    },
  },
  bard: {
    build: { bulk: 0.92, big: 1 },
    dress(F, C) {
      F.head.push(paint(ball(0.17, 1.1, 0.5, 1).translate(0, 0.12, -0.01), C.hat), paint(aimed(spike(0.022, 0.3), 0.09, 0.16, -0.06, 0.4, 1, -0.5), '#ffcd75'));
      F.body.push(paint(ball(0.1, 1, 1.25, 0.34).translate(0.05, 0.5, 0.17), '#a86a3a'), paint(block(0.03, 0.26, 0.03).translate(0.17, 0.68, 0.17).rotateZ(-0.3), '#5a3a22'));
    },
  },
  elder: {
    build: { bulk: 0.96, big: 1, robe: 0.34 },
    dress(F, C) {
      F.head.push(paint(aimed(spike(0.1, 0.24), 0, -0.11, 0.1, 0, -1, 0.15), '#ece7e0'));
      F.arm[1].push(paint(limb(0.016, 0.016, 0.98).translate(0, 0.32, 0.07), '#5a3a22'), paint(ball(0.05).translate(0, 0.34, 0.07), '#73eff7'));
    },
  },
  guard: {
    build: { bulk: 1.08, big: 0.96 },
    dress(F, C) {
      F.body.push(paint(limb(0.215, 0.18, 0.34, 0.76).translate(0, 0.67, 0), '#94b0c2'));
      F.head.push(paint(ball(0.165, 1, 0.9, 1).translate(0, 0.06, 0), '#94b0c2'), paint(block(0.3, 0.03, 0.05).translate(0, 0.02, 0.15), '#566c86'));
      F.arm[1].push(paint(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16).rotateX(Math.PI / 2).translate(-0.07, -0.2, 0.08).rotateY(-0.9), '#566c86'));
    },
  },
  // ---- those who fight ----
  bandit: {
    build: { bulk: 0.98, big: 0.96, lean: 0.12 },
    dress(F, C) {
      F.head.push(paint(ball(0.185, 1, 1.05, 1.04).translate(0, 0.02, -0.02), C.hat), paint(block(0.22, 0.09, 0.03).translate(0, -0.05, 0.15), '#2b2f45'));
      F.body.push(paint(block(0.38, 0.08, 0.26).rotateZ(0.3).translate(0, 0.54, 0), '#7a2a3e'));
      F.body.push(paint(new THREE.CylinderGeometry(0.2, 0.28, 0.42, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8).translate(0, 0.44, -0.03), '#3a2c30'));
    },
  },
  chief: {
    build: { bulk: 1.42, big: 0.9, arms: 1.3 },
    dress(F, C) {
      F.body.push(paint(ball(0.28, 1.18, 0.5, 0.86).translate(0, 0.66, 0), '#5a4638'));
      for (const s of [-1, 1]) F.head.push(paint(aimed(spike(0.05, 0.3), s * 0.13, 0.1, 0, s * 0.7, 1, 0.1), '#e8dcc0'));
      F.head.push(paint(aimed(spike(0.09, 0.22), 0, -0.11, 0.12, 0, -1, 0.15), C.beard ?? C.hair));
      F.arm[0].push(paint(limb(0.018, 0.018, 0.72).translate(0, -0.03, 0.1).rotateX(1.05), '#5a3a22'), paint(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 3).rotateX(Math.PI / 2).translate(0, -0.4, 0.42), '#c8ccd4'));
    },
  },
  legion: {
    build: { bulk: 1.12, big: 0.94 },
    dress(F, C) {
      F.body.push(paint(limb(0.22, 0.19, 0.34, 0.78).translate(0, 0.67, 0), '#c8a14a'), paint(block(0.05, 0.3, 0.02).translate(0, 0.5, 0.17), '#a8201e'));
      F.body.push(paint(new THREE.CylinderGeometry(0.2, 0.25, 0.14, 12).translate(0, 0.28, 0), '#a8201e'));
      F.body.push(paint(new THREE.CylinderGeometry(0.2, 0.32, 0.62, 10, 1, true, Math.PI * 0.7, Math.PI * 0.6).translate(0, 0.36, -0.08), '#a8201e'));
      F.head.push(paint(ball(0.165, 1, 0.92, 1).translate(0, 0.06, 0), '#c8a14a'), paint(block(0.04, 0.16, 0.34).translate(0, 0.22, -0.02), '#e03030'), paint(block(0.04, 0.12, 0.02).translate(0, -0.04, 0.155), '#8a6a2a'));
      F.arm[1].push(paint(block(0.36, 0.58, 0.04).translate(-0.04, -0.22, 0.12), '#a8201e'), paint(ball(0.05, 1, 1, 0.5).translate(-0.04, -0.22, 0.15), '#e8c050'));
    },
  },
  assassin: {
    build: { bulk: 0.8, big: 0.92, lean: 0.34, thin: 0.8 },
    dress(F, C) {
      F.head.push(paint(ball(0.175, 1, 1.02, 1.08).translate(0, 0.01, -0.02), C.tunic), paint(aimed(spike(0.09, 0.26), 0, 0.08, -0.13, 0, 0.45, -1), C.tunic));
      F.body.push(paint(block(0.05, 0.3, 0.02).rotateZ(0.5).translate(0, 0.54, 0.15), '#5fae62'));
      for (const i of [0, 1]) F.arm[i].push(paint(aimed(spike(0.026, 0.3, 4), 0, -0.3, 0.02, 0, -0.25, 1), '#c8ccd4'));
      F.body.push(paint(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 8, 1, true, Math.PI * 0.8, Math.PI * 0.4).translate(0, 0.46, -0.1), C.tunicShade));
    },
  },
  rime: {
    build: { bulk: 1.32, big: 0.86, arms: 1.25 },
    dress(F, C) {
      F.body.push(paint(limb(0.27, 0.2, 0.38, 0.8).translate(0, 0.7, 0), C.tunic));
      for (const s of [-1, 1]) {
        F.body.push(paint(ball(0.13, 1, 0.76, 1).translate(s * 0.28, 0.67, 0), '#dff4ff'));
        for (const [z, t] of [[0.05, 0.22], [-0.06, 0.16]]) F.body.push(paint(aimed(spike(0.05, t, 5), s * 0.31, 0.7, z, s * 0.3, 1, -0.2), '#8fe0ff'));
      }
      F.head.push(paint(limb(0.15, 0.17, 0.3).translate(0, 0.17, 0), C.tunic));
      F.glow.head.push(paint(block(0.2, 0.02, 0.02).translate(0, 0.02, 0.16), '#8fe0ff'));
      F.arm[0].push(paint(aimed(spike(0.05, 0.62, 5), 0, -0.32, 0.03, 0, 0.1, 1), '#bfeaff'));
    },
  },
  cinder: {
    build: { bulk: 1, big: 0.94, lean: 0.14 },
    dress(F, C) {
      F.body.push(paint(limb(0.15, 0.15, 0.42).translate(0, 0.72, -0.21), '#6a3a22'), paint(ball(0.15, 1, 0.5, 1).translate(0, 0.74, -0.21), '#8a4a2a'));
      F.head.push(paint(limb(0.16, 0.14, 0.2).translate(0, 0.1, 0), '#3a2a1f'), paint(aimed(limb(0.05, 0.06, 0.1), 0, -0.04, 0.2, 0, 0, 1), '#5a4a3c'));
      F.glow.head.push(...[-1, 1].map((s) => paint(ball(0.04).translate(s * 0.07, 0.04, 0.145), '#ff7a2a')));
      F.arm[0].push(paint(ball(0.08).translate(0, -0.33, 0.02), '#1a1210'));
      F.glow.arm[0].push(paint(ball(0.025).translate(0, -0.25, 0.02), '#ffb040'));
    },
  },
  drowned: {
    build: { bulk: 0.86, big: 1.04, lean: 0.46, arms: 0.8, long: 1.34 },
    dress(F, C) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 6.28;
        F.head.push(paint(aimed(spike(0.03, 0.26, 4), Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, Math.cos(a) * 0.4, -1, Math.sin(a) * 0.4), '#3a5a34'));
      }
      F.body.push(paint(new THREE.CylinderGeometry(0.15, 0.25, 0.26, 7, 1, true).translate(0, 0.26, 0), '#26321f'));
      F.glow.head.length = 0;
      F.glow.head.push(...[-1, 1].map((s) => paint(ball(0.03).translate(s * 0.06, 0.01, 0.145), '#a8d84a')));
    },
  },
  // ---- rulers ----
  chiefRuler: {
    build: { bulk: 1.12, big: 0.9, arms: 1.05 },
    dress(F, C) {
      F.body.push(paint(limb(0.23, 0.17, 0.38, 0.72).translate(0, 0.7, 0), '#a8863c'), paint(block(0.1, 0.1, 0.02).rotateZ(0.78).translate(0, 0.5, 0.15), '#a8201e'));
      for (const s of [-1, 1]) F.body.push(paint(ball(0.1, 1.05, 0.62, 1).translate(s * 0.25, 0.68, 0), '#8a6a2a'));
      F.body.push(paint(new THREE.CylinderGeometry(0.22, 0.44, 0.74, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8).translate(0, 0.32, -0.1), '#a8201e'));
      F.head.push(paint(ball(0.17, 1, 0.92, 1).translate(0, 0.06, 0), '#a8863c'));
      for (let i = 0; i < 6; i++) F.head.push(paint(aimed(spike(0.03, 0.2 + (i % 2) * 0.1, 5), -0.1 + i * 0.04, 0.17, -0.04, 0, 1, -0.2), i % 2 ? '#ffffff' : '#e03030'));
      F.arm[0].push(paint(block(0.05, 0.05, 0.96).translate(0, -0.3, 0.46), '#dfe6ee'), paint(block(0.2, 0.04, 0.05).translate(0, -0.3, 0.03), '#e8c050'));
    },
  },
  queen: {
    build: { bulk: 0.86, big: 0.96, robe: 0.42, thin: 0.84 },
    dress(F, C) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * 3.6 - 1.8;
        F.head.push(paint(aimed(spike(0.022, 0.16 + (i % 2) * 0.12, 4), Math.sin(a) * 0.15, 0.14, Math.cos(a) * 0.15, Math.sin(a) * 0.6, 1, Math.cos(a) * 0.3), i % 3 ? '#2a3a1e' : '#5fae62'));
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.28;
        F.body.push(paint(aimed(spike(0.03, 0.24, 4), Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3, Math.cos(a), 0.2, Math.sin(a)), '#5fae62'));
      }
      F.arm[0].push(paint(block(0.016, 0.016, 0.66).translate(0, -0.3, 0.32), '#dfe6ee'), paint(ball(0.04).translate(0, -0.3, 0.03), '#5fae62'));
    },
  },
};
// Which outfit a look wears, where the names differ.
const WEARS = { legion: 'legion', rime: 'rime', ruler: 'chiefRuler', thornqueen: 'queen' };

export function makeFigure(look, { sword = false } = {}) {
  const name = typeof look === 'string' ? look : Object.keys(LOOKS).find((k) => LOOKS[k] === look);
  const C = LOOKS[name] ?? look, outfit = OUTFITS[WEARS[name] ?? name] ?? OUTFITS.guard, B = { bulk: 1, big: 1, arms: 1, thin: 1, lean: 0, long: 1, ...outfit.build };
  const mat = toon(), group = new THREE.Group(), root = new THREE.Group();
  root.scale.setScalar(C.scale ?? 1);
  group.add(root);
  const torso = new THREE.Group();
  torso.rotation.x = B.lean;
  torso.position.y = HIP - 0.02;
  root.add(torso);

  const F = { body: [], head: [], arm: [[], []], leg: [[], []], glow: { head: [], arm: [[], []] } };
  // The body, before the outfit goes on. Anything above the hip leans with the torso.
  const w = 0.17 * B.bulk;
  F.body.push(
    paint(limb(w * 1.08, w * 0.9, 0.34, 0.7).translate(0, NECK - 0.04, 0), C.tunic),
    paint(limb(w * 0.94, w, 0.1, 0.74).translate(0, 0.36, 0), C.belt ?? C.pants),
    paint(ball(w, 1, 0.7, 0.76).translate(0, 0.28, 0), C.pants),
  );
  F.head.push(paint(limb(0.05, 0.06, 0.1).translate(0, -0.1, 0), C.skin), paint(ball(0.15, 0.96, 1.03, 1), C.skin));
  if (name !== 'drowned' && name !== 'rime') {
    F.head.push(paint(ball(0.158, 1, 0.8, 1).translate(0, 0.045, -0.02), C.hair));
    for (const s of [-1, 1]) F.head.push(paint(ball(0.024, 0.9, 1.25, 0.4).translate(s * 0.06, 0.005, 0.142), C.eye ?? '#1a1c2c'));
  }
  if (C.beard && name !== 'chief') F.head.push(paint(ball(0.1, 1, 0.8, 0.7).translate(0, -0.1, 0.08), C.beard));
  if (B.robe) F.body.push(paint(new THREE.CylinderGeometry(w * 1.1, w * (1 + CLOTH * 0.1), B.robe + 0.32, 12, 1, true).translate(0, 0.28 - B.robe / 2 + 0.02, 0), C.tunic));
  for (const i of [0, 1]) {
    F.leg[i].push(
      paint(limb(0.07 * B.thin, 0.052 * B.thin, 0.24), C.pants),
      paint(limb(0.056, 0.058, 0.08).translate(0, -0.22, 0), C.boots ?? '#3a2a1f'),
      paint(ball(0.056, 1, 0.55, 1.5).translate(0, -0.3, 0.03), C.boots ?? '#3a2a1f'),
    );
    F.arm[i].push(
      paint(limb(0.055 * B.arms, 0.046 * B.arms, 0.24 * B.long), C.tunicShade ?? C.tunic),
      paint(ball(0.05 * B.arms).translate(0, -0.27 * B.long, 0), C.skin),
    );
  }
  if (sword) F.arm[0].push(paint(block(0.15, 0.03, 0.04).translate(0, -0.29, 0.06), '#ffcd75'), paint(aimed(spike(0.03, 0.56, 4).scale(1, 1, 0.4), 0, -0.29, 0.06, 0, 0, 1), '#dfe6ee'));
  outfit.dress(F, C);

  skin(torso, F.body, mat, INK);
  const head = new THREE.Group();
  head.position.y = HEAD - HIP + 0.02;
  head.scale.setScalar(B.big);
  torso.add(head);
  skin(head, F.head, mat, INK);
  shine(head, F.glow.head);
  const arms = [-1, 1].map((side, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (0.215 * B.bulk), SHOULDER - HIP + 0.02, 0);
    pivot.rotation.order = 'YXZ';
    skin(pivot, F.arm[i], mat, INK);
    shine(pivot, F.glow.arm[i]);
    torso.add(pivot);
    return pivot;
  });
  const legs = [-1, 1].map((side, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.09 * B.bulk, HIP, 0);
    skin(pivot, F.leg[i], mat, INK);
    root.add(pivot);
    return pivot;
  });
  return { group, root, legs, arms, head, cape: null, mat };
}
