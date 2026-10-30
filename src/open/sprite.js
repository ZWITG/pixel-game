import * as THREE from 'three';

// The hero as a hand-placed pixel sprite standing in the 3D world.
// Atlas: rows back / front / side, four walking frames each, all drawn here in code.
const W = 32, H = 38, FRAMES = 4, ROWS = 3;
const C = {
  hair: '#3f4fd0', hairHi: '#7f90ff', hairDark: '#2a3398', skin: '#ffd2a8', skinDark: '#e8a884', eye: '#1b2233',
  tunic: '#f3ead8', tunicDark: '#c9b89e', cape: '#d0344a', capeDark: '#8e2036', pants: '#2b2f45',
  boot: '#5a3320', metal: '#c9d4e2', gold: '#ffb547', glow: '#fff0b0',
};

function drawFrame(g, row, frame, ox, oy) {
  const step = [0, 1, 0, -1][frame], bob = frame % 2 ? 1 : 0;
  const r = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(ox + x, oy + y, w, h);
  };
  const body = bob; // upper body dips on passing steps
  if (row === 2) {
    // side view, facing right
    r(13 + step * 2, 30, 4, 6, C.pants);
    r(13 + step * 2, 34, 6, 3, C.boot);
    r(14 - step * 2, 30, 4, 6, C.pants);
    r(14 - step * 2, 34, 6, 3, C.boot);
    r(7 - bob, 18 + body, 6, 13, C.capeDark);
    r(6 - bob, 26 + body, 5, 8, C.cape);
    r(12, 19 + body, 9, 12, C.tunic);
    r(12, 27 + body, 9, 2, C.boot);
    r(15, 20 + body, 4, 9 - step, C.tunicDark);
    r(19, 26 + body, 4, 5, C.gold); // lantern on the hip
    r(20, 27 + body, 2, 3, C.glow);
    r(10, 4 + body, 13, 14, C.skin);
    r(9, 1 + body, 13, 8, C.hair);
    r(7, 4 + body, 8, 12, C.hair);
    r(5, 7 + body, 4, 4, C.hairDark);
    r(4, 2 + body, 5, 3, C.hair);
    r(12, 0 + body, 8, 2, C.hairHi);
    r(19, 9 + body, 2, 4, C.eye);
    r(17, 15 + body, 3, 1, C.skinDark);
    r(10, 17 + body, 12, 3, C.cape);
    return;
  }
  // legs and boots, shared by back and front
  r(10, 29, 5, 6 + Math.min(0, step) * 2, C.pants);
  r(17, 29, 5, 6 - Math.max(0, step) * 2, C.pants);
  r(9, 34 + Math.min(0, step) * 2, 6, 3, C.boot);
  r(17, 34 - Math.max(0, step) * 2, 6, 3, C.boot);
  if (row === 0) {
    // back view: what you see most of the time
    r(6, 19 + body, 20, 3, C.capeDark);
    r(8, 21 + body, 16, 11, C.cape);
    r(9 + step, 31 + body, 14, 3, C.capeDark);
    r(15, 22 + body, 2, 9, C.capeDark);
    r(23, 25 + body, 4, 6, C.gold);
    r(24, 26 + body, 2, 4, C.glow);
    r(9, 5 + body, 14, 13, C.hair);
    r(8, 8 + body, 16, 7, C.hair);
    r(9, 2 + body, 4, 4, C.hair);
    r(14, 0 + body, 4, 5, C.hair);
    r(19, 2 + body, 4, 4, C.hair);
    r(11, 6 + body, 7, 2, C.hairHi);
    r(14, 3 + body, 2, 2, C.hairHi);
    r(10, 14 + body, 12, 3, C.hairDark);
    r(12, 16 + body, 3, 3, C.hairDark);
    r(18, 16 + body, 2, 2, C.hairDark);
    r(9, 18 + body, 14, 3, C.tunic); // pale collar breaks up hair and cape
    r(9, 20 + body, 14, 1, C.tunicDark);
    r(24, 6 + body, 2, 19, C.metal); // sword slung over the shoulder
    r(25, 6 + body, 1, 19, C.tunicDark);
    r(22, 20 + body, 6, 2, C.gold);
    r(24, 22 + body, 2, 4, C.boot);
  } else {
    // front view
    r(8, 21 + body, 2, 10, C.capeDark);
    r(22, 21 + body, 2, 10, C.capeDark);
    r(10, 20 + body, 12, 11, C.tunic);
    r(10, 27 + body, 12, 2, C.boot);
    r(15, 27 + body, 2, 2, C.gold);
    r(22, 25 + body, 4, 6, C.gold);
    r(23, 26 + body, 2, 4, C.glow);
    r(8, 6 + body, 16, 13, C.skin);
    r(7, 2 + body, 18, 7, C.hair);
    r(6, 6 + body, 4, 10, C.hair);
    r(22, 6 + body, 4, 10, C.hair);
    r(10, 8 + body, 4, 2, C.hair);
    r(18, 8 + body, 5, 3, C.hair);
    r(10, 0 + body, 5, 3, C.hair);
    r(17, 1 + body, 5, 2, C.hairHi);
    r(11, 11 + body, 3, 4, C.eye);
    r(18, 11 + body, 3, 4, C.eye);
    r(12, 11 + body, 1, 1, C.glow);
    r(19, 11 + body, 1, 1, C.glow);
    r(15, 16 + body, 2, 1, C.skinDark);
    r(8, 18 + body, 16, 3, C.cape);
    r(19, 20 + body, 4, 5, C.capeDark);
  }
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

export default class HeroSprite {
  constructor(scene) {
    const c = document.createElement('canvas');
    c.width = W * FRAMES;
    c.height = H * ROWS;
    const g = c.getContext('2d');
    for (let row = 0; row < ROWS; row++) for (let f = 0; f < FRAMES; f++) drawFrame(g, row, f, f * W, row * H);
    outline(g, c.width, c.height);
    const map = new THREE.CanvasTexture(c);
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(1 / FRAMES, 1 / ROWS);
    this.map = map;
    const size = 2.5;
    const geo = new THREE.PlaneGeometry(size * (W / H), size).translate(0, size / 2 - 0.08, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      map, alphaTest: 0.5, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.55,
    }));
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    scene.add(this.mesh);
  }

  // view: 0 back, 1 front, 2 side; flip mirrors the side view to face left.
  update(x, y, z, camera, view, flip, frame) {
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    this.map.repeat.x = (flip ? -1 : 1) / FRAMES;
    this.map.offset.set((frame + (flip ? 1 : 0)) / FRAMES, 1 - (view + 1) / ROWS);
  }
}
