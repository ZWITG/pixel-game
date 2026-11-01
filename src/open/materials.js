import * as THREE from 'three';

// Surfaces with no texture files: every color is worked out in the shader from the world
// position, so the 8 km world never repeats.
const HASH = /* glsl */`
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
uniform sampler2D uNoise;
float vn(vec2 p){ return texture2D(uNoise,(p+.5)/256.).r; }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03+3.1)*.3+vn(p*4.1+7.7)*.2; }
`;

// Smooth noise comes from one small tiling texture: a lookup costs a tenth of working it out.
function noiseTexture() {
  const size = 256, data = new Uint8Array(size * size);
  let seed = 2024;
  for (let i = 0; i < data.length; i++) data[i] = (seed = (seed * 16807) % 2147483647) % 256;
  const t = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// The land's scars (see scars.js): a window of the world that wraps, so it never has to scroll.
export const SCAR_CELLS = 128, SCAR_SIZE = 384;
function scarTexture() {
  const t = new THREE.DataTexture(new Uint8Array(SCAR_CELLS * SCAR_CELLS * 4), SCAR_CELLS, SCAR_CELLS, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
export const SCAR_GLSL = `uniform sampler2D uScars; uniform vec2 uScarAt;
  vec4 scarAt(vec2 p){ return texture2D(uScars,p/${SCAR_SIZE.toFixed(1)})*(1.-smoothstep(150.,180.,distance(p,uScarAt))); }`;

export const shared = {
  uScars: { value: scarTexture() }, uScarAt: { value: new THREE.Vector2() },
  uTime: { value: 0 }, uNoise: { value: noiseTexture() }, uHole: { value: new THREE.Vector3(0, 0, 0) }, uHole2: { value: new THREE.Vector3(0, 0, 0) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSkyTop: { value: new THREE.Color() }, uSkyLow: { value: new THREE.Color() }, uNight: { value: 0 },
};

// Fog that lies low: thick in the valleys, thin on the peaks, for every material in the world.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth; varying float vFogY;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogDepth = -mvPosition.z; vFogY = (vec4(mvPosition.xyz, 0.) * viewMatrix).y + cameraPosition.y;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth; varying float vFogY; uniform float fogDensity;
#endif`;
THREE.ShaderChunk.fog_fragment = /* glsl */`
  #ifdef USE_FOG
  float fogRise = vFogY - cameraPosition.y;
  float fogThin = abs(fogRise) < 1.0 ? exp(-0.005 * cameraPosition.y) : (exp(-0.005 * cameraPosition.y) - exp(-0.005 * vFogY)) / (0.005 * fogRise);
  float fogFactor = 1.0 - exp(-fogDensity * vFogDepth * clamp(fogThin, 0.05, 1.0));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #endif`;

// A shadow fades out toward the edge of the sun's reach rather than stopping at a line.
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace(
  'return shadow;',
  'return mix(shadow, 1.0, smoothstep(0.7, 0.98, max(abs(shadowCoord.x - 0.5), abs(shadowCoord.y - 0.5)) * 2.0));',
);

export function terrainMaterial({ far = false } = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHole = shared.uHole;
    s.uniforms.uHole2 = shared.uHole2;
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uNoise = shared.uNoise;
    s.uniforms.uScars = shared.uScars;
    s.uniforms.uScarAt = shared.uScarAt;
    s.vertexShader = `attribute vec3 aBiome; attribute float aRoad; attribute vec2 aLand;
      varying vec3 vP; varying vec3 vN; varying vec3 vB; varying float vR; varying vec2 vL;\n${s.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       ${far ? 'transformed.y-=3.;' : ''} // the far land sits just under the near land, where they overlap
       vP=(modelMatrix*vec4(transformed,1.)).xyz; vN=normal; vB=aBiome; vR=aRoad; vL=aLand;`,
    );
    s.fragmentShader = `varying vec3 vP; varying vec3 vN; varying vec3 vB; varying float vR; varying vec2 vL; uniform vec3 uHole,uHole2; uniform float uTime;
      ${HASH}
      ${SCAR_GLSL}
      float groundBump(vec2 p){ return vn(p*.9)*.5+vn(p*3.1)*.25; }
      \n${s.fragmentShader}`.replace(
      '#include <color_fragment>',
      /* glsl */`
      ${far ? 'if(max(abs(vP.x-uHole.x),abs(vP.z-uHole.z))<uHole.y||max(abs(vP.x-uHole2.x),abs(vP.z-uHole2.z))<uHole2.y) discard;' : ''}
      vec3 at=vP;
      float dist=length(vP-cameraPosition);
      float detail=1.-smoothstep(90.,420.,dist);
      vec2 g=at.xz+vec2(at.y*.6,-at.y*.4); // a slope keeps its grain instead of stretching
      float big=fb(g*.0045), mid=fb(g*.03), fine=vn(g*.31)*detail+.5*(1.-detail), speck=vn(g*2.3)*detail+.5*(1.-detail);
      float slope=1.-normalize(vN).y;
      float rocky=smoothstep(.2,.36,slope+(mid-.5)*.18);
      float mixy=(mid-.5)*.5+(fine-.5)*.25;
      // the three ground types melt into each other along a noisy edge
      vec3 w=max(vB+vec3(mixy,big-.5,-mixy)*.7,vec3(.001)); w=w*w*w; w/=w.x+w.y+w.z;
      vec3 meadow=mix(vec3(.2,.33,.1),vec3(.38,.44,.13),big);
      meadow=mix(meadow,vec3(.5,.47,.16),smoothstep(.55,.72,mid)*.5);
      vec3 autumn=mix(vec3(.36,.2,.1),vec3(.56,.34,.13),mid);
      vec3 pine=mix(vec3(.09,.2,.13),vec3(.17,.29,.14),mid);
      vec3 col=meadow*w.x+autumn*w.y+pine*w.z;
      float edgeNoise=(mid-.5)*.5+(fine-.5)*.18;
      col=mix(col,mix(vec3(.54,.27,.15),vec3(.75,.5,.28),mid),smoothstep(.45,.55,vL.x+edgeNoise)); // badlands: red dust and pale salt
      col=mix(col,mix(vec3(.1,.14,.1),vec3(.22,.26,.13),mid),smoothstep(.45,.55,vL.y+edgeNoise));  // swamp: black peat and sour moss
      col*=.86+fine*.2+(speck-.5)*.12;
      // pale shore, darker where the water laps it, then seabed
      float sand=1.-smoothstep(.6,1.7+mid*1.6,vP.y);
      col=mix(col,vec3(.72,.65,.48)*(.92+fine*.16),sand);
      col*=1.-.32*smoothstep(.9,.1,vP.y)*step(0.,vP.y+.6);
      if(vP.y<-.4) col=mix(vec3(.3,.34,.3),vec3(.05,.12,.18),smoothstep(0.,9.,-vP.y));
      // cliffs in grey strata; bands of red rock in the badlands
      float strata=vn(vec2((at.x+at.z)*.03,at.y*.7))*.6+vn(vec2((at.x-at.z)*.1,at.y*2.1))*.4;
      vec3 rock=mix(vec3(.3,.29,.3),vec3(.56,.53,.49),strata);
      rock=mix(rock,mix(vec3(.42,.17,.11),vec3(.74,.44,.26),strata),smoothstep(.35,.5,vL.x));
      col=mix(col,rock*(.85+fine*.3),rocky);
      // snow on the heights, thinning on steep faces
      float snow=smoothstep(300.,380.,vP.y+(mid-.5)*80.)*(1.-rocky*.7);
      col=mix(col,vec3(.86,.9,.97)*(.95+fine*.08),snow);
      // the roads: packed earth, cobbled where you can see the stones
      float road=smoothstep(4.6,3.2,vR+(mid-.5)*2.2);
      if(road>0.){
        vec3 way=mix(vec3(.44,.34,.23),vec3(.58,.48,.34),mid);
        if(detail>0.){
          vec2 q=vP.xz*1.5; q.x+=step(1.,mod(floor(q.y),2.))*.5;
          vec2 f=fract(q)-.5; float id=h21(floor(q));
          float stone=smoothstep(.5,.33,length(f*vec2(1.,1.1)));
          way=mix(way,mix(vec3(.46,.42,.37),vec3(.68,.62,.52),id),stone*smoothstep(3.6,2.2,vR)*detail);
        }
        col=mix(col,way,road);
      }
      // what powers have done to the ground: char, frost, rot, and embers still glowing
      {
        vec4 sc=scarAt(vP.xz); float rough=(fine-.5)*.5+(speck-.5)*.5+(mid-.5)*.4;
        col=mix(col,vec3(.05,.042,.04)*(.7+fine*.7),smoothstep(.1,.45,sc.r+rough*.25));
        float ice=smoothstep(.12,.42,sc.g+rough*.3);
        col=mix(col,mix(vec3(.62,.8,.92),vec3(.93,.97,1.),speck),ice);
        float rot=smoothstep(.12,.5,sc.b+rough*.35);
        col=mix(col,vec3(.05,.02,.09),rot);
        totalEmissiveRadiance+=vec3(.42,.08,.8)*rot*smoothstep(.022,.004,abs(vn(vP.xz*.21+uTime*.012)-.5))*detail;
        totalEmissiveRadiance+=vec3(1.8,.5,.08)*smoothstep(.1,.7,sc.a)*(.35+speck*1.2);
        totalEmissiveRadiance+=vec3(1.1,.26,.04)*smoothstep(.45,.8,sc.r)*smoothstep(.72,.8,vn(vP.xz*.9))*.5;
      }
      // cloud shade drifting over the land
      float shade=smoothstep(.42,.68,fb(vP.xz*.0016+vec2(uTime*.006,uTime*.003)));
      col*=1.-shade*.26*(1.-snow*.4);
      diffuseColor.rgb=col;`,
    ).replace(
      '#include <normal_fragment_maps>',
      /* glsl */`#include <normal_fragment_maps>
      {
        // small bumps catch the light, close up
        float reach=1.-smoothstep(25.,90.,length(vP-cameraPosition));
        if(reach>0.){
          vec2 p=vP.xz; float e=.25, h0=groundBump(p);
          vec3 d=vec3(groundBump(p+vec2(e,0.))-h0,0.,groundBump(p+vec2(0.,e))-h0)*.9*reach;
          normal=normalize(normal-(viewMatrix*vec4(d,0.)).xyz);
        }
      }`,
    );
  };
  mat.customProgramCacheKey = () => `terrain${far}`;
  return mat;
}

// Cut stone for walls and paving: blocks and flagstones laid out in world space, strongest on
// grey surfaces. Colored ones get faint boards instead. The color comes from the model.
export function masonry() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uNoise = shared.uNoise;
    s.vertexShader = `varying vec3 vW; varying vec3 vWN;\n${s.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*normal);',
    );
    s.fragmentShader = `varying vec3 vW; varying vec3 vWN; ${HASH}\n${s.fragmentShader}`.replace(
      '#include <color_fragment>',
      /* glsl */`#include <color_fragment>
      {
        vec3 c=diffuseColor.rgb, n=abs(vWN);
        float grey=1.-smoothstep(.06,.34,(max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)))/max(c.g,.02));
        float along=n.x>n.z?vW.z:vW.x, near=1.-smoothstep(120.,520.,length(vW-cameraPosition));
        vec2 q=n.y>.7?vW.xz*.42:vec2(along*.42,vW.y*.8);
        q.x+=step(1.,mod(floor(q.y),2.))*.5;
        vec2 f=fract(q); float id=h21(floor(q));
        float seam=smoothstep(0.,.05,min(f.x,1.-f.x))*smoothstep(0.,.08,min(f.y,1.-f.y));
        float stone=(.68+.32*seam)*(.84+id*.26)*(.88+vn(vW.xz*.3+vW.y*.4)*.24);
        float boards=.9+.1*smoothstep(0.,.08,abs(fract(along*1.5)-.5))+(vn(vec2(along*1.5,vW.y*.15))-.5)*.14;
        diffuseColor.rgb=c*mix(1.,mix(boards,stone,grey),near);
      }`,
    );
  };
  mat.customProgramCacheKey = () => 'masonry';
  return mat;
}

// Clear at the shore, deep blue further out; it mirrors the sky at a low angle and glitters
// under the sun. `depth` is 1 metre everywhere on the great plane far out at sea.
export function waterMaterial({ plane = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...shared },
    vertexShader: /* glsl */`attribute float aDepth; varying vec3 vP; varying float vD;
      ${THREE.ShaderChunk.fog_pars_vertex}

      void main(){
        vD=${plane ? '9.' : 'aDepth'};
        vec4 world=modelMatrix*vec4(position,1.); vP=world.xyz;
        vec4 mvPosition=viewMatrix*world; gl_Position=projectionMatrix*mvPosition;
${THREE.ShaderChunk.fog_vertex}

      }`,
    fragmentShader: /* glsl */`varying vec3 vP; varying float vD; uniform float uTime; uniform vec3 uHole,uHole2,uSunDir,uSunCol,uSkyTop,uSkyLow; uniform float uNight;
      ${HASH}
      ${SCAR_GLSL}
      ${THREE.ShaderChunk.fog_pars_fragment}
      float wave(vec2 p){ return vn(p*.21+vec2(uTime*.16,uTime*.05))*.6+vn(p*.53-vec2(uTime*.13,-uTime*.2))*.3+vn(p*1.3+vec2(uTime*.3,0.))*.1; }
      void main(){
        ${plane ? 'if(max(abs(vP.x-uHole.x),abs(vP.z-uHole.z))<uHole.y||max(abs(vP.x-uHole2.x),abs(vP.z-uHole2.z))<uHole2.y) discard;' : ''}
        vec3 view=cameraPosition-vP; float dist=length(view); view/=dist;
        vec2 p=vP.xz;
        float fall=1.-smoothstep(120.,900.,dist)*.85, e=.35, h0=wave(p);
        vec3 n=normalize(vec3((h0-wave(p+vec2(e,0.)))*1.4*fall,1.,(h0-wave(p+vec2(0.,e)))*1.4*fall));
        float deep=smoothstep(0.,7.,vD), fres=.03+.97*pow(1.-max(dot(n,view),0.),5.);
        vec3 body=mix(vec3(.11,.47,.47),vec3(.02,.13,.25),deep);
        vec3 r=reflect(-view,n); r.y=abs(r.y);
        vec3 sky=mix(uSkyLow,uSkyTop,smoothstep(0.,.5,r.y));
        vec3 col=mix(body*(.35+.65*max(uSunDir.y+.15,.1))*(1.-uNight*.82),sky,fres*.85);
        float glint=pow(max(dot(r,uSunDir),0.),320.)*5.+pow(max(dot(r,uSunDir),0.),40.)*.12;
        col+=uSunCol*glint;
        // foam lines breathing against the shore
        float lap=vD-(.25+.2*sin(uTime*.9+vn(p*.2)*9.));
        float foam=smoothstep(.2,0.,abs(lap))*smoothstep(.3,.6,vn(p*1.7+uTime*.1));
        col=mix(col,vec3(.9,.95,.95)*(.4+.6*max(uSunDir.y+.2,.2))*(1.-uNight*.7),foam*.75);
        // frost closes over the water in plates, cracked between them
        float ice=smoothstep(.16,.36,scarAt(vP.xz).g+(vn(p*.5)-.5)*.2);
        float crack=smoothstep(.02,.0,abs(vn(p*.42)-.5))*.5+smoothstep(.015,.0,abs(vn(p*1.1+9.)-.5))*.3;
        col=mix(col,mix(vec3(.5,.74,.88),vec3(.86,.95,1.),vn(p*.16))*(1.-crack)*(.5+.6*max(uSunDir.y+.2,.2)),ice);
        float water=clamp(max(smoothstep(0.,2.6,vD)*.58+.36*deep+glint,foam),0.,1.)*smoothstep(0.,.14,vD);
        gl_FragColor=vec4(col,max(water,ice*.97));
${THREE.ShaderChunk.fog_fragment}

      }`,
  });
}

// A deep gradient, soft sun and moon, stars, and clouds that are lit from the sun's side.
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uNight: { value: 0 },
      uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uCloud: { value: new THREE.Color() }, uTime: shared.uTime, uNoise: shared.uNoise,
    },
    vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`varying vec3 vD; uniform vec3 uTop,uMid,uLow,uFog,uSun,uSunCol,uCloud; uniform float uTime,uNight; ${HASH}
      void main(){
        vec3 d=normalize(vD);
        float y=max(d.y,0.);
        vec3 col=mix(uLow,uMid,smoothstep(0.,.16,y)); col=mix(col,uTop,smoothstep(.1,.62,y));
        float s=max(dot(d,uSun),0.);
        col+=uSunCol*(pow(s,6.)*.14+pow(s,60.)*.4);
        col+=uSunCol*smoothstep(.9988,.9994,s)*5.;
        if(uNight>0.){
          vec3 q=floor(d*190.); float star=fract(sin(dot(q,vec3(12.9,78.2,37.7)))*43758.5);
          col+=vec3(.9,.95,1.)*step(.9965,star)*(.6+.4*sin(uTime*2.+star*800.))*uNight*smoothstep(.02,.2,y);
        }
        // clouds on a far ceiling
        vec2 p=d.xz/(y+.16)*.9+vec2(uTime*.006,uTime*.002);
        float c=fb(p*1.1)*.72+fb(p*3.4+5.)*.28;
        float mask=smoothstep(.5,.72,c)*smoothstep(.015,.2,y);
        float lit=clamp(.55+(c-fb((p+uSun.xz*.09)*1.1)*.72-fb((p+uSun.xz*.09)*3.4+5.)*.28)*5.,0.,1.);
        col=mix(col,mix(uCloud*.62+uMid*.18,uCloud*1.12+uSunCol*.1,lit),mask*.92);
        col=mix(uFog,col,smoothstep(-.01,.075,d.y));
        gl_FragColor=vec4(col,1.);
      }`,
  });
}
