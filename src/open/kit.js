import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The shapes every figure in the open world is sculpted from: toon-lit, with an ink line, so
// heroes, townsfolk and monsters all belong to one picture.
export const toonSteps = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 185, 185, 185, 255, 255, 255, 255, 255, 255, 255, 255, 255]), 4, 1);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const inks = new Map();
// Ink: the same shape pushed out along its normals, drawn inside out.
export function inkMaterial(width) {
  if (inks.has(width)) return inks.get(width);
  const m = new THREE.MeshBasicMaterial({ color: '#14162a', side: THREE.BackSide, fog: true });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${width.toFixed(3)};`);
  };
  m.customProgramCacheKey = () => `ink${width}`;
  inks.set(width, m);
  return m;
}

export const toon = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonSteps });

// Parts painted one color each, merged per bone so a figure stays a few draw calls.
export function paint(geometry, color) {
  const g = geometry.index ? geometry : geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
  const c = new THREE.Color(color), n = g.attributes.position.count, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(out, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  g.deleteAttribute('uv');
  return g;
}

export const ball = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz);
export const limb = (top, bottom, length, depth = 1) => new THREE.CylinderGeometry(top, bottom, length, 10, 1).scale(1, 1, depth).translate(0, -length / 2, 0);
export const spike = (r, length, sides = 7) => new THREE.ConeGeometry(r, length, sides).translate(0, length / 2, 0);
export const block = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rock = (r) => new THREE.DodecahedronGeometry(r, 0);
const up = new THREE.Vector3(0, 1, 0);
export const aimed = (g, x, y, z, dx, dy, dz) => g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(dx, dy, dz).normalize())).translate(x, y, z);

// Hangs merged parts on a bone, with their ink. `mat` is shared across the figure.
export function skin(bone, parts, mat, ink) {
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
  mesh.castShadow = true;
  bone.add(mesh);
  if (ink) bone.add(new THREE.Mesh(mesh.geometry, inkMaterial(ink)));
  return mesh;
}

// Parts that give off their own light, so they burn through shadow and bloom at night.
export function shine(bone, parts) {
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4), fog: false }));
  bone.add(mesh);
  return mesh;
}
