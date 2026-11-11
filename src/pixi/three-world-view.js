import {createThreePirates} from './three-pirates.js';
import * as THREE from 'three';
import {createIsletStanding} from './three-islet-props.js';
import {liveSurfaceGeometry,liveSurfaceBounds,liveSurfaceNeedsUpdate,liveCaptureEdgeShader,liveCaptureProjection} from './three-live-geometry.js';
import {detailViewport,DETAIL_CAPTURE_SCALE} from './three-detail-view.js';
import {WORLD_GEO, WORLD_ISLANDS} from './world-map.js';
import {ISLETS} from './islets.js';
import {sphereFrame} from './sphere.js';
import {heartPose} from './heart-motion.js';
import {rotateGlobeFromScreen} from './three-globe-math.js';
import {createHeartLocations,heartArtContains,HEART_ACTIVITY_INTERVAL,HEART_ACTIVITY_CHANCE,HEART_ACTIVITY_LIMIT} from './heart-activity.js';
import {focusQuaternion, islandQuaternion, focusSurfaceQuaternion, surfacePoint, surfaceCoordinates, surfaceUnderPointer, lockSurfaceAnchor, atlasTransform, pickSurfacePatch, visiblePoint, EARTH_DISTANCE} from './three-globe-math.js';
import {alignIslandNorth,approachProgress} from './three-island-approach.js';
import {loadWorldAssets} from './three-asset-queue.js';
import {RenderDemand,AmbientDrawClock} from './three-render-demand.js';
import {PALETTE} from './palette.js';
import {mapOf} from './island-maps.js';
import {transport} from './sphere.js';
import {SPACE_LOOKS,createSpaceBackdrop} from './three-space-backdrop.js';
import {createGlobeAtmosphere} from './three-atmosphere.js';
import manifest from '../../public/pixi-art/globe/manifest.json' with {type:'json'};

const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const out=x=>1-Math.pow(1-THREE.MathUtils.clamp(x,0,1),3);
const HEART='<svg xmlns="http://www.w3.org/2000/svg" viewBox="2.5 4 19 17.3"><path d="M12 21.3c-.4 0-.8-.1-1.1-.4C6.6 17.2 2.5 13.9 2.5 9.4 2.5 6.4 4.8 4 7.7 4c1.8 0 3.3.9 4.3 2.3C13 4.9 14.5 4 16.3 4c2.9 0 5.2 2.4 5.2 5.4 0 4.5-4.1 7.8-8.4 11.5-.3.3-.7.4-1.1.4z" fill="#FF6F8E"/></svg>';

// Continuous Three.js world. Pixi remains the island renderer and simulation.
export async function createThreeWorld(host, {onDetail=()=>{}, onFrame=()=>{}, onTap=()=>{}, onSelect=()=>{}, onReady=()=>{}, onInteract=()=>{},surfaceAtPointer=()=>null,pirateFleet=null,pirateProjection=()=>null,initialIsland='home',isletProjection=()=>null,isletCapture=()=>false}={}) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.domElement.setAttribute('aria-label','Rotating Ducky Land globe');
  renderer.domElement.dataset.renderer='threejs';
  renderer.domElement.style.touchAction='none';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','application');
  host.append(renderer.domElement);
  renderer.domElement.style.zIndex='1';renderer.domElement.style.position='absolute';renderer.domElement.style.inset='0';
  let spaceStyle=new URLSearchParams(location.search).get('space')??'starlight';
  if(!SPACE_LOOKS[spaceStyle])spaceStyle='starlight';
  const backdrop=createSpaceBackdrop(host,spaceStyle),planetShade={value:SPACE_LOOKS[spaceStyle].shade};
  const scene=new THREE.Scene(), globe=new THREE.Group();
  const demand=new RenderDemand();
  globe.name='World: ocean, islands, islets and activity anchors'; scene.add(globe);
  const camera=new THREE.PerspectiveCamera(35,1,.2,20); camera.position.set(0,0,EARTH_DISTANCE);
  const atmosphere=createGlobeAtmosphere(globe,scene,planetShade);
  const ocean=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),atmosphere.water);
  ocean.name='Ocean'; globe.add(ocean);

  const pirates=pirateFleet?await createThreePirates(scene,pirateFleet):null;const ambientClock=new AmbientDrawClock();
  let detailOpacity=0,direct=false;const liveCaptureBlend={value:0},liveCaptureScale={value:DETAIL_CAPTURE_SCALE};
  function planetLighting(shader){
    shader.uniforms.planetShade=planetShade;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 planetNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nplanetNormal=normalize(mat3(modelViewMatrix)*normalize(position));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float planetShade; varying vec3 planetNormal;')
      .replace('#include <opaque_fragment>','vec3 sunlight=normalize(vec3(-.35,.45,1.));float daylight=clamp(dot(normalize(planetNormal),sunlight)/sunlight.z,0.,1.);outgoingLight*=mix(1.-planetShade,1.,daylight);\n#include <opaque_fragment>');
  }

  // Small water marks rotate with the sphere, giving the eye an unambiguous 3D reference.
  const wavePositions=[];
  for(let k=0;k<460;k++) {
    const y=1-2*(k+.5)/460,lon=k*2.399963229728653,frame=sphereFrame(lon,Math.asin(y));
    for(let j=0;j<4;j++) for(const t of [j/4,(j+1)/4]) {
      const p=new THREE.Vector3(...frame.center).multiplyScalar(1.002)
        .addScaledVector(new THREE.Vector3(...frame.east),(t-.5)*.028)
        .addScaledVector(new THREE.Vector3(...frame.north),Math.sin(t*Math.PI*2)*.0025).normalize().multiplyScalar(1.002);
      wavePositions.push(...p);
    }
  }
  const waves=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(wavePositions,3)),new THREE.LineBasicMaterial({color:PALETTE.cream,transparent:true,opacity:.25}));
  waves.name='Water marks'; globe.add(waves);

  const loader=new THREE.TextureLoader(), patches=[], cleanups=[],isletStanding=[],assetState={disposed:false};
  const assetStart=performance.now();
  async function patch(frame,width,height,url,island=false) {
    // Islets use the ground-only split directly. Loading the full SVG here as
    // well would decode/rasterize it twice and reintroduce baked upright props.
    const standing=!island?await createIsletStanding(scene,frame,await(await fetch(url)).text()):null;
    const texture=standing?standing.ground:await loader.loadAsync(url);
    texture.colorSpace=THREE.SRGBColorSpace;
    if(assetState.disposed){
      texture.dispose();
      for(const {mesh}of standing?.props??[]){scene.remove(mesh);mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();}
      return;
    }
    if(standing)isletStanding.push(standing);
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const geometry=new THREE.PlaneGeometry(width,height,island?96:24,island?72:24),positions=geometry.attributes.position;
    for(let k=0;k<positions.count;k++){
      const x=positions.getX(k),y=-positions.getY(k),point=surfacePoint(frame,x,y,WORLD_GEO.Rw);
      positions.setXYZ(k,point.x,point.y,point.z);
    }
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,
      new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.04,depthWrite:true,side:THREE.FrontSide}));
    const atlasUniform={value:0};
    const atlasMatrix={value:new THREE.Matrix3()};
    mesh.material.onBeforeCompile=shader=>{
      planetLighting(shader);
      shader.uniforms.liveAtlas=atlasUniform;shader.uniforms.atlasMatrix=atlasMatrix;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat3 atlasMatrix; varying vec2 atlasPoint;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\natlasPoint=(atlasMatrix*vec3(uv,1.)).xy;');
      // The atlas remains under the live capture, including its feathered edge.
    };
    mesh.name=frame.name??frame.art; mesh.userData={id:frame.id,island,frame,width,height,texture,atlasUniform,atlasMatrix};
    mesh.material.customProgramCacheKey=()=> 'planet-ground';
    globe.add(mesh); patches.push(mesh); return mesh;
  }
  const assetTasks=[
    ...WORLD_ISLANDS.map(i=>()=>{const m=manifest[i.theme??'home'];return patch(i,i.width,i.height,`${m.src}?v=${m.sha256.slice(0,12)}`,true);}),
    ...ISLETS.map(i=>()=>patch(i,i.width,i.width,`/pixi-art/islets/${i.art}.svg`))
  ];
  // The current Home view can be used immediately. Other atlas/islet work is
  // bounded and yields between jobs instead of holding up the first frame.
  const first=Math.max(0,WORLD_ISLANDS.findIndex(i=>i.id===initialIsland));
  await assetTasks.splice(first,1)[0]();

  const overlay=document.createElement('canvas'); overlay.className='heart-overlay'; overlay.setAttribute('aria-hidden','true');
  host.append(overlay); const ctx=overlay.getContext('2d');
  overlay.style.zIndex='2';
  const heart=new Image(); heart.src=`data:image/svg+xml,${encodeURIComponent(HEART)}`; await heart.decode();
  const glow=document.createElement('canvas'); glow.width=glow.height=64;
  const gc=glow.getContext('2d'), gradient=gc.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,240,190,1)'); gradient.addColorStop(.35,'rgba(255,214,90,.55)'); gradient.addColorStop(1,'rgba(255,214,90,0)');
  gc.fillStyle=gradient; gc.fillRect(0,0,64,64);
  let width=1,height=1,pixelRatio=1,selected='home',active=true,destroyed=false,raf=0,transition=null,last=performance.now(),due=0,seed=7;
  let targetAltitude=EARTH_DISTANCE-1,zoomAnchor=null,live=null,detailId=null;
  const events=[], random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  // Collision maps also contain detached/legacy coast pieces that the preview
  // does not draw. Check the actual displayed art once while building locations.
  let heartLocation;
  function refreshHeartLocations(){
    const heartMasks=new Map(patches.map(p=>{
      const c=document.createElement('canvas');c.width=256;c.height=256;
      const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(p.userData.texture.image,0,0,256,256);
      return [p.userData.frame,context.getImageData(0,0,256,256)];
    }));
    heartLocation=createHeartLocations(WORLD_ISLANDS.filter(i=>heartMasks.has(i)),mapOf,random,ISLETS.filter(i=>heartMasks.has(i)),(frame,x,y)=>heartArtContains(frame,x,y,heartMasks.get(frame)));
    heartMasks.clear();
  }
  refreshHeartLocations();
  const frames=[];
  let frameCount=0;
  let statsAt=performance.now(),renderCount=0,drawCount=0,renderMs=0,detailMs=0,detailPeak=0,overlayAt=-Infinity;
  const review=new URLSearchParams(location.search),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||review.has('review');
  globe.quaternion.copy(focusQuaternion(sphereFrame(Number(review.get('viewLon')??0)*Math.PI/180,23*Math.PI/180)));
  function resize() {
    const box=host.getBoundingClientRect(); width=Math.max(1,box.width);height=Math.max(1,box.height);pixelRatio=Math.min(devicePixelRatio||1,1.5);
    renderer.setSize(width,height);renderer.setPixelRatio(pixelRatio);camera.aspect=width/height;camera.updateProjectionMatrix();
    overlay.width=Math.round(width*pixelRatio);overlay.height=Math.round(height*pixelRatio);ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    demand.invalidate();
  }
  const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host); resize();
  const globeRadius=()=>height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.sqrt(camera.position.z**2-1));
  function pick(x,y) {
    const hit=pickSurfacePatch(camera,globe.quaternion,x,y,width,height,WORLD_ISLANDS,WORLD_GEO.Rw);
    return hit?patches.find(p=>p.userData.id===hit.id):null;
  }
  function groundAtPointer(x,y){
    const p=surfaceAtPointer({x,y});
    if(p){const frame=WORLD_ISLANDS.find(i=>i.id===p.id);if(frame)return surfacePoint(frame,p.x,p.y,WORLD_GEO.Rw).normalize().applyQuaternion(globe.quaternion);}
    return surfaceUnderPointer(camera,x,y,width,height);
  }
  function coordinates(e) {const b=renderer.domElement.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};}
  function focus(id,{enter=false}={}) {
    const island=WORLD_ISLANDS.find(i=>i.id===id);if(!island)return;
    selected=id;onSelect(island);renderer.domElement.dataset.selectedIsland=id;
    zoomAnchor=null;targetAltitude=enter ? .65 : EARTH_DISTANCE-1;
    transition={at:performance.now(),duration:reduced?1:700,from:globe.quaternion.clone(),to:focusSurfaceQuaternion(island,globe.quaternion),z0:camera.position.z,z1:1+targetAltitude};
  }
  function world() {zoomAnchor=null;targetAltitude=EARTH_DISTANCE-1;transition={at:performance.now(),duration:reduced?1:650,from:globe.quaternion.clone(),to:globe.quaternion.clone(),z0:camera.position.z,z1:EARTH_DISTANCE};}
  let drag=null,pinch=null;const pointers=new Map();
  function down(e) {
    if(!active||e.button>0)return;onInteract();renderer.domElement.focus({preventScroll:true});const p=coordinates(e);pointers.set(e.pointerId,p);renderer.domElement.setPointerCapture(e.pointerId);transition=null;
    if(pointers.size===2){const [a,b]=[...pointers.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2,point=groundAtPointer(x,y);pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),altitude:camera.position.z-1,frame:pick(x,y)?.userData.frame,point:point?.applyQuaternion(globe.quaternion.clone().invert())};if(pinch.frame&&pinch.point)pinch.approach={startAltitude:pinch.altitude,angle:alignIslandNorth(globe.quaternion,pinch.frame,pinch.point,camera,0)};drag=null;return;}
    zoomAnchor=null;targetAltitude=camera.position.z-1;
    const point=groundAtPointer(p.x,p.y);
    drag={...p,point:point?.applyQuaternion(globe.quaternion.clone().invert())??null,distance:0};
    renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';
  }
  function move(e) {
    const p=coordinates(e);if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
    if(pinch&&pointers.size>=2){const[a,b]=[...pointers.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2;targetAltitude=THREE.MathUtils.clamp(pinch.altitude*pinch.distance/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),.018,7);zoomAnchor=pinch.point?{point:pinch.point,x,y,island:targetAltitude<pinch.altitude?pinch.frame:null,approach:pinch.approach}:null;demand.invalidate();return;}
    if(!drag) {const hit=pick(p.x,p.y);renderer.domElement.style.cursor=hit?'pointer':'grab';renderer.domElement.dataset.hoveredIsland=hit?.userData.id??'';return;}
    if(!drag.point||!lockSurfaceAnchor(globe.quaternion,drag.point,camera,p.x,p.y,width,height)){
      drag.point=null;rotateGlobeFromScreen(globe.quaternion,p.x-drag.x,p.y-drag.y,height);
    }
    demand.invalidate();
    drag.distance+=Math.hypot(p.x-drag.x,p.y-drag.y);Object.assign(drag,{x:p.x,y:p.y});
  }
  function up(e) {
    pointers.delete(e.pointerId);if(pinch){pinch=null;drag=null;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);return;}
    if(!drag)return;const p=coordinates(e),click=drag.distance<5;drag=null;
    if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
    renderer.domElement.style.cursor='grab';
    if(click){const hit=pick(p.x,p.y);if(camera.position.z<1.6){const frame=hit?.userData.frame??WORLD_ISLANDS.find(i=>i.id===selected),point=surfaceUnderPointer(camera,p.x,p.y,width,height)?.applyQuaternion(globe.quaternion.clone().invert());if(point)onTap({id:frame.id,...surfaceCoordinates(frame,point,WORLD_GEO.Rw),screen:p});}else if(hit)focus(hit.userData.id,{enter:true});}
  }
  function wheel(e) {
    e.preventDefault();if(!active)return;onInteract();const p=coordinates(e),hit=pick(p.x,p.y);
    if(hit&&selected!==hit.userData.id){selected=hit.userData.id;onSelect(hit.userData.frame);}
    const point=groundAtPointer(p.x,p.y),previous=zoomAnchor;
    zoomAnchor=point?{point:point.applyQuaternion(globe.quaternion.clone().invert()),...p}:null;
    transition=null;
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
    targetAltitude=THREE.MathUtils.clamp(targetAltitude*Math.exp(delta*.0015),.018,7);
    if(zoomAnchor){
      zoomAnchor.island=delta<0?hit?.userData.frame:null;
      if(zoomAnchor.island)zoomAnchor.approach=previous?.island?.id===zoomAnchor.island.id?previous.approach:null;
      if(zoomAnchor.island&&!zoomAnchor.approach)zoomAnchor.approach={startAltitude:camera.position.z-1,angle:alignIslandNorth(globe.quaternion,zoomAnchor.island,zoomAnchor.point,camera,0)};
    }
  }
  function listen(name,fn,options){renderer.domElement.addEventListener(name,fn,options);cleanups.push(()=>renderer.domElement.removeEventListener(name,fn,options));}
  listen('keydown',e=>{if(e.key==='0'||e.key==='Escape'){e.preventDefault();onInteract();world();}else if(['+','=','-'].includes(e.key)){e.preventDefault();wheel({preventDefault(){},clientX:renderer.domElement.getBoundingClientRect().left+width/2,clientY:renderer.domElement.getBoundingClientRect().top+height/2,deltaY:e.key==='-'?160:-160,deltaMode:0});}});listen('pointerdown',down);listen('pointermove',move);listen('pointerup',up);listen('pointercancel',()=>{drag=null;pinch=null;pointers.clear();});listen('wheel',wheel,{passive:false});

  function activity(time,dt) {
    // Surface anchors are occluded below; the rising heart itself is free to
    // cross the planet silhouette, without a circular cookie-cutter edge.
    ctx.clearRect(0,0,width,height);ctx.save();
    const px=Math.min(1.5,Math.max(1,globeRadius()/240));
    for(due-=dt;due<0;due+=HEART_ACTIVITY_INTERVAL*(.8+random()*.4)) {
      if(events.length>=HEART_ACTIVITY_LIMIT)continue;
      const {island,x,y}=heartLocation();
      events.push({position:surfacePoint(island,x,y,WORLD_GEO.Rw),normal:surfacePoint(island,x,y,WORLD_GEO.Rw).normalize(),at:time,heart:random()<HEART_ACTIVITY_CHANCE,duration:2+random()*.8,seed:x});
    }
    for(let i=events.length-1;i>=0;i--) {
      const event=events[i],sec=time-event.at,age=sec/event.duration;if(age>=1){events.splice(i,1);continue;}
      const p=event.position.clone().applyQuaternion(globe.quaternion),normal=event.normal.clone().applyQuaternion(globe.quaternion);
      const facing=normal.dot(camera.position.clone().sub(p).normalize());
      if(facing<.08||!visiblePoint(p,camera.position))continue;
      p.project(camera);const x=(p.x+1)*width/2,y=(1-p.y)*height/2,f=ease(facing/.3),sq=.45+.55*facing,k=out(age),rr=(2.5+k*11)*px;
      const fade=ease(age/.12)*(1-ease((age-.35)/.65)),gw=(.14+out(age)*.18)*px*64;
      ctx.globalAlpha=fade*.85*f;ctx.drawImage(glow,x-gw/2,y-gw*sq/2,gw,gw*sq);
      ctx.globalAlpha=(1-k)*.55*f;ctx.strokeStyle='#FFF3C4';ctx.lineWidth=1.1*px;ctx.beginPath();ctx.ellipse(x,y,rr,rr*sq,0,0,Math.PI*2);ctx.stroke();
      if(event.heart&&!reduced){
        const pose=heartPose(sec,event.seed),size=19*pose.scale*px;
        ctx.save();ctx.globalAlpha=pose.alpha*f;ctx.translate(x+pose.x*px,y+pose.y*px);ctx.rotate(pose.rotation);ctx.drawImage(heart,-size/2,-size*17.3/38,size,size*17.3/19);ctx.restore();
        if(pose.spark>.01)for(let n=0;n<4;n++) {const a=n*1.571+.785,d=(7+out(sec/.45)*9)*px;ctx.globalAlpha=pose.spark*f;ctx.fillStyle='#FF8FA6';ctx.beginPath();ctx.arc(x+Math.cos(a)*d,y-8*px+Math.sin(a)*d,1.6*px,0,Math.PI*2);ctx.fill();}
      }
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  function tick(now) {
    if(destroyed||!active||document.hidden)return;const dt=Math.min(.1,(now-last)/1000);last=now;
    let moving=!!(drag||transition||Math.abs(camera.position.z-1-targetAltitude)>1e-7);
    if(transition) {
      const t=ease((now-transition.at)/transition.duration);
      globe.quaternion.slerpQuaternions(transition.from,transition.to,t);camera.position.z=THREE.MathUtils.lerp(transition.z0,transition.z1,t);
      if(t>=1)transition=null;
    }else if(Math.abs(camera.position.z-1-targetAltitude)>1e-7){
      const previous=camera.position.z;
      camera.position.z=1+Math.exp(THREE.MathUtils.lerp(Math.log(previous-1),Math.log(targetAltitude),reduced?1:1-Math.exp(-18*dt)));
      if(zoomAnchor&&!lockSurfaceAnchor(globe.quaternion,zoomAnchor.point,camera,zoomAnchor.x,zoomAnchor.y,width,height)){
        camera.position.z=previous;targetAltitude=previous-1;zoomAnchor=null;
      }
    }
    if(zoomAnchor?.island&&zoomAnchor.approach&&!drag&&!transition){
      const progress=approachProgress(zoomAnchor.approach.startAltitude,camera.position.z-1),remaining=zoomAnchor.approach.angle*(1-progress);
      const angle=alignIslandNorth(globe.quaternion,zoomAnchor.island,zoomAnchor.point,camera,reduced?1:1-Math.exp(-14*dt),reduced?Infinity:2.4*dt,reduced?0:remaining);
      renderer.domElement.dataset.approachProgress=progress.toFixed(3);
      renderer.domElement.dataset.approachIsland=zoomAnchor.island.id;
      renderer.domElement.dataset.approachHeadingDeg=(angle*180/Math.PI).toFixed(3);
      if(Math.abs(angle-(reduced?0:remaining))>1e-5){moving=true;demand.invalidate();}
    }
    // After a close drag, settle the heading at the same gentle angular rate
    // used during zoom. The centre anchor stays fixed throughout this twist.
    if(!zoomAnchor?.island&&!drag&&!transition&&camera.position.z<1.5){
      const frame=WORLD_ISLANDS.find(i=>i.id===selected),anchor=surfaceUnderPointer(camera,width/2,height/2,width,height)?.applyQuaternion(globe.quaternion.clone().invert());
      if(anchor){const angle=alignIslandNorth(globe.quaternion,frame,anchor,camera,reduced?1:1-Math.exp(-14*dt),reduced?Infinity:2.4*dt);if(Math.abs(angle)>1e-5){moving=true;demand.invalidate();}}
    }
    const near=Math.max(.001,Math.min(.2,(camera.position.z-1)*.2));
    if(Math.abs(camera.near-near)>1e-7){camera.near=near;camera.updateProjectionMatrix();}
    backdrop.setRotation(globe.quaternion);
    globe.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const centre=new THREE.Vector3(0,0,1).applyQuaternion(globe.quaternion.clone().invert());
    if(camera.position.z<2.8&&!transition){
      const nearest=WORLD_ISLANDS.reduce((a,b)=>new THREE.Vector3(...a.center).dot(centre)>new THREE.Vector3(...b.center).dot(centre)?a:b);
      if(nearest.id!==selected){selected=nearest.id;onSelect(nearest);}
      if(detailId!==selected){detailId=selected;onDetail(selected);}
    }
    const frame=WORLD_ISLANDS.find(i=>i.id===selected);
    const heading=alignIslandNorth(globe.quaternion,frame,zoomAnchor?.point??centre,camera,0);
    renderer.domElement.dataset.captureHeadingDeg=(heading*180/Math.PI).toFixed(2);
    let ambientChanged=!direct&&atmosphere.update(now/1000,camera.position.z,reduced);
    const detailStart=performance.now();
    const held=drag??zoomAnchor;
    onFrame({heading,anchor:held?{point:held.point,x:held.x,y:held.y}:null,id:selected,altitude:camera.position.z-1,point:surfaceCoordinates(frame,centre,WORLD_GEO.Rw),distance:camera.position.z,fov:camera.fov,width,height,moving});
    if(!direct)for(const standing of isletStanding)standing.update(globe.quaternion,camera,isletProjection);
    for(const patch of patches)if(!patch.userData.island)patch.visible=!live||!isletCapture(patch.userData.frame);
    if(!direct&&pirates?.update(globe.quaternion,camera,now/1000,dt,reduced,1-detailOpacity,pirateProjection,{width,height}))ambientChanged=true;
    if(!direct&&ambientClock.update(now,ambientChanged))demand.invalidate();
    const detailCost=performance.now()-detailStart;detailMs+=detailCost;detailPeak=Math.max(detailPeak,detailCost);
    if(!direct&&demand.consume(moving)){
      const renderStart=performance.now();renderer.render(scene,camera);renderMs+=performance.now()-renderStart;renderCount++;drawCount+=renderer.info.render.calls;
    }
    if(now-overlayAt>=1000/60-.5){const overlayDt=Math.min(.1,(now-overlayAt)/1000);overlayAt=now;if(!direct&&camera.position.z>1.6)activity(now/1000,overlayDt);else ctx.clearRect(0,0,width,height);}
    frames.push(dt*1000);if(frames.length>90)frames.shift();
    if(++frameCount%30===0){const el=renderer.domElement;el.dataset.frameMeanMs=(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(1);el.dataset.quaternion=globe.quaternion.toArray().map(n=>n.toFixed(5)).join(',');el.dataset.patchCount=patches.length;el.dataset.cameraDistance=camera.position.z.toFixed(3);el.dataset.selectedIsland=selected;el.dataset.projection='continuous-sphere';el.dataset.liveIsland=live?.id??'';el.dataset.globeDiameter=(globeRadius()*2).toFixed(1);el.dataset.waterPhase=atmosphere.phase.toFixed(3);}
    if(now-statsAt>=1000){const d=renderer.domElement.dataset,seconds=(now-statsAt)/1000;d.rendersPerSecond=(renderCount/seconds).toFixed(1);d.drawCallsPerSecond=(drawCount/seconds).toFixed(1);d.renderCpuMs=(renderMs/Math.max(1,renderCount)).toFixed(2);d.detailCpuMsPerSecond=(detailMs/seconds).toFixed(2);d.detailPeakMs=detailPeak.toFixed(2);d.frameP95Ms=[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)]?.toFixed(1);d.seaColor='#'+PALETTE.water.toString(16).toUpperCase();statsAt=now;renderCount=drawCount=renderMs=detailMs=detailPeak=0;}
    if(active)raf=requestAnimationFrame(tick);
  }
  const visibility=()=>{cancelAnimationFrame(raf);if(!document.hidden&&active&&!destroyed){last=performance.now();demand.invalidate();raf=requestAnimationFrame(tick);}};
  document.addEventListener('visibilitychange',visibility);cleanups.push(()=>document.removeEventListener('visibilitychange',visibility));
  renderer.domElement.dataset.selectedIsland=selected;renderer.domElement.dataset.islandCount=WORLD_ISLANDS.length;renderer.domElement.dataset.isletCount=ISLETS.length;
  raf=requestAnimationFrame(tick);onReady();
  const ready=loadWorldAssets(assetTasks,{
    stopped:()=>assetState.disposed,
    onLoaded:()=>{renderer.domElement.dataset.patchCount=patches.length;demand.invalidate();},
    onError:error=>{console.warn('World preview asset failed',error);renderer.domElement.dataset.assetErrors=String(Number(renderer.domElement.dataset.assetErrors??0)+1);}
  }).then(()=>{if(!assetState.disposed){try{refreshHeartLocations();}catch(error){console.warn('World activity mask failed',error);}renderer.domElement.dataset.assetsReadyMs=(performance.now()-assetStart).toFixed(1);}});
  function setLiveCanvas(id,canvas,placement,matrix,atlasWidth,atlasHeight,bounds=null,captureScale=DETAIL_CAPTURE_SCALE){
    liveCaptureScale.value=captureScale;
    const patch=patches.find(p=>p.userData.island&&p.userData.id===id);if(!patch)return;
    if(bounds&&![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite))return;
    if(live?.id!==id||live.canvasWidth!==canvas.width||live.canvasHeight!==canvas.height){
      clearLiveCanvas();
      const geometry=patch.geometry,texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.matrixAutoUpdate=false;
      const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:0,depthWrite:false,depthTest:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      material.onBeforeCompile=shader=>{planetLighting(shader);liveCaptureEdgeShader(shader,canvas);liveCaptureProjection(shader,liveCaptureBlend,liveCaptureScale);
        // The independently tessellated atlas and live surface intersect even
        // with polygon offset. Live detail owns this coverage; only reject
        // the back hemisphere instead of depth-testing against the old atlas.
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 captureWorldPoint;').replace('#include <project_vertex>','#include <project_vertex>\ncaptureWorldPoint=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 captureWorldPoint;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(liveCaptureBlend<.001&&dot(captureWorldPoint,cameraPosition-captureWorldPoint)<=0.)discard;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(any(lessThan(vMapUv,vec2(0.)))||any(greaterThan(vMapUv,vec2(1.))))discard;');};
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Live island detail';mesh.frustumCulled=false;mesh.renderOrder=100;globe.add(mesh);
      const viewport=detailViewport(texture,DETAIL_CAPTURE_SCALE);viewport.material.opacity=detailOpacity;viewport.visible=false;scene.add(viewport);
      live={id,patch,mesh,viewport,canvasWidth:canvas.width,canvasHeight:canvas.height};
    }
    if(bounds){
      if(liveSurfaceNeedsUpdate(live.bounds,bounds)){
        const geometry=liveSurfaceGeometry(patch.userData.frame,bounds,patch.userData.width,patch.userData.height,WORLD_GEO.Rw);
        if(!geometry)return;
        if(live.ownsGeometry)live.mesh.geometry.dispose();live.mesh.geometry=geometry;live.ownsGeometry=true;live.bounds=liveSurfaceBounds(bounds);
      }
    }
    const t=atlasTransform(patch.userData.width,patch.userData.height,placement,matrix,atlasWidth,atlasHeight);
    const gpuMatrix=patch.userData.atlasMatrix.value;gpuMatrix.set(t.a,t.c,t.x,t.b,t.d,t.y,0,0,1);
    live.mesh.material.map.matrix.copy(gpuMatrix);patch.userData.atlasUniform.value=1;live.mesh.material.map.needsUpdate=true;demand.invalidate();
  }
  function clearLiveCanvas(){if(!live)return;live.patch.userData.atlasUniform.value=0;globe.remove(live.mesh);scene.remove(live.viewport);live.viewport.geometry.dispose();live.viewport.material.dispose();live.mesh.material.map.dispose();live.mesh.material.dispose();if(live.ownsGeometry)live.mesh.geometry.dispose();live=null;demand.invalidate();}
  function setPresentation(blend,value){
    if(detailOpacity!==blend)demand.invalidate();
    detailOpacity=blend;liveCaptureBlend.value=blend;
    if(live){live.viewport.material.opacity=blend;live.viewport.visible=false;}
    if(direct!==value){
      direct=value;renderer.domElement.setAttribute('aria-label',direct?'Ducky Land island. Drag to pan, scroll to zoom, click to walk.':'Rotating Ducky Land globe');renderer.domElement.style.opacity=direct?'0':'1';host.style.background=direct?'transparent':'#000';
      for(const c of host.querySelectorAll('.space-backdrop,.space-effects,.heart-overlay'))c.style.visibility=direct?'hidden':'';
      backdrop.setActive(active&&!direct);demand.invalidate();
    }
    renderer.domElement.dataset.presentation=direct?'native-pixi':'three-globe';
    renderer.domElement.dataset.detailBlend=blend.toFixed(3);
  }
  function setSpaceStyle(id){spaceStyle=SPACE_LOOKS[id]?id:'starlight';const look=SPACE_LOOKS[spaceStyle];planetShade.value=look.shade;backdrop.setStyle(spaceStyle);renderer.domElement.dataset.spaceStyle=spaceStyle;demand.invalidate();return look;}
  renderer.domElement.dataset.spaceStyle=spaceStyle;
  renderer.domElement.dataset.cloudCount=String(atmosphere.cloudCount);renderer.domElement.dataset.atmosphereRim='none';renderer.domElement.dataset.waterMotion='animated-wave-normals';
  function centreOn(id,x,y,altitude=null,animate=false){
    const frame=WORLD_ISLANDS.find(i=>i.id===id);if(!frame)return;
    const map=mapOf(id),point=surfacePoint(frame,x-map.cx,y-map.cy,WORLD_GEO.Rw).normalize();
    const to=animate?islandQuaternion(transport(frame,point.toArray())).invert():new THREE.Quaternion().setFromUnitVectors(point.clone().applyQuaternion(globe.quaternion),new THREE.Vector3(0,0,1)).multiply(globe.quaternion);
    selected=id;onSelect(frame);zoomAnchor=null;
    if(altitude!==null)targetAltitude=altitude;
    if(animate)transition={at:performance.now(),duration:reduced?1:600,from:globe.quaternion.clone(),to,z0:camera.position.z,z1:1+targetAltitude};
    else{globe.quaternion.copy(to);transition=null;}
    demand.invalidate();
  }
  function project(id,x,y){const frame=WORLD_ISLANDS.find(i=>i.id===id);if(!frame)return null;const map=mapOf(id),p=surfacePoint(frame,x-map.cx,y-map.cy,WORLD_GEO.Rw).applyQuaternion(globe.quaternion);if(!visiblePoint(p,camera.position))return null;p.project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
  function focusIslet(id){
    const frame=ISLETS.find(i=>i.id===id);if(!frame)return;
    selected=frame.home;onSelect(WORLD_ISLANDS.find(i=>i.id===selected));zoomAnchor=null;targetAltitude=.65;
    transition={at:performance.now(),duration:reduced?1:700,from:globe.quaternion.clone(),to:focusQuaternion(frame),z0:camera.position.z,z1:1+targetAltitude};demand.invalidate();
  }
  return {ready,focus,focusIslet,world,setLiveCanvas,clearLiveCanvas,setSpaceStyle,centreOn,project,setPresentation,

    setActive(value){if(active===value)return;active=value;backdrop.setActive(value&&!direct);cancelAnimationFrame(raf);if(value){last=performance.now();resize();demand.invalidate();raf=requestAnimationFrame(tick);}},
    destroy(){assetState.disposed=true;destroyed=true;cancelAnimationFrame(raf);clearLiveCanvas();pirates?.destroy();resizeObserver.disconnect();backdrop.destroy();atmosphere.destroy();cleanups.forEach(fn=>fn());const geometries=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){o.material.map?.dispose();o.material.dispose();}});geometries.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();overlay.remove();}
  };
}
