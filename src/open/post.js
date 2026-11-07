import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// The picture after the scene is drawn: a soft glow, light shafts, the color grade and tone
// curve. All of it is made from one small copy of the frame, so it costs little on a laptop.
const VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const SMALL = 4;      // the glow works at a quarter of the screen size
const MIN_SMALL = 64;

const pass = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });

// The bright parts of the frame, smoothly thresholded so glow never pops on and off.
const bright = () => pass(/* glsl */`varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uPx;
  void main(){
    vec3 c=(texture2D(tMap,vUv+uPx*vec2(-1,-1)).rgb+texture2D(tMap,vUv+uPx*vec2(1,-1)).rgb+texture2D(tMap,vUv+uPx*vec2(-1,1)).rgb+texture2D(tMap,vUv+uPx*vec2(1,1)).rgb)*.25;
    float l=max(c.r,max(c.g,c.b));
    gl_FragColor=vec4(min(c,vec3(6.))*smoothstep(.75,1.5,l),1.);
  }`, { tMap: { value: null }, uPx: { value: new THREE.Vector2() } });

const blur = () => pass(/* glsl */`varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uDir;
  void main(){
    vec3 c=texture2D(tMap,vUv).rgb*.227;
    c+=(texture2D(tMap,vUv+uDir*1.385).rgb+texture2D(tMap,vUv-uDir*1.385).rgb)*.316;
    c+=(texture2D(tMap,vUv+uDir*3.231).rgb+texture2D(tMap,vUv-uDir*3.231).rgb)*.07;
    gl_FragColor=vec4(c,1.);
  }`, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });

// Streaks of light running out from the sun, marched through the small copy.
const shafts = () => pass(/* glsl */`varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uSun;
  float h(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
  void main(){
    vec2 d=(uSun-vUv)/10.; vec2 p=vUv+d*h(gl_FragCoord.xy); float s=0.;
    for(int i=0;i<10;i++){ s+=smoothstep(.9,2.2,dot(texture2D(tMap,p).rgb,vec3(.33)))*(1.-float(i)/14.); p+=d; }
    gl_FragColor=vec4(vec3(s/10.),1.);
  }`, { tMap: { value: null }, uSun: { value: new THREE.Vector2() } });

const finish = () => pass(/* glsl */`varying vec2 vUv; uniform sampler2D tMap,tGlow,tShaft; uniform vec3 uSunCol,uShadow; uniform float uGlow,uShaft,uSat,uExposure,uImpact,uLines,uTime,uTintAmt,uGray; uniform vec3 uTint;
  float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
  vec3 curve(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
  void main(){
    vec3 c=texture2D(tMap,vUv).rgb;
    c+=texture2D(tGlow,vUv).rgb*uGlow;
    c+=uSunCol*uShaft*texture2D(tShaft,vUv).r;
    c=curve(c*uExposure);
    float l=dot(c,vec3(.2126,.7152,.0722));
    c=mix(vec3(l),c,uSat);
    // An ultimate's mood: the colour drains, and the picture leans into its tint.
    c=mix(c,vec3(dot(c,vec3(.2126,.7152,.0722))),uGray);
    c=mix(c,c*uTint*1.5+uTint*.05,uTintAmt);
    c+=uShadow*.06*(1.-smoothstep(0.,.35,l));   // colored shadows, never dead black
    vec2 v=vUv-.5; c*=1.-dot(v,v)*.28;
    c=pow(max(c,vec3(0.)),vec3(1./2.2));
    // An impact frame: the picture turns to ink on paper, light and dark swapped, for an instant.
    float g=dot(c,vec3(.299,.587,.114));
    c=mix(c,mix(vec3(.97,.94,.86),vec3(.05,.03,.08),smoothstep(.36,.46,g)),uImpact);
    // Speed lines streaking in from the edges.
    if(uLines>0.){
      vec2 q=vUv-.5; q.x*=1.6;
      float r=length(q),n=fract(sin(floor(atan(q.y,q.x)*70.)+floor(uTime*24.)*3.17)*43758.5453);
      c=mix(c,vec3(1.),step(.8,n)*smoothstep(.25,.6,r)*uLines*.6);
    }
    c+=(ign(gl_FragCoord.xy)-.5)/255.;          // hides banding in soft skies
    gl_FragColor=vec4(c,1.);
  }`, {
  tMap: { value: null }, tGlow: { value: null }, tShaft: { value: null }, uGlow: { value: 0.3 }, uShaft: { value: 0 }, uSat: { value: 1 }, uExposure: { value: 1 },
  uImpact: { value: 0 }, uLines: { value: 0 }, uTime: { value: 0 }, uTintAmt: { value: 0 }, uGray: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') },
  uSunCol: { value: new THREE.Color() }, uShadow: { value: new THREE.Color() },
});

const target = (w, h, options = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...options });

export default class Post {
  constructor(renderer, scene, camera) {
    Object.assign(this, { renderer, scene, camera });
    this.quad = new FullScreenQuad();
    this.bright = bright();
    this.blur = blur();
    this.shafts = shafts();
    this.finish = finish();
    this.toScreen = true;
    this.shaft = 0;
    this.v = new THREE.Vector3();
    this.main = target(4, 4, { depthBuffer: true });
    this.glowA = target(4, 4);
    this.glowB = target(4, 4);
    this.ray = target(4, 4, { type: THREE.UnsignedByteType });
    this.final = target(4, 4, { type: THREE.UnsignedByteType });
  }

  setTime({ sunCol, shaft, shadow, sat, bloom }) {
    const u = this.finish.uniforms;
    u.uSunCol.value.set(sunCol);
    u.uShadow.value.set(shadow);
    u.uSat.value = sat;
    u.uGlow.value = bloom;
    this.shaft = shaft;
  }

  resize(w, h, samples = 0) {
    if (samples !== this.main.samples) {
      this.main.dispose();
      this.main.samples = samples;
    }
    const sw = Math.max(MIN_SMALL, Math.ceil(w / SMALL)), sh = Math.max(MIN_SMALL, Math.ceil(h / SMALL));
    this.main.setSize(w, h);
    this.final.setSize(w, h);
    this.glowA.setSize(sw, sh);
    this.glowB.setSize(sw, sh);
    this.ray.setSize(sw, sh);
    this.bright.uniforms.uPx.value.set(1 / w, 1 / h);
    this.px = [1 / sw, 1 / sh];
  }

  get output() {
    return this.final.texture;
  }

  draw(material, to) {
    this.renderer.setRenderTarget(to);
    this.quad.material = material;
    this.quad.render(this.renderer);
  }

  // Shafts fade out when the sun is behind the camera.
  render(sunDir) {
    const { renderer, v, bright: b, blur: g, shafts: s, finish: f, px } = this;
    renderer.setRenderTarget(this.main);
    renderer.render(this.scene, this.camera);

    b.uniforms.tMap.value = this.main.texture;
    this.draw(b, this.glowA);
    v.copy(sunDir).multiplyScalar(3000).add(this.camera.position).project(this.camera);
    const facing = v.z < 1 ? 1 - Math.min(1, Math.hypot(v.x, v.y) / 1.8) : 0, shaft = this.indoors ? 0 : this.shaft * facing;
    if (shaft > 0.01) {
      s.uniforms.tMap.value = this.main.texture;
      s.uniforms.uSun.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
      this.draw(s, this.ray);
    }
    for (const [from, to, x, y] of [[this.glowA, this.glowB, 1, 0], [this.glowB, this.glowA, 0, 1]]) {
      g.uniforms.tMap.value = from.texture;
      g.uniforms.uDir.value.set(x * px[0], y * px[1]);
      this.draw(g, to);
    }
    const u = f.uniforms;
    u.tMap.value = this.main.texture;
    u.tGlow.value = this.glowA.texture;
    u.tShaft.value = this.ray.texture;
    u.uShaft.value = shaft;
    this.draw(f, this.toScreen ? null : this.final);
  }
}
