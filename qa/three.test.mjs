import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {geometry} from '../rive/web/island-geometry.mjs';
import {createNavigation} from '../src/three/navigation.js';
import {createSimulation,DURATIONS} from '../src/three/simulation.js';
import {IslandCamera,installInput} from '../src/three/camera.js';
import {IslandEngine} from '../src/three/engine.js';
import {createDuck} from '../src/three/models/duck.js';
import {wardrobeEntries,createWardrobe} from '../src/three/models/wardrobe.js';
import {world,placementFor,toScene,toWorld,buildWorld,heightAt} from '../src/three/world.js';
const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
function valid(root,label){root.updateMatrixWorld(true);let triangles=0;root.traverse(o=>{if(!o.geometry)return;assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite),`${label}: finite vertices`);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});const b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());assert.ok(!b.isEmpty()&&s.x>0&&s.y>0&&s.z>0,`${label}: 3D bounds`);assert.ok(triangles>0);return b;}

test('every manifest asset and island placement has explicit visible 3D geometry',async()=>{
 globalThis.DOMParser=new JSDOM('').window.DOMParser;
 const server=await createServer({server:{middlewareMode:true,watch:null},appType:'custom'});
 try{
  const {assets,landmarkEntries,createAsset}=await server.ssrLoadModule('/src/three/registry.js');
  assert.equal(assets.length,203);assert.equal(new Set(assets.map(a=>a.id)).size,203);
  for(const entry of assets){assert.ok(entry.anchor&&entry.size);assert.ok(existsSync(entry.source));valid(await createAsset(entry.id),entry.id);}
  for(const entry of landmarkEntries)valid(await createAsset(entry.id),entry.id);
  for(const [i,p]of world.props.entries())valid(await createAsset(placementFor(p,i)[0]),p.name);
 }finally{await server.close();delete globalThis.DOMParser;}
});
test('34 canonical wardrobe designs, aliases and all 10 duck actions are valid',()=>{
 assert.equal(wardrobeEntries.length,34);assert.equal(new Set(wardrobeEntries.map(e=>e.id)).size,34);
 for(const e of wardrobeEntries){assert.ok(existsSync(e.source));valid(e.create(),e.id);for(const alias of e.aliases){assert.ok(existsSync(alias));assert.equal(createWardrobe(e.slot,alias).userData.wardrobeId,e.id);}
  const duck=createDuck({outfit:{[e.slot]:e.index}});assert.equal(duck.clips.length,10);duck.root.position.set(4,0,7);duck.root.rotation.y=1;
  for(let action=0;action<10;action++){for(let frame=0;frame<20;frame++)duck.update(1/60,{action,speed:2,time:frame/60});valid(duck.root,e.id);near(duck.root.position.x,4);near(duck.root.rotation.y,1);}
  duck.dispose();
 }
});
test('walkability matches original throughout coast, lakes, bridges and islets',()=>{
 const nav=createNavigation(world),original=geometry(world);
 for(let y=0;y<world.height;y+=19)for(let x=0;x<world.width;x+=23)assert.equal(nav.walkable(x,y),original.walkable(x,y));
 const points=[...Object.values(world.zones).map(z=>z.spawn),...world.islets.map(a=>a.slice(0,2)),...world.bridges.map(b=>[b.x,b.y])].map(p=>nav.nearest(...p,400)).filter(Boolean);
 for(const p of points){const start=nav.nearest(...world.zones.plaza.spawn,400),route=nav.route(...start,...p);assert.ok(route.length,`reachable ${p}`);let prev=start;for(const next of route){assert.ok(nav.clearLine(prev,next),`safe segment ${prev} to ${next}`);prev=next;}}
 const p={x:2345,y:1765};assert.deepEqual(toWorld(toScene(p.x,p.y)),p);
});
test('all 29 ducks remain deterministic and walkable while wandering',()=>{
 const a=createSimulation(world,27),b=createSimulation(world,27);assert.equal(a.ducks.length,29);assert.equal(a.ducks.filter(d=>d.player).length,1);
 for(let i=0;i<3600;i++){a.step(1/60);b.step(1/60);if(i%60===0)for(const d of a.ducks)assert.ok(a.nav.walkable(d.x,d.y),`duck ${d.id}`);}
 assert.deepEqual(a.ducks,b.ducks);assert.equal(new Set(a.ducks.slice(1).map(d=>d.zone)).size,7);
});
test('emotes preserve durations, restart, dance toggle, movement interrupt and quack replies',()=>{
 for(const [id,duration]of Object.entries(DURATIONS)){const s=createSimulation(world);s.emote(+id);near(s.player.until,duration);s.step(duration-.001);assert.equal(s.player.action,+id);s.step(.002);assert.equal(s.player.action,0);}
 const s=createSimulation(world);s.emote(2);s.step(.2);s.emote(2);assert.equal(s.player.emoteVersion,2);near(s.player.until,1.5);s.emote(3);s.emote(3);assert.equal(s.player.action,0);s.emote(7);s.step(1/60,{x:1,y:0});assert.equal(s.player.until,0);assert.notEqual(s.player.action,7);
 s.emote(2);for(let i=0;i<30;i++)s.step(1/60);assert.ok(s.ducks.slice(1).some(d=>d.action===2));
});
function camera(){const c=new IslandCamera(new THREE.OrthographicCamera(-1,1,1,-1,.1,240),{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})});c.resize(1280,720);return c;}
test('cursor centered zoom keeps its world anchor through every easing frame',()=>{
 const c=camera(),before=c.ground(270,210);c.zoomAt(6,270,210);near(c.currentZoom,1);
 for(let i=0;i<90;i++){c.update(1/60,false);const after=c.ground(270,210);near(after.distanceTo(before),0);}
 assert.ok(c.currentZoom>5.99);c.fit();c.update(1/60,true);near(c.currentZoom,1);near(c.current.length(),0);
});
test('pointer cancellation, multitouch, drag threshold, camera-relative keys and listener disposal',()=>{
 const dom=new JSDOM('<canvas tabindex="0"/>'),{window}=dom;globalThis.window=window;globalThis.document=window.document;const el=document.querySelector('canvas');el.setPointerCapture=()=>{};el.getBoundingClientRect=()=>({left:0,top:0,width:1280,height:720});const c=new IslandCamera(new THREE.OrthographicCamera(-1,1,1,-1,.1,240),el);c.resize(1280,720);let taps=0,emotes=0,stops=0;const input=installInput(el,c,{tap:()=>taps++,emote:()=>emotes++,stop:()=>stops++});
 const p=(type,id,x,y,button=0)=>{const e=new window.Event(type);Object.assign(e,{pointerId:id,clientX:x,clientY:y,button});el.dispatchEvent(e);};
 p('pointerdown',1,400,300);p('pointerup',1,500,300);assert.equal(taps,0);
 p('pointerdown',1,400,300);p('pointercancel',1,400,300);p('pointerup',1,400,300);assert.equal(taps,0);
 const anchor=c.ground(400,300);p('pointerdown',1,400,300);for(let x=410;x<=600;x+=10){p('pointermove',1,x,350);near(c.ground(x,350).distanceTo(anchor),0);}p('pointerup',1,600,350);assert.equal(taps,0);
 p('pointerdown',1,400,300);p('pointerup',1,403,303);assert.equal(taps,1);
 p('pointerdown',1,400,300);p('pointerdown',2,600,300);const pinchAnchor=c.ground(500,300);p('pointermove',2,720,400);near(c.ground(560,350).distanceTo(pinchAnchor),0);p('pointerup',2,720,400);p('pointerup',1,400,300);assert.equal(taps,1);
 p('pointerdown',1,400,300,2);p('pointermove',1,1200,-10000,2);p('pointerup',1,1200,-10000,2);assert.equal(taps,1);assert.ok(c.polar>=.15&&c.polar<=1.18);assert.notEqual(c.yaw,0);
 c.currentYaw=Math.PI/2;window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'w'}));near(input.movement.x,-1);near(input.movement.y,0);window.dispatchEvent(new window.Event('blur'));near(input.movement.x,0);assert.ok(stops);
 input.dispose();window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'q'}));assert.equal(emotes,0);dom.window.close();delete globalThis.window;delete globalThis.document;
});


test('terrain and raised walkways expose finite matching render elevations',async()=>{
 const scene=new THREE.Scene(),built=await buildWorld(scene);valid(scene,'complete island');assert.equal(built.dynamic.length>0,true);
 assert.ok(heightAt(1640,2630)>.3);assert.ok(heightAt(2910,1120)>.6);assert.ok(heightAt(2920,1400)>.6);assert.ok(heightAt(3320,3550)>.1);
 for(const d of createSimulation(world).ducks)assert.ok(Number.isFinite(heightAt(d.x,d.y)));
});


test('engine lifecycle pauses hidden tabs, handles context recovery and releases an interrupted mount',async()=>{
 const dom=new JSDOM('<div id="scene"></div>',{pretendToBeVisual:true}),host=dom.window.document.querySelector('#scene');let hidden=false,observing=0,disposed=0,lost=0,id=0;const frames=new Map();
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.location=dom.window.location;dom.window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},fillText(){}});globalThis.devicePixelRatio=1;globalThis.matchMedia=()=>({matches:true});Object.defineProperty(document,'hidden',{get:()=>hidden});
 globalThis.ResizeObserver=class{observe(){observing++;}disconnect(){observing--;}};
 globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 host.getBoundingClientRect=()=>({width:1280,height:720});
 const rendererFactory=()=>({domElement:document.createElement('canvas'),shadowMap:{},info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0}},setClearColor(){},setPixelRatio(){},setSize(){},render(){},dispose(){disposed++;},forceContextLoss(){lost++;}});
 const errors=[],engine=new IslandEngine({rendererFactory,onError:e=>errors.push(e)});
 try{
  await engine.mount(host);assert.equal(host.querySelectorAll('canvas').length,1);assert.equal(observing,1);
  const frame=now=>{const [key,fn]=frames.entries().next().value;frames.delete(key);fn(now);};frame(1000);frame(1020);const time=engine.sim.time;assert.ok(time>0);assert.equal(engine.env.root.visible,false);
  hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));frame(5000);near(engine.sim.time,time);
  hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));frame(100000);near(engine.sim.time,time);
  const canvas=engine.renderer.domElement;canvas.dispatchEvent(new window.Event('webglcontextlost',{cancelable:true}));assert.ok(errors.at(-1) instanceof Error);assert.equal(frames.size,0);
  canvas.dispatchEvent(new window.Event('webglcontextrestored'));assert.equal(errors.at(-1),null);assert.equal(frames.size,1);
  engine.dispose();assert.equal(frames.size,0);assert.equal(host.childElementCount,0);assert.equal(observing,0);assert.equal(disposed,1);assert.equal(lost,1);
  const interrupted=new IslandEngine({rendererFactory});const mounting=interrupted.mount(host);interrupted.dispose();await mounting;assert.equal(host.childElementCount,0);assert.equal(observing,0);assert.equal(disposed,2);
 }finally{engine.dispose();dom.window.close();for(const key of ['window','document','location','devicePixelRatio','matchMedia','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'])delete globalThis[key];}
});
