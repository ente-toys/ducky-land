import {createAtlasBuild} from './atlas-work.js';
import {globeAtlasLayout} from './globe-atlas-layout.js';
import {textureSourceBytes,managedTextureMemory} from './texture-memory.js';
import {horizonRatio,pixelChart,lensAngle} from '../../world/sphere-projection.js';
import {spherePoint,localPoint,viewFrame} from '../../world/sphere-coordinates.js';
import {WORLD_GEO,worldIsland,WORLD_ISLANDS} from '../../world/world-map.js';
import {dot,expMap} from '../../world/sphere.js';
import {flatRigid} from '../../world/rigid.js';
import {globeScreen,paintWeight} from '../shared/globe-screen.js';
import {globeDrag,lonLat,centreOf,globeBall} from '../shared/globe-look.js';
import {mapOf} from '../../world/island-maps.js';
import {createHeartLocations,HEART_ACTIVITY_INTERVAL,HEART_ACTIVITY_CHANCE,HEART_ACTIVITY_LIMIT} from '../shared/heart-activity.js';
import {ISLETS,ISLET_ART} from '../../world/islets.js';
import {cloudState,CLOUD_SHADER} from './globe-clouds.js';

import {Container, GlProgram, Graphics, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Text, Texture} from 'pixi.js';
import {PALETTE} from '../shared/palette.js';
const ISLET_ATLAS_ROWS=Math.ceil(ISLET_ART.length/4);

const VERTEX = `
#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  vUV = aUV;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.)).xy, 0., 1.);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uScene;
uniform sampler2D uWorld;
uniform sampler2D uIslets;
uniform vec4 uWorldUV[13];
uniform vec4 uIsl[13];
uniform vec4 uIslFlat[13];
uniform vec4 uIslInfo[13];
uniform vec4 uIt[22];
uniform vec4 uItInfo[22];
uniform vec3 uIslC[13];
uniform vec3 uIslE[13];
uniform vec3 uIslN[13];
uniform vec4 uIslAux[13];
uniform vec3 uItC[22];
uniform vec3 uItE[22];
uniform vec3 uItN[22];
uniform vec4 uItAux[22];
uniform float uPaint;
uniform float uTime;
uniform vec2 uCam;
uniform float uZoom;
uniform vec2 uRes;
uniform float uR;
uniform float uBall;
uniform float uLive;
uniform vec4 uBasis;
uniform vec3 uSea;
uniform vec3 uAnchor;
uniform vec3 uEast;
uniform vec3 uNorth;
uniform vec3 uFocus;
uniform vec3 uViewEast;
uniform vec3 uViewNorth;
uniform vec3 uSph;
${CLOUD_SHADER}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 surface(vec2 g){
 vec2 q=g-uSph.xy;float d=length(q),a=d/uSph.z;
 return uAnchor*cos(a)+(uEast*q.x-uNorth*q.y)*(d>.001?sin(a)/d:1./uSph.z);
}
vec2 local(vec3 p){
 vec2 en=vec2(dot(p,uEast),-dot(p,uNorth));float s=length(en);
 return uSph.xy+en*(s>.000001?atan(s,dot(p,uAnchor))*uSph.z/s:uSph.z);
}
vec2 screenDelta(vec2 p){return mat2(uBasis.x,uBasis.y,uBasis.z,uBasis.w)*p;}
vec2 chartDelta(vec2 p){return inverse(mat2(uBasis.x,uBasis.y,uBasis.z,uBasis.w))*p;}
vec2 sceneUV(vec2 g){return (screenDelta((g-uCam)*uZoom)+uRes*.5)/uRes;}
vec2 cellUV(int i,vec2 uv){return uWorldUV[i].xy+uv*uWorldUV[i].zw;}
bool land(vec2 g,int skip){
 for(int i=0;i<13;i++){
  if(i==skip||uIslInfo[i].z<.5)continue;
  vec2 d=g-uIslFlat[i].xy,q=vec2(uIslFlat[i].z*d.x+uIslFlat[i].w*d.y,-uIslFlat[i].w*d.x+uIslFlat[i].z*d.y);
  vec2 uv=q/uIslInfo[i].xy+.5;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
  if(textureLod(uWorld,cellUV(int(uIslInfo[i].w+.5),uv),0.).a>.02)return true;
 }
 return false;
}
vec3 over(vec3 under,vec4 c){return mix(under,c.rgb/max(c.a,.001),c.a);}
vec2 chartQ(vec3 c,vec3 e,vec3 n,vec3 p){
 float z=dot(p,c);if(z<0.)return vec2(1e6);
 float x=dot(p,e),y=dot(p,n),s=length(vec2(x,y));
 return s>1e-9?vec2(x,-y)*(atan(s,z)*uSph.z/s):vec2(0.);
}
vec2 stickQ(vec4 S,vec2 X){vec2 d=X-S.xy;return vec2(S.z*d.x+S.w*d.y,-S.w*d.x+S.z*d.y);}
vec2 placeQ(vec4 S,vec3 c,vec3 e,vec3 n,float k,vec2 X,vec3 P){
 vec2 b=chartQ(c,e,n,P);if(k>.9999)return b;
 return mix(stickQ(S,X),b,k);
}
bool owns(float alpha,float distance,float bestAlpha,float bestDistance){
 if(alpha<=.001)return false;
 bool opaque=alpha>.5,bestOpaque=bestAlpha>.5;
 if(opaque!=bestOpaque)return opaque;
 return bestAlpha==0.||distance<bestDistance;
}
vec3 islands(vec2 X,vec3 P0,vec3 P1,vec3 P2,vec3 under){
 vec4 best=vec4(0.);float bestAlpha=0.,bestDistance=1e30;
 for(int i=0;i<13;i++){
  vec4 info=uIslInfo[i];if(info.z<.5)continue;
  float k=uIslAux[i].x>.5?uPaint:1.;
  vec2 q=placeQ(uIsl[i],uIslC[i],uIslE[i],uIslN[i],k,X,P0);
  vec2 uv=q/info.xy+.5;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
  float alpha=textureLod(uWorld,cellUV(int(info.w+.5),uv),0.).a,distance=dot(q,q);
  if(!owns(alpha,distance,bestAlpha,bestDistance))continue;
  vec4 c;
  if(info.z>1.5){
   vec4 f=uIslFlat[i];vec2 g=f.xy+vec2(f.z*q.x-f.w*q.y,f.w*q.x+f.z*q.y);
   c=textureLod(uScene,sceneUV(g),0.);
  }else{
   vec2 qx=placeQ(uIsl[i],uIslC[i],uIslE[i],uIslN[i],k,X+vec2(1.,0.),P1),qy=placeQ(uIsl[i],uIslC[i],uIslE[i],uIslN[i],k,X+vec2(0.,1.),P2);
   vec2 scale=.6*uWorldUV[int(info.w+.5)].zw;
   vec2 dx=(qx-q)/info.xy*scale,dy=(qy-q)/info.xy*scale;
   c=textureGrad(uWorld,cellUV(int(info.w+.5),uv),dx,dy);
  }
  if(c.a<=.001)continue;
  best=c;bestAlpha=alpha;bestDistance=distance;
 }
 return over(under,best);
}
vec3 islets(vec2 X,vec3 P0,vec3 P1,vec3 P2,vec3 under){
 vec4 best=vec4(0.);float bestAlpha=0.,bestDistance=1e30;
 for(int i=0;i<22;i++){
  vec4 info=uItInfo[i];if(info.y<.5)continue;
  float k=uItAux[i].x>.5?uPaint:1.;
  vec2 q=placeQ(uIt[i],uItC[i],uItE[i],uItN[i],k,X,P0);
  vec2 uv=q/info.x+.5;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
  vec2 qx=placeQ(uIt[i],uItC[i],uItE[i],uItN[i],k,X+vec2(1.,0.),P1),qy=placeQ(uIt[i],uItC[i],uItE[i],uItN[i],k,X+vec2(0.,1.),P2);
  int c4=int(info.z+.5);vec2 cell=vec2(float(c4%4),float(c4/4)),scale=.6*508./512./vec2(4.,${ISLET_ATLAS_ROWS}.);
  float alpha=textureLod(uIslets,(cell+(vec2(2.)+uv*508.)/512.)/vec2(4.,${ISLET_ATLAS_ROWS}.),0.).a,distance=dot(q,q);
  if(!owns(alpha,distance,bestAlpha,bestDistance))continue;
  vec4 c=textureGrad(uIslets,(cell+(vec2(2.)+uv*508.)/512.)/vec2(4.,${ISLET_ATLAS_ROWS}.),(qx-q)/info.x*scale,(qy-q)/info.x*scale);
  if(c.a<=.001)continue;
  best=c;bestAlpha=alpha;bestDistance=distance;
 }
 return over(under,best);
}
vec3 sea(vec3 p,vec3 ocean){
 if(uLive<.5)return ocean;
 vec2 g=local(p),suv=sceneUV(g);
 if(length(g-uSph.xy)>uSph.z*1.25||any(lessThan(suv,vec2(0.)))||any(greaterThan(suv,vec2(1.)))||land(g,-1))return ocean;
 return over(ocean,textureLod(uScene,suv,0.));
}
vec3 surfaceAt(vec2 uv){
 vec2 px=chartDelta((uv-.5)*uRes);float Rp=uR*uRes.y,d=length(px)/Rp,ball=uBall;
 float theta=min(1.57079632679,d);
 if(ball>.999999)theta=asin(min(d,1.));
 else for(int it=0;it<7;it++)theta=clamp(theta-((1.-ball)*theta+ball*sin(theta)-d)/max(.00001,1.-ball+ball*cos(theta)),0.,1.57079632679);
 vec2 dir=d>0.?px/length(px):vec2(0.);
 vec3 p=uFocus*cos(theta)+(uViewEast*dir.x-uViewNorth*dir.y)*sin(theta);
 return normalize(mix(surface(uCam+px/uZoom),p,smoothstep(0.,.25,ball)));
}
vec3 planet(vec2 uv){
 vec2 px=chartDelta((uv-.5)*uRes);float Rp=uR*uRes.y,d=length(px)/Rp;
 float ball=uBall;
 vec2 sp=uv*uRes;vec3 space=vec3(.07,.09,.22);
 float st=hash(floor(sp/2.)),tw=.5+.5*sin(uTime*1.7+st*40.);
 space+=vec3(1.,.95,.8)*step(.9975,st)*tw*step(1.03,d);
 float horizon=mix(1.57079632679,1.,ball),edge=d/horizon;
 float air=exp(-max(edge-1.,0.)*Rp*horizon/7.)*step(1.,edge);
 space=mix(space,vec3(.36,.68,1.),air*.7);
 if(edge>=1.)return space;
 vec2 dir=d>0.?px/length(px):vec2(0.);
 vec3 p=surfaceAt(uv),p1=surfaceAt(uv+vec2(1./uRes.x,0.)),p2=surfaceAt(uv+vec2(0.,1./uRes.y));
 vec3 v=vec3(dir.x*edge,-dir.y*edge,sqrt(max(0.,1.-edge*edge)));
 vec3 ocean=mix(uSea,vec3(.2,.52,.86),ball);
 vec3 col=sea(p,ocean);
 col=islets(sp,p,p1,p2,col);
 col=islands(sp,p,p1,p2,col);
 float lit=dot(v,normalize(vec3(-.5,.5,.72)));
 col=mix(col,col*vec3(.72,.8,.98),(1.-smoothstep(.12,.3,lit))*ball);
 col=mix(col,col+vec3(.06,.07,.08),smoothstep(.8,.95,lit)*ball);
 col=atmosphere(col,p,dir,edge);
 col=mix(col,vec3(.55,.82,1.),pow(smoothstep(.94,1.,edge),2.)*.45*ball);
 return col;
}
void main(){finalColor=vec4(planet(vUV),1.);}
`;

function buildWorldTexture(app,arch,workQueue,texture,valid){
 const layout=globeAtlasLayout(arch);
 const build=createAtlasBuild(app.renderer,{width:layout.width,height:layout.height,label:'World globe atlas',items:WORLD_ISLANDS,workQueue,texture,valid,
  // Leave room for a preview upload and newly visible sleeper caches in the
  // following main render. At DPR1, those caches must retire before admitting
  // the world target. The queue rechecks this gate on subsequent game frames.
  admit:()=>Boolean(texture)||managedTextureMemory(app.renderer).bytes+layout.width*layout.height*4*4/3+(app.renderer.resolution<=1?6:40)*1048576<=(app.renderer.resolution<=1?150:250)*1e6,
  prepare:island=>app.renderer.texture?.initSource(arch.globeTextureOf(island.id)),
  retire:island=>arch.retireGlobeUpload?.(island.id),
  draw:(island,k)=>{
   const {x,y,width,height}=layout.cells[k],s=new Sprite(arch.globeTextureOf(island.id));
   s.position.set(x+1,y+1);s.width=width;s.height=height;
   if(!texture)return s;
   // Refresh one cell without clearing the other islands between slices.
   const box=new Container(),erase=new Graphics().rect(x,y,1024,height+2).fill(0xffffff);erase.blendMode='erase';
   box.addChild(erase,s);return box;
  }});
 return {...build,layout};
}

function makePin() {
  const pin = new Container({label: 'You are here'});
  const shadow = new Graphics().ellipse(0, 0, 9, 3.5).fill({color: 0x000000, alpha: .25});
  const drop = new Graphics()
    .moveTo(0, 0).bezierCurveTo(-4, -10, -15, -18, -15, -30).arc(0, -30, 15, Math.PI, 0).bezierCurveTo(15, -18, 4, -10, 0, 0)
    .fill(PALETTE.sun).stroke({color: PALETTE.ink, width: 3, join: 'round'});
  drop.circle(0, -30, 6).fill(PALETTE.cream).stroke({color: PALETTE.ink, width: 2});
  const tag = new Text({text: 'You', style: {fontFamily: 'ui-rounded, system-ui, sans-serif', fontSize: 13, fontWeight: '700', fill: PALETTE.ink}});
  tag.anchor.set(.5);
  const tagBg = new Graphics().roundRect(-20, -11, 40, 22, 11).fill(PALETTE.cream).stroke({color: PALETTE.ink, width: 2});
  const label = new Container(); label.addChild(tagBg, tag); label.position.set(0, -64);
  const body = new Container(); body.addChild(drop, label);
  pin.addChild(shadow, body);
  pin.body = body;
  return pin;
}

export function createWorldView(app, scene, isletView, cloudTexture=Texture.EMPTY,workQueue) {
  const shoreTextures = new Map();
  let atlasPending=false,isletsPending=false,captureReady=false,atlasGeneration=0,disposed=false,currentZoom=Infinity;
  let rt = RenderTexture.create({width: 2, height: 2, resolution: 1,label:'Globe live capture'}), w = 0, h = 0, worldTex = null, worldVersion = -1, lastGlobeTime = -Infinity;
  const geometry = new MeshGeometry({positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3])});
  const blank = RenderTexture.create({width: 2, height: 2});
  const shader = new Shader({glProgram: GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'ducky-world-view', preferredFragmentPrecision: 'highp'}), resources: {
    uScene: rt.source, uWorld: blank.source, uIslets:blank.source, uClouds:cloudTexture.source, viewUniforms: {
      uCloudPhase:{value:0,type:'f32'},uCloudFade:{value:0,type:'f32'},
      uTime: {value: 0, type: 'f32'},uBall:{value:0,type:'f32'},uBasis:{value:new Float32Array([1,0,0,1]),type:'vec4<f32>'}, uZoom: {value: 1, type: 'f32'}, uR: {value: .43, type: 'f32'},
      uCam: {value: new Float32Array([0, 0]), type: 'vec2<f32>'}, uRes: {value: new Float32Array([1, 1]), type: 'vec2<f32>'},

      uSea: {value: new Float32Array([0x6E / 255, 0xC9 / 255, 0xDE / 255]), type: 'vec3<f32>'},
      uSph: {value: new Float32Array([0, 0, 1]), type: 'vec3<f32>'},
      ...Object.fromEntries(['uAnchor','uEast','uNorth','uFocus','uViewEast','uViewNorth'].map(n=>[n,{value:new Float32Array([0,0,1]),type:'vec3<f32>'}])),
      uLive:{value:0,type:'f32'},
      uWorldUV:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIsl:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIslFlat:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIslInfo:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIt:{value:new Float32Array(22*4),type:'vec4<f32>',size:22},
      uItInfo:{value:new Float32Array(22*4),type:'vec4<f32>',size:22},
      ...Object.fromEntries(['uIslC','uIslE','uIslN'].map(n=>[n,{value:new Float32Array(13*3),type:'vec3<f32>',size:13}])),
      ...Object.fromEntries(['uItC','uItE','uItN'].map(n=>[n,{value:new Float32Array(22*3),type:'vec3<f32>',size:22}])),
      uIslAux:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},uItAux:{value:new Float32Array(22*4),type:'vec4<f32>',size:22},
      uPaint:{value:0,type:'f32'},
    },
  }});
  const mesh = new Mesh({geometry, shader, label: 'World view'});
  mesh.visible = false;
  app.stage.addChildAt(mesh, app.stage.getChildIndex(scene) + 1);
  const life = new Container({label: 'Ducky activity'}), rings = new Graphics();
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d'), grad = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,190,1)'); grad.addColorStop(.35, 'rgba(255,214,90,.55)'); grad.addColorStop(1, 'rgba(255,214,90,0)');
  gc.fillStyle = grad; gc.fillRect(0, 0, 64, 64);
  const glowTex = Texture.from(glowCanvas);
  const heartG = new Graphics().svg('<svg viewBox="0 0 24 24"><path d="M12 21.3c-.4 0-.8-.1-1.1-.4C6.6 17.2 2.5 13.9 2.5 9.4 2.5 6.4 4.8 4 7.7 4c1.8 0 3.3.9 4.3 2.3C13 4.9 14.5 4 16.3 4c2.9 0 5.2 2.4 5.2 5.4 0 4.5-4.1 7.8-8.4 11.5-.3.3-.7.4-1.1.4z" fill="#FF6F8E"/></svg>');
  const heartTex = app.renderer.generateTexture({target: heartG, resolution: 4}); heartG.destroy();
  const glows = new Container(), hearts = new Container();
  life.addChild(glows, rings, hearts);
  const sprite = (pool, tex) => {const sp = pool.children.find(c => !c.visible) ?? pool.addChild(new Sprite(tex)); sp.anchor.set(.5); sp.visible = true; return sp;};
  const pin = makePin();
  app.stage.addChildAt(life, app.stage.getChildIndex(mesh) + 1);
  app.stage.addChildAt(pin, app.stage.getChildIndex(life) + 1);
  const sphereMask=new Graphics();app.stage.addChild(sphereMask);pin.mask=sphereMask;
  life.visible = pin.visible = false;
  const u = shader.resources.viewUniforms.uniforms;
  const ease = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
  const out = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const heartLocation = createHeartLocations(WORLD_ISLANDS, mapOf, rand, ISLETS);
  const ripples = [];
  let lastT = 0, rippleDue = 0, hover = false, hoverK = 1;
  return {
    prepare() {
      mesh.visible = true; mesh.scale.set(2);
      try {app.renderer.render({container: mesh, clear: false});}
      finally {mesh.visible = false;}
    },
    pinIn: 0,
    reservedBytes(arch,width,height,zoom){
      if(zoom>=.18)return 0;
      const layout=globeAtlasLayout(arch);
      // Include one uploaded preview while copying. Islet MSAA work completes
      // before the world build, so its scratch does not overlap that peak.
      const wanted=(layout.width*layout.height+2048*512*ISLET_ATLAS_ROWS)*4*4/3+width*height*4+1024*1024*4*4/3;
      let uploaded=0;
      for(const source of Object.values(app.renderer.texture?._managedTextures?.items??{}))if(source&&!source.destroyed&&(/globe atlas|Globe live capture|\/pixi-art\/globe\/(?![^/]*-ground\.svg)[^/]+\.svg(?:[?#]|$)/.test(source.label)))uploaded+=textureSourceBytes(source);
      return Math.max(0,wanted-uploaded);
    },
    update(t, width, height, time, cam, arch, worldSize, floorZoom, idle, me, reduced=false) {
      currentZoom=cam.zoom;
      const on = t > .001;
      mesh.visible = on;
      // Begin before the transition, while the camera is still above .1.
      // Never build an empty atlas while preview decoding is outstanding.
      const preparing=on||cam.zoom<.18;
      arch?.setGlobePreparing?.(preparing,on);
      if(preparing){lastGlobeTime=time;arch?.setPreviewActive?.(true);}
      if(preparing&&(width!==w||height!==h)){
        w=width;h=height;captureReady=false;mesh.scale.set(w,h);
        const generation=atlasGeneration,resize=()=>{rt.resize(width,height);app.renderer.texture?.initSource(rt);captureReady=true;};
        if(workQueue)workQueue.enqueue(resize,{priority:3},true,()=>!disposed&&generation===atlasGeneration&&w===width&&h===height,true).catch(()=>{});
        else resize();
      }
      if(preparing&&!isletsPending&&shader.resources.uIslets===blank.source){
        isletsPending=true;const generation=atlasGeneration;
        if(isletView.prepareAtlas)isletView.prepareAtlas(()=>app.renderer.resolution>1||currentZoom<=.065).then(texture=>{if(!disposed&&generation===atlasGeneration)shader.resources.uIslets=texture.source;}).catch(()=>{}).finally(()=>{if(generation===atlasGeneration)isletsPending=false;});
        else{shader.resources.uIslets=isletView.atlas.source;isletsPending=false;}
      }
      const version=arch?.previewVersion??arch?.version;
      if (preparing && shader.resources.uIslets!==blank.source && arch?.texture && arch.previewsReady!==false && !atlasPending && (!worldTex || worldVersion !== version)) {
        const generation=atlasGeneration;worldVersion=version;
        const build=buildWorldTexture(app,arch,workQueue,worldTex,()=>!disposed&&generation===atlasGeneration);
        worldTex=build.texture;atlasPending=true;
        if(!workQueue){shader.resources.uWorld=worldTex.source;u.uWorldUV.set(build.layout.uvs);}
        build.ready.then(()=>{if(!disposed&&generation===atlasGeneration){shader.resources.uWorld=worldTex.source;u.uWorldUV.set(build.layout.uvs);}}).catch(()=>{if(generation===atlasGeneration)worldVersion=-1;}).finally(()=>{if(generation===atlasGeneration)atlasPending=false;});
      }
      if (!on) {
        if(time-lastGlobeTime>3){arch?.setPreviewActive?.(false);}
        if(time-lastGlobeTime>3&&(w||worldTex||isletsPending||shader.resources.uIslets!==blank.source)){shader.resources.uWorld=blank.source;shader.resources.uIslets=blank.source;isletView.releaseAtlas?.();atlasGeneration++;atlasPending=isletsPending=captureReady=false;worldTex?.destroy(true);worldTex=null;worldVersion=-1;rt.resize(2,2);w=h=0;}
        scene.visible=true;life.visible=pin.visible=false;this.pinIn=0;this.worldAt=null;return;
      }
      const live=captureReady&&t < .97 && cam.zoom > .065;
      if (live) {scene.visible = true; app.renderer.render({container: scene, target: rt, clear: true}); this.liveCopies?.(rt);}
      scene.visible = false;
      const id=arch.current,m=mapOf(id),anchor=worldIsland(id),view=viewFrame(id,cam);
      const Rw=WORLD_GEO.Rw,R=Rw*cam.zoom/h,Rp=Rw*cam.zoom,ball=globeBall(t,cam.zoom,h);
      u.uBall=ball;
      const clouds=cloudState(ball,time,reduced);u.uCloudPhase=clouds.phase;u.uCloudFade=clouds.fade;
      const masking=ball>.999;sphereMask.clear();if(masking)sphereMask.circle(w/2,h/2,Rp*horizonRatio(ball)).fill(0xffffff);
      pin.mask=masking?sphereMask:null;
      const basis=cam.basis??{a:1,b:0,c:0,d:1};u.uBasis.set([basis.a,basis.b,basis.c,basis.d]);
      this.roll=0;
      u.uAnchor.set(anchor.center);u.uEast.set(anchor.east);u.uNorth.set(anchor.north);
      u.uFocus.set(view.center);u.uViewEast.set(view.east);u.uViewNorth.set(view.north);
      u.uSph.set([m.cx,m.cy,Rw]);u.uR=R;u.uTime=time;u.uZoom=cam.zoom;u.uCam.set([cam.x,cam.y]);u.uRes.set([w,h]);
      const horizon=Rp*horizonRatio(ball);
      const gOf=(px,py)=>{
        const p=pixelChart(id,cam,px,py,ball);return p?[p.x,p.y]:[NaN,NaN];
      };
      this.worldAt=point=>{
        const x=point.x-w/2,y=point.y-h/2,det=basis.a*basis.d-basis.b*basis.c;
        const px=(basis.d*x-basis.c*y)/det,py=(-basis.b*x+basis.a*y)/det;
        return Math.hypot(px,py)>horizon?null:gOf(px,py);
      };
      this.debug={ball,horizon,atlasSize:worldTex?.width??0,atlasHeight:worldTex?.height??0,source:live?'live':'atlas',colourBlends:0};
      this.globe={w,h,Rp,Rw,ball,view,id,basis,camera:{x:cam.x,y:cam.y}};
      const G=globeScreen({id,cam,ball,w,h,basis}),stickerOf=G.sticker;
      const project=(x,y)=>{
        const p=spherePoint(id,{x,y}),vz=dot(p,view.center);
        if(ball>.5&&vz<=0)return {x:0,y:0,face:-1};
        const s=G.screenOf(p);if(!s)return {x:0,y:0,face:-1};
        return {x:s.x,y:s.y,face:ball>.5?vz:1};
      };
      const isl=u.uIsl,flat=u.uIslFlat,info=u.uIslInfo,it=u.uIt,itInfo=u.uItInfo;
      const paint=paintWeight(ball);u.uPaint=paint;
      const facing=(c,r)=>paint>0&&dot(c,view.center)>-Math.sin(r/Rw);
      const stickers=[];
      WORLD_ISLANDS.forEach((island,k)=>{
        const mi=mapOf(island.id),S=(x,y)=>spherePoint(island.id,{x:mi.cx+x,y:mi.cy+y});
        let st=stickerOf(S,ball>=.25?4:16);
        if(st&&ball>.5&&st.depth<=0)st=null;
        if(!st&&!facing(island.center,Math.hypot(mi.width,mi.height)/2))return;
        const F=flatRigid(id,island.id);let mode=worldTex?1:0;
        if(live&&st&&paint===0){
          let inside=true;
          for(let gy=0;gy<=8&&inside;gy++)for(let gx=0;gx<=8;gx++){
            const qx=(gx/8-.5)*mi.width,qy=(gy/8-.5)*mi.height,X=st.x+st.scale*(st.cos*qx-st.sin*qy),Y=st.y+st.scale*(st.sin*qx+st.cos*qy);
            if(X<-2||Y<-2||X>w+2||Y>h+2)continue;
            const fx=F.x+F.a*qx+F.c*qy-cam.x,fy=F.y+F.b*qx+F.d*qy-cam.y,sx=(basis.a*fx+basis.c*fy)*cam.zoom/w+.5,sy=(basis.b*fx+basis.d*fy)*cam.zoom/h+.5;
            if(sx<-.001||sy<-.001||sx>1.001||sy>1.001){inside=false;break;}
          }
          if(inside)mode=2;
        }
        if(!mode)return;
        stickers.push({kind:'island',id:island.id,k,st,F,mi,mode,frame:island,S,depth:dot(island.center,view.center)});
      });
      stickers.sort((p,q)=>q.depth-p.depth);
      info.fill(0);
      const frames=(C,E,N,A,f,st,n)=>{C.set(f.center,n*3);E.set(f.east,n*3);N.set(f.north,n*3);A.set([st?1:0,0,0,0],n*4);};
      stickers.forEach(({st,F,mi,k,mode,frame},n)=>{
        isl.set(st?[st.x,st.y,st.cos/st.scale,st.sin/st.scale]:[0,0,0,0],n*4);flat.set([F.x,F.y,F.a,F.b],n*4);info.set([mi.width,mi.height,mode,k],n*4);
        frames(u.uIslC,u.uIslE,u.uIslN,u.uIslAux,frame,st,n);
      });
      const islets=[];itInfo.fill(0);
      ISLETS.forEach((islet,k)=>{
        const S=(x,y)=>expMap(islet,x,y,Rw);let st=stickerOf(S,ball>=.25?2:16);
        if(st&&ball>.5&&st.depth<=0)st=null;
        if(!st&&!facing(islet.center,islet.width*.71))return;
        islets.push({kind:'islet',id:`islet-${k}`,k,st,islet,S,depth:dot(islet.center,view.center)});
      });
      islets.sort((p,q)=>q.depth-p.depth).forEach(({st,islet},n)=>{
        it.set(st?[st.x,st.y,st.cos/st.scale,st.sin/st.scale]:[0,0,0,0],n*4);itInfo.set([islet.width,1,islet.artIndex,0],n*4);
        frames(u.uItC,u.uItE,u.uItN,u.uItAux,islet,st,n);
      });
      u.uLive=live?1:0;
      const drawn=({st,S})=>{
        const C=G.screenOf(S(0,0)),e=2,xp=G.screenOf(S(e,0)),xm=G.screenOf(S(-e,0)),yp=G.screenOf(S(0,e)),ym=G.screenOf(S(0,-e));
        const J=C&&xp&&xm&&yp&&ym?[(xp.x-xm.x)/(2*e),(xp.y-xm.y)/(2*e),(yp.x-ym.x)/(2*e),(yp.y-ym.y)/(2*e)]:null;
        const inv=m=>{const d=m[0]*m[3]-m[1]*m[2];return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d];};
        const A=st?[st.cos*st.scale,st.sin*st.scale,-st.sin*st.scale,st.cos*st.scale]:null,k=st?paint:1;
        const M=!J?A:!A?J:inv(inv(A).map((v,i)=>v*(1-k)+inv(J)[i]*k));
        const at=k>=1||!st?C:{x:st.x,y:st.y};
        return M&&at?{a:M[0],b:M[1],c:M[2],d:M[3],x:at.x,y:at.y,onBall:k}:null;
      };
      this.stickers=[...stickers,...islets].map(s=>{const m=drawn(s),r=s.st;return m&&{kind:s.kind,id:s.id,mode:s.mode===2?'live':s.kind==='islet'?'islet-atlas':'atlas',width:s.islet?.width,...m,
        rigid:r?{x:r.x,y:r.y,a:r.cos*r.scale,b:r.sin*r.scale,c:-r.sin*r.scale,d:r.cos*r.scale}:null};}).filter(Boolean);
      const islands = arch.islands, dt = Math.min(.1, Math.max(0, time - lastT)); lastT = time;
      const busy = ease((ball - .25) / .4);
      life.visible = busy > .01; life.alpha = busy;
      if (busy > .01) {
        const pick=()=>{const {island,x,y}=heartLocation();return localPoint(id,expMap(island,x,y,Rw));};
        for (rippleDue -= dt; rippleDue < 0; rippleDue += HEART_ACTIVITY_INTERVAL*(.8+rand()*.4)) {
          if(ripples.length<HEART_ACTIVITY_LIMIT)ripples.push({...pick(), at: time, heart: rand() < HEART_ACTIVITY_CHANCE, dur: 2 + rand() * .8});
        }
        const px = Math.min(1.5, Math.max(1, Rp / 240));
        for (const c of glows.children) c.visible = false;
        for (const c of hearts.children) c.visible = false;
        rings.clear();
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i], age = (time - r.at) / r.dur;
          if (age >= 1) {ripples.splice(i, 1); continue;}
          const p = project(r.x, r.y);
          if (p.face < .08) continue;
          const f = ease(p.face / .3), sq = .45 + .55 * p.face;
          const fade = ease(age / .12) * (1 - ease((age - .35) / .65));
          const g = sprite(glows, glowTex);
          g.position.set(p.x, p.y); g.scale.set((.14 + out(age) * .18) * px, (.14 + out(age) * .18) * px * sq); g.alpha = fade * .85 * f;
          const k = out(age), rr = (2.5 + k * 11) * px;
          rings.ellipse(p.x, p.y, rr, rr * sq).stroke({color: 0xFFF3C4, width: 1.1 * px, alpha: (1 - k) * .55 * f});
          if (r.heart) {
            const sec = (time - r.at), spring = 1 - Math.exp(-sec * 9) * Math.cos(sec * 22);
            const hs = sprite(hearts, heartTex), lift = out((sec - .35) / 1.4), gone = ease((sec - 1.1) / .6);
            hs.position.set(p.x + Math.sin(sec * 4 + r.x) * 1.5 * px * lift, p.y - (8 + lift * 22) * px);
            hs.scale.set(Math.max(0, spring) * (1 - gone * .35) * .9 * px);
            hs.rotation = Math.exp(-sec * 7) * Math.sin(sec * 18) * .35;
            hs.alpha = (1 - gone) * f;
            const burst = ease(sec / .06) * (1 - ease((sec - .1) / .35));
            if (burst > .01) for (let n = 0; n < 4; n++) {
              const a = n * 1.571 + .785, d = (7 + out(sec / .45) * 9) * px;
              rings.circle(p.x + Math.cos(a) * d, p.y - 8 * px + Math.sin(a) * d, 1.6 * px).fill({color: 0xFF8FA6, alpha: burst * f});
            }
          }
        }
      } else ripples.length = 0;
      this.pinIn = me ? ease((t - .12) / .15) : 0;
      if (me) {
        const p = project(me.x, me.y);
        pin.position.set(p.x, p.y);
        pin.alpha = this.pinIn * ease(p.face / .25);
        pin.visible = pin.alpha > .01;
        pin.body.y = -Math.abs(Math.sin(time * 3)) * 6;
        hoverK += ((hover && pin.visible ? 1.05 : 1) - hoverK) * (1 - Math.exp(-dt * 18));
        pin.scale.set((.8 + .2 * p.face) * hoverK);
      } else pin.visible = false;
    },
    pinAt(point) {
      if (!pin.visible || pin.alpha < .35) return false;
      const k = pin.scale.x, dx = point.x - pin.x, dy = point.y - pin.y;
      return Math.abs(dx) < Math.max(32, 26 * k) && dy > -Math.max(90, 84 * k) && dy < 16;
    },
    hoverPin(on) {hover = on;},
    pinPoint() {return pin.visible ? {x: pin.x, y: pin.y, alpha: pin.alpha, scale: pin.scale.x} : null;},
    grab(from, to, camera, aim) {
      const g = this.globe;
      if (!g || g.ball < .3) return null;
      const centre=aim??spherePoint(g.id,camera),o=p=>({x:p.x-g.w/2,y:p.y-g.h/2});
      const before=lonLat(centre),next=globeDrag(g.id,centre,o(from),o(to),g.ball,g.Rp);
      let dlon=next.lon-before.lon;dlon-=2*Math.PI*Math.round(dlon/(2*Math.PI));
      return {aim:centreOf(next.lon,next.lat),dlon,dlat:next.lat-before.lat};
    },
    destroy() {disposed=true;atlasGeneration++;for (const texture of shoreTextures.values()) texture.destroy(true); shoreTextures.clear();sphereMask.destroy();mesh.destroy(); life.destroy({children: true}); glowTex.destroy(true); heartTex.destroy(true); pin.destroy({children: true}); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
