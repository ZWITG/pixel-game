import * as THREE from 'three';
import { toon, paint, ball, limb, spike, block, rock, aimed, skin, shine } from './kit.js';

// The Watchers' own bodies: taller than a person, armoured, each built around one sign that reads
// from far off (the Lantern's halo and light wings, the Anchor's floating stones, the Hush's fan
// collar and sound rings, the Echo's orbiting mirrors, the Thornwarden's antlers and roots).
// Same skeleton as every figure (`root`, `legs`, `arms`, `head`), so Enemy and walkPose drive it;
// `orbit` spins and `glows` can be recoloured (watchers.js). Front is +z.
const INK = 0.009;
const HIP = 0.5, SHOULDER = 0.92, HEAD = 1.12;

const PALETTES = {
  lantern: { armor: '#efe6cc', under: '#3a3426', trim: '#e8c050', glow: '#fff0a0', face: '#2a2418', cape: '#c89a3a', lining: '#fff6dc' },
  anchor: { armor: '#3a3450', under: '#15121f', trim: '#8a7ab8', glow: '#b090ff', face: '#0c0a14', cape: null },
  hush: { armor: '#cfe0ea', under: '#22344a', trim: '#5a7a94', glow: '#8fd8ff', face: '#eef6fb', cape: '#2a4a66', lining: '#9fc8e0' },
  echo: { armor: '#a8b0c8', under: '#1a1c28', trim: '#e8ecff', glow: '#ffffff', face: '#0e1018', cape: '#30344a', lining: '#e8ecff' },
  thornwarden: { armor: '#5a1c24', under: '#1a0a0c', trim: '#3a2a1a', glow: '#ff4a5a', face: '#120608', cape: 'tatters' },
};
const BARK = '#3a2a1a';

const plate = (w, h, d) => block(w, h, d);
const ringOf = (n, r, make, { y = 0, z = 0, plane = 'xy', from = 0, to = 6.283 } = {}) => Array.from({ length: n }, (_, i) => {
  const a = from + ((to - from) * i) / (to - from >= 6.28 ? n : n - 1);
  return plane === 'xy' ? make(a).translate(Math.cos(a) * r, y + Math.sin(a) * r, z) : make(a).translate(Math.cos(a) * r, y, z + Math.sin(a) * r);
});

export function makeWatcher(type) {
  const P = PALETTES[type] ?? PALETTES.echo, glowColor = P.glow;
  const mat = toon(), group = new THREE.Group(), root = new THREE.Group();
  group.add(root);
  const F = { body: [], head: [], arm: [[], []], leg: [[], []], orbit: [] };
  const G = { body: [], head: [], arm: [[], []], leg: [[], []], orbit: [] };
  const heavy = type === 'anchor' ? 1.25 : type === 'hush' ? 0.88 : 1;

  // ---- legs: armoured thigh, knee, greave and a pointed boot, with a line of light down the shin ----
  for (const i of [0, 1]) {
    F.leg[i].push(
      paint(limb(0.078 * heavy, 0.062 * heavy, 0.26), P.under),
      paint(limb(0.084 * heavy, 0.07 * heavy, 0.16).translate(0, -0.02, 0.006), P.armor),
      paint(ball(0.062 * heavy).translate(0, -0.26, 0.02), P.trim),
      paint(limb(0.07 * heavy, 0.055 * heavy, 0.22).translate(0, -0.27, 0.004), P.armor),
      paint(ball(0.064, 1, 0.55, 1.9).translate(0, -0.48, 0.05), P.under),
      paint(aimed(spike(0.03, 0.08, 5), 0, -0.48, 0.15, 0, 0, 1), P.trim),
    );
    G.leg[i].push(paint(block(0.014, 0.15, 0.012).translate(0, -0.36, 0.065 * heavy), glowColor));
  }

  // ---- torso: waist, layered plates, a sculpted chest with a core of light, pauldrons, coat panels ----
  const w = 0.2 * heavy;
  F.body.push(
    paint(limb(0.13 * heavy, 0.12 * heavy, 0.14).translate(0, 0.14, 0), P.under),
    paint(limb(0.135 * heavy, 0.13 * heavy, 0.045).translate(0, 0.03, 0), P.trim),
    ...[0, 1, 2].map((k) => paint(plate(0.2 * heavy - k * 0.02, 0.05, 0.03).translate(0, 0.1 + k * 0.055, 0.12 * heavy), P.armor)),
    paint(ball(w, 1.12, 0.92, 0.78).translate(0, 0.32, 0), P.armor),
    paint(ball(w * 0.82, 1.1, 0.7, 0.7).translate(0, 0.33, -0.03), P.under),
    paint(limb(0.09, 0.11, 0.08).translate(0, 0.5, 0), P.trim),
  );
  // Coat: front and back panels and two tails, split so the legs show.
  for (const [z, tilt] of [[0.13, 0.12], [-0.13, -0.18]]) F.body.push(paint(plate(0.22 * heavy, 0.46, 0.02).translate(0, -0.2, 0).rotateX(tilt).translate(0, 0.02, z * heavy), z > 0 ? P.under : P.armor));
  for (const s of [-1, 1]) F.body.push(paint(plate(0.07, 0.4, 0.018).translate(0, -0.18, 0).rotateZ(s * 0.18).translate(s * 0.15 * heavy, 0.02, -0.06), P.trim));
  // Pauldrons, each with a rim.
  for (const s of [-1, 1]) {
    F.body.push(
      paint(ball(0.11 * heavy, 1.35, 0.78, 1.15).translate(s * 0.27 * heavy, 0.43, 0), P.armor),
      paint(ball(0.115 * heavy, 1.38, 0.32, 1.18).translate(s * 0.27 * heavy, 0.39, 0), P.trim),
    );
  }
  G.body.push(paint(ball(0.05).translate(0, 0.32, 0.15 * heavy), glowColor));
  // Hip plates, flaring out over the thighs.
  for (const [a, wide] of [[0.5, 0.12], [-0.5, 0.12], [2.2, 0.1], [-2.2, 0.1]]) {
    F.body.push(paint(plate(wide * heavy, 0.17, 0.02).translate(0, -0.085, 0).rotateX(0.28).rotateY(a).translate(Math.sin(a) * 0.13 * heavy, 0.02, Math.cos(a) * 0.13 * heavy), P.armor));
  }
  // A cape from the shoulders to the ground: two panels, the lower one flaring back, with a lit hem.
  if (P.cape === 'tatters') {
    for (let k = 0; k < 7; k++) F.body.push(paint(plate(0.06, 0.55 + (k % 3) * 0.18, 0.016).translate(0, -(0.55 + (k % 3) * 0.18) / 2, 0).rotateX(-0.12).translate((k - 3) * 0.055 * heavy, 0.46, -0.15 * heavy), k % 2 ? P.armor : P.trim));
  } else if (P.cape) {
    F.body.push(
      paint(plate(0.42 * heavy, 0.5, 0.02).translate(0, -0.25, 0).rotateX(-0.08).translate(0, 0.48, -0.16 * heavy), P.cape),
      paint(plate(0.5 * heavy, 0.44, 0.02).translate(0, -0.22, 0).rotateX(-0.22).translate(0, -0.01, -0.2 * heavy), P.cape),
      paint(plate(0.4 * heavy, 0.48, 0.02).translate(0, -0.25, 0).rotateX(-0.08).translate(0, 0.48, -0.145 * heavy), P.lining),
    );
    G.body.push(paint(plate(0.5 * heavy, 0.025, 0.024).translate(0, -0.44, 0).rotateX(-0.22).translate(0, -0.01, -0.2 * heavy), glowColor));
    for (const s of [-1, 1]) F.body.push(paint(ball(0.035).translate(s * 0.17 * heavy, 0.47, 0.06), P.trim));
  }

  // ---- head: neck, helm, dark faceplate, a band of light for eyes ----
  F.head.push(
    paint(limb(0.05, 0.06, 0.1).translate(0, -0.08, 0), P.under),
    paint(ball(0.135, 0.95, 1.1, 1.05).translate(0, 0.02, 0), P.armor),
    paint(ball(0.115, 0.98, 1.05, 0.62).translate(0, 0.0, 0.055), P.face),
    paint(block(0.2, 0.03, 0.2).translate(0, 0.075, 0), P.trim),
  );
  G.head.push(paint(block(0.15, 0.022, 0.02).translate(0, 0.015, 0.125), glowColor));

  // ---- arms: sleeve, elbow, gauntlet, hand with a glowing palm ----
  for (const i of [0, 1]) {
    F.arm[i].push(
      paint(limb(0.058 * heavy, 0.05 * heavy, 0.22), P.under),
      paint(ball(0.054 * heavy).translate(0, -0.23, 0), P.trim),
      paint(limb(0.062 * heavy, 0.054 * heavy, 0.2).translate(0, -0.24, 0), P.armor),
      paint(limb(0.068 * heavy, 0.066 * heavy, 0.04).translate(0, -0.42, 0), P.trim),
      paint(ball(0.056 * heavy, 1, 1.15, 0.85).translate(0, -0.49, 0.01), P.armor),
    );
    G.arm[i].push(paint(ball(0.026).translate(0, -0.5, 0.045 * heavy), glowColor));
  }

  // ---- each one's sign ----
  if (type === 'lantern') {
    // A segmented halo behind the head, a crest, light-blade wings, a caged core.
    G.head.push(...ringOf(20, 0.32, (a) => paint(block(0.06, 0.026, 0.026).rotateZ(a + Math.PI / 2), glowColor), { y: 0.1, z: -0.17 }));
    G.head.push(...ringOf(12, 0.42, (a) => paint(aimed(spike(0.018, 0.1, 4), 0, 0, 0, Math.cos(a), Math.sin(a), 0), '#ffffff'), { y: 0.1, z: -0.17 }));
    F.head.push(...ringOf(10, 0.26, (a) => paint(block(0.035, 0.035, 0.02).rotateZ(a), P.trim), { y: 0.1, z: -0.16 }));
    F.head.push(paint(plate(0.016, 0.14, 0.22).translate(0, 0.16, -0.02), P.trim));
    G.head.push(paint(aimed(spike(0.022, 0.18, 4), 0, 0.14, 0.02, 0, 1, 0.25), glowColor));
    for (const s of [-1, 1]) for (const [k, len] of [[0, 0.95], [1, 0.75], [2, 0.55], [3, 0.38]]) {
      G.body.push(paint(aimed(spike(0.06, len, 4).scale(1, 1, 0.22), s * 0.1, 0.42 - k * 0.07, -0.16, s * (0.9 - k * 0.15), 0.75 - k * 0.35, -0.35), k === 0 ? '#ffffff' : glowColor));
    }
    G.body.push(paint(ball(0.07).translate(0, 0.32, 0.15), glowColor));
    F.body.push(...[-1, 1].map((s) => paint(block(0.016, 0.16, 0.016).translate(s * 0.06, 0.32, 0.19), P.trim)), paint(block(0.14, 0.016, 0.016).translate(0, 0.32, 0.2), P.trim));
  }
  if (type === 'anchor') {
    // Stone on the shoulders, a crown of floating stones, chains at the wrists, a ring of orbiting rock.
    for (const s of [-1, 1]) F.body.push(paint(rock(0.09).scale(1.3, 0.8, 1).translate(s * 0.34, 0.52, 0), '#4a4458'), paint(rock(0.06).translate(s * 0.3, 0.58, -0.06), '#5a546a'));
    F.head.push(...ringOf(5, 0.2, () => paint(rock(0.05), '#4a4458'), { y: 0.3, plane: 'xz' }));
    for (const s of [-1, 1]) F.head.push(paint(aimed(spike(0.035, 0.2, 6), s * 0.12, 0.06, 0, s, 0.7, 0), P.trim));
    G.head.push(...ringOf(5, 0.16, () => paint(ball(0.014), glowColor), { y: 0.215, plane: 'xz' }));
    for (const i of [0, 1]) for (let k = 0; k < 4; k++) F.arm[i].push(paint(block(0.03, 0.05, 0.015).rotateY(k % 2 ? 1.57 : 0).translate(0, -0.54 - k * 0.05, -0.02), '#6a6478'));
    G.body.push(paint(ball(0.075).translate(0, 0.32, 0.15), glowColor));
    F.body.push(...ringOf(10, 0.1, () => paint(block(0.03, 0.03, 0.03), '#0c0a14'), { y: 0.32, z: 0.17 }));
    F.orbit.push(...ringOf(7, 0.6, (a) => paint(rock(0.05 + (a % 1) * 0.03), '#4a4458'), { y: 0.75, plane: 'xz' }));
    G.orbit.push(...ringOf(7, 0.6, () => paint(ball(0.02), glowColor), { y: 0.81, plane: 'xz' }));
  }
  if (type === 'hush') {
    // A tall fan collar around a smooth mask, three rings of sound on the back, tuning-fork blades.
    F.body.push(...ringOf(9, 0.15, (a) => paint(plate(0.06, 0.26, 0.015).rotateY(-a + Math.PI / 2).rotateX(-0.25), P.armor), { y: 0.62, plane: 'xz', from: Math.PI + 0.15, to: 2 * Math.PI - 0.15 }));
    F.head.length = 1;
    F.head.push(paint(ball(0.13, 0.95, 1.18, 1.02).translate(0, 0.03, 0), P.face), paint(ball(0.134, 0.97, 0.3, 1.04).translate(0, 0.1, 0), P.trim));
    G.head.length = 0;
    G.head.push(...[-1, 1].map((s) => paint(ball(0.016, 1, 2.2, 0.6).translate(s * 0.045, 0.03, 0.125), glowColor)));
    for (const [r, n] of [[0.1, 10], [0.18, 16], [0.26, 22]]) G.body.push(...ringOf(n, r, (a) => paint(block(0.03, 0.012, 0.012).rotateZ(a + Math.PI / 2), glowColor), { y: 0.3, z: -0.19 }));
    for (const i of [0, 1]) for (const s of [-1, 1]) {
      F.arm[i].push(paint(block(0.014, 0.3, 0.02).translate(s * 0.025, -0.68, 0.03), P.trim));
      G.arm[i].push(paint(block(0.016, 0.05, 0.022).translate(s * 0.025, -0.84, 0.03), glowColor));
    }
  }
  if (type === 'echo') {
    // Faceted, mirrored, a face on both sides, and mirror shards orbiting it (glow takes the hero's colour).
    F.body.push(paint(new THREE.OctahedronGeometry(0.2, 0).scale(1.1, 1.05, 0.8).translate(0, 0.33, 0.02), P.armor));
    for (const s of [-1, 1]) F.body.push(paint(new THREE.OctahedronGeometry(0.08, 0).scale(1, 1.6, 1).translate(s * 0.3, 0.5, 0), P.trim));
    F.head.splice(1, 2, paint(new THREE.OctahedronGeometry(0.15, 0).scale(0.95, 1.15, 0.95).translate(0, 0.02, 0), P.armor));
    G.head.push(paint(block(0.15, 0.022, 0.02).translate(0, 0.015, -0.12), glowColor));
    for (const s of [-1, 1]) F.head.push(paint(aimed(spike(0.03, 0.24, 4).scale(1, 1, 0.3), s * 0.1, 0.06, -0.02, s * 0.5, 0.5, -1), P.trim));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.283, y = 0.45 + (k % 3) * 0.2, r = 0.5 + (k % 2) * 0.08;
      F.orbit.push(paint(new THREE.OctahedronGeometry(0.06, 0).scale(0.5, 1.6, 1).rotateY(-a).translate(Math.cos(a) * r, y, Math.sin(a) * r), P.armor));
      G.orbit.push(paint(new THREE.OctahedronGeometry(0.02, 0).scale(0.5, 1.6, 1).rotateY(-a).translate(Math.cos(a) * (r + 0.035), y, Math.sin(a) * (r + 0.035)), glowColor));
    }
  }
  if (type === 'thornwarden') {
    // Antlers of thorn, roots trailing from the arms and coat, veins of blood light, claws.
    for (const s of [-1, 1]) {
      F.head.push(paint(aimed(limb(0.032, 0.016, 0.42), s * 0.08, 0.1, -0.02, s * 0.6, 1, -0.2), BARK));
      for (const [t, len] of [[0.12, 0.2], [0.2, 0.17], [0.27, 0.14], [0.34, 0.1]]) F.head.push(paint(aimed(spike(0.018, len, 4), s * (0.08 + t * 0.5), 0.1 + t * 0.85, -0.02 - t * 0.15, s * 0.2, 1, 0.3), BARK));
      G.head.push(paint(ball(0.02).translate(s * 0.29, 0.47, -0.1), glowColor));
    }
    for (const i of [0, 1]) {
      for (let k = 0; k < 3; k++) F.arm[i].push(paint(aimed(spike(0.012, 0.12, 4), (k - 1) * 0.025, -0.53, 0.03, (k - 1) * 0.2, -1, 0.4), '#e8dcc0'));
      for (let k = 0; k < 3; k++) F.arm[i].push(paint(aimed(limb(0.012, 0.004, 0.28), (k - 1) * 0.03, -0.2, -0.05, (k - 1) * 0.15, -1, -0.3), BARK));
      G.arm[i].push(paint(block(0.01, 0.16, 0.01).translate(0, -0.32, 0.06), glowColor));
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.283;
      F.body.push(paint(aimed(limb(0.016, 0.004, 0.3 + (k % 3) * 0.08), Math.cos(a) * 0.15, -0.18, Math.sin(a) * 0.15, Math.cos(a) * 0.3, -1, Math.sin(a) * 0.3), BARK));
      F.body.push(paint(aimed(spike(0.016, 0.1, 4), Math.cos(a) * 0.2, 0.25 + (k % 3) * 0.08, Math.sin(a) * 0.17, Math.cos(a), 0.3, Math.sin(a)), BARK));
    }
    G.body.push(paint(ball(0.06, 1, 1.2, 1).translate(0, 0.33, 0.15), glowColor), ...[-1, 1].map((s) => paint(block(0.012, 0.22, 0.012).rotateZ(s * 0.5).translate(s * 0.08, 0.3, 0.16), glowColor)));
  }

  // ---- assemble ----
  const glows = [];
  const hang = (bone, parts, lights) => {
    skin(bone, parts, mat, INK);
    const m = shine(bone, lights);
    if (m) glows.push(m);
  };
  const torso = new THREE.Group();
  torso.position.y = HIP;
  torso.rotation.x = type === 'thornwarden' ? 0.22 : type === 'anchor' ? 0.06 : 0;
  root.add(torso);
  hang(torso, F.body, G.body);
  const head = new THREE.Group();
  head.position.y = HEAD - HIP;
  head.scale.setScalar(0.86);
  torso.add(head);
  hang(head, F.head, G.head);
  const arms = [-1, 1].map((side, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27 * heavy, SHOULDER - HIP, 0);
    pivot.rotation.order = 'YXZ';
    hang(pivot, F.arm[i], G.arm[i]);
    torso.add(pivot);
    return pivot;
  });
  const legs = [-1, 1].map((side, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1 * heavy, HIP, 0);
    hang(pivot, F.leg[i], G.leg[i]);
    root.add(pivot);
    return pivot;
  });
  const orbit = new THREE.Group();
  root.add(orbit);
  hang(orbit, F.orbit, G.orbit);
  return { group, root, legs, arms, head, torso, orbit, glows, cape: null, mat, hover: type === 'lantern' || type === 'echo' || type === 'hush' ? 0.08 : 0 };
}
