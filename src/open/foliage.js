import * as THREE from 'three';
import { addWind } from '../render/wind.js';
import { shared, SCAR_GLSL, DIG_GLSL } from './materials.js';
import { FEATURES } from '../config/features.js';
import { voxelCrown, voxelTrunk, voxelRock, voxelTuft } from './voxelArt.js';

const CUBES = FEATURES.voxelWorld;

// Trees and ground cover made of crossed cards. A card is two triangles, so a crown of soft
// leaves costs less than a few boxes. Far trees swap to a single picture of the near one.
const LEAVES = {
  pine: { colors: ['#17372e', '#23503c', '#35704c', '#6a9a60'], shape: 'bough' },
  crimson: { colors: ['#5e241f', '#96382a', '#c4632f', '#efa75a'], shape: 'blob' },
  gold: { colors: ['#7c6222', '#b08d33', '#d6bb52', '#f2e38e'], shape: 'blob' },
};
const LEAF_SIZE = 512;
const IMPOSTOR = 256;

// Where the heroes are, set before each view is drawn.
export const focus = { uFocus: { value: new THREE.Vector3() }, uFocus2: { value: new THREE.Vector3() } };

const SIGHT = /* glsl */`uniform vec3 uFocus, uFocus2;
  float sightKeep(vec3 from, vec3 at, vec3 to, float inner, float outer) {
    vec3 dir = to - from, v = at - from;
    float l = length(dir), a = dot(v, dir / l);
    if (a < 0.0 || a > l - 1.0) return 1.0;
    return smoothstep(inner, outer, length(v - dir / l * a));
  }`;

// Leaves and grass close to the camera, or on the sight line to a hero, draw back to their own
// centers, the way a branch is pushed aside. Shadows stay whole. `aCard` is that center.
function parting(material, near, far) {
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner?.(shader, renderer);
    Object.assign(shader.uniforms, focus);
    shader.vertexShader = `attribute vec3 aCard; ${SIGHT}\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `vec3 cardAt = (modelMatrix * instanceMatrix * vec4(aCard, 1.0)).xyz;
      float cardKeep = min(smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, distance(cardAt, cameraPosition)), min(sightKeep(cameraPosition, cardAt, uFocus, 1.4, 3.6), sightKeep(cameraPosition, cardAt, uFocus2, 1.4, 3.6)));
      transformed = mix(aCard, transformed, cardKeep);
      #include <project_vertex>`,
    );
  };
  const key = material.customProgramCacheKey?.() ?? '';
  material.customProgramCacheKey = () => `${key}-part-${near}-${far}`;
  return material;
}

// Plants take the marks of the land they stand on: burnt away, frosted white, or rotted black.
// `burn`: how far a burnt plant shrinks toward its own center.
function scarred(material, shrink) {
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner?.(shader, renderer);
    shader.uniforms.uScars = shared.uScars;
    shader.uniforms.uScarAt = shared.uScarAt;
    shader.uniforms.uDigs = shared.uDigs;
    shader.uniforms.uDigMask = shared.uDigMask;
    shader.vertexShader = `${SCAR_GLSL}\n${DIG_GLSL}\nvarying vec4 vScar;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `vScar = scarAt(instanceMatrix[3].xz);
      if (bare(instanceMatrix[3].xz)) transformed *= 0.0;
      ${shrink}
      #include <project_vertex>`,
    );
    shader.fragmentShader = `varying vec4 vScar;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.03), smoothstep(.1, .45, vScar.r));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86, .94, 1.), smoothstep(.08, .4, vScar.g) * .9);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.08, .03, .13), smoothstep(.1, .45, vScar.b) * .9);`,
    );
  };
  const key = material.customProgramCacheKey?.() ?? '';
  material.customProgramCacheKey = () => `${key}-scar-${shrink.length}`;
  return material;
}

// Solid things can't part, so they thin out in a very fine dither instead.
function fadeNear(material, near, far) {
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner?.(shader, renderer);
    Object.assign(shader.uniforms, focus);
    shader.vertexShader = `varying vec3 vFadeAt;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      #ifdef USE_INSTANCING
        vFadeAt = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vFadeAt = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`,
    );
    shader.fragmentShader = `varying vec3 vFadeAt; ${SIGHT}\n${shader.fragmentShader}`.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      float fadeKeep = min(smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, distance(vFadeAt, cameraPosition)), min(sightKeep(cameraPosition, vFadeAt, uFocus, 0.9, 2.0), sightKeep(cameraPosition, vFadeAt, uFocus2, 0.9, 2.0)));
      if (fadeKeep < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`,
    );
  };
  const key = material.customProgramCacheKey?.() ?? '';
  material.customProgramCacheKey = () => `${key}-fade-${near}-${far}`;
  return material;
}

// Cards are lit by the crown's rounded normals on both faces, not flipped like a sheet of paper.
function cardLight(material) {
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner?.(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', 'vec3 normal = normalize(vNormal); vec3 nonPerturbedNormal = normal;');
  };
  return crisp(material);
}

// Keeps a leaf's edge one pixel wide at any distance, so it smooths cleanly and never stipples.
function crisp(material) {
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner?.(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      'diffuseColor.a = clamp((diffuseColor.a - 0.4) / max(fwidth(diffuseColor.a), 0.0001) + 0.5, 0.0, 1.0); if (diffuseColor.a < 0.02) discard;',
    );
  };
  return material;
}

function canvasTexture(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fills the empty corners with the mean color, so soft edges never fade through black.
function backfill(g, S, color) {
  g.globalCompositeOperation = 'destination-over';
  g.globalAlpha = 0.004;
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// Hundreds of small painted leaves: dark in the depths, sunlit toward the top.
function leafTexture({ colors, shape }) {
  return canvasTexture(LEAF_SIZE, (g, S) => {
    let seed = 41;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const unit = S / 110;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < 2400; i++) {
        const x = r() * S, y = r() * S, nx = x / S - 0.5, ny = y / S - 0.5;
        const inside = shape === 'bough' ? Math.abs(nx) < (y / S) * 0.48 * (0.75 + 0.25 * Math.sin(y * 0.2 / unit)) : Math.hypot(nx, ny) < 0.33 + 0.15 * r();
        if (!inside) continue;
        const light = Math.min(3, Math.max(0, Math.floor((1 - y / S) * 1.7 + pass * 0.75 + r() * 0.9 - 0.4)));
        g.fillStyle = colors[light];
        g.beginPath();
        g.ellipse(x, y, (shape === 'bough' ? 0.5 : 1.3) * unit, (shape === 'bough' ? 2 : 0.85) * unit, shape === 'bough' ? nx * 1.8 : r() * 3.14, 0, 6.3);
        g.fill();
      }
    }
    backfill(g, S, colors[1]);
  });
}

// Quads around each cluster. Normals point out of the crown, so it shades like one soft
// volume; cards deep inside and low down are darker, which gives the crown its depth.
function cardGeometry(clusters, center, reach) {
  const pos = [], nor = [], uv = [], col = [], card = [], idx = [];
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
        n.copy(p).sub(center);
        const depth = Math.min(1, n.length() / reach), lift = (p.y - center.y) / reach;
        n.setY(n.y * 0.6 + 0.4).normalize();
        nor.push(n.x, n.y, n.z);
        const shade = 0.55 + 0.45 * Math.min(1, depth * 0.65 + (lift + 1) * 0.3);
        col.push(shade, shade, shade);
        uv.push((s + 1) / 2, (t + 1) / 2);
        card.push(cx, cy, cz);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 3));
  g.setIndex(idx);
  return g;
}

// Pines are tiers of drooping boughs; broadleaf trees are a loose heap of leafy clumps.
function crown(kind) {
  const list = [];
  if (kind === 'pine') {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      list.push([0, 3.8 + t * 12, 0, 8.4 - t * 6.6, 3, 0.34]);
    }
    return cardGeometry(list, new THREE.Vector3(0, 8, 0), 8);
  }
  let seed = kind === 'gold' ? 11 : 23;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 15; i++) {
    const a = r() * 6.28, up = r(), d = Math.sqrt(1 - (up * 2 - 1) ** 2) * (2.2 + r() * 2.2), y = 7 + up * 7.5;
    list.push([Math.cos(a) * d, y, Math.sin(a) * d, 4 + r() * 2.6, 2, 0.55]);
  }
  return cardGeometry(list, new THREE.Vector3(0, 9, 0), 6);
}

// A tapered trunk with bark: vertical streaks, plus dark notches on pale birch-like trees.
function trunkMaterial(kind, tall = 6) {
  const c = kind === 'gold' ? ['#d9d2c4', '#b3a99b', '#463f36'] : kind === 'crimson' ? ['#7c5140', '#5c3a2c', '#35201a'] : ['#6e4a35', '#4e3226', '#2e1c17'];
  const map = canvasTexture(64, (g, S) => {
    g.fillStyle = c[0];
    g.fillRect(0, 0, S, S);
    let seed = 19;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 170; i++) {
      g.fillStyle = r() < 0.75 ? c[1] : c[2];
      g.fillRect(Math.floor(r() * S), Math.floor(r() * S), kind === 'gold' ? 4 : 1 + Math.floor(r() * 2), kind === 'gold' ? 1 : 6 + Math.floor(r() * 18));
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, tall);
  return new THREE.MeshLambertMaterial({ map });
}

const trunkGeometry = () => new THREE.CylinderGeometry(0.16, 0.5, 15, 7, 1).translate(0, 7.5, 0);
const STUMPS = 400; // per kind

// A picture of one tree from the side, taken once, for the far forest.
function bakeImpostor(renderer, kind, crownGeo, leafMat, trunkGeo, trunkMat) {
  const target = new THREE.WebGLRenderTarget(IMPOSTOR, IMPOSTOR, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 4 });
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-9, 9, 19, -1, 1, 60);
  cam.position.set(0, 9, 30);
  cam.lookAt(0, 9, 0);
  const light = new THREE.DirectionalLight('#ffffff', 2.2);
  light.position.set(0.4, 1, 0.6);
  scene.add(new THREE.HemisphereLight('#ffffff', '#88888a', 1.5), light);
  const leaf = CUBES ? new THREE.MeshLambertMaterial({ vertexColors: true }) : cardLight(new THREE.MeshLambertMaterial({ map: leafMat.map, alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true }));
  const a = new THREE.Mesh(crownGeo, leaf), b = new THREE.Mesh(trunkGeo, trunkMat.clone());
  scene.add(a, b);
  const clear = new THREE.Color(LEAVES[kind].colors[1]), oldColor = new THREE.Color(), oldAlpha = renderer.getClearAlpha();
  renderer.getClearColor(oldColor);
  renderer.setClearColor(clear, 0);
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  renderer.setClearColor(oldColor, oldAlpha);
  return target.texture;
}

function impostorGeometry() {
  const pos = [], uv = [], nor = [], idx = [];
  [0.3, 1.35, 2.4].forEach((a, k) => {
    const c = Math.cos(a), s = Math.sin(a), base = k * 4;
    for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      pos.push(x * c * 9, y * 20 - 1, x * s * 9);
      uv.push((x + 1) / 2, y);
      nor.push(0, 1, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function makeTreeMeshes(scene, renderer, max, farMax) {
  return Object.keys(LEAVES).map((kind) => {
    const stump = new THREE.InstancedMesh(CUBES ? new THREE.BoxGeometry(1, 0.8, 1).translate(0, 0.4, 0) : new THREE.CylinderGeometry(0.42, 0.5, 0.8, 7).translate(0, 0.4, 0), trunkMaterial(kind, 0.4), STUMPS);
    stump.frustumCulled = false;
    stump.castShadow = true;
    stump.count = 0;
    scene.add(stump);
    // Cubes: solid crowns of leaf cubes and trunks of bark cubes, coloured per cube.
    const map = CUBES ? null : leafTexture(LEAVES[kind]);
    const leaf = CUBES ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ map, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: true });
    const burn = 'transformed = mix(transformed, aCard, smoothstep(.35, .8, vScar.r));';
    const mat = CUBES ? parting(scarred(addWind(leaf, { from: 5, amount: 0.01 }), burn), 3, 8) : parting(scarred(cardLight(addWind(leaf, { from: 5, amount: 0.014 })), burn), 3, 8);
    const geo = CUBES ? voxelCrown(kind, LEAVES[kind].colors) : crown(kind), bark = CUBES ? new THREE.MeshLambertMaterial({ vertexColors: true }) : trunkMaterial(kind), trunkGeo = CUBES ? voxelTrunk(kind) : trunkGeometry();
    const crownMesh = new THREE.InstancedMesh(geo, mat, max);
    if (!CUBES) crownMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.4, side: THREE.DoubleSide });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, fadeNear(bark.clone(), 2, 5), max);
    for (const m of [crownMesh, trunkMesh]) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = m === trunkMesh;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }
    crownMesh.setColorAt(0, new THREE.Color());
    const pic = bakeImpostor(renderer, kind, geo, leaf, trunkGeo, bark);
    const far = new THREE.InstancedMesh(impostorGeometry(), scarred(crisp(new THREE.MeshLambertMaterial({ map: pic, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide })), ''), farMax);
    far.frustumCulled = false;
    far.count = 0;
    far.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    far.setColorAt(0, new THREE.Color());
    scene.add(far);
    return { crown: crownMesh, trunk: trunkMesh, far, stump };
  });
}

// Rocks: one faceted stone, varied per instance by scale, turn and tint.
export function makeRocks(scene, max) {
  const map = canvasTexture(64, (g, S) => {
    g.fillStyle = '#d8d0d4';
    g.fillRect(0, 0, S, S);
    let seed = 31;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 300; i++) {
      g.fillStyle = r() < 0.6 ? '#b4aab2' : r() < 0.7 ? '#8e8490' : '#efe9e6';
      g.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1 + Math.floor(r() * 5), 1 + Math.floor(r() * 3));
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const geo = CUBES ? voxelRock() : new THREE.IcosahedronGeometry(1, 1);
  const p = CUBES ? { count: 0 } : geo.attributes.position;
  // Knock the corners about, keeping shared corners together so the stone stays closed.
  for (let i = 0; i < p.count; i++) {
    const k = 1 + Math.sin(p.getX(i) * 4 + p.getY(i) * 7 + p.getZ(i) * 3) * 0.14 + Math.sin(p.getX(i) * 9 - p.getZ(i) * 8) * 0.06;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  if (!CUBES) geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, fadeNear(CUBES ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ map, flatShading: true }), 1.5, 3), max);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.setColorAt(0, new THREE.Color());
  scene.add(mesh);
  return mesh;
}

// Ground cover: a tuft of thin tapered blades, dark at the root, tinted per instance.
export function makeGrass(scene, max) {
  const map = canvasTexture(128, (g, S) => {
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 34; i++) {
      const x = S * (0.08 + r() * 0.84), h = S * (0.35 + r() * 0.62), lean = (r() - 0.5) * S * 0.2, w = S * 0.022, v = 170 + Math.floor(r() * 85);
      const fill = g.createLinearGradient(0, S, 0, S - h);
      fill.addColorStop(0, `rgb(${v * 0.45},${v * 0.5},${v * 0.42})`);
      fill.addColorStop(1, `rgb(${v},${v},${v * 0.92})`);
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(x - w, S);
      g.quadraticCurveTo(x - w * 0.5, S - h * 0.6, x + lean, S - h);
      g.quadraticCurveTo(x + w * 0.8, S - h * 0.5, x + w, S);
      g.fill();
    }
    backfill(g, S, '#808878');
  });
  const pos = [], uv = [], nor = [], idx = [], card = [];
  [0.4, 2.0, 3.2].forEach((a, k) => {
    const c = Math.cos(a), s = Math.sin(a), base = k * 4;
    for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      pos.push(x * c * 0.7, y * 0.85, x * s * 0.7);
      uv.push((x + 1) / 2, y);
      nor.push(0, 1, 0);
      card.push(0, 0, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 3));
  g.setIndex(idx);
  // Cubes: a tuft of thin square blades instead of a painted card.
  if (CUBES) g = voxelTuft();
  const material = CUBES ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ map, alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide });
  addWind(material, { from: 0.1, amount: 0.2 });
  // Grass sinks into the ground with distance, so its edge can't be seen.
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `transformed.y *= 1.0 - smoothstep(55.0, 88.0, distance((instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz, cameraPosition.xz));
      #include <project_vertex>`,
    );
  };
  const flatten = 'transformed.y *= 1.0 - smoothstep(.15, .5, vScar.r) * .94;';
  const mesh = new THREE.InstancedMesh(g, parting(scarred(CUBES ? material : cardLight(material), flatten), 1.6, 4), max);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color());
  scene.add(mesh);
  return mesh;
}
