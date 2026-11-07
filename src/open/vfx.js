import * as THREE from 'three';

// The effects kit for fights and powers: ribbon trails, beams, shock rings, domes and a spark
// system, all pooled and additive, plus the mood of the sky (a tint the whole picture takes on for
// an ultimate). Nothing is created during play. `world.vfx`; post.js reads `mood`.
const TRAILS = 10, TRAIL_POINTS = 18;
const BEAMS = 4, SHOCKS = 12, DOMES = 3;
const SPARKS = 1800, SPARK_DRAG = 1.6, SPARK_FALL = 14;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false };

// A soft round dot, for the sparks.
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d'), f = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  f.addColorStop(0, '#ffffff');
  f.addColorStop(0.3, '#ffffffcc');
  f.addColorStop(1, '#00000000');
  g.fillStyle = f;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// A strip that follows a moving point: bright at the head, fading and thinning to the tail.
function makeTrail(scene) {
  const n = TRAIL_POINTS, pos = new Float32Array(n * 2 * 3), fade = new Float32Array(n * 2), idx = [];
  for (let i = 0; i < n; i++) fade[i * 2] = fade[i * 2 + 1] = 1 - i / (n - 1);
  for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('fade', new THREE.BufferAttribute(fade, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } },
    vertexShader: 'attribute float fade; varying float vFade; void main(){ vFade=fade; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vFade; void main(){ gl_FragColor=vec4(mix(uColor,vec3(1.),vFade*vFade*.6)*vFade*uAlpha,1.); }',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, points: Array.from({ length: n }, () => new THREE.Vector3()), get: null, left: 0, width: 1, live: false };
}

// A beam from A to B: a white core inside a colored sheath, with energy streaming along it.
function makeBeam(scene) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 1 }, uLength: { value: 1 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vec4 p=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime,uAlpha,uLength; varying vec2 vUv; varying vec3 vN,vV;
      void main(){ float edge=abs(dot(vN,vV)); float core=pow(edge,3.); float flow=.6+.4*sin(vUv.y*uLength*1.4-uTime*40.);
        vec3 c=mix(uColor*flow,vec3(1.),core); gl_FragColor=vec4(c*(.35+edge)*uAlpha,1.); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, left: 0, life: 1, width: 1, live: false };
}

// A ring of force rolling out over the ground: a hard bright edge, soft inside.
function makeShock(scene) {
  const mat = new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide, depthTest: false,
    uniforms: { uColor: { value: new THREE.Color() }, uK: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying vec2 vUv;
      void main(){ float r=length(vUv-.5)*2.; float edge=smoothstep(.72,.97,r)*(1.-smoothstep(.97,1.,r)); float fill=(1.-r)*.15;
        gl_FragColor=vec4(mix(uColor,vec3(1.),edge*.5)*(edge+fill)*(1.-uK),1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, age: 9, life: 1, size: 1, live: false };
}

// A sphere of light seen from inside or out: bright at the rim, clear in the middle.
function makeDome(scene) {
  const mat = new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec3 vN, vV; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying vec3 vN,vV; void main(){ float rim=1.-abs(dot(vN,vV)); gl_FragColor=vec4(uColor*(pow(rim,2.5)+.06)*uAlpha,1.); }',
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, live: false };
}

export default class Vfx {
  constructor(scene) {
    this.trails = Array.from({ length: TRAILS }, () => makeTrail(scene));
    this.beams = Array.from({ length: BEAMS }, () => makeBeam(scene));
    this.shocks = Array.from({ length: SHOCKS }, () => makeShock(scene));
    this.domes = Array.from({ length: DOMES }, () => makeDome(scene));
    // Sparks: one draw call of soft dots that fly, drag and fall.
    const geo = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(SPARKS * 3);
    this.sparkCol = new Float32Array(SPARKS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkPoints = new THREE.Points(geo, new THREE.PointsMaterial({ ...additive, map: dotTexture(), size: 0.7, vertexColors: true, sizeAttenuation: true }));
    this.sparkPoints.frustumCulled = false;
    scene.add(this.sparkPoints);
    this.sparks = Array.from({ length: SPARKS }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, fall: 1 }));
    this.nextSpark = 0;
    this.time = 0;
    this.color = new THREE.Color();
    // The sky's mood: a tint the picture leans into, and how far it leans; eased toward `want`.
    this.mood = { color: new THREE.Color('#ffffff'), amount: 0, gray: 0 };
    this.want = { color: new THREE.Color('#ffffff'), amount: 0, gray: 0, left: 0 };
  }

  // A trail behind whatever `get()` points at (it fills a Vector3), for `secs`.
  trail(get, color, width = 0.6, secs = 0.5) {
    const t = this.trails.find((x) => !x.live) ?? this.trails.reduce((a, b) => (a.left < b.left ? a : b));
    t.get = get;
    t.left = secs;
    t.width = width;
    t.live = true;
    t.fresh = true;
    t.mesh.material.uniforms.uColor.value.set(color);
    t.mesh.visible = true;
    return t;
  }

  // A beam between two points for `secs`; move it with `aim(beam, from, to)` while it lasts.
  beam(from, to, width, color, secs) {
    const b = this.beams.find((x) => !x.live) ?? this.beams[0];
    Object.assign(b, { left: secs, life: secs, width, live: true });
    b.mesh.material.uniforms.uColor.value.set(color);
    b.mesh.visible = true;
    this.aim(b, from, to);
    return b;
  }

  aim(b, from, to) {
    const len = Math.max(0.01, from.distanceTo(to));
    b.mesh.position.copy(from);
    b.mesh.lookAt(to);
    b.mesh.scale.set(b.width, b.width, len);
    b.mesh.material.uniforms.uLength.value = len;
  }

  stopBeam(b) {
    b.left = Math.min(b.left, 0.12);
  }

  // A ring of force rolling out from (x, z) to `size` tiles over `life` seconds.
  shock(x, y, z, size, color, life = 0.4) {
    const s = this.shocks.find((v) => !v.live) ?? this.shocks.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    Object.assign(s, { age: 0, life, size, live: true });
    s.mesh.position.set(x, y + 0.3, z);
    s.mesh.material.uniforms.uColor.value.set(color);
    s.mesh.visible = true;
    return s;
  }

  // A sphere of light at (x, y, z); the caller grows and fades it with `shape(dome, size, alpha)`.
  dome(x, y, z, color) {
    const d = this.domes.find((v) => !v.live) ?? this.domes[0];
    d.live = true;
    d.mesh.position.set(x, y, z);
    d.mesh.material.uniforms.uColor.value.set(color);
    d.mesh.visible = true;
    return d;
  }

  shape(d, size, alpha) {
    d.mesh.scale.setScalar(Math.max(0.01, size));
    d.mesh.material.uniforms.uAlpha.value = alpha;
    if (alpha <= 0) {
      d.live = false;
      d.mesh.visible = false;
    }
  }

  // `n` sparks bursting from a point. `speed` tiles a second; `up` lifts them; `fall` is gravity's share.
  burst(x, y, z, colors, n = 12, speed = 10, { up = 0.4, life = 0.6, fall = 1 } = {}) {
    const list = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.nextSpark];
      this.nextSpark = (this.nextSpark + 1) % SPARKS;
      const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.4, v = speed * (0.35 + Math.random() * 0.65);
      this.color.set(list[i % list.length]);
      Object.assign(s, { life: life * (0.6 + Math.random() * 0.6), x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: (Math.sin(e) + up) * v, vz: Math.sin(a) * Math.cos(e) * v, r: this.color.r, g: this.color.g, b: this.color.b, fall });
      s.max = s.life;
    }
  }

  // The picture leans toward `color` by `amount` (0..1), `gray` drains its colour; held `secs`, then eases back.
  tint(color, amount, secs, gray = 0) {
    this.want.color.set(color);
    Object.assign(this.want, { amount, gray, left: secs });
  }

  update(dt) {
    this.time += dt;
    // The mood eases toward what's wanted, and back to nothing once that runs out.
    const w = this.want, m = this.mood, k = Math.min(1, dt * 3);
    w.left -= dt;
    const goal = w.left > 0 ? w.amount : 0, gray = w.left > 0 ? w.gray : 0;
    m.amount += (goal - m.amount) * k;
    m.gray += (gray - m.gray) * k;
    m.color.lerp(w.color, k);
    for (const t of this.trails) {
      if (!t.live) continue;
      t.left -= dt;
      if (t.left > 0 && t.get) {
        // The head follows the point; every other point eases after the one in front of it.
        const head = t.get(t.points[0]);
        if (head === false) t.left = Math.min(t.left, 0.2);
        if (t.fresh) {
          for (const p of t.points) p.copy(t.points[0]);
          t.fresh = false;
        }
      }
      for (let i = t.points.length - 1; i > 0; i--) t.points[i].lerp(t.points[i - 1], Math.min(1, dt * 30));
      const pos = t.mesh.geometry.attributes.position;
      for (let i = 0; i < t.points.length; i++) {
        const p = t.points[i], half = t.width * (1 - i / t.points.length) * 0.5;
        pos.setXYZ(i * 2, p.x, p.y + half, p.z);
        pos.setXYZ(i * 2 + 1, p.x, p.y - half, p.z);
      }
      pos.needsUpdate = true;
      t.mesh.material.uniforms.uAlpha.value = Math.min(1, Math.max(0, t.left) * 5);
      if (t.left <= -0.2) {
        t.live = false;
        t.mesh.visible = false;
      }
    }
    for (const b of this.beams) {
      if (!b.live) continue;
      b.left -= dt;
      b.mesh.material.uniforms.uTime.value = this.time;
      b.mesh.material.uniforms.uAlpha.value = Math.min(1, b.left * 8) * (0.85 + Math.sin(this.time * 60) * 0.15);
      if (b.left <= 0) {
        b.live = false;
        b.mesh.visible = false;
      }
    }
    for (const s of this.shocks) {
      if (!s.live) continue;
      s.age += dt;
      const k2 = Math.min(1, s.age / s.life);
      s.mesh.scale.setScalar(s.size * (1 - (1 - k2) ** 3));
      s.mesh.material.uniforms.uK.value = k2 * k2;
      if (k2 >= 1) {
        s.live = false;
        s.mesh.visible = false;
      }
    }
    const pos = this.sparkPos, col = this.sparkCol, drag = Math.exp(-dt * SPARK_DRAG);
    for (let i = 0; i < SPARKS; i++) {
      const s = this.sparks[i];
      if (s.life <= 0) {
        if (pos[i * 3 + 1] !== -999) {
          pos[i * 3 + 1] = -999;
          col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
        }
        continue;
      }
      s.life -= dt;
      s.vx *= drag;
      s.vz *= drag;
      s.vy = s.vy * drag - SPARK_FALL * s.fall * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const f = Math.max(0, s.life / s.max);
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
      col[i * 3] = s.r * f;
      col[i * 3 + 1] = s.g * f;
      col[i * 3 + 2] = s.b * f;
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.sparkPoints.geometry.attributes.color.needsUpdate = true;
  }
}
