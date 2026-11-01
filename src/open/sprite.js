import * as THREE from 'three';

// The heroes as pixel sprites standing in the 3D world, drawn here in code from a small
// skeleton: each frame poses the joints, then paints limbs, coat, scarf and hair around them.
// Atlas rows: back / front / side (facing right). Columns: six walking, idle, wind-up, punch, jump.
const W = 56, H = 84, ROWS = 3;
const WALK = 6, IDLE = 6, WINDUP = 7, PUNCH = 8, JUMP = 9, FRAMES = 10;
const CX = 28, GROUND = 81; // where the feet sit in a frame
const SIZE = 2.9;           // height of a frame in the world, in tiles

export const LOOKS = [
  // A wandering lantern-bearer: spiked blue hair, long red scarf, pale coat, wrapped fists.
  {
    hair: '#2c3fc4', hairHi: '#6f8cff', hairDark: '#1c2688', skin: '#ffd2a8', skinDark: '#e3a27c', iris: '#ffb547',
    coat: '#f0e6d2', coatDark: '#b9a88f', trim: '#2b2f45', scarf: '#e0344a', scarfDark: '#9a1f36',
    pants: '#2f3550', pantsDark: '#1f2338', boot: '#6a3d26', bootDark: '#44261a', wrap: '#e8d8c0',
    gold: '#ffb547', glow: '#fff0b0',
  },
  // The second hero: a long pale tail, teal coat, gold scarf.
  {
    hair: '#ded6ee', hairHi: '#ffffff', hairDark: '#9a90c0', skin: '#c98f66', skinDark: '#a06a48', iris: '#37c8b0',
    coat: '#2fa89a', coatDark: '#1c6f68', trim: '#f0b13c', scarf: '#f0b13c', scarfDark: '#b87a22',
    pants: '#3a2f45', pantsDark: '#261e30', boot: '#2b2f45', bootDark: '#1a1d2e', wrap: '#ded6ee',
    gold: '#9fe8ff', glow: '#e8fbff', tail: true,
  },
];

// Pixel painting without antialiasing: everything here has hard edges.
class Paint {
  constructor(g, ox, oy) {
    Object.assign(this, { g, ox, oy });
  }

  dot(x, y, color, w = 1, h = 1) {
    if (x < 1 || x + w > W - 1 || y < 1 || y + h > H - 1) return;
    this.g.fillStyle = color;
    this.g.fillRect(this.ox + Math.round(x), this.oy + Math.round(y), w, h);
  }

  // A tapered capsule from a to b.
  cap([ax, ay], [bx, by], ra, rb, color) {
    const r = Math.max(ra, rb), dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.max(ay, by) + r; y++) {
      for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.max(ax, bx) + r; x++) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
        if (Math.hypot(x - (ax + dx * t), y - (ay + dy * t)) <= ra + (rb - ra) * t) this.dot(x, y, color);
      }
    }
  }

  // A limb: dark underneath, the lit side laid on top, up and to the left.
  limb(a, b, ra, rb, dark, light) {
    this.cap(a, b, ra, rb, dark);
    this.cap([a[0] - 0.8, a[1] - 0.4], [b[0] - 0.8, b[1] - 0.4], ra - 1, rb - 1, light);
  }

  poly(points, color) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      points.forEach(([ax, ay], i) => {
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y) !== (by <= y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      });
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= xs[i + 1]; x++) this.dot(x, y, color);
    }
  }

  oval(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) {
      const w = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
      for (let x = Math.ceil(-w); x <= w; x++) this.dot(cx + x, cy + y, color);
    }
  }
}

// Where the body is on one frame. `s` runs -1..1 through a stride.
function posing(frame) {
  if (frame < WALK) {
    const a = (frame / WALK) * Math.PI * 2;
    return { s: Math.sin(a), bob: Math.abs(Math.cos(a)) < 0.6 ? 0 : 1, wave: frame, lean: 1 };
  }
  if (frame === WINDUP) return { s: -0.35, bob: 1, wave: 1, lean: -2, windup: true };
  if (frame === PUNCH) return { s: 0.55, bob: 1, wave: 2, lean: 4, punch: true };
  if (frame === JUMP) return { s: 0.2, bob: -3, wave: 3, lean: 1, jump: true };
  return { s: 0, bob: 0, wave: 0, lean: 0 };
}

// A leg seen from the side. `s` > 0 swings forward; a leg swinging back bends at the knee.
function sideLeg(hip, s, jump) {
  const L = 15, thigh = jump ? 0.9 : s * 0.62, bend = jump ? 1.4 : s < 0 ? -s * 1.1 : 0.12;
  const knee = [hip[0] + Math.sin(thigh) * L, hip[1] + Math.cos(thigh) * L];
  const shin = thigh - bend;
  return { knee, foot: [knee[0] + Math.sin(shin) * L, knee[1] + Math.cos(shin) * L] };
}

function drawLeg(p, C, hip, leg, far) {
  const dark = far ? C.pantsDark : C.pants;
  p.limb(hip, leg.knee, 4.4, 3.4, C.pantsDark, dark);
  p.limb(leg.knee, leg.foot, 3.4, 2.8, C.pantsDark, dark);
  p.limb(leg.foot, [leg.foot[0] + 4, leg.foot[1] + 1], 2.9, 2.4, C.bootDark, C.boot);
  p.cap([leg.foot[0] - 1.5, leg.foot[1] - 2.5], [leg.foot[0] + 1.5, leg.foot[1] - 2.5], 1, 1, C.bootDark);
}

// The scarf trails behind in a wave; `dir` is the way it streams.
function scarfTail(p, C, from, dir, wave) {
  let [x, y] = from;
  for (let i = 0; i < 9; i++) {
    const nx = x + dir * 3, ny = y + 1.1 + Math.sin(i * 1.1 + wave * 1.05) * 1.7;
    p.cap([x, y], [nx, ny], 2.4 - i * 0.12, 2.3 - i * 0.12, i % 3 === 2 ? C.scarfDark : C.scarf);
    x = nx;
    y = ny;
  }
}

function lantern(p, C, x, y) {
  p.dot(x - 1, y - 3, C.bootDark, 2, 2);
  p.dot(x - 3, y - 1, C.gold, 6, 2);
  p.dot(x - 3, y + 1, C.bootDark, 6, 6);
  p.dot(x - 2, y + 1, C.glow, 4, 5);
  p.dot(x - 3, y + 6, C.gold, 6, 2);
}

function drawSide(p, C, q) {
  const bob = q.bob, hip = [CX - 1 + q.lean * 0.3, 50 + bob], neck = [CX + q.lean, 29 + bob];
  const shoulder = [neck[0] - 1, neck[1] + 3];
  // Far arm and leg first.
  const farHand = q.windup ? [shoulder[0] + 7, shoulder[1] + 8] : q.punch ? [shoulder[0] - 7, shoulder[1] + 10] : [shoulder[0] + q.s * 9 + 1, shoulder[1] + 15];
  p.limb(shoulder, farHand, 3, 2.4, C.coatDark, C.coatDark);
  p.oval(farHand[0], farHand[1], 2.5, 2.5, C.skinDark);
  drawLeg(p, C, [hip[0] + 1, hip[1]], sideLeg(hip, -q.s, q.jump && false), true);

  scarfTail(p, C, [neck[0] - 4, neck[1]], -1, q.wave);
  if (C.tail) for (let i = 0; i < 8; i++) p.oval(neck[0] - 8 - i * 1.6, neck[1] - 10 + i * 3.2 + Math.sin(i + q.wave) * 0.7, 3.2 - i * 0.2, 2.4, i % 3 === 1 ? C.hairDark : C.hair);

  drawLeg(p, C, hip, sideLeg(hip, q.s, q.jump), false);
  // Coat: torso, then a split tail that flares with the stride.
  const flare = 3 + Math.abs(q.s) * 3;
  p.poly([[neck[0] - 7, neck[1] + 1], [neck[0] + 6, neck[1] + 1], [hip[0] + 7, hip[1] - 2], [hip[0] + 6 + q.s * 2, hip[1] + 10], [hip[0] - 8 - flare, hip[1] + 13], [hip[0] - 8, hip[1] - 2]], C.coatDark);
  p.poly([[neck[0] - 4, neck[1] + 1], [neck[0] + 6, neck[1] + 1], [hip[0] + 7, hip[1] - 2], [hip[0] + 6 + q.s * 2, hip[1] + 9], [hip[0] - 2, hip[1] + 10], [hip[0] - 3, hip[1] - 2]], C.coat);
  p.dot(hip[0] - 7, hip[1] - 3, C.trim, 15, 3);
  p.dot(hip[0] + 1, hip[1] - 3, C.gold, 3, 3);
  lantern(p, C, hip[0] + 8, hip[1] + 1);

  // Head.
  const hx = neck[0] + 1, hy = neck[1] - 11;
  p.cap(neck, [hx, hy + 6], 3, 3, C.skinDark);
  p.oval(hx + 1, hy, 8, 9, C.skin);
  p.dot(hx + 5, hy - 1, C.trim, 3, 4);
  p.dot(hx + 6, hy - 1, C.iris, 2, 2);
  p.dot(hx + 3, hy + 6, C.skinDark, 3, 1);
  // Hair: a cap with spikes blown backward.
  p.oval(hx - 1, hy - 3, 9, 8, C.hair);
  p.poly([[hx - 8, hy - 8], [hx - 15, hy - 6], [hx - 8, hy - 3], [hx - 16, hy + 1], [hx - 8, hy + 2], [hx - 13, hy + 7], [hx - 5, hy + 6], [hx - 3, hy + 9], [hx - 1, hy + 2]], C.hair);
  p.poly([[hx - 4, hy - 10], [hx + 1, hy - 15], [hx + 3, hy - 10], [hx + 8, hy - 13], [hx + 8, hy - 7], [hx + 11, hy - 6], [hx + 8, hy - 3], [hx + 8, hy + 1], [hx + 5, hy - 3], [hx + 3, hy + 1], [hx + 1, hy - 3]], C.hair);
  p.poly([[hx - 8, hy - 3], [hx - 3, hy - 9], [hx + 3, hy - 9], [hx - 2, hy - 6]], C.hairHi);
  p.poly([[hx - 6, hy + 2], [hx - 2, hy - 2], [hx - 1, hy + 5], [hx - 5, hy + 7]], C.hairDark);
  // Scarf wrap at the neck.
  p.limb([neck[0] - 5, neck[1]], [neck[0] + 5, neck[1] + 1], 3.3, 3.3, C.scarfDark, C.scarf);

  // Near arm, in front of everything.
  const hand = q.punch ? [shoulder[0] + 22, shoulder[1] + 1] : q.windup ? [shoulder[0] - 10, shoulder[1] + 5] : [shoulder[0] - q.s * 9 + 1, shoulder[1] + 15];
  const elbow = q.punch ? [shoulder[0] + 11, shoulder[1] + 1] : q.windup ? [shoulder[0] - 7, shoulder[1] + 8] : [(shoulder[0] + hand[0]) / 2 - 1, shoulder[1] + 8];
  p.limb(shoulder, elbow, 3.4, 3, C.coatDark, C.coat);
  p.limb(elbow, hand, 3, 2.6, C.coatDark, C.coat);
  p.oval(hand[0], hand[1], q.punch ? 3.4 : 2.8, q.punch ? 3.4 : 2.8, C.wrap);
}

function legsFacing(p, C, q, y) {
  for (const side of [-1, 1]) {
    const hip = [CX + side * 5, y], lift = Math.max(0, side * q.s) * 6 + (q.jump ? (side > 0 ? 9 : 4) : 0);
    const foot = [hip[0] + side, GROUND - 5 - lift], knee = [hip[0] + side * 1.5, (hip[1] + foot[1]) / 2 - lift * 0.2];
    p.limb(hip, knee, 4.6, 3.6, C.pantsDark, C.pants);
    p.limb(knee, foot, 3.6, 3, C.pantsDark, C.pants);
    p.limb([foot[0], foot[1] + 1], [foot[0], foot[1] + 3], 3, 3, C.bootDark, C.boot);
  }
}

function armsFacing(p, C, q, y, back) {
  for (const side of [-1, 1]) {
    const shoulder = [CX + side * 11, y], swing = side * q.s * 3 * (back ? -1 : 1);
    const thrown = q.punch && side > 0, drawn = q.windup && side > 0;
    const hand = thrown ? [CX + 25, y + 3] : drawn ? [CX + 9, y + 9] : [shoulder[0] + side * 2, y + 21 + swing];
    const elbow = thrown ? [CX + 18, y + 2] : drawn ? [CX + 15, y + 11] : [shoulder[0] + side * 2.5, y + 11 + swing * 0.5];
    p.limb(shoulder, elbow, 3.6, 3, C.coatDark, C.coat);
    p.limb(elbow, hand, 3, 2.6, C.coatDark, C.coat);
    p.oval(hand[0], hand[1], thrown ? 3.4 : 2.8, thrown ? 3.4 : 2.8, C.wrap);
  }
}

function coatFacing(p, C, y, hipY, s) {
  const out = 10 + Math.abs(s) * 2;
  p.poly([[CX - 11, y], [CX + 11, y], [CX + 10, hipY - 2], [CX + out, hipY + 12], [CX - out, hipY + 12], [CX - 10, hipY - 2]], C.coatDark);
  p.poly([[CX - 10, y], [CX + 8, y], [CX + 7, hipY - 2], [CX + out - 3, hipY + 10], [CX - out + 1, hipY + 10], [CX - 9, hipY - 2]], C.coat);
}

function drawBack(p, C, q) {
  const hipY = 50 + q.bob, neckY = 29 + q.bob;
  legsFacing(p, C, q, hipY + 4);
  coatFacing(p, C, neckY + 1, hipY, q.s);
  p.dot(CX, hipY + 2, C.coatDark, 1, 10); // the vent up the back of the coat
  p.dot(CX - 10, hipY - 3, C.trim, 21, 3);
  lantern(p, C, CX + 12, hipY + 1);
  armsFacing(p, C, q, neckY + 3, true);
  // Scarf: wrapped at the neck, both ends hanging down the back.
  p.limb([CX - 6, neckY + 1], [CX + 6, neckY + 1], 3.3, 3.3, C.scarfDark, C.scarf);
  for (const [dx, wave] of [[-3, 0], [3, 2]]) {
    let x = CX + dx, y = neckY + 2;
    for (let i = 0; i < 6; i++) {
      const nx = x + Math.sin(i * 0.9 + q.wave + wave) * 1.4, ny = y + 3.4;
      p.cap([x, y], [nx, ny], 2.2, 2.2, i % 3 === 2 ? C.scarfDark : C.scarf);
      x = nx;
      y = ny;
    }
  }
  // The back of the head is nearly all hair.
  const hy = neckY - 11;
  p.oval(CX, hy, 10, 10, C.hair);
  if (C.tail) {
    for (let i = 0; i < 12; i++) p.oval(CX + Math.sin(i * 0.8 + q.wave) * 1.2, hy + 7 + i * 3, 3.6 - i * 0.16, 2.6, i % 4 === 1 ? C.hairDark : C.hair);
    p.dot(CX - 3, hy + 6, C.scarf, 6, 2);
  } else {
    p.poly([[CX - 10, hy - 2], [CX - 15, hy + 7], [CX - 7, hy + 5], [CX - 8, hy + 12], [CX - 2, hy + 8], [CX, hy + 13], [CX + 3, hy + 8], [CX + 8, hy + 12], [CX + 7, hy + 5], [CX + 15, hy + 7], [CX + 10, hy - 2]], C.hair);
    p.poly([[CX - 7, hy + 4], [CX - 5, hy + 10], [CX - 3, hy + 6]], C.hairDark);
    p.poly([[CX + 3, hy + 6], [CX + 5, hy + 10], [CX + 7, hy + 4]], C.hairDark);
  }
  p.poly([[CX - 8, hy - 6], [CX - 12, hy - 15], [CX - 4, hy - 9], [CX - 1, hy - 16], [CX + 3, hy - 9], [CX + 9, hy - 15], [CX + 8, hy - 6]], C.hair);
  p.poly([[CX - 7, hy - 5], [CX - 2, hy - 9], [CX + 3, hy - 8], [CX - 2, hy - 5]], C.hairHi);
}

function drawFront(p, C, q) {
  const hipY = 50 + q.bob, neckY = 29 + q.bob;
  if (C.tail) for (let i = 0; i < 6; i++) p.oval(CX + 11 + Math.sin(i + q.wave), neckY - 2 + i * 3, 3 - i * 0.2, 2.4, C.hairDark);
  legsFacing(p, C, q, hipY + 4);
  coatFacing(p, C, neckY + 1, hipY, q.s);
  p.poly([[CX - 3, neckY + 2], [CX + 3, neckY + 2], [CX + 2, hipY + 11], [CX - 2, hipY + 11]], C.trim);
  p.dot(CX - 10, hipY - 3, C.trim, 21, 3);
  p.dot(CX - 2, hipY - 3, C.gold, 4, 3);
  lantern(p, C, CX - 12, hipY + 1);
  armsFacing(p, C, q, neckY + 3, false);
  // One scarf end falls across the chest.
  let x = CX + 4, y = neckY + 3;
  for (let i = 0; i < 5; i++) {
    const nx = x + Math.sin(i + q.wave) * 1.2, ny = y + 3.2;
    p.cap([x, y], [nx, ny], 2.2, 2.2, i % 3 === 2 ? C.scarfDark : C.scarf);
    x = nx;
    y = ny;
  }
  p.limb([CX - 6, neckY + 1], [CX + 6, neckY + 1], 3.3, 3.3, C.scarfDark, C.scarf);
  const hy = neckY - 11;
  p.oval(CX, hy + 1, 8, 9, C.skin);
  // Big anime eyes.
  for (const side of [-1, 1]) {
    const ex = CX + side * 4 - 1;
    p.dot(ex - 1, hy - 1, C.trim, 4, 1);
    p.dot(ex, hy, C.trim, 3, 5);
    p.dot(ex, hy + 2, C.iris, 3, 2);
    p.dot(ex, hy, '#ffffff', 1, 1);
  }
  p.dot(CX - 1, hy + 7, C.skinDark, 3, 1);
  // Bangs, spikes up and out.
  p.poly([[CX - 10, hy + 3], [CX - 12, hy - 5], [CX - 15, hy - 9], [CX - 9, hy - 10], [CX - 10, hy - 16], [CX - 3, hy - 12], [CX, hy - 17], [CX + 3, hy - 12], [CX + 10, hy - 16], [CX + 9, hy - 10], [CX + 15, hy - 9], [CX + 12, hy - 5], [CX + 10, hy + 3], [CX + 8, hy - 3], [CX + 5, hy - 1], [CX + 3, hy - 4], [CX, hy], [CX - 3, hy - 4], [CX - 5, hy - 1], [CX - 8, hy - 3]], C.hair);
  p.poly([[CX - 8, hy - 8], [CX - 2, hy - 12], [CX + 2, hy - 11], [CX - 3, hy - 7]], C.hairHi);
}

// A one-pixel dark ink line around everything keeps the sprite readable on busy ground.
function outline(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, src = d.slice();
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y) || !(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
    d.set([20, 22, 40, 255], (y * w + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
}

// A chunky eight-point star. White on black: the flash adds light, so black shows nothing.
function burstTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, 24, 24);
  g.fillStyle = '#ffffff';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, reach = k % 2 ? 7 : 11;
    for (let d = 0; d < reach; d++) {
      const w = Math.max(1, Math.round(4 * (1 - d / reach)));
      g.fillRect(Math.round(12 + Math.cos(a) * d - w / 2), Math.round(12 + Math.sin(a) * d - w / 2), w, w);
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  return map;
}

export const punchFrame = (t) => (t < 0.35 ? WINDUP : PUNCH);
export const walkFrame = (time, rate) => Math.floor(time * rate) % WALK;
export { IDLE, JUMP };

export default class HeroSprite {
  constructor(scene, look) {
    const c = document.createElement('canvas');
    c.width = W * FRAMES;
    c.height = H * ROWS;
    const g = c.getContext('2d');
    [drawBack, drawFront, drawSide].forEach((draw, row) => {
      for (let f = 0; f < FRAMES; f++) draw(new Paint(g, f * W, row * H), look, posing(f));
    });
    outline(g, c.width, c.height);
    this.atlas = c;
    const map = new THREE.CanvasTexture(c);
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(1 / FRAMES, 1 / ROWS);
    this.map = map;
    const geo = new THREE.PlaneGeometry(SIZE * (W / H), SIZE).translate(0, SIZE / 2 - SIZE * ((H - GROUND) / H), 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      map, alphaTest: 0.5, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.55,
    }));
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    scene.add(this.mesh);

    // A flash on the fist as the punch lands; bigger and hotter at higher stages.
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: burstTexture(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.flash.visible = false;
    this.mesh.add(this.flash);
  }

  // pose: { t, stage, color } from the melee system, or null. side 1 punches toward screen right.
  punch(pose, side) {
    this.flash.visible = !!pose && pose.t > 0.35 && pose.t < 0.7;
    if (!this.flash.visible) return;
    this.flash.material.color.set(pose.color);
    this.flash.position.set(side * 0.95, 1.9, 0.1);
    this.flash.scale.setScalar(0.6 + pose.stage * 0.5);
    this.flash.rotation.z = pose.t * 9;
  }

  // view: 0 back, 1 front, 2 side; flip mirrors the frame to face left.
  update(x, y, z, camera, view, flip, frame) {
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    this.map.repeat.x = (flip ? -1 : 1) / FRAMES;
    this.map.offset.set((frame + (flip ? 1 : 0)) / FRAMES, 1 - (view + 1) / ROWS);
  }
}
