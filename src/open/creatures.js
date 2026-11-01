import * as THREE from 'three';
import { toon, paint, ball, limb, spike, block, rock, aimed, skin, shine } from './kit.js';

// Monsters, each sculpted to be known by its outline alone. A creature fills in the parts lists
// and gets back what Enemy expects: { group, root, mat, legs, hover, sway }, and `tick(t, moving)`
// for anything it does beyond walking. Forward is +z, about a tile in size; bosses are huge.
const INK = 0.012;

function make(draw) {
  const group = new THREE.Group(), root = new THREE.Group(), mat = toon(), m = { group, root, mat, legs: [] };
  group.add(root);
  const body = [], glow = [];
  m.bone = (name, x, y, z, parts, lit = []) => {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    skin(b, parts, mat, INK);
    shine(b, lit);
    root.add(b);
    m[name] = b;
    return b;
  };
  m.leg = (x, y, z, parts) => {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    skin(b, parts, mat, INK);
    root.add(b);
    m.legs.push(b);
    return b;
  };
  draw(m, body, glow);
  skin(root, body, mat, INK);
  shine(root, glow);
  if (!m.legs.length) delete m.legs;
  if (m.hover) root.position.y = m.hover;
  return m;
}

const eyes = (glow, x, y, z, r, color) => { for (const s of [-1, 1]) glow.push(paint(ball(r).translate(s * x, y, z), color)); };

const CREATURES = {
  // A clear dome of jelly with something dark inside; the fire kind is a crusted coal.
  slime: (m, body, glow, def) => {
    const fire = def.colors === 'fire', main = fire ? '#3a1c14' : '#46c47c', hi = fire ? '#ff7a2a' : '#a8f0a0';
    body.push(paint(ball(0.42, 1.1, 0.74, 1.1).translate(0, 0.3, 0), main), paint(ball(0.3, 1, 0.5, 1).translate(0, 0.54, 0), main), paint(ball(0.1, 1.4, 0.6, 1).translate(0.14, 0.62, 0.1), hi));
    for (let i = 0; i < 6; i++) body.push(paint(ball(0.07, 1, 0.8, 1).translate(Math.cos(i) * 0.44, 0.07, Math.sin(i) * 0.44), main));
    eyes(body, 0.15, 0.38, 0.4, 0.09, '#f4f4f4');
    eyes(glow, 0.15, 0.38, 0.47, 0.045, fire ? '#ffd24a' : '#141a28');
    if (fire) for (let i = 0; i < 7; i++) glow.push(paint(block(0.05, 0.22, 0.03).rotateZ(i).translate(Math.cos(i * 2) * 0.32, 0.3 + (i % 3) * 0.1, Math.sin(i * 2) * 0.34), '#ff7a2a'));
    m.tick = (t) => { m.root.scale.set(1 + Math.sin(t * 5) * 0.05, 1 - Math.sin(t * 5) * 0.07, 1 + Math.sin(t * 5) * 0.05); };
  },
  // A walking toadstool with a sleepy, grumpy face under a spotted cap.
  mushroom: (m, body, glow, def) => {
    const small = def.name?.includes('Sporeling'), cap = small ? '#c86ad8' : '#b83a5a';
    body.push(paint(limb(0.17, 0.22, 0.42).translate(0, 0.56, 0), '#e8dcc0'), paint(ball(0.42, 1.06, 0.62, 1.06).translate(0, 0.66, 0), cap), paint(ball(0.36, 1.05, 0.2, 1.05).translate(0, 0.58, 0), '#d8c8a0'));
    for (let i = 0; i < 7; i++) body.push(paint(ball(0.07, 1, 0.5, 1).translate(Math.cos(i * 2.1) * (0.12 + i * 0.04), 0.86 - i * 0.012, Math.sin(i * 2.1) * (0.12 + i * 0.04)), '#f4ecd8'));
    eyes(body, 0.08, 0.36, 0.17, 0.035, '#141a28');
    for (const s of [-1, 1]) m.leg(s * 0.1, 0.16, 0, [paint(ball(0.08, 1, 1, 1.4).translate(0, -0.08, 0.03), '#d8c8a0')]);
  },
  // All shoulders and back: a wall of black thorns, a low snout and two great tusks.
  boar: (m, body, glow) => {
    body.push(paint(ball(0.4, 0.92, 0.86, 1.3).translate(0, 0.52, -0.06), '#5a3a2c'), paint(ball(0.3, 1, 0.86, 1.1).translate(0, 0.46, 0.46), '#6a4634'), paint(limb(0.1, 0.13, 0.14).rotateX(1.57).translate(0, 0.4, 0.78), '#8a6a54'));
    for (const s of [-1, 1]) body.push(paint(aimed(spike(0.05, 0.34), s * 0.13, 0.32, 0.72, s * 0.3, 1, 0.5), '#ece0c8'));
    for (let i = 0; i < 9; i++) body.push(paint(aimed(spike(0.07, 0.36 - Math.abs(i - 4) * 0.03, 5), 0, 0.84 - Math.abs(i - 4) * 0.02, 0.42 - i * 0.12, 0, 1, -0.5), i % 2 ? '#1e1612' : '#3a2820'));
    eyes(glow, 0.15, 0.56, 0.72, 0.03, '#ff4a2a');
    for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.36], [0.2, -0.36]]) m.leg(x, 0.3, z, [paint(limb(0.09, 0.07, 0.3), '#3a281e')]);
  },
  // A lit ball of cold fire with rings of ash turning around it.
  wisp: (m, body, glow) => {
    m.hover = 0.9;
    glow.push(paint(ball(0.22), '#9fe8ff'), paint(aimed(spike(0.16, 0.5), 0, 0.12, 0, 0, 1, -0.2), '#dff8ff'));
    m.bone('ring', 0, 0, 0, [paint(new THREE.TorusGeometry(0.44, 0.022, 6, 22).rotateX(1.3), '#2a3a5a'), ...[0, 2.1, 4.2].map((a) => paint(rock(0.075).translate(Math.cos(a) * 0.44, Math.sin(a) * 0.1, Math.sin(a) * 0.43), '#3a4a6a'))]);
    m.tick = (t) => { m.ring.rotation.y = t * 2.2; };
  },
  // Lean as a blade, shoulders higher than its head, with burning eyes.
  wolf: (m, body, glow) => {
    body.push(paint(ball(0.26, 0.82, 0.9, 1.56).translate(0, 0.58, -0.05), '#3a3e52'), paint(ball(0.24, 1, 1.1, 1).translate(0, 0.72, 0.28), '#2a2e40'), paint(ball(0.17, 0.9, 0.9, 1.05).translate(0, 0.72, 0.58), '#4a4e62'), paint(limb(0.07, 0.1, 0.24).rotateX(1.57).translate(0, 0.66, 0.84), '#2a2e40'));
    for (const s of [-1, 1]) body.push(paint(aimed(spike(0.06, 0.24, 5), s * 0.1, 0.84, 0.54, s * 0.2, 1, -0.3), '#1e2030'));
    for (let i = 0; i < 6; i++) body.push(paint(aimed(spike(0.06, 0.24, 4), Math.sin(i) * 0.05, 0.84 - i * 0.03, 0.34 - i * 0.14, 0, 0.8, -1), '#6a7088'));
    for (let i = 0; i < 4; i++) body.push(paint(ball(0.09 - i * 0.012, 1, 1, 1.6).translate(0, 0.62 + i * 0.05, -0.5 - i * 0.16), '#6a7088'));
    eyes(glow, 0.08, 0.77, 0.72, 0.026, '#ffd24a');
    for (const [x, z] of [[-0.13, 0.32], [0.13, 0.32], [-0.13, -0.32], [0.13, -0.32]]) m.leg(x, 0.46, z, [paint(limb(0.06, 0.035, 0.44), '#1e2030'), paint(ball(0.05, 1, 0.6, 1.4).translate(0, -0.44, 0.03), '#1e2030')]);
  },
  // A hunched heap of boulders with fists bigger than its body and one crystal heart.
  golem: (m, body, glow) => {
    body.push(paint(rock(0.5).scale(1, 0.95, 0.8).translate(0, 1, 0), '#6e625a'), paint(rock(0.36).translate(0, 1.42, -0.12), '#5a4e48'), paint(rock(0.22).translate(0, 1.1, 0.42), '#7c6e64'));
    for (const s of [-1, 1]) body.push(paint(rock(0.28).translate(s * 0.62, 1.32, 0), '#7c6e64'), paint(rock(0.16).translate(s * 0.76, 0.94, 0.08), '#5a4e48'), paint(rock(0.34).translate(s * 0.82, 0.5, 0.16), '#8a7c70'));
    glow.push(paint(new THREE.OctahedronGeometry(0.15).scale(1, 1.4, 0.7).translate(0, 1.06, 0.5), '#7fe3c0'));
    eyes(glow, 0.09, 1.26, 0.36, 0.035, '#7fe3c0');
    for (const s of [-1, 1]) m.leg(s * 0.26, 0.6, 0, [paint(rock(0.27).translate(0, -0.3, 0), '#5a4e48')]);
  },
  // Plated and low, pincers wide, its sting arched high over its back.
  scorpion: (m, body, glow) => {
    for (let i = 0; i < 5; i++) body.push(paint(ball(0.34 - i * 0.03, 1.08, 0.5, 0.7).translate(0, 0.27, 0.34 - i * 0.2), i % 2 ? '#8e4a24' : '#b4602c'));
    const tail = [[0, 0.42, -0.62], [0, 0.66, -0.74], [0, 0.92, -0.7], [0, 1.1, -0.52], [0, 1.16, -0.3]];
    tail.forEach(([x, y, z], i) => body.push(paint(ball(0.13 - i * 0.012), i % 2 ? '#8e4a24' : '#b4602c').translate(x, y, z)));
    glow.push(paint(aimed(spike(0.06, 0.28, 5), 0, 1.12, -0.2, 0, -0.5, 1), '#ffd24a'));
    for (const s of [-1, 1]) {
      body.push(paint(limb(0.06, 0.05, 0.42).rotateX(1.3).rotateY(s * 0.5).translate(s * 0.28, 0.28, 0.46), '#8e4a24'), paint(ball(0.15, 1.1, 0.7, 1.4).translate(s * 0.5, 0.3, 0.86), '#b4602c'));
      body.push(paint(aimed(spike(0.05, 0.3, 5), s * 0.46, 0.3, 1.0, -s * 0.5, 0, 1), '#3a1c10'), paint(aimed(spike(0.05, 0.3, 5), s * 0.58, 0.3, 1.0, -s * 0.2, 0, 1), '#3a1c10'));
      for (const z of [0.2, -0.04, -0.28]) m.leg(s * 0.34, 0.22, z, [paint(aimed(limb(0.03, 0.018, 0.4), 0, 0, 0, s, 0.9, 0).translate(s * 0.08, 0, 0), '#6a3a1c')]);
    }
    eyes(glow, 0.09, 0.36, 0.62, 0.028, '#141a28');
  },
  // Most of it is mouth: a wide flat toad with teeth, and a lure hanging on a stalk.
  lurker: (m, body, glow) => {
    body.push(paint(ball(0.48, 1.1, 0.52, 1.2).translate(0, 0.28, -0.02), '#2e4a2a'), paint(ball(0.4, 1.2, 0.3, 0.86).translate(0, 0.44, 0.4), '#3e5a34'), paint(ball(0.4, 1.2, 0.2, 0.86).translate(0, 0.14, 0.42), '#2a3e24'), paint(ball(0.3, 1.2, 0.24, 0.8).translate(0, 0.27, 0.44), '#8a1a24'));
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * 2.6 - 1.3;
      body.push(paint(aimed(spike(0.03, 0.12, 4), Math.sin(a) * 0.44, 0.32, 0.42 + Math.cos(a) * 0.34, 0, -1, 0), '#ece0c8'), paint(aimed(spike(0.03, 0.1, 4), Math.sin(a) * 0.42, 0.18, 0.42 + Math.cos(a) * 0.32, 0, 1, 0), '#ece0c8'));
    }
    for (const s of [-1, 1]) body.push(paint(ball(0.1).translate(s * 0.22, 0.6, 0.3), '#3e5a34'));
    eyes(glow, 0.22, 0.63, 0.37, 0.05, '#d8e06a');
    body.push(paint(limb(0.016, 0.016, 0.6).rotateX(-0.8).translate(0, 0.96, 0.32), '#2a3e24'));
    glow.push(paint(ball(0.07).translate(0, 0.64, 0.78), '#a8ff7a'));
    for (const s of [-1, 1]) m.leg(s * 0.42, 0.14, -0.26, [paint(ball(0.13, 1.2, 0.5, 1.6), '#2a3e24')]);
  },
  // Nothing under the hood but two points of cold, and a robe that tears off into the air.
  wraith: (m, body, glow) => {
    m.hover = 0.3;
    const robe = new THREE.CylinderGeometry(0.2, 0.52, 1.1, 12, 3, true), p = robe.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      if (p.getY(i) < -0.5) p.setY(i, p.getY(i) - Math.max(0, Math.sin(a * 6)) * 0.3);
    }
    body.push(paint(robe.translate(0, 0.62, 0), '#9fc8ec'), paint(ball(0.26, 1, 1.15, 1.1).translate(0, 1.26, 0), '#dff4ff'), paint(ball(0.19, 1, 1.1, 0.5).translate(0, 1.22, 0.2), '#0a1020'));
    eyes(glow, 0.07, 1.25, 0.3, 0.03, '#8fe0ff');
    for (const s of [-1, 1]) {
      body.push(paint(aimed(limb(0.05, 0.03, 0.62), s * 0.22, 1, 0.08, s * 0.6, 0.4, 0.5), '#9fc8ec'));
      for (const k of [-0.05, 0, 0.05]) body.push(paint(aimed(spike(0.016, 0.16, 4), s * 0.56 + k, 0.76, 0.34, s * 0.4, -1, 0.5), '#dff4ff'));
    }
  },
  // Leather wings wider than it is long, carrying a fanged little skull of a head.
  bat: (m, body, glow) => {
    m.hover = 1.1;
    body.push(paint(ball(0.15, 0.9, 1, 1.2).translate(0, 0, 0), '#3a2c4a'), paint(ball(0.12).translate(0, 0.08, 0.15), '#4a3a5c'));
    for (const s of [-1, 1]) body.push(paint(aimed(spike(0.05, 0.2, 4), s * 0.07, 0.17, 0.12, s * 0.3, 1, 0), '#2a2038'), paint(aimed(spike(0.012, 0.07, 4), s * 0.03, 0, 0.26, 0, -1, 0), '#f4f4f4'));
    eyes(glow, 0.05, 0.11, 0.255, 0.018, '#ff5a5a');
    const wing = (s) => {
      const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, s * 0.74, 0.14, 0.05, 0, 0, -0.16, s * 0.74, 0.14, 0.05, s * 0.5, -0.1, -0.3, 0, 0, -0.16, s * 0.74, 0.14, 0.05, s * 0.86, -0.08, -0.26, s * 0.5, -0.1, -0.3], 3));
      tri.computeVertexNormals();
      return new THREE.Mesh(tri, new THREE.MeshToonMaterial({ color: '#2a2038', side: THREE.DoubleSide }));
    };
    m.wings = [-1, 1].map((s) => {
      const w = new THREE.Group();
      w.add(wing(s));
      m.root.add(w);
      return w;
    });
    m.tick = (t) => { m.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(t * 16) * 0.6; }); };
  },
  // A walking grave: a vast skull for a chest, the jaw hanging open, ribs for hands.
  colossus: (m, body, glow) => {
    const bone = '#d8ccb0', dark = '#7c6a54';
    body.push(paint(rock(0.8).scale(1, 0.8, 0.9).translate(0, 1.2, 0), '#5a4638'), paint(ball(0.62, 1, 0.82, 0.96).translate(0, 1.76, 0.2), bone), paint(ball(0.44, 1.1, 0.28, 0.9).translate(0, 1.14, 0.46), bone), paint(ball(0.4, 1.1, 0.4, 0.5).translate(0, 1.42, 0.5), '#1a1210'));
    for (const s of [-1, 1]) {
      body.push(paint(ball(0.17, 1, 0.9, 0.5).translate(s * 0.26, 1.84, 0.74), '#1a1210'), paint(aimed(spike(0.15, 1, 7), s * 0.46, 2.08, 0.24, s * 0.8, 1, 0.1), bone), paint(aimed(limb(0.13, 0.1, 1), s * 0.76, 1.58, 0, s * 0.3, -1, 0.1), dark));
      for (let i = 0; i < 4; i++) body.push(paint(aimed(spike(0.05, 0.56), s * 0.28, 0.92, 0.24 - i * 0.2, s * 0.9, -0.2, 0), bone));
      for (let i = 0; i < 3; i++) body.push(paint(aimed(spike(0.06, 0.5, 5), s * (0.9 + i * 0.05), 0.6, 0.1 + (i - 1) * 0.14, s * 0.2, -1, (i - 1) * 0.3), bone));
    }
    for (let i = 0; i < 7; i++) body.push(paint(aimed(spike(0.04, 0.2, 4), -0.33 + i * 0.11, 1.28, 0.74, 0, 1, 0), bone));
    eyes(glow, 0.26, 1.84, 0.8, 0.075, '#ff7a3a');
    for (const s of [-1, 1]) m.leg(s * 0.4, 0.82, 0, [paint(limb(0.24, 0.18, 0.82), dark), paint(ball(0.26, 1, 0.5, 1.3).translate(0, -0.76, 0.1), bone)]);
  },
  // A great serpent risen out of the mud, fanned hood open, swaying on its coils.
  wyrm: (m, body, glow) => {
    m.sway = true;
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      body.push(paint(ball(0.52 - t * 0.14, 1, 0.8, 1).translate(Math.sin(t * 3.6) * 0.18, 0.3 + t * 1.8, -0.3 + t * 0.7 - Math.sin(t * 3) * 0.2), i % 2 ? '#3a5a30' : '#5a7a3a'));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.28 + 0.4;
      body.push(paint(ball(0.56, 1, 0.5, 1).translate(Math.cos(a) * 0.86, 0.26, Math.sin(a) * 0.86 - 0.3), '#2e4a2a'));
    }
    body.push(paint(ball(0.42, 1.02, 0.72, 1.3).translate(0, 2.2, 0.56), '#5a7a3a'), paint(ball(0.3, 1.1, 0.26, 0.9).translate(0, 2.02, 0.76), '#c84a5a'));
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * 2.4 - 1.2;
      body.push(paint(aimed(spike(0.09, 0.72, 5), Math.sin(a) * 0.3, 2.3, 0.22, Math.sin(a) * 1.2, Math.cos(a) * 0.9, -0.6), i % 2 ? '#a8d84a' : '#3a5a30'));
    }
    for (const s of [-1, 1]) body.push(paint(aimed(spike(0.06, 0.34, 5), s * 0.2, 1.98, 0.98, 0, -1, 0.2), '#ece0c8'));
    eyes(glow, 0.27, 2.34, 0.82, 0.07, '#d8e06a');
  },
  // The Rime King: crowned, faceless, a mantle of ice and a sword as tall as a house.
  warden: (m, body, glow) => {
    const ice = '#bfeaff', deep = '#3a6a8c';
    body.push(paint(limb(0.46, 0.72, 1.3).translate(0, 1.32, 0), deep), paint(limb(0.62, 0.46, 0.62, 0.8).translate(0, 2.06, 0), '#dff4ff'), paint(ball(0.36, 1, 1.1, 1).translate(0, 2.3, 0.04), '#0a1a2a'));
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * 3.14 + 3.14;
      body.push(paint(aimed(spike(0.11, 1.1, 5), Math.cos(a) * 0.5, 1.5, Math.sin(a) * 0.46, Math.cos(a) * 0.25, -1, Math.sin(a) * 0.25), i % 2 ? ice : deep));
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28;
      body.push(paint(aimed(spike(0.07, 0.42 + (i % 2) * 0.34, 5), Math.cos(a) * 0.28, 2.6, Math.sin(a) * 0.28, Math.cos(a) * 0.2, 1, Math.sin(a) * 0.2), ice));
    }
    for (const s of [-1, 1]) {
      body.push(paint(ball(0.3, 1.1, 0.7, 1).translate(s * 0.76, 2.1, 0), '#dff4ff'), paint(aimed(limb(0.17, 0.12, 0.86), s * 0.8, 2, 0.04, s * 0.1, -1, 0.2), deep));
      for (let i = 0; i < 3; i++) body.push(paint(aimed(spike(0.08, 0.6 - i * 0.1, 5), s * (0.68 + i * 0.14), 2.26, -0.1 + i * 0.1, s * 0.5, 1, -0.2), ice));
    }
    body.push(paint(aimed(spike(0.17, 3.4, 4), 0.92, 0.1, 0.36, 0, 1, 0).scale(1, 1, 0.5), '#dff4ff'), paint(block(0.72, 0.1, 0.14).translate(0.92, 1.1, 0.2), deep));
    eyes(glow, 0.13, 2.32, 0.34, 0.05, '#8fe0ff');
  },
  // Emberhorn: a bull of burnt rock, split with fire, its horns longer than its legs.
  emberhorn: (m, body, glow) => {
    const hide = '#2a1a1e', crust = '#46302c';
    body.push(paint(ball(0.84, 0.86, 0.8, 1.26).translate(0, 1.16, -0.2), hide), paint(ball(0.74, 1, 1, 0.8).translate(0, 1.5, 0.52), crust), paint(ball(0.42, 1, 0.86, 1.1).translate(0, 1.16, 1.24), hide), paint(limb(0.24, 0.3, 0.3).rotateX(1.57).translate(0, 0.98, 1.62), crust));
    for (const s of [-1, 1]) {
      body.push(paint(aimed(limb(0.2, 0.15, 0.72), s * 0.36, 1.46, 1.12, s * 1, 0.12, 0.2), crust), paint(aimed(spike(0.15, 0.96, 7), s * 0.98, 1.56, 1.28, s * 0.1, 1, 0.5), '#ece0c8'));
      glow.push(paint(ball(0.07).translate(s * 0.26, 1.3, 1.58), '#ffb547'));
    }
    glow.push(paint(ball(0.1, 1.4, 0.6, 1).translate(0, 0.92, 1.92), '#ff5a2a'));
    for (let i = 0; i < 12; i++) glow.push(paint(block(0.09, 0.42, 0.05).rotateZ(i * 1.3).rotateY(i).translate(Math.sin(i * 2.4) * 0.62, 1.2 + Math.cos(i) * 0.5, Math.cos(i * 2.4) * 0.84 - 0.1), i % 2 ? '#ff5a2a' : '#ffb547'));
    for (let i = 0; i < 9; i++) glow.push(paint(aimed(spike(0.12, 0.4 + (i % 2) * 0.28, 5), Math.sin(i) * 0.16, 1.86 - Math.abs(i - 3) * 0.04, 0.5 - i * 0.2, 0, 1, -0.3), i % 2 ? '#ff5a2a' : '#ffb547'));
    for (const [x, z] of [[-0.54, 0.6], [0.54, 0.6], [-0.54, -0.78], [0.54, -0.78]]) m.leg(x, 0.72, z, [paint(limb(0.27, 0.2, 0.7), hide), paint(ball(0.24, 1, 0.6, 1.2).translate(0, -0.68, 0.06), crust)]);
  },
};

export const makeCreature = (shape, def = {}) => make((m, body, glow) => CREATURES[shape](m, body, glow, def));
export const hasCreature = (shape) => !!CREATURES[shape];
