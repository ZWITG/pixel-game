import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Puts two finished views on screen, either side of a line that points from one hero to the
// other. Near the start of a split both views match, so the line appears without a jump.
export default class SplitView {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: { tA: { value: null }, tB: { value: null }, uN: { value: new THREE.Vector2(1, 0) }, uAspect: { value: 16 / 9 }, uLine: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: /* glsl */`varying vec2 vUv; uniform sampler2D tA,tB; uniform vec2 uN; uniform float uAspect,uLine;
        void main(){
          float d=dot((vUv-.5)*vec2(uAspect,1.),uN);
          vec3 c=d<0.?texture2D(tA,vUv).rgb:texture2D(tB,vUv).rgb;
          if(abs(d)<uLine*.005) c=vec3(.95,.92,.85);
          else if(abs(d)<uLine*.009) c=vec3(.08,.1,.16);
          gl_FragColor=vec4(c,1.);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, a, b, normal, line, aspect) {
    const u = this.material.uniforms;
    u.tA.value = a;
    u.tB.value = b;
    u.uN.value.copy(normal);
    u.uLine.value = line;
    u.uAspect.value = aspect;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }
}
