import * as THREE from 'three';
import { shared } from './materials.js';

// Smoke and dust (phase 3 of docs/world-upgrade-plan.md). Every puff in the game is one instance
// of a camera-facing card, drawn in one call. A puff is lit like a soft ball: a round normal is
// made up from where on the card a pixel is, so the side towards the sun is bright and the far
// side dark, and puffs over a fire glow from below. Edges are eaten by moving noise so no card
// ever looks square. Fog thins them more slowly than the land, so a burning town's smoke rises
// above the haze across the map.
const MOST = 900;
const WIND = new THREE.Vector2(0.8, 0.35); // tiles per second the smoke drifts, growing with height
const NEAR_FADE = 0.6;                     // a puff fades as the camera comes within this many sizes of it

export default class Smoke {
  constructor(scene, sun, hemi) {
    this.sun = sun;
    this.hemi = hemi;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const attr = (n) => new THREE.InstancedBufferAttribute(new Float32Array(MOST * n), n).setUsage(THREE.DynamicDrawUsage);
    this.at = attr(3);
    this.look = attr(4);   // size, opacity, seed, heat
    this.tint = attr(3);
    g.setAttribute('aAt', this.at);
    g.setAttribute('aLook', this.look);
    g.setAttribute('aTint', this.tint);
    g.instanceCount = 0;
    this.uniforms = {
      uTime: shared.uTime, uNoise: shared.uNoise,
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() },
      uFogCol: { value: new THREE.Color() }, uFogDensity: { value: 0 },
    };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.uniforms,
      vertexShader: /* glsl */`attribute vec3 aAt; attribute vec4 aLook; attribute vec3 aTint;
        varying vec2 vU; varying vec4 vL; varying vec3 vT; varying vec3 vRight; varying vec3 vUp; varying vec3 vFwd; varying float vDist;
        void main(){
          vRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
          vUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
          vFwd=vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]);
          vec3 p=aAt+(vRight*position.x+vUp*position.y)*aLook.x;
          vU=position.xy*2.; vL=aLook; vT=aTint;
          vDist=distance(aAt,cameraPosition);
          vL.y*=smoothstep(aLook.x*${(NEAR_FADE * 0.4).toFixed(2)},aLook.x*${(NEAR_FADE * 1.6).toFixed(2)},vDist);
          gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        }`,
      fragmentShader: /* glsl */`varying vec2 vU; varying vec4 vL; varying vec3 vT; varying vec3 vRight; varying vec3 vUp; varying vec3 vFwd; varying float vDist;
        uniform float uTime; uniform sampler2D uNoise; uniform vec3 uSunDir, uSunCol, uAmb, uFogCol; uniform float uFogDensity;
        float vn(vec2 p){ return texture2D(uNoise,(p+.5)/256.).r; }
        void main(){
          float d=length(vU);
          if(d>1.) discard;
          float t=uTime*.07+vL.z*13.;
          float n=vn(vU*7.+vec2(vL.z*41.,t*6.))*.6+vn(vU*15.-vec2(t*9.,vL.z*17.))*.4;
          float body=smoothstep(1.,.25,d+(n-.5)*.75);
          float a=body*vL.y;
          if(a<.004) discard;
          // A soft ball's normal, turned to the world: lit side, shadowed side, a little light through.
          vec3 nrm=normalize(vRight*vU.x+vUp*vU.y+vFwd*sqrt(max(0.,1.-d*d)));
          float lit=clamp(dot(nrm,uSunDir)*.5+.55,0.,1.)*(.75+n*.35);
          vec3 col=vT*(uAmb*.8+uSunCol*lit*.55);
          // Over a fire the underside glows.
          col+=vec3(1.,.36,.08)*vL.w*vL.w*smoothstep(.3,-.9,vU.y)*(.5+n*.6);
          // Fog, gentler than on the land: columns stay seen from afar.
          float f=1.-exp(-pow(uFogDensity*vDist*.55,2.));
          gl_FragColor=vec4(mix(col,uFogCol,f*.85),a);
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.list = [];
    this.columns = [];
    this.c = new THREE.Color();
  }

  // One puff. `heat`: glow from below (fire smoke); `lift`: how fast it rises; `spread`: sideways speed.
  puff(x, y, z, { size = 2, grow = 1, life = 4, tint = '#8a8480', alpha = 0.6, heat = 0, lift = 1.5, spread = 0.5, drag = 0.25 } = {}) {
    if (this.list.length >= MOST) this.list.shift();
    const a = Math.random() * 6.283, s = spread * (0.4 + Math.random() * 0.6);
    this.c.set(tint);
    this.list.push({ x, y, z, vx: Math.cos(a) * s, vy: lift * (0.7 + Math.random() * 0.6), vz: Math.sin(a) * s, size: size * (0.8 + Math.random() * 0.4), grow, life: life * (0.8 + Math.random() * 0.4), age: 0, alpha, heat, drag, seed: Math.random(), r: this.c.r, g: this.c.g, b: this.c.b });
  }

  // A cloud of dust where something broke or fell: low, wide, settling quickly.
  dust(x, y, z, tint, amount = 1, reach = 2) {
    const n = Math.min(14, Math.ceil(3 + amount * 4));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = Math.random() * reach;
      this.puff(x + Math.cos(a) * r, y + Math.random() * reach * 0.4, z + Math.sin(a) * r, { size: 1.2 + reach * 0.5 + amount * 0.6, grow: 0.9 + amount * 0.3, life: 2.2 + amount, tint, alpha: 0.42, lift: 0.35, spread: 1.2 + reach * 0.4 });
    }
  }

  // A fire's smoke: a column fed for `life` seconds, `strength` from a campfire (0.3) to a town (3).
  column(x, y, z, strength = 1, life = 6) {
    const near = this.columns.find((c) => Math.hypot(c.x - x, c.z - z) < 6 + strength * 3);
    if (near) {
      near.life = Math.max(near.life, life);
      near.strength = Math.min(4, Math.max(near.strength, strength) + 0.05);
      near.y = Math.min(near.y, y);
      return near;
    }
    const c = { x, y, z, strength, life, wait: 0 };
    this.columns.push(c);
    return c;
  }

  update(dt) {
    for (const c of this.columns) {
      c.life -= dt;
      if ((c.wait -= dt) > 0) continue;
      c.wait = 0.32 / Math.min(2, 0.6 + c.strength * 0.4);
      const s = c.strength;
      this.puff(c.x + (Math.random() - 0.5) * s * 2, c.y + 1, c.z + (Math.random() - 0.5) * s * 2, {
        size: 1.4 + s * 0.9, grow: 0.4 + s * 0.35, life: 7 + s * 4, drag: 0.07, tint: Math.random() < 0.35 ? '#2e2a28' : '#57514c', alpha: 0.42 + Math.min(0.2, s * 0.07), heat: 0.7, lift: 2.4 + s * 1.2, spread: 0.35,
      });
    }
    this.columns = this.columns.filter((c) => c.life > 0);
    const { at, look, tint } = this;
    let n = 0;
    this.list = this.list.filter((p) => (p.age += dt) < p.life);
    for (const p of this.list) {
      const k = p.age / p.life;
      p.vx *= 1 - dt * 0.6;
      p.vz *= 1 - dt * 0.6;
      p.vy *= 1 - dt * p.drag;
      p.x += (p.vx + WIND.x * k * 2) * dt;
      p.z += (p.vz + WIND.y * k * 2) * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      at.setXYZ(n, p.x, p.y, p.z);
      look.setXYZW(n, p.size, p.alpha * Math.min(1, k * 6) * (1 - k) * (1 - k * 0.3), p.seed, p.heat * Math.max(0, 1 - k * 2.5));
      tint.setXYZ(n, p.r, p.g, p.b);
      n++;
    }
    at.needsUpdate = look.needsUpdate = tint.needsUpdate = true;
    this.mesh.geometry.instanceCount = n;
    // Light and fog as the land has them now.
    const u = this.uniforms, fog = this.mesh.parent?.fog;
    u.uSunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
    u.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity * 0.45);
    u.uAmb.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.55);
    if (fog) {
      u.uFogCol.value.copy(fog.color);
      u.uFogDensity.value = fog.density;
    }
  }
}

// Fire light: a few point lights, always in the scene so no shader is ever rebuilt for them,
// moved each frame to the biggest fires near the camera, flickering.
const LIGHTS = 3;
export class FireLights {
  constructor(scene) {
    this.lights = Array.from({ length: LIGHTS }, () => {
      const l = new THREE.PointLight('#ff9a4a', 0, 34, 1.6);
      scene.add(l);
      return l;
    });
    this.t = 0;
  }

  // fires: [{x, y, z, strength}]
  update(dt, fires, eye) {
    this.t += dt;
    const near = fires.map((f) => [f, Math.hypot(f.x - eye.x, f.z - eye.z) / (0.5 + f.strength)]).sort((a, b) => a[1] - b[1]).slice(0, LIGHTS);
    this.lights.forEach((l, i) => {
      const f = near[i]?.[0];
      if (!f) {
        l.intensity = Math.max(0, l.intensity - dt * 40);
        return;
      }
      const flick = 0.75 + Math.sin(this.t * 13 + i * 2.1) * 0.12 + Math.sin(this.t * 31 + i) * 0.08 + Math.random() * 0.08;
      l.position.set(f.x, f.y + 2.5, f.z);
      l.distance = 18 + f.strength * 10;
      l.intensity = (20 + f.strength * 26) * flick;
    });
  }
}
