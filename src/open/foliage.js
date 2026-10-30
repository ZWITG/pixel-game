import * as THREE from 'three';
import { addWind } from '../render/wind.js';

// Trees and ground cover made of crossed pixel-art cards. A card is two triangles, so a
// crown of soft leaves costs less than a few boxes, and thousands fit on screen.
const LEAVES = {
  pine: { colors: ['#123f35', '#1b5a44', '#2a7a55', '#46a06a'], shape: 'bough' },
  crimson: { colors: ['#7c1424', '#b81f2e', '#e23a36', '#ff7a56'], shape: 'blob' },
  gold: { colors: ['#9a5c14', '#cf8f1e', '#efbe34', '#ffe27a'], shape: 'blob' },
};

function pixelTexture(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Leaves are little 2px dabs, darker low down and lighter toward the top.
function leafTexture({ colors, shape }) {
  return pixelTexture(64, (g, S) => {
    let seed = 41;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2600; i++) {
      const x = r() * S, y = r() * S, nx = x / S - 0.5, ny = y / S - 0.5;
      const inside = shape === 'bough' ? Math.abs(nx) < (y / S) * 0.5 : Math.hypot(nx, ny) < 0.34 + 0.14 * r();
      if (!inside) continue;
      const light = Math.min(3, Math.floor((1 - y / S) * 2.6 + r() * 1.7));
      g.fillStyle = colors[light];
      g.fillRect(Math.floor(x), Math.floor(y), 2, 2);
    }
  });
}

// Quads around each cluster. Normals point out of the crown, so it shades like one soft
// volume. Each quad is indexed both ways round to get two-sided cards with those normals.
function cardGeometry(clusters, center) {
  const pos = [], nor = [], uv = [], idx = [];
  const n = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [cx, cy, cz, size, cards, tilt] of clusters) {
    for (let k = 0; k < cards; k++) {
      const a = (k / cards) * Math.PI + cx, h = size / 2;
      const ux = Math.cos(a), uz = Math.sin(a);
      const vx = -uz * Math.sin(tilt), vy = Math.cos(tilt), vz = ux * Math.sin(tilt);
      const base = pos.length / 3;
      for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        p.set(cx + (ux * s + vx * t) * h, cy + vy * t * h, cz + (uz * s + vz * t) * h);
        pos.push(p.x, p.y, p.z);
        n.copy(p).sub(center).setY((p.y - center.y) * 0.6 + 0.35).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push((s + 1) / 2, (t + 1) / 2);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function crown(kind) {
  const list = [];
  if (kind === 'pine') {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      list.push([0, 5 + t * 10.5, 0, 7.4 - t * 5.6, 3, 0.25]);
    }
    return cardGeometry(list, new THREE.Vector3(0, 7, 0));
  }
  let seed = kind === 'gold' ? 11 : 23;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) {
    const a = r() * 6.28, d = r() * 3.2, y = 7.5 + r() * 5.2;
    list.push([Math.cos(a) * d, y, Math.sin(a) * d, 3.6 + r() * 2.6, 3, 0.5]);
  }
  return cardGeometry(list, new THREE.Vector3(0, 8, 0));
}

// A tapered trunk with pixel bark: vertical streaks, plus dark notches on pale birch-like trees.
function trunkMaterial(kind) {
  const c = kind === 'gold' ? ['#e4ddcf', '#bdb3a4', '#4a4238'] : kind === 'crimson' ? ['#9a5a3e', '#6e3a2a', '#40201a'] : ['#8a5236', '#5e3624', '#38201a'];
  const map = pixelTexture(16, (g, S) => {
    g.fillStyle = c[0];
    g.fillRect(0, 0, S, S);
    let seed = 19;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      g.fillStyle = r() < 0.75 ? c[1] : c[2];
      g.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, kind === 'gold' ? 1 : 3 + Math.floor(r() * 5));
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 7);
  return new THREE.MeshLambertMaterial({ map });
}

const trunkGeometry = () => new THREE.CylinderGeometry(0.14, 0.46, 15, 6, 1).translate(0, 7.5, 0);

export function makeTreeMeshes(scene, max) {
  return Object.keys(LEAVES).map((kind) => {
    const map = leafTexture(LEAVES[kind]);
    const mat = addWind(new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 }), { from: 5, amount: 0.018 });
    const crownMesh = new THREE.InstancedMesh(crown(kind), mat, max);
    crownMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeometry(), trunkMaterial(kind), max);
    for (const m of [crownMesh, trunkMesh]) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = m === trunkMesh;
      m.count = 0;
      scene.add(m);
    }
    return { crown: crownMesh, trunk: trunkMesh };
  });
}

// Ground cover: a tuft of thin pixel blades, tinted per instance.
export function makeGrass(scene, max) {
  const map = pixelTexture(24, (g, S) => {
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const x = 1 + Math.floor(r() * (S - 2)), h = 6 + Math.floor(r() * 16), v = 150 + Math.floor(r() * 105);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, S - h, 1, h);
    }
  });
  const pos = [], uv = [], nor = [], idx = [];
  [0.4, 2.0].forEach((a, k) => {
    const c = Math.cos(a), s = Math.sin(a), base = k * 4;
    for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      pos.push(x * c * 0.55, y * 0.7, x * s * 0.55);
      uv.push((x + 1) / 2, y);
      nor.push(0, 1, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mesh = new THREE.InstancedMesh(g, addWind(new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 }), { from: 0.1, amount: 0.22 }), max);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.setColorAt(0, new THREE.Color());
  scene.add(mesh);
  return mesh;
}
