import {horizonRatio,pixelChart} from './sphere-projection.js';
import {spherePoint,localPoint,viewFrame} from './sphere-coordinates.js';
import {WORLD_GEO,worldIsland,WORLD_ISLANDS} from './world-map.js';
import {dot,expMap} from './sphere.js';
import {polar,flatRigid} from './rigid.js';
import {mapOf} from './island-maps.js';
import {ISLETS} from './islets.js';

// boss 5 Nov: the zoom-out story, "like Google Earth". Zooming out past the home island the flat world curls into a globe
// floating in space; drag spins it, and it turns slowly when left alone. Style (boss ref, a cartoon Earth): flat blue sea
// with a glowing rim, a pin on where you are, and Ducky activity as ripples and hearts.
// Each island occupies a separate local patch, packed in an atlas without geographic distortion.
import {Container, GlProgram, Graphics, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Text, Texture} from 'pixi.js';
import {PALETTE} from './palette.js';

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
// boss 8 Nov ("I don't want any skew"): every island and islet is a rigid sticker. The CPU projects its centre and
// takes the nearest rotation and a uniform scale of the projection there (rigid.js), then hands each sticker over as
// screen centre + inverse rotation/scale. The shader never pushes art through a sphere chart, so nothing shears.
// uIsl: screen centre xy, cos/s, sin/s.  uIslFlat: where the sticker sits in this island's flat chart (the live scene
// render): centre xy, cos, sin.  uIslInfo: map width, height, mode (0 hidden, 1 atlas, 2 live scene), atlas cell.
uniform vec4 uIsl[13];
uniform vec4 uIslFlat[13];
uniform vec4 uIslInfo[13];
uniform vec4 uIt[22];
uniform vec4 uItInfo[22];
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
vec2 cellUV(int i,vec2 uv){vec2 cell=vec2(float(i%4),float(i/4));return (cell+(vec2(1.)+uv*1022.)/1024.)/4.;}
// Is flat-chart point g on some island's land (other than skip)? Its true art's alpha, laid down rigidly.
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
vec3 islands(vec2 X,vec3 sea,vec3 under){
 for(int i=0;i<13;i++){
  vec4 info=uIslInfo[i];if(info.z<.5)continue;
  vec2 d=X-uIsl[i].xy;vec2 q=vec2(uIsl[i].z*d.x+uIsl[i].w*d.y,-uIsl[i].w*d.x+uIsl[i].z*d.y);
  vec2 uv=q/info.xy+.5;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
  if(info.z>1.5){
   // The live scene, read through the same rigid placement it was drawn with. Only where this island's own art (a little
   // grown, via a coarse mip) has land: another island's land seen in this rectangle is that island's business.
   if(textureLod(uWorld,cellUV(int(info.w+.5),uv),3.).a<.01)continue;
   vec4 f=uIslFlat[i];vec2 g=f.xy+vec2(f.z*q.x-f.w*q.y,f.w*q.x+f.z*q.y);
   vec4 c=textureLod(uScene,sceneUV(g),0.);
   if(c.a>.001)return over(under,c);
  }else{
   // Mip level from the sticker's true footprint, biased sharp (x.6): smooth far away, crisp as soon as it is near size.
   vec2 dx=vec2(uIsl[i].z,-uIsl[i].w)/info.xy*(.6*1022./4096.),dy=vec2(uIsl[i].w,uIsl[i].z)/info.xy*(.6*1022./4096.);
   vec4 c=textureGrad(uWorld,cellUV(int(info.w+.5),uv),dx,dy);
   if(c.a>.001)return over(under,c);
  }
 }
 return under;
}
vec3 islets(vec2 X,vec3 under){
 for(int i=0;i<22;i++){
  vec4 info=uItInfo[i];if(info.y<.5)continue;
  vec2 d=X-uIt[i].xy;vec2 q=vec2(uIt[i].z*d.x+uIt[i].w*d.y,-uIt[i].w*d.x+uIt[i].z*d.y);
  vec2 uv=q/info.x+.5;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
  int k=int(info.z+.5);vec2 cell=vec2(float(k%4),float(k/4)),scale=.6*508./512./vec2(4.,3.);
  vec4 c=textureGrad(uIslets,(cell+(vec2(2.)+uv*508.)/512.)/vec2(4.,3.),vec2(uIt[i].z,-uIt[i].w)/info.x*scale,vec2(uIt[i].w,uIt[i].z)/info.x*scale);
  if(c.a>.001)return over(under,c);
 }
 return under;
}
// Open sea. Close in, the live scene's water (boats, wakes) still shows, read through the sphere chart; anything that
// lands on an island there is skipped, because the island itself comes only from its rigid sticker.
vec3 sea(vec3 p,vec3 ocean){
 if(uLive<.5)return ocean;
 vec2 g=local(p),suv=sceneUV(g);
 if(length(g-uSph.xy)>uSph.z*1.25||any(lessThan(suv,vec2(0.)))||any(greaterThan(suv,vec2(1.)))||land(g,-1))return ocean;
 return over(ocean,textureLod(uScene,suv,0.));
}
vec3 planet(vec2 uv){
 vec2 px=chartDelta((uv-.5)*uRes);float Rp=uR*uRes.y,d=length(px)/Rp;
 float ball=uBall;
 vec2 sp=uv*uRes;vec3 space=vec3(.07,.09,.22);
 float st=hash(floor(sp/2.)),tw=.5+.5*sin(uTime*1.7+st*40.);
 space+=vec3(1.,.95,.8)*step(.9975,st)*tw*step(1.03,d);
 // The flat chart's horizon starts beyond the viewport, then contracts
 // continuously to the orthographic disc. Never sample the far hemisphere.
 float horizon=mix(1.57079632679,1.,ball),edge=d/horizon;
 float air=exp(-max(edge-1.,0.)*Rp*horizon/7.)*step(1.,edge);
 space=mix(space,vec3(.36,.68,1.),air*.7);
 if(edge>=1.)return space;
 float theta=min(1.57079632679,d);
 if(ball>.999999)theta=asin(min(d,1.));
 else for(int it=0;it<7;it++)theta=clamp(theta-((1.-ball)*theta+ball*sin(theta)-d)/max(.00001,1.-ball+ball*cos(theta)),0.,1.57079632679);
 vec2 dir=d>0.?px/length(px):vec2(0.);
 vec3 p=uFocus*cos(theta)+(uViewEast*dir.x-uViewNorth*dir.y)*sin(theta);
 // Near the flat end retain the exact local chart, then morph coordinates,
 // never colours. No antipodal log-map interpolation on the sphere's limb.
 vec3 flatPoint=surface(uCam+px/uZoom);
 p=normalize(mix(flatPoint,p,smoothstep(0.,.25,ball)));
 vec3 v=vec3(dir.x*edge,-dir.y*edge,sqrt(max(0.,1.-edge*edge)));
 vec3 ocean=mix(uSea,vec3(.2,.52,.86),ball);
 vec3 col=sea(p,ocean);
 col=islets(sp,col);
 col=islands(sp,ocean,col);
 float lit=dot(v,normalize(vec3(-.5,.5,.72)));
 col=mix(col,col*vec3(.72,.8,.98),(1.-smoothstep(.12,.3,lit))*ball);
 col=mix(col,col+vec3(.06,.07,.08),smoothstep(.8,.95,lit)*ball);
 col=mix(col,vec3(.55,.82,1.),pow(smoothstep(.94,1.,edge),2.)*.45*ball);
 return col;
}
void main(){finalColor=vec4(planet(vUV),1.);}
`;

// Thirteen separate images in a padded atlas. Packing is unrelated to placement.
function buildWorldTexture(app,islands,bounds,arch){
 const box=new Container();
 WORLD_ISLANDS.forEach((island,k)=>{
  const s=new Sprite(arch.textureOf(island.id));s.position.set(k%4*1024+1,Math.floor(k/4)*1024+1);s.width=s.height=1022;box.addChild(s);
 });
 const rt=RenderTexture.create({width:4096,height:4096,scaleMode:'linear',autoGenerateMipmaps:true});
 app.renderer.render({container:box,target:rt,clear:true});box.destroy({children:true});rt.source.updateMipmaps();return rt;
}

// the 'you are here' pin: a sun-yellow drop with an ink outline and a cream dot, a 'You' tag above it
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

export function createWorldView(app, scene, isletView) {
  const shoreTextures = new Map();
  let rt = RenderTexture.create({width: 2, height: 2, resolution: 1}), w = 0, h = 0, worldTex = null, worldVersion = -1;
  const geometry = new MeshGeometry({positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3])});
  const blank = RenderTexture.create({width: 2, height: 2});
  const shader = new Shader({glProgram: GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'ducky-world-view', preferredFragmentPrecision: 'highp'}), resources: {
    uScene: rt.source, uWorld: blank.source, uIslets:isletView.atlas.source, viewUniforms: {
      uTime: {value: 0, type: 'f32'},uBall:{value:0,type:'f32'},uBasis:{value:new Float32Array([1,0,0,1]),type:'vec4<f32>'}, uZoom: {value: 1, type: 'f32'}, uR: {value: .43, type: 'f32'},
      uCam: {value: new Float32Array([0, 0]), type: 'vec2<f32>'}, uRes: {value: new Float32Array([1, 1]), type: 'vec2<f32>'},

      uSea: {value: new Float32Array([0x6E / 255, 0xC9 / 255, 0xDE / 255]), type: 'vec3<f32>'},
      uSph: {value: new Float32Array([0, 0, 1]), type: 'vec3<f32>'},
      ...Object.fromEntries(['uAnchor','uEast','uNorth','uFocus','uViewEast','uViewNorth'].map(n=>[n,{value:new Float32Array([0,0,1]),type:'vec3<f32>'}])),
      uLive:{value:0,type:'f32'},
      uIsl:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIslFlat:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIslInfo:{value:new Float32Array(13*4),type:'vec4<f32>',size:13},
      uIt:{value:new Float32Array(22*4),type:'vec4<f32>',size:22},
      uItInfo:{value:new Float32Array(22*4),type:'vec4<f32>',size:22},
    },
  }});
  const mesh = new Mesh({geometry, shader, label: 'World view'});
  mesh.visible = false;
  app.stage.addChildAt(mesh, app.stage.getChildIndex(scene) + 1);
  // boss 5 Nov (ref: Kaspersky cybermap): the world is busy. A Ducky doing something shows as a soft warm glow that
  // blooms and fades with one thin ring easing out; now and then a rounded heart pops up and drifts away.
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
  const sphereMask=new Graphics();app.stage.addChild(sphereMask);life.mask=sphereMask;pin.mask=sphereMask;
  life.visible = pin.visible = false;
  const u = shader.resources.viewUniforms.uniforms;
  const ease = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
  const out = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);   // ease-out: quick start, soft landing
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ripples = [];
  let lastT = 0, rippleDue = 0, hover = false, hoverK = 1;
  return {
    // Compile and warm the globe pipeline while the loading screen is present.
    // Its first visible frame can then use the same shader and GPU buffers.
    prepare() {
      mesh.visible = true; mesh.scale.set(2);
      try {app.renderer.render({container: mesh, clear: false});}
      finally {mesh.visible = false;}
    },
    pinIn: 0,   // 0..1, how far the 'You' pin has come in (engine.js fades the name tags out by the same amount)
    // t: 0 at the island, 1 fully zoomed out. cam: the camera's world point. me: where the player is (world units).
    update(t, width, height, time, cam, arch, worldSize, floorZoom, idle, me) {
      const on = t > .001;
      mesh.visible = on;
      if (arch?.texture && (!worldTex || worldVersion !== arch.version)) {   // rebuilt when a themed island's snapshot arrives
        const old = worldTex; worldVersion = arch.version;
        worldTex = buildWorldTexture(app, arch.islands, arch.bounds, arch, worldSize, shoreTextures);
        shader.resources.uWorld = worldTex.source;
        if (old) setTimeout(() => old.destroy(true), 0);   // unbound first, then freed (no 'destroyed while bound' warning)
      }
      if (!on) {scene.visible=true;life.visible=pin.visible=false;this.pinIn=0;this.worldAt=null;return;}
      if (width !== w || height !== h) {w = width; h = height; rt.resize(w, h); mesh.scale.set(w, h); shader.resources.uScene = rt.source;}
      const live=t < .97 && cam.zoom > .065;
      if (live) {scene.visible = true; app.renderer.render({container: scene, target: rt, clear: true}); this.liveCopies?.(rt);}   // the real islands round the camera (not needed once it is all globe)
      scene.visible = false;
      const id=arch.current,m=mapOf(id),anchor=worldIsland(id),view=viewFrame(id,cam);
      const Rw=WORLD_GEO.Rw,R=Rw*cam.zoom/h,Rp=Rw*cam.zoom,ball=ease(t)*ease((4-R)/3);
      u.uBall=ball;
      // The mask is a white disc: only draw it while it is actually masking, or it shows as a white ball mid-zoom.
      const masking=ball>.999;sphereMask.clear();if(masking)sphereMask.circle(w/2,h/2,Rp*horizonRatio(ball)).fill(0xffffff);
      life.mask=pin.mask=masking?sphereMask:null;
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
      this.debug={ball,horizon,atlasSize:4096,source:live?'live':'atlas',colourBlends:0};
      this.globe={w,h,Rp,Rw,ball,view,id,camera:{x:cam.x,y:cam.y}};
      const project=(x,y)=>{
        const p=spherePoint(id,{x,y}),vz=dot(p,view.center);
        if(ball>.5&&vz<=0)return {x:0,y:0,face:-1};
        let px=dot(p,view.east)*Rp*ball+(x-cam.x)*cam.zoom*(1-ball),py=-dot(p,view.north)*Rp*ball+(y-cam.y)*cam.zoom*(1-ball);
        if(ball<.999)for(let it=0;it<4;it++){
          const [gx,gy]=gOf(px,py),ex=x-gx,ey=y-gy;if(Math.abs(ex)+Math.abs(ey)<.5)break;
          const e=.5,[gx1,gy1]=gOf(px+e,py),[gx2,gy2]=gOf(px,py+e),a=(gx1-gx)/e,b=(gx2-gx)/e,c=(gy1-gy)/e,d=(gy2-gy)/e,det=a*d-b*c;
          if(Math.abs(det)<1e-12)break;px+=(d*ex-b*ey)/det;py+=(-c*ex+a*ey)/det;
        }
        if(Math.hypot(px,py)>=horizon)return {x:0,y:0,face:-1};
        return {x:w/2+basis.a*px+basis.c*py,y:h/2+basis.b*px+basis.d*py,face:ball>.5?vz:1};
      };
      // boss 8 Nov: rigid stickers. Screen pixel of any sphere point, exactly as the fragment shader draws it.
      const screenOf=p=>{
        let px,py;
        if(ball>=.25){   // past a quarter the lens is analytic: r = (1-ball)*angle + ball*sin(angle)
          const e=dot(p,view.east),n=dot(p,view.north),s=Math.hypot(e,n),a=Math.atan2(s,dot(p,view.center));
          if(a>=Math.PI/2)return null;
          const r=((1-ball)*a+ball*Math.sin(a))*Rp/(s||1);px=e*r;py=-n*r;
        }else{
          const g=localPoint(id,p),vz=dot(p,view.center);if(vz<=-.2)return null;
          px=(g.x-cam.x)*cam.zoom;py=(g.y-cam.y)*cam.zoom;
          if(ball>1e-6){px=dot(p,view.east)*Rp*ball+px*(1-ball);py=-dot(p,view.north)*Rp*ball+py*(1-ball);
            for(let it=0;it<8;it++){
              const [gx,gy]=gOf(px,py),ex=g.x-gx,ey=g.y-gy;if(!(Math.abs(ex)+Math.abs(ey)>.001))break;
              const e=.25,[gx1,gy1]=gOf(px+e,py),[gx2,gy2]=gOf(px,py+e),a=(gx1-gx)/e,b=(gx2-gx)/e,c=(gy1-gy)/e,d=(gy2-gy)/e,det=a*d-b*c;
              if(!(Math.abs(det)>1e-14))break;px+=(d*ex-b*ey)/det;py+=(-c*ex+a*ey)/det;
            }}
          if(!Number.isFinite(px+py))return null;
        }
        if(Math.hypot(px,py)>=horizon)return null;
        return {x:w/2+basis.a*px+basis.c*py,y:h/2+basis.b*px+basis.d*py};
      };
      // Centre from the projection, the nearest rotation of its Jacobian, one uniform scale: the camera zoom at the flat
      // end (true size, matching the live scene), the area-preserving sqrt|det J| as the ball closes, shrinking to nothing
      // at the horizon instead of popping.
      const stickerOf=(S,step)=>{
        const c=S(0,0),C=screenOf(c);if(!C)return null;
        const xp=screenOf(S(step,0)),xm=screenOf(S(-step,0)),yp=screenOf(S(0,step)),ym=screenOf(S(0,-step));
        if(!xp||!xm||!yp||!ym)return null;
        const q=polar((xp.x-xm.x)/(2*step),(xp.y-xm.y)/(2*step),(yp.x-ym.x)/(2*step),(yp.y-ym.y)/(2*step));
        const a=Math.acos(Math.max(-1,Math.min(1,dot(c,view.center)))),limb=ball>.5?1:ease((Math.PI/2-a)/.12);
        const scale=(cam.zoom*(1-ball)+q.scale*ball)*(ball>.5?1:limb);
        if(!(scale>1e-6))return null;
        return {x:C.x,y:C.y,cos:q.cos,sin:q.sin,scale,depth:dot(c,view.center)};
      };
      const isl=u.uIsl,flat=u.uIslFlat,info=u.uIslInfo,it=u.uIt,itInfo=u.uItInfo;
      const stickers=[];
      WORLD_ISLANDS.forEach((island,k)=>{
        const mi=mapOf(island.id),S=(x,y)=>spherePoint(island.id,{x:mi.cx+x,y:mi.cy+y}),st=stickerOf(S,ball>=.25?4:16);
        if(!st||(ball>.5&&st.depth<=0))return;
        // the live scene only if every on-screen part of this sticker was rendered into it this frame
        const F=flatRigid(id,island.id);let mode=worldTex?1:0;
        if(live){
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
        stickers.push({kind:'island',id:island.id,k,st,F,mi,mode});
      });
      stickers.sort((p,q)=>q.st.depth-p.st.depth);
      info.fill(0);
      stickers.forEach(({st,F,mi,k,mode},n)=>{
        isl.set([st.x,st.y,st.cos/st.scale,st.sin/st.scale],n*4);flat.set([F.x,F.y,F.a,F.b],n*4);info.set([mi.width,mi.height,mode,k],n*4);
      });
      const islets=[];itInfo.fill(0);
      ISLETS.forEach((islet,k)=>{
        const st=stickerOf((x,y)=>expMap(islet,x,y,Rw),ball>=.25?2:16);
        if(!st||(ball>.5&&st.depth<=0))return;
        islets.push({kind:'islet',id:`islet-${k}`,k,st,islet});
      });
      islets.sort((p,q)=>q.st.depth-p.st.depth).forEach(({st,islet},n)=>{it.set([st.x,st.y,st.cos/st.scale,st.sin/st.scale],n*4);itInfo.set([islet.width,1,islet.artIndex,0],n*4);});
      u.uLive=live?1:0;
      // QA readback: the matrices actually drawn (local units -> screen pixels), for the shear sweep.
      this.stickers=[...stickers,...islets].map(({kind,id,st,mode,islet})=>({kind,id,mode:mode===2?'live':kind==='islet'?'islet-atlas':'atlas',width:islet?.width,a:st.cos*st.scale,b:st.sin*st.scale,c:-st.sin*st.scale,d:st.cos*st.scale,x:st.x,y:st.y}));
      const islands = arch.islands, dt = Math.min(.1, Math.max(0, time - lastT)); lastT = time;
      const busy = ease((ball - .25) / .4);
      life.visible = busy > .01; life.alpha = busy;
      if (busy > .01) {
        const pick=()=>{const i=islands[Math.floor(rand()*islands.length)],a=rand()*6.283,r=rand()*.22*Math.min(i.width,i.height);return localPoint(id,expMap(i,Math.cos(a)*r,Math.sin(a)*r,Rw));};
        for (rippleDue -= dt; rippleDue < 0; rippleDue += .035) ripples.push({...pick(), at: time, heart: rand() < .7, dur: 2 + rand() * .8});   // boss 5 Nov: the hearts are the 30,000 stars, so lots of them
        const px = Math.min(1.5, Math.max(1, Rp / 240));   // hearts and ripples stay a friendly size at every zoom   // sizes follow the globe
        for (const c of glows.children) c.visible = false;
        for (const c of hearts.children) c.visible = false;
        rings.clear();
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i], age = (time - r.at) / r.dur;
          if (age >= 1) {ripples.splice(i, 1); continue;}
          const p = project(r.x, r.y);
          if (p.face < .08) continue;
          const f = ease(p.face / .3), sq = .45 + .55 * p.face;   // everything flattens toward the rim
          const fade = ease(age / .12) * (1 - ease((age - .35) / .65));
          const g = sprite(glows, glowTex);
          g.position.set(p.x, p.y); g.scale.set((.14 + out(age) * .18) * px, (.14 + out(age) * .18) * px * sq); g.alpha = fade * .85 * f;
          const k = out(age), rr = (2.5 + k * 11) * px;
          rings.ellipse(p.x, p.y, rr, rr * sq).stroke({color: 0xFFF3C4, width: 1.1 * px, alpha: (1 - k) * .55 * f});
          if (r.heart) {
            // the pop: a damped spring from nothing up past full size and back, a little tilt that settles, a burst of
            // four sparkles, then a slow rise that shrinks and fades away
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
      // the pin: the player's world point projected onto the globe the same way the shader bends the map
      this.pinIn = me ? ease((t - .12) / .15) : 0;
      if (me) {
        const p = project(me.x, me.y);
        pin.position.set(p.x, p.y);
        pin.alpha = this.pinIn * ease(p.face / .25);
        pin.visible = pin.alpha > .01;
        pin.body.y = -Math.abs(Math.sin(time * 3)) * 6;
        hoverK += ((hover && pin.visible ? 1.05 : 1) - hoverK) * (1 - Math.exp(-dt * 18));   // boss 6 Nov: a small lift on hover, never past 1.05
        pin.scale.set((.8 + .2 * p.face) * hoverK);
      } else pin.visible = false;
    },
    // boss 6 Nov: the 'You' pin is a button. Hit box covers the drop and the tag with room for a finger (at least 64 x 96 px).
    pinAt(point) {
      if (!pin.visible || pin.alpha < .35) return false;
      const k = pin.scale.x, dx = point.x - pin.x, dy = point.y - pin.y;
      return Math.abs(dx) < Math.max(32, 26 * k) && dy > -Math.max(90, 84 * k) && dy < 16;
    },
    hoverPin(on) {hover = on;},
    pinPoint() {return pin.visible ? {x: pin.x, y: pin.y, alpha: pin.alpha, scale: pin.scale.x} : null;},   // QA readback
    // grab-drag on the ball: how far to move the camera so the spot under the finger stays under the finger
    grab(from, to, camera) {
      const g = this.globe;
      if (!g || g.ball < .3) return null;
      const view=camera?viewFrame(g.id,camera):g.view;
      const at=p=>{
        let x=(p.x-g.w/2)/g.Rp,y=-(p.y-g.h/2)/g.Rp;const d=Math.hypot(x,y);if(d>.97){x*=.97/d;y*=.97/d;}
        const z=Math.sqrt(Math.max(0,1-x*x-y*y));return view.center.map((v,k)=>v*z+view.east[k]*x+view.north[k]*y);
      };
      const a=localPoint(g.id,at(from)),b=localPoint(g.id,at(to));return {dx:a.x-b.x,dy:a.y-b.y};
    },
    destroy() {for (const texture of shoreTextures.values()) texture.destroy(true); shoreTextures.clear();sphereMask.destroy();mesh.destroy(); life.destroy({children: true}); glowTex.destroy(true); heartTex.destroy(true); pin.destroy({children: true}); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
