import * as THREE from 'three';
import { shared } from './materials.js';

// How each element looks. Fire is real moving flame, lightning is a jagged bolt with branches,
// ice is hard crystal, stone is stone, and the void is a hole in the picture.
const MAX_FLAMES = 320;
const FLAME_TINT = [[1, 0], [0, 1]]; // kind 0 fire, kind 1 void

// Every flame in the game is one instance here, turned to face the camera in the shader.
export class Flames {
  constructor(scene) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.at = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLAMES * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLAMES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aAt', this.at);
    g.setAttribute('aLook', this.look);
    g.instanceCount = 0;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: shared.uTime, uNoise: shared.uNoise },
      vertexShader: /* glsl */`attribute vec3 aAt; attribute vec4 aLook; varying vec2 vU; varying vec3 vL;
        void main(){
          vec3 side=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
          vec3 p=aAt+side*position.x*aLook.x*.8+vec3(0.,1.,0.)*position.y*aLook.x*1.5;
          vU=position.xy+vec2(.5,0.); vL=aLook.yzw;
          vL.y*=smoothstep(3.,14.,distance(aAt,cameraPosition))*.8+.2; // flames at the lens must not blind
          gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        }`,
      fragmentShader: /* glsl */`varying vec2 vU; varying vec3 vL; uniform float uTime; uniform sampler2D uNoise;
        float vn(vec2 p){ return texture2D(uNoise,(p+.5)/256.).r; }
        void main(){
          float t=uTime*1.9+vL.x*17.;
          vec2 u=vU; u.x+=(vn(vec2(u.y*2.+vL.x*31.,t*.8))-.5)*.34*u.y;
          float n=vn(vec2(u.x*3.4+vL.x*91.,u.y*2.6-t*2.2))*.62+vn(vec2(u.x*7.+vL.x*13.,u.y*5.-t*3.5))*.38;
          float width=(1.-abs(u.x-.5)*2.);
          float body=width*(1.-u.y*u.y)*1.5-u.y*.55+(n-.5)*1.15;
          float a=smoothstep(.18,.62,body)*vL.y*smoothstep(0.,.08,u.y+.02);
          if(a<.01) discard;
          float hot=smoothstep(.4,1.05,body);
          vec3 fire=mix(vec3(.8,.09,.01),mix(vec3(1.3,.42,.04),vec3(1.7,1.2,.5),hot),hot);
          vec3 dark=mix(vec3(.1,.01,.26),vec3(.6,.16,1.4),hot);
          gl_FragColor=vec4(mix(fire,dark,vL.z)*a,a);
        }`,
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.list = [];
  }

  add(x, y, z, size, life, kind) {
    if (this.list.length >= MAX_FLAMES) this.list.shift();
    this.list.push({ x, y, z, size, life, age: 0, kind, seed: Math.random() });
  }

  update(dt) {
    const { at, look } = this;
    let n = 0;
    this.list = this.list.filter((f) => (f.age += dt) < f.life);
    for (const f of this.list) {
      const k = f.age / f.life, grow = Math.min(1, k * 7) * (1 - k * k * 0.6);
      at.setXYZ(n, f.x, f.y + k * f.size * 0.3, f.z);
      look.setXYZW(n, f.size * grow, f.seed, Math.min(1, (1 - k) * 2.2), FLAME_TINT[f.kind][1]);
      n++;
    }
    at.needsUpdate = look.needsUpdate = true;
    this.mesh.geometry.instanceCount = n;
  }
}

// A bolt of lightning: two crossed ribbons along a jagged path, so it holds up from any angle.
const BOLT_STEPS = 12;
export function makeBolt(scene) {
  const pos = new Float32Array((BOLT_STEPS + 1) * 4 * 3), idx = [];
  for (let i = 0; i < BOLT_STEPS; i++) for (const r of [0, 1]) {
    const a = i * 2 + r * (BOLT_STEPS + 1) * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.frustumCulled = false;
  m.visible = false;
  scene.add(m);
  return m;
}

export function shapeBolt(mesh, a, b, width) {
  const p = mesh.geometry.attributes.position, span = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), wild = Math.min(2.6, span * 0.09);
  const n = BOLT_STEPS + 1;
  for (let i = 0; i < n; i++) {
    const t = i / BOLT_STEPS, off = i && i < BOLT_STEPS ? wild : 0, w = width * (1 - t * 0.55);
    const x = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * off, y = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * off, z = a.z + (b.z - a.z) * t + (Math.random() - 0.5) * off;
    p.setXYZ(i * 2, x - w, y, z);
    p.setXYZ(i * 2 + 1, x + w, y, z);
    p.setXYZ((n + i) * 2, x, y, z - w);
    p.setXYZ((n + i) * 2 + 1, x, y, z + w);
  }
  p.needsUpdate = true;
}
