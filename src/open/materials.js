import * as THREE from 'three';

// Pixel-art surfaces with no texture files: the color of each "texel" is worked out in the
// shader from its world position, so the 8 km world never repeats.
const TEXELS = 12; // texels per tile
const HASH = /* glsl */`
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
`;

export const shared = { uTime: { value: 0 }, uHole: { value: new THREE.Vector3(0, 0, 0) } };

export function terrainMaterial({ far = false } = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHole = shared.uHole;
    s.vertexShader = `attribute vec3 aBiome; attribute float aRoad;
      varying vec3 vP; varying vec3 vN; varying vec3 vB; varying float vR;\n${s.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vP=(modelMatrix*vec4(position,1.)).xyz; vN=normal; vB=aBiome; vR=aRoad;`,
    );
    s.fragmentShader = `varying vec3 vP; varying vec3 vN; varying vec3 vB; varying float vR; uniform vec3 uHole;
      ${HASH}\n${s.fragmentShader}`.replace(
      '#include <color_fragment>',
      /* glsl */`
      ${far ? 'if(max(abs(vP.x-uHole.x),abs(vP.z-uHole.z))<uHole.y) discard;' : ''}
      float dist=length(vP-cameraPosition);
      float slope=1.-normalize(vN).y;
      float rocky=smoothstep(.3,.42,slope);
      vec2 uv=mix(vP.xz,vec2(vP.x+vP.z,vP.y*1.6),step(.5,rocky));
      vec2 c=floor(uv*${TEXELS.toFixed(1)})/${TEXELS.toFixed(1)};
      float detail=1.-smoothstep(120.,520.,dist);
      float n=h21(c), n2=h21(c+7.3);
      float patchy=vn(floor(c*3.)/3.*.11), big=vn(c*.013);
      vec3 col;
      // pick one ground type per texel (dithered) so borders break up like pixel art
      vec3 w=vB+vec3(n,n2,h21(c+3.1))*.45*detail+(vec3(patchy,big,1.-patchy)-.5)*.5;
      if(w.x>=w.y&&w.x>=w.z){ // golden meadow
        col=mix(vec3(.42,.56,.16),vec3(.73,.66,.14),patchy);
        if(n>.93) col=vec3(.86,.2,.12); else if(n>.86) col=vec3(.95,.78,.2);
      } else if(w.y>=w.z){ // crimson wood floor
        col=mix(vec3(.52,.17,.09),vec3(.74,.42,.1),patchy);
        if(n>.9) col=vec3(.82,.55,.12);
      } else { // deep pine wood
        col=mix(vec3(.1,.27,.17),vec3(.2,.38,.16),patchy);
        if(n>.94) col=vec3(.45,.24,.42);
      }
      col*=.82+n2*.3*detail;
      // pale shore and dark seabed
      float sand=1.-smoothstep(1.5,5.+n*3.,vP.y);
      col=mix(col,vec3(.8,.72,.52)*(.9+n*.2),sand);
      if(vP.y<-.5) col=mix(vec3(.2,.32,.38),vec3(.05,.13,.22),smoothstep(0.,24.,-vP.y));
      // cliffs in lilac-grey strata, with a warm lit edge
      if(rocky>.5){
        float strata=vn(vec2(floor(vP.y*1.3)*.37,(vP.x+vP.z)*.02));
        col=mix(vec3(.44,.42,.44),vec3(.7,.67,.62),strata)*(.85+n*.25);
      }
      // snow on the heights
      float snow=smoothstep(300.,380.,vP.y+n*30.)*(1.-rocky*.6);
      col=mix(col,vec3(.9,.93,1.)*(.92+n*.1),snow);
      // cobbled roads: rounded stones with dark gaps
      if(vR>.5){
        vec2 q=vP.xz*1.7; q.x+=step(1.,mod(floor(q.y),2.))*.5;
        vec2 f=fract(q)-.5; float id=h21(floor(q));
        float gap=step(.4,max(abs(f.x),abs(f.y)));
        vec3 stone=mix(vec3(.63,.5,.34),vec3(.86,.76,.56),id);
        col=mix(stone,vec3(.46,.34,.24),gap)*(.9+n*.2);
      }
      diffuseColor.rgb=col;`,
    );
  };
  mat.customProgramCacheKey = () => `terrain${far}`;
  return mat;
}

export function waterMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.84 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.vertexShader = `varying vec3 vP;\n${s.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = `varying vec3 vP; uniform float uTime; ${HASH}\n${s.fragmentShader}`.replace(
      '#include <color_fragment>',
      /* glsl */`
      vec2 c=floor(vP.xz*2.)/2.;
      float a=vn(c*.05+uTime*.12), b=vn(c*.17-uTime*.2);
      vec3 col=mix(vec3(.13,.36,.5),vec3(.33,.62,.68),a);
      float glint=step(.8,b*a*2.);
      col=mix(col,vec3(.86,.84,.86),glint*.65);
      diffuseColor.rgb=col;`,
    );
  };
  mat.customProgramCacheKey = () => 'water';
  return mat;
}

// Banded, dithered sky with a soft sun and drifting cloud bars.
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uCloud: { value: new THREE.Color() }, uTime: shared.uTime,
    },
    vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`varying vec3 vD; uniform vec3 uTop,uMid,uLow,uSun,uSunCol,uCloud; uniform float uTime; ${HASH}
      void main(){
        vec3 d=normalize(vD);
        float y=max(d.y,0.);
        // quantize into bands, dithered on screen pixels
        float dither=h21(floor(gl_FragCoord.xy))*.012;
        float t=floor((y+dither)*48.)/48.;
        vec3 col=mix(uLow,uMid,smoothstep(0.,.14,t)); col=mix(col,uTop,smoothstep(.1,.6,t));
        float s=dot(d,uSun);
        col=mix(col,uSunCol,smoothstep(.8,.995,s)*.6);
        col=mix(col,vec3(1.,.9,.86),smoothstep(.985,.9975,s)*.7);
        col=mix(col,vec3(1.,.96,.92),step(.9992,s));
        // cloud bars
        vec2 p=d.xz/(y+.12);
        vec2 cc=floor(p*36.)/36.;
        float cl=vn(cc*vec2(.5,1.6)+vec2(uTime*.01,0.))*.65+vn(cc*vec2(1.2,3.)+3.)*.35;
        cl*=vn(cc*.35+9.)*1.5;
        float edge=h21(cc)*.05, fade=smoothstep(.02,.2,y);
        col=mix(col,uCloud*.8,step(.5+edge,cl)*fade*.5);
        col=mix(col,uCloud,step(.58+edge,cl)*fade*.8);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
}
