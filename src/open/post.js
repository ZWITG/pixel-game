import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';

// Light shafts from the sun, then the color grade and vignette.
const GRADE = {
  uniforms: {
    tDiffuse: { value: null }, uSun: { value: new THREE.Vector2() }, uShaft: { value: 0 },
    uSunCol: { value: new THREE.Color() }, uShadow: { value: new THREE.Color() }, uSat: { value: 1.15 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */`varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uShaft,uSat; uniform vec3 uSunCol,uShadow;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      if(uShaft>0.){
        vec2 d=(uSun-vUv)/18.; vec2 p=vUv+d*h(gl_FragCoord.xy); float s=0.;
        for(int i=0;i<18;i++){ p+=d; s+=smoothstep(.7,1.6,dot(texture2D(tDiffuse,p).rgb,vec3(.33)))*(1.-float(i)/30.); }
        c+=uSunCol*uShaft*s/18.;
      }
      float l=dot(c,vec3(.3,.59,.11));
      c=mix(vec3(l),c,uSat);
      c=mix(c+uShadow*.5*(1.-smoothstep(0.,.5,l)),c,.5); // colored shadows, never dead black
      vec2 v=vUv-.5; c*=1.-dot(v,v)*.75;
      gl_FragColor=vec4(c,1.);
    }`,
};

// Last step, after tone mapping: limit each channel to a few levels with an ordered dither,
// the banding of hand-made pixel art.
const FINISH = {
  uniforms: { tDiffuse: { value: null }, uLevels: { value: 42 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uLevels;
    float bayer(vec2 p){ ivec2 i=ivec2(mod(p,4.)); int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[i.y*4+i.x])/16.-.5; }
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      c=floor(c*uLevels+.5+bayer(gl_FragCoord.xy)*.9)/uLevels;
      gl_FragColor=vec4(c,1.);
    }`,
};

export default class Post {
  constructor(renderer, scene, camera) {
    this.camera = camera;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.7, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(FINISH));
    this.v = new THREE.Vector3();
  }

  setTime({ sunCol, shaft, shadow, sat, bloom }) {
    const u = this.grade.uniforms;
    u.uSunCol.value.set(sunCol);
    u.uShadow.value.set(shadow);
    u.uSat.value = sat;
    this.shaft = shaft;
    this.bloom.strength = bloom;
  }

  resize(w, h) {
    this.composer.setSize(w, h);
  }

  // Shafts fade out when the sun is behind the camera.
  render(sunDir) {
    const u = this.grade.uniforms, v = this.v;
    v.copy(sunDir).multiplyScalar(3000).add(this.camera.position).project(this.camera);
    const facing = v.z < 1 ? 1 - Math.min(1, Math.hypot(v.x, v.y) / 1.8) : 0;
    u.uSun.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    u.uShaft.value = this.shaft * facing;
    this.composer.render();
  }
}
