import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {CanvasTexture,Group,Matrix3,Mesh,MeshBasicMaterial,PerspectiveCamera,PlaneGeometry,Quaternion,Raycaster,Scene,ShaderLib,Vector2,Vector3,Vector4} from 'three';
import {DETAIL_CAPTURE_SCALE,detailViewport,detailSize,detailCamera,detailBlend} from '../src/pixi/three-detail-view.js';
import {liveSurfaceBounds,liveSurfaceNeedsUpdate,liveSurfaceGeometry,captureFeather,liveCaptureEdgeShader,liveCaptureProjection} from '../src/pixi/three-live-geometry.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {ISLETS} from '../src/pixi/islets.js';
import {atlasTransform,focusQuaternion,surfacePoint} from '../src/pixi/three-globe-math.js';
import {cameraMatrix} from '../src/pixi/sphere-camera.js';
import {flatRigid} from '../src/pixi/rigid.js';

const sizes=[[2560,1080],[1920,1080],[393,852]];
const frame=WORLD_ISLANDS.find(i=>i.theme==='community'),map=mapOf(frame.id);

function assertViewport(mesh,width,height){
  assert.equal(mesh.frustumCulled,false,'the sphere camera must not cull the screen plane');
  assert.equal(mesh.material.depthTest,false,'ocean and island depths must not clip the handoff');
  assert.equal(mesh.material.depthWrite,false);
  const shader={vertexShader:ShaderLib.basic.vertexShader};
  mesh.material.onBeforeCompile(shader);
  assert.ok(!shader.vertexShader.includes('#include <project_vertex>'),'handoff projection must bypass the globe camera and rotation');
  assert.ok(shader.vertexShader.includes('gl_Position=vec4(position.xy,0.,1.);'));
  assert.ok(shader.vertexShader.includes('vMapUv=vec2(.5)+(uv-vec2(.5))/detailCaptureScale;'),'screen capture must bypass the spherical atlas UV transform');
  const scale=shader.uniforms.detailCaptureScale.value;
  // Use the actual plane triangles and UVs. Every viewport corner, edge and
  // interior pixel must have a triangle and sample the same capture location.
  const {position,uv}=mesh.geometry.attributes,indices=mesh.geometry.index.array;
  for(const sx of [0,.01,.25,.5,.75,.99,1])for(const sy of [0,.01,.5,.99,1]){
    const x=sx*2-1,y=1-sy*2;
    let hit=false;
    for(let k=0;k<indices.length;k+=3){
      const [a,b,c]=indices.slice(k,k+3),ax=position.getX(a),ay=position.getY(a),bx=position.getX(b),by=position.getY(b),cx=position.getX(c),cy=position.getY(c);
      const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy),u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
      if(Math.min(u,v,w)<-1e-8)continue;
      const tx=.5+(u*uv.getX(a)+v*uv.getX(b)+w*uv.getX(c)-.5)/scale,ty=.5+(u*uv.getY(a)+v*uv.getY(b)+w*uv.getY(c)-.5)/scale;
      assert.ok(Math.abs(tx-(.5+(sx-.5)/scale))<1e-8&&Math.abs((1-ty)-(.5+(sy-.5)/scale))<1e-8,'capture spans the CSS viewport with the exact central overscan crop');hit=true;break;
    }
    assert.ok(hit,`uncovered pixel at ${sx*width},${sy*height}`);
  }
}

test('Campfire handoff covers every viewport edge throughout zoom-out, even after a half turn',()=>{
  for(const [width,height]of sizes)for(const heading of [0,.7,Math.PI/2,Math.PI])for(const scale of [1,DETAIL_CAPTURE_SCALE]){
    const size=detailSize(width,height,2),texture=new CanvasTexture({width:size.width,height:size.height}),viewport=detailViewport(texture,scale),scene=new Scene(),globe=new Group();
    scene.add(globe,viewport);globe.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),heading).multiply(focusQuaternion(frame)));scene.updateMatrixWorld(true);
    assert.ok(Math.max(size.width,size.height)<=1536);
    assert.ok(Math.abs(size.width/size.height-width/height)<.003);
    // The same texture has a nonidentity atlas matrix for the spherical mesh.
    // The viewport plane must still sample the complete, untransformed image.
    for(const altitude of [.16,.17,.18,.20,.23,.26,.30,.35,.36]){
      const camera=detailCamera(frame,map,{fov:35,altitude,radius:WORLD_GEO.Rw,point:{x:900,y:-400},width,height},size.width,size.height,1,{x:0,y:0},scale);
      const t=atlasTransform(frame.width,frame.height,flatRigid(frame.id,frame.id),cameraMatrix(camera,size.width,size.height),size.width,size.height);
      texture.matrixAutoUpdate=false;texture.matrix=new Matrix3().set(t.a,t.c,t.x,t.b,t.d,t.y,0,0,1);
      // Rotating the world does not parent, rotate or rescale the viewport.
      assert.equal(viewport.parent,scene);assert.ok(viewport.matrixWorld.equals(scene.matrixWorld));
      viewport.material.opacity=detailBlend(altitude);assertViewport(viewport,width,height);
    }
    viewport.geometry.dispose();viewport.material.dispose();texture.dispose();
  }
});

test('single capture projection ends at exact overscan UV positions with constant perspective W',()=>{
  const uniform={value:0},shader={uniforms:{},vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader};
  liveCaptureProjection(shader,uniform,DETAIL_CAPTURE_SCALE);
  assert.equal(shader.uniforms.liveCaptureBlend,uniform,'projection uses the same transition state as the bridge');
  assert.ok(shader.vertexShader.includes('float captureW=mix(gl_Position.w,1.,liveCaptureBlend);'),'flat endpoint must stop perspective-distorting capture UVs');
  const camera=new PerspectiveCamera(35,2560/1080,.001,20);camera.position.z=1.23;camera.updateMatrixWorld();
  const span=2*Math.tan(35*Math.PI/360)*.23*WORLD_GEO.Rw,size=detailSize(2560,1080,2);
  const native=detailCamera(frame,map,{fov:35,altitude:.23,radius:WORLD_GEO.Rw,point:{x:900,y:-400},width:2560,height:1080},size.width,size.height,1,{x:0,y:0},DETAIL_CAPTURE_SCALE);
  const t=atlasTransform(frame.width,frame.height,flatRigid(frame.id,frame.id),cameraMatrix(native,size.width,size.height),size.width,size.height);
  const atlasMatrix=new Matrix3().set(t.a,t.c,t.x,t.b,t.d,t.y,0,0,1);
  const geometry=liveSurfaceGeometry(frame,{x:900,y:-400,width:span*2560/1080*DETAIL_CAPTURE_SCALE,height:span*DETAIL_CAPTURE_SCALE},frame.width,frame.height,WORLD_GEO.Rw);
  const positions=geometry.attributes.position,uvs=geometry.attributes.uv,rotation=focusQuaternion(frame);let minW=Infinity,maxW=0;
  for(let k=0;k<positions.count;k+=17){
    const world=new Vector3().fromBufferAttribute(positions,k).applyQuaternion(rotation),clip=new Vector4(world.x,world.y,world.z,1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    const uv=new Vector2().fromBufferAttribute(uvs,k).applyMatrix3(atlasMatrix),flat=new Vector2((uv.x-.5)*2*DETAIL_CAPTURE_SCALE,(uv.y-.5)*2*DETAIL_CAPTURE_SCALE);
    minW=Math.min(minW,clip.w);maxW=Math.max(maxW,clip.w);
    const flatPixel={x:(flat.x+1)*2560/2,y:(1-flat.y)*1080/2};
    const expected={x:(uv.x-.5)*DETAIL_CAPTURE_SCALE*2560+1280,y:(.5-uv.y)*DETAIL_CAPTURE_SCALE*1080+540};
    assert.ok(Math.hypot(flatPixel.x-expected.x,flatPixel.y-expected.y)<1e-8);
  }
  assert.ok(maxW-minW>.001,'the curved mesh has varying W, so retaining original W would warp the flat endpoint');
  geometry.dispose();
});

test('combined camera pan and zoom-out cannot escape the cached live surface, in either axis',()=>{
  for(const [width,height]of sizes){
    let bounds={x:0,y:0,width,height},cached=liveSurfaceBounds(bounds),rebuilds=0;
    // Each change passes the old separate pan and scale thresholds, but their
    // combined extent exceeds the old mesh, exposing the static globe at left.
    const panned={x:-width*.35,y:height*.35,width:width*1.4,height:height*1.4};
    assert.ok(liveSurfaceNeedsUpdate(cached,panned));
    for(let step=0;step<=120;step++){
      const scale=1+step*.01;bounds={x:-width*step*.003,y:height*step*.003,width:width*scale,height:height*scale};
      if(liveSurfaceNeedsUpdate(cached,bounds)){cached=liveSurfaceBounds(bounds);rebuilds++;}
      assert.ok(Math.abs(bounds.x-cached.x)+bounds.width/2<=cached.width/2);
      assert.ok(Math.abs(bounds.y-cached.y)+bounds.height/2<=cached.height/2);
    }
    assert.ok(rebuilds<10,'retain padded geometry reuse rather than remeshing every frame');
    assert.ok(liveSurfaceNeedsUpdate(cached,{...bounds,height:cached.height*1.1}),'height-only resize also checks coverage');
    const geometry=liveSurfaceGeometry(frame,bounds,frame.width,frame.height,WORLD_GEO.Rw);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));geometry.dispose();
  }
});

test('independent globe tessellations cross in depth, so live detail must own its coverage',()=>{
  const geometry=new PlaneGeometry(frame.width,frame.height,96,72),positions=geometry.attributes.position;
  for(let k=0;k<positions.count;k++){
    const p=surfacePoint(frame,positions.getX(k),-positions.getY(k),WORLD_GEO.Rw);positions.setXYZ(k,p.x,p.y,p.z);
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const span=2*Math.tan(35*Math.PI/360)*.381*WORLD_GEO.Rw;
  const capture=liveSurfaceGeometry(frame,{x:900,y:-400,width:span*2560/1080,height:span},frame.width,frame.height,WORLD_GEO.Rw);
  const material=new MeshBasicMaterial(),atlas=new Mesh(geometry,material),live=new Mesh(capture,material);
  atlas.quaternion.copy(focusQuaternion(frame));live.quaternion.copy(atlas.quaternion);atlas.updateMatrixWorld();live.updateMatrixWorld();
  const camera=new PerspectiveCamera(35,2560/1080,.001,20);camera.position.z=1.381;camera.updateMatrixWorld();
  const ray=new Raycaster();let front=0,behind=0;
  for(let y=-.8;y<=.81;y+=.2)for(let x=-.8;x<=.81;x+=.2){
    ray.setFromCamera(new Vector2(x,y),camera);
    const a=ray.intersectObject(atlas)[0],b=ray.intersectObject(live)[0];if(!a||!b)continue;
    if(b.distance<a.distance)front++;else behind++;
  }
  assert.ok(front>0&&behind>0,'same-radius meshes cross each other, producing triangular sharp/blur patches if depth-tested');
  geometry.dispose();capture.dispose();material.dispose();
});

test('live capture tapers its own edges without changing texture coordinates or cutting the atlas',()=>{
  for(const [width,height]of sizes){
    const size=detailSize(width,height,2),shader={uniforms:{},fragmentShader:ShaderLib.basic.fragmentShader};
    liveCaptureEdgeShader(shader,captureFeather(size));
    const feather=shader.uniforms.liveCaptureFeather.value;
    assert.ok(feather.x>0&&feather.x<=.12&&feather.y>0&&feather.y<=.12);
    assert.ok(shader.fragmentShader.includes('diffuseColor.a*=captureFade.x*captureFade.y;'),'a rotated capture edge must fade to the unchanged atlas');
    assert.ok(!shader.fragmentShader.includes('discard;'),'alpha-zero boundary keeps the underlying island available');
    assert.ok(shader.fragmentShader.includes('#include <map_fragment>'),'the actual atlas mapping remains unchanged');
    // All four edges have zero coverage, the centre has full coverage, and
    // crossing a corner cannot create a hard rectangular cut at any aspect.
    const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
    const coverage=(u,v)=>smooth(Math.min(u,1-u)/feather.x)*smooth(Math.min(v,1-v)/feather.y);
    for(const [u,v]of [[0,.5],[1,.5],[.5,0],[.5,1],[0,0],[1,1],[-.1,.5]])assert.equal(coverage(u,v),0);
    assert.equal(coverage(.5,.5),1);
    for(let k=0;k<20;k++)assert.ok(coverage(k/20*feather.x,.5)<=coverage((k+1)/20*feather.x,.5));
  }
});

// Run the real bridge, world, cameras, events and render-demand code. Only the
// GPU and decorative backdrop are replaced for Node execution. Real art and
// canvas pixels keep heart-location initialization in the handoff path.
const {outputFiles:[bundle]}=await build({
  entryPoints:[fileURLToPath(new URL('../src/pixi/three-game-view.js',import.meta.url))],bundle:true,packages:'external',platform:'node',format:'esm',write:false,
  plugins:[{name:'headless-decoration',setup(b){
    b.onLoad({filter:/three-world-view\.js$/},async args=>({contents:(await readFile(args.path,'utf8'))
      .replace('new THREE.WebGLRenderer(','new globalThis.__wideQA.Renderer(')
      .replace('new THREE.TextureLoader(','new globalThis.__wideQA.Loader(')}));
    b.onResolve({filter:/three-(space-backdrop|atmosphere)\.js$/},args=>({path:args.path,namespace:'decoration'}));
    b.onLoad({filter:/.*/,namespace:'decoration'},args=>({contents:args.path.includes('space-backdrop')?
      'export const SPACE_LOOKS={starlight:{shade:0}};export const createSpaceBackdrop=()=>({setRotation(){},setActive(){},destroy(){}});':
      'export const createGlobeAtmosphere=()=>({water:globalThis.__wideQA.water,update(){return false;},destroy(){},cloudCount:0,phase:0});'}));
  }}]
});
const {createThreeGameView}=await import('data:text/javascript;base64,'+Buffer.from(bundle.text.replaceAll('"three"',JSON.stringify(import.meta.resolve('three'))).replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')))).toString('base64'));

for(const [width,height]of sizes)test(`real handoff zoom-out/rotation/resize at ${width}x${height} keeps full width and native render ownership`,async()=>{
  const dom=new JSDOM('<div id="host"><canvas></canvas></div>',{pretendToBeVisual:true,url:'http://localhost/'}),{window}=dom,host=window.document.querySelector('#host'),canvas=host.querySelector('canvas');
  const keys=['window','document','location','Image','DOMParser','XMLSerializer','fetch','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia','devicePixelRatio','performance','__wideQA'],prior=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const callbacks=new Map(),observers=[],renderers=[],nativeProps=[];let nextRAF=0,now=performance.now(),nativeRenders=0,view;
  let box={width,height,left:0,top:0};window.HTMLElement.prototype.getBoundingClientRect=()=>box;
  Object.defineProperties(host,{clientWidth:{get:()=>box.width},clientHeight:{get:()=>box.height}});
  const canvases=new WeakMap();
  window.HTMLCanvasElement.prototype.getContext=function(){
    let bitmap=canvases.get(this);
    if(!bitmap){bitmap=createCanvas(this.width,this.height);canvases.set(this,bitmap);}
    if(bitmap.width!==this.width)bitmap.width=this.width;
    if(bitmap.height!==this.height)bitmap.height=this.height;
    const context=bitmap.getContext('2d');
    if(!Object.hasOwn(context,'drawImage')){
      const drawImage=context.drawImage.bind(context);
      context.drawImage=(source,...args)=>drawImage(canvases.get(source)??source.bitmap??source,...args);
    }
    return context;
  };
  class Renderer{
    constructor(){this.domElement=window.document.createElement('canvas');this.capabilities={getMaxAnisotropy:()=>1};this.info={render:{calls:1}};this.renders=0;this.domElement.getBoundingClientRect=()=>box;this.domElement.setPointerCapture=()=>{};this.domElement.hasPointerCapture=()=>false;renderers.push(this);}
    setPixelRatio(){}setSize(){}dispose(){}
    async compileAsync(){}
    render(scene,camera){this.scene=scene;this.camera=camera;this.renders++;}
  }
  const globals={window,document:window.document,location:window.location,devicePixelRatio:2,performance:{now:()=>now},
    Image:class{async decode(){this.bitmap=await loadImage(this.src);}},DOMParser:window.DOMParser,XMLSerializer:window.XMLSerializer,
    fetch:async url=>({text:()=>readFile(new URL('../public'+new URL(url,window.location.href).pathname,import.meta.url),'utf8')}),ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}disconnect(){}},
    requestAnimationFrame:fn=>{callbacks.set(++nextRAF,fn);return nextRAF;},cancelAnimationFrame:id=>callbacks.delete(id),matchMedia:()=>({matches:true}),
    __wideQA:{Renderer,Loader:class{async loadAsync(url){
      const path=new URL('../public'+new URL(url,window.location.href).pathname,import.meta.url);
      return new CanvasTexture(await loadImage(fileURLToPath(path)));
    }},water:new MeshBasicMaterial()}};
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  const isletProp={visible:true},isletFrame=ISLETS.find(i=>i.art==='05-lighthouse-rock');
  assert.ok(isletFrame,'exercise the lighthouse reported in the double-scenery screenshot');
  const game={isletView:{views:[{i:isletFrame,root:{visible:true},props:[{sprite:isletProp}]}],update(){}},canvas,width,height,artShown:'community',islandId:frame.id,ready:true,arts:new Map([['home',{ready:true}],['community',{ready:true}]]),
    camera:{x:map.cx,y:map.cy,zoom:1},target:{},zoomMotion:{velocity:0},player:{x:map.cx,y:map.cy},rigs:[],localDucks:[],liveRigs:new Map(),ocean:{alpha:1,visible:true},keys:new Set(),touchInput:{x:0,y:0},
    app:{render(){nativeRenders++;nativeProps.push(isletProp.visible);},renderer:{resolution:1,background:{alpha:1},resize(w,h,resolution=this.resolution){this.resolution=resolution;canvas.width=Math.round(w*resolution);canvas.height=Math.round(h*resolution);}}},
    tick(now,{followCamera}={}){
      if(this.keys.has('d'))this.player.x+=4;
      followCamera?.(this.externalCamera,this.playerView());
      this.app.render();
    },playerView(){return this.player;},resize(){},onInteriorChange(){},listen(){},ensureArt(){},artReady(){return true;},showArt(){},applyMapAmbience(){},freeArt(){},tap(){}};
  const step=(ms=17)=>{const frames=[...callbacks.values()];callbacks.clear();now+=ms;for(const fn of frames)fn(now);};
  const settle=async()=>{
    let done=false;view.ready.finally(()=>{done=true;});
    for(let k=0;!done&&k<2000;k++){step();await new Promise(resolve=>setTimeout(resolve,0));}
    assert.ok(done,'background atlas jobs must settle while browser paint callbacks are pumped');await view.ready;
  };
  const wheel=delta=>renderers[0].domElement.dispatchEvent(new window.WheelEvent('wheel',{clientX:box.width*.37,clientY:box.height*.61,deltaY:delta,cancelable:true}));
  try{
    view=await createThreeGameView(game,host);await settle();for(let i=0;i<4;i++)step();
    assert.equal(renderers.length,1,'handoff uses the existing Three renderer');
    const renderer=renderers[0];assert.equal(renderer.domElement.dataset.presentation,'native-pixi','initial close view');
    const renders=renderer.renders,flat=renderer.scene?.getObjectByName('Live viewport handoff'),version=flat?.material.map.version;
    for(let i=0;i<5;i++)step();
    assert.equal(renderer.renders,renders,'native close-up skips Three draws');assert.equal(flat?.material.map.version,version,'native close-up skips texture uploads');
    assert.ok(nativeRenders>0);assert.equal(nativeProps.at(-1),true,'native close-up draws its own upright islet props');assert.equal(canvas.style.visibility,'visible');
    const beforeWalk=nativeRenders;
    game.keys.add('d');
    for(let i=0;i<6;i++){
      step(1000/120);
      assert.equal(game.externalCamera.x,game.player.x,'camera follows the pose produced by the current frame');
    }
    game.keys.delete('d');
    assert.equal(nativeRenders-beforeWalk,6,'close-up draws every display frame at 120 Hz');
    wheel(300);for(let i=0;i<3;i++)step();
    assert.equal(renderer.domElement.dataset.presentation,'three-globe','zoom-out camera: '+renderer.camera.position.z);
    const globe=renderer.scene.getObjectByName('World: ocean, islands, islets and activity anchors');
    globe.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.7));
    for(const delta of [80,100,100]){
      wheel(delta);for(let i=0;i<2;i++)step();
      const viewport=renderer.scene.getObjectByName('Live viewport handoff');assertViewport(viewport,box.width,box.height);
      assert.ok(!viewport.visible&&viewport.material.opacity>0&&viewport.material.opacity<1,'zoom-out morphs one live capture instead of overlaying a second flat image');
      assert.equal(viewport.parent,renderer.scene,'handoff must not inherit the globe rotation');
      const surface=renderer.scene.getObjectByName('Live island detail');
      assert.equal(canvas.style.visibility,'hidden','overscan native canvas is captured, not displayed as a second layer');
      assert.equal(nativeProps.at(-1),false,'capture omits upright islet props that are rendered once by Three');
      assert.equal(isletProp.visible,true,'temporary capture suppression restores native ownership');
      const lighthouse=renderer.scene.getObjectByName('Standing 05-lighthouse-rock/lighthouse');
      assert.ok(lighthouse?.visible,'the independent Three lighthouse remains the visible scenery owner');
      assert.equal(lighthouse.material.userData.flatBlend.value,viewport.material.opacity,'the single lighthouse follows the same projection morph as its captured ground');
      assert.ok(lighthouse.renderOrder>surface.renderOrder,'upright lighthouse draws above the captured surface');
      const isletGround=globe.children.find(p=>p.userData?.id===isletFrame.id);
      assert.equal(isletGround?.visible,false,'captured native ground replaces the old static ground instead of doubling its footprint');
      assert.equal(viewport.material.map,surface.material.map,'one capture and texture upload for both planes');
      const shader={uniforms:{},vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader};surface.material.onBeforeCompile(shader);
      assert.ok(shader.vertexShader.includes('#include <project_vertex>'),'spherical detail stays on the sphere instead of dragging the atlas crop into the viewport');
      assert.ok(shader.uniforms.liveCaptureFeather,'the real curved capture, not only a test plane, feathers its coverage boundary');
      assert.equal(surface.material.depthWrite,false,'transparent capture edges cannot occlude the base atlas');
      assert.equal(surface.material.depthTest,false,'independent sphere tessellations must not depth-clip each other into triangles');
      assert.equal(surface.frustumCulled,false,'curved bounds cannot cull vertices that flatten into the viewport');
      assert.equal(surface.material.opacity,1,'the single live capture stays opaque throughout projection morph');
      assert.equal(shader.uniforms.liveCaptureBlend.value,viewport.material.opacity);
      assert.ok(shader.vertexShader.includes('captureFlatNdc'),'the actual live surface changes projection');
      assert.ok(shader.fragmentShader.includes('dot(captureWorldPoint,cameraPosition-captureWorldPoint)<=0.'),'disabled depth testing still rejects the hidden hemisphere');
      const atlas=surface.parent.children.find(p=>p.userData?.id===renderer.domElement.dataset.liveIsland);
      assert.ok(atlas,'selected island atlas remains in the scene');
      const atlasShader={uniforms:{},vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader};atlas.material.onBeforeCompile(atlasShader);
      assert.ok(!atlasShader.fragmentShader.includes('if(liveAtlas>.5'),'the base atlas must not be cut out beneath a partial viewport capture');
      assert.ok(Math.abs(game.width/game.height-box.width/box.height)<.003);
      assert.ok(Math.max(canvas.width,canvas.height)<=2048,'handoff upload stays bounded');
      assert.equal(canvas.style.width,'100%');assert.equal(canvas.style.height,'100%');
    }
    const capture=renderer.scene.getObjectByName('Live island detail'),oldMaterial=capture.material,oldTexture=oldMaterial.map;
    let released=false;oldTexture.addEventListener('dispose',()=>{released=true;});
    box={...box,width:height,height:width};for(const resize of observers)resize();for(let i=0;i<3;i++)step();
    assert.equal(renderer.camera.aspect,box.width/box.height,'camera aspect refreshes on landscape/portrait resize');
    assertViewport(renderer.scene.getObjectByName('Live viewport handoff'),box.width,box.height);
    assert.equal(renderer.scene.getObjectByName('Live island detail').material,oldMaterial,'resize keeps the compiled capture shader');
    assert.notEqual(oldMaterial.map,oldTexture,'the new canvas size gets a fresh texture');
    assert.ok(released,'resize releases the old GPU texture');
    // A single large zoom-in returns ownership; no persistent second draw loop.
    wheel(-1400);for(let i=0;i<4;i++)step();assert.equal(renderer.domElement.dataset.presentation,'native-pixi','return to close view: '+renderer.camera.position.z);
    const after=renderer.renders;for(let i=0;i<4;i++)step();assert.equal(renderer.renders,after);assert.equal(nativeProps.at(-1),true,'return to direct native restores upright islet props');assert.equal(canvas.style.visibility,'visible');
  }catch(error){
    // Bundled data-URL stack traces otherwise print the entire source bundle.
    throw new Error(error.message);
  }finally{
    view?.destroy();if(view)await settle();globals.__wideQA.water.dispose();dom.window.close();
    for(const [key,descriptor]of prior)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
