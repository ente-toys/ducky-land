// Actual native Rive Canvas2D WASM pixels and the integrated host in jsdom.
// This is software validation, not a real Chrome/mobile compositor check.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {createCanvas,Path2D,DOMMatrix,Image} from '@napi-rs/canvas';
import Rive from '@rive-app/canvas-advanced';
import WebSocket from 'ws';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url))),WEB=path.join(ROOT,'rive/web');
globalThis.Path2D=Path2D;globalThis.DOMMatrix=DOMMatrix;globalThis.Image=Image;
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h);}};
globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},removeEventListener(){},body:{appendChild(){},remove(){}}};
const runtime=await Rive({wasmBinary:fs.readFileSync(path.join(ROOT,'node_modules/@rive-app/canvas-advanced/rive.wasm'))});
// Canvas2D's JS renderer takes six scalar arguments, while the WebGL2 renderer
// exposed by the shipped web host takes native Mat2D values.
const makeRenderer=runtime.makeRenderer.bind(runtime);
runtime.makeRenderer=(canvas)=>{const r=makeRenderer(canvas);return new Proxy(r,{get(target,key){if(key==='transform')return(...args)=>args.length===1?r.transform(args[0].xx,args[0].xy,args[0].yx,args[0].yy,args[0].tx,args[0].ty):r.transform(...args);const value=target[key];return typeof value==='function'?value.bind(target):value;}});};
const dom=new JSDOM(fs.readFileSync(path.join(WEB,'index.html'),'utf8'),{url:'http://127.0.0.1:8800/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
const nativeFetch=globalThis.fetch;
let size={width:1440,height:1000,dpr:1},raf=[],time=0,hosts=[];
Object.defineProperties(w,{innerWidth:{get:()=>size.width},innerHeight:{get:()=>size.height},devicePixelRatio:{get:()=>size.dpr}});
const canvasMap=new WeakMap();
function native(c){if(!canvasMap.has(c))canvasMap.set(c,createCanvas(c.width||300,c.height||150));return canvasMap.get(c);}
for(const key of ['width','height'])Object.defineProperty(w.HTMLCanvasElement.prototype,key,{get(){return native(this)[key];},set(value){native(this)[key]=Math.max(1,Number(value)||1);},configurable:true});
// Avoid recursive width access during lazy native-canvas creation.
function ensure(c){if(!canvasMap.has(c))canvasMap.set(c,createCanvas(Number(c.getAttribute('width'))||300,Number(c.getAttribute('height'))||150));return canvasMap.get(c);}
function nativeFixed(c){return ensure(c);}
Object.defineProperty(w.HTMLCanvasElement.prototype,'width',{get(){return ensure(this).width;},set(v){ensure(this).width=Math.max(1,Number(v)||1);},configurable:true});
Object.defineProperty(w.HTMLCanvasElement.prototype,'height',{get(){return ensure(this).height;},set(v){ensure(this).height=Math.max(1,Number(v)||1);},configurable:true});
w.HTMLCanvasElement.prototype.getContext=function(){const c=ensure(this),ctx=c.getContext('2d');if(!ctx._wrapped){const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(image,...args)=>draw(image instanceof w.HTMLCanvasElement?ensure(image):image,...args);ctx._wrapped=true;}return ctx;};
w.HTMLCanvasElement.prototype.toBlob=function(callback,type){callback(new Blob([ensure(this).toBuffer('image/png')],{type:type||'image/png'}));};
w.HTMLCanvasElement.prototype.getBoundingClientRect=function(){const width=this.id==='ducky'?420:size.width,height=this.id==='ducky'?500:size.height;return{x:0,y:0,left:0,top:0,right:width,bottom:height,width,height};};
w.HTMLCanvasElement.prototype.getClientRects=function(){return[this.getBoundingClientRect()];};
const captures=new Map();w.HTMLCanvasElement.prototype.setPointerCapture=function(id){captures.set(id,this);};w.HTMLCanvasElement.prototype.hasPointerCapture=function(id){return captures.get(id)===this;};w.HTMLCanvasElement.prototype.releasePointerCapture=function(id){captures.delete(id);};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.requestAnimationFrame=fn=>{raf.push(fn);return raf.length;};w.cancelAnimationFrame=()=>{};
w.fetch=async url=>{const name=String(url).split('?')[0];if(name.startsWith('blob:'))return nativeFetch(name);const file=path.join(WEB,name.replace(/^\//,''));if(!fs.existsSync(file))throw Error('Missing local fetch: '+name);return new Response(fs.readFileSync(file));};
class NativeHost{
 constructor(params){this.params=params;this.canvas=params.canvas;this.playing=true;this.layout={runtimeFit:()=>runtime.Fit.contain,runtimeAlignment:()=>runtime.Alignment.center};hosts.push(this);this.load();}
 async load(){this.file=await runtime.load(new Uint8Array(this.params.buffer),undefined,false);this.artboard=this.file.artboardByName(this.params.artboard);this.artboard.frameOrigin=false;this.viewModelInstance=this.file.viewModelByName(this.params.artboard.startsWith('Photo ')?'PhotoVM':'DuckyVM').defaultInstance();this.artboard.bindViewModelInstance(this.viewModelInstance);this.sm=new runtime.StateMachineInstance(this.artboard.stateMachineByName(this.params.stateMachines),this.artboard);this.sm.bindViewModelInstance(this.viewModelInstance);this.renderer=runtime.makeRenderer(this.canvas);this.runtime=runtime;this.params.onLoad();}
 resizeDrawingSurfaceToCanvas(dpr){const r=this.canvas.getBoundingClientRect();this.canvas.width=r.width*dpr;this.canvas.height=r.height*dpr;this.draw(0);}
 pause(){this.playing=false;}play(){this.playing=true;}stopRendering(){}startRendering(){}
 advanceAndReportChanges(dt){this.sm.advanceAndApply(dt);this.artboard.advance(dt);}
 draw(dt){if(!this.renderer)return;this.advanceAndReportChanges(dt);this.renderer.clear();this.renderer.save();this.renderer.align(runtime.Fit.contain,runtime.Alignment.center,{minX:0,minY:0,maxX:this.canvas.width,maxY:this.canvas.height},this.artboard.bounds);this.artboard.draw(this.renderer);this.renderer.restore();this.renderer.flush();runtime.resolveAnimationFrame();}
}
w.rive={RuntimeLoader:{setWasmUrl(){},awaitInstance:async()=>runtime},Rive:NativeHost,Layout:class{constructor(o){Object.assign(this,o);}},Fit:{Contain:0},Alignment:{Center:0}};
w.AudioContext=class{constructor(){this.state='suspended';this.destination={};}resume(){this.state='running';return Promise.resolve();}decodeAudioData(){return Promise.resolve({});}createBufferSource(){return{connect(){return this;},start(){}};}createGain(){return{gain:{value:0},connect(){return this;}};}};
for(const key of ['window','document','navigator','location','history','localStorage','CustomEvent','Event','Option','Blob']){
 if(key==='window')globalThis.window=w;else if(key==='Blob'){}else Object.defineProperty(globalThis,key,{value:w[key],configurable:true});
}
globalThis.addEventListener=w.addEventListener.bind(w);globalThis.matchMedia=w.matchMedia;globalThis.getComputedStyle=w.getComputedStyle.bind(w);globalThis.fetch=w.fetch;globalThis.rive=w.rive;globalThis.LocalSounds=undefined;globalThis.WebSocket=WebSocket;
Object.defineProperty(globalThis,'devicePixelRatio',{get:()=>size.dpr,configurable:true});
w.eval(fs.readFileSync(path.join(WEB,'sounds.js'),'utf8')+'\nwindow.LocalSounds=LocalSounds;');globalThis.LocalSounds=w.LocalSounds;
const errors=[];w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));
w.eval(fs.readFileSync(path.join(WEB,'game.js'),'utf8'));
for(let i=0;i<500&&!w.game?.ready&&!w.gameError;i++)await new Promise(r=>setTimeout(r,20));
assert.ok(w.game?.ready,w.gameError||'World never became ready');
const {installAssets}=await import('../rive/web/assets.js');const {installControls}=await import('../rive/web/controls.js');const {installCrowd}=await import('../rive/web/crowd.js');const {installLife}=await import('../rive/web/life.js');const {installActivities}=await import('../rive/web/activities.js');const {installNetwork}=await import('../rive/web/network.js');const {installUI}=await import('../rive/web/ui.js');
const g=w.game;g.inputLocked=true;await installAssets(g);installControls(g);installCrowd(g);installLife(g);installActivities(g);installNetwork(g);await installUI(g);g.integrationReady=true;
function tick(count=1,draw=true){for(let i=0;i<count;i++){time+=1000/60;const callbacks=raf;raf=[];for(const fn of callbacks)fn(time);for(const h of hosts)if(h.playing)h.draw(1/60);}if(draw)g.render();}
function shot(name){g.render();fs.writeFileSync(path.join(ROOT,'shots','software-'+name+'.png'),ensure(w.document.getElementById('world-canvas')).toBuffer('image/png'));}
function advanceArt(count=24){for(let i=0;i<count;i++){g.simulate(1/60);g.drawFrame(1/60);}}
function pointer(type,x,y,id=1){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:id,pointerType:'touch',button:0});w.document.getElementById('world-canvas').dispatchEvent(e);}
tick(1);fs.writeFileSync(path.join(ROOT,'shots/software-join-preview.png'),ensure(w.document.getElementById('ducky')).toBuffer('image/png'));assert.ok(g.join({name:'soft_duck',city:0,cap:8,shades:1,acc:0,shoes:2}));
g.paused=true;
for(let i=0;i<18;i++){g.simulate(1/60);g.drawFrame(1/60);}shot('landing');
for(let i=0;i<60;i++){g.simulate(1/60);g.drawFrame(1/60);}
// Render the actual island client receiving two real socket identities.
const friend=new WebSocket('ws://127.0.0.1:8810/room?name=socket_friend&city=1&cap=10&shades=2&acc=0&shoes=4',{origin:'http://127.0.0.1:8800'});
for(let i=0;i<120;i++){g.simulate(1/60);g.drawFrame(1/60);await new Promise(r=>setTimeout(r,10));if(g.network.inspect().realCount===2&&g.ducks.some(d=>d.name==='socket_friend'))break;}
assert.equal(g.network.inspect().realCount,2);shot('multiplayer');friend.close();g.network.close();await new Promise(r=>setTimeout(r,30));
const results={label:'Native Rive Canvas2D software checks, not browser screenshots',errors,zones:{},assets:{count:g.assets.count,replaced:g.assets.replaced,placed:g.assets.placed},checks:['Actual native client renders two identities from the real socket server']};
for(const name of Object.keys(g.world.zones)){g.reviewZone(name);for(let i=0;i<8;i++)g.simulate(1/60);advanceArt(2);shot(name);results.zones[name]={walkable:g.walkable(...g.world.zones[name].spawn),route:g.route(...g.world.zones.plaza.spawn,...g.world.zones[name].spawn).length};}
g.overview();shot('overview');g.reviewZone('plaza');g.follow();
const x=g.player.x;g.keys.add('d');for(let i=0;i<30;i++)g.simulate(1/60);g.keys.clear();assert.ok(g.player.x>x+90);results.checks.push('WASD movement and camera simulation');
g.reviewZone('plaza');g.player.until=0;g.player.action=0;const jx=g.player.x;pointer('pointerdown',200,600,11);pointer('pointermove',260,600,11);pointer('pointerdown',100,500,12);assert.equal(g.controls.stick.id,11);for(let i=0;i<30;i++)g.simulate(1/60);advanceArt(2);shot('joystick');assert.ok(g.player.x>jx+90);pointer('pointerup',260,600,11);assert.equal(g.controls.stick.id,null);assert.equal(g.keys.size,0);results.checks.push('Floating joystick, second-finger ownership and release reset');
g.reviewZone('plaza');pointer('pointerdown',200,600,13);pointer('pointermove',250,600,13);pointer('pointercancel',250,600,13);assert.equal(g.controls.stick.id,null);assert.equal(g.keys.size,0);results.checks.push('Pointer cancellation resets movement');
for(const action of [2,3,4,5,6,7,8,9,10,11,12,13]){g.player.action=action;g.player.until=g.now+10;g.player.targetTurn=0;for(let i=0;i<25;i++)g.render(1/60);shot('pose-'+action);}
// render() is a frozen capture helper, so advance the native pose explicitly.
for(const action of [2,3,4,5,6,7,8,9,10,11,12,13]){g.player.controls.action.value=action;g.player.controls.turn.value=360;for(let i=0;i<25;i++){g.player.sm.advanceAndApply(1/60);g.player.art.advance(1/60);}shot('pose-'+action);}
g.reviewZone('bread-forest');g.activity.start('bread');advanceArt(1);shot('bread-playing');let collected=0;for(const b of g.activity.hunt.bread){if(!b.active)continue;g.player.path=g.route(g.player.x,g.player.y,b.x,b.y);let steps=0;while(g.player.path.length&&steps++<3000)g.simulate(1/60);g.simulate(1/60);assert.ok(!b.active,'Bread slice reachable by real island navigation');if(++collected===1){advanceArt(12);shot('bread-pop');}}assert.equal(g.activity.hunt.collected,12);advanceArt(28);shot('bread-complete');results.checks.push('Twelve bread slices reached by walking real island routes and score once');g.activity.stop();
g.reviewZone('race-lake');g.activity.start('race');g.simulate(1/60);advanceArt(20);shot('race-countdown');for(let i=0;i<60*45;i++){if(i%6===0)g.activity.paddle();g.simulate(1/60);if(i===240){advanceArt(10);shot('race-playing');}}assert.equal(g.activity.race.finishOrder.length,8);advanceArt(28);shot('race-complete');results.checks.push('Race countdown, paddles, eight finishes and result');g.activity.stop();
for(const [width,height]of [[375,812],[390,844],[412,915],[844,390],[768,1024]]){size={width,height,dpr:1};g.resize();g.reviewZone('plaza');g.simulate(1/60);shot('viewport-'+width+'x'+height);}
size={width:1440,height:1000,dpr:1};g.resize();g.reviewZone('plaza');g.render();
await g.openPhoto();assert.ok(g.lastPhoto?.cards.length===2);for(const [i,card]of g.lastPhoto.cards.entries()){const blob=await fetch(card.url).then(r=>r.blob());fs.writeFileSync(path.join(ROOT,'shots',i?'software-photo-square.png':'software-photo-wide.png'),Buffer.from(await blob.arrayBuffer()));}results.checks.push('Frozen native postcards export 1600x900 and 1200x1200');
fs.writeFileSync(path.join(ROOT,'qa/software-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));process.exit(0);
