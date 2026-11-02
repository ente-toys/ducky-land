// Native Rive WASM + software raster, running the real mobile.js host in jsdom.
// Pointer events here are simulated. This cannot certify Chrome mobile behavior.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createCanvas, Path2D, DOMMatrix } = require('@napi-rs/canvas');
const { performance } = require('node:perf_hooks');
const captures = [], checks = [];
(async () => {
  globalThis.Path2D = Path2D; globalThis.DOMMatrix = DOMMatrix;
  globalThis.OffscreenCanvas = class { constructor(w,h){return createCanvas(w,h);} };
  globalThis.document = {createElement:()=>createCanvas(1,1),addEventListener(){},removeEventListener(){},body:{appendChild(){},remove(){}}};
  const factory = (await import('@rive-app/canvas-advanced')).default;
  const runtime = await factory({wasmBinary:fs.readFileSync('node_modules/@rive-app/canvas-advanced/rive.wasm')});
  const dom = new JSDOM(fs.readFileSync('rive/web/index.html','utf8'), {url:'http://127.0.0.1:8807/?quality=high',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window;
  let size={width:390,height:844,dpr:3},safe={top:0,bottom:0,left:0,right:0},time=0,raf=[],instance,measureNative=false,nativeSamples=[];
  const nativeCanvas=createCanvas(1170,2532), renderer=runtime.makeRenderer(nativeCanvas);
  const rect=(x,y,width,height)=>({x,y,left:x,top:y,right:x+width,bottom:y+height,width,height,toJSON(){return this;}});
  for(const key of ['innerWidth','innerHeight'])Object.defineProperty(w,key,{get:()=>size[key==='innerWidth'?'width':'height']});
  Object.defineProperty(w,'devicePixelRatio',{get:()=>size.dpr});
  Object.defineProperty(w.navigator,'hardwareConcurrency',{get:()=>8});
  const canvas=w.document.getElementById('c'),play=w.document.getElementById('play'),actions=w.document.getElementById('actions');
  canvas.getBoundingClientRect=play.getBoundingClientRect=()=>rect(0,0,size.width,size.height);
  actions.getBoundingClientRect=()=>rect(size.width-138-safe.right,size.height-58-safe.bottom,124,44);
  let capturesSet = new Set();
  canvas.setPointerCapture=id=>capturesSet.add(id);canvas.hasPointerCapture=id=>capturesSet.has(id);canvas.releasePointerCapture=id=>capturesSet.delete(id);
  for(const id of ['quack','dance'])w.document.getElementById(id).setPointerCapture=()=>{};
  const realComputed=w.getComputedStyle.bind(w);
  w.getComputedStyle=e=>e.id==='safe'?{paddingTop:String(safe.top),paddingRight:String(safe.right),paddingBottom:String(safe.bottom),paddingLeft:String(safe.left)}:realComputed(e);
  w.ResizeObserver=class{observe(){}disconnect(){}};
  w.visualViewport={addEventListener(){}};
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.requestAnimationFrame=fn=>{raf.push(fn);return raf.length};
  class NativeHost {
    constructor(params){this.params=params;instance=this;this.load(params);}
    async load(params){
      this.ready=false;
      if(this.sm){this.sm.delete();this.artboard.delete();this.viewModelInstance.delete();this.file.delete();}
      this.file=await runtime.load(new Uint8Array(fs.readFileSync('rive/web/'+params.src)),undefined,false);
      this.artboard=this.file.artboardByName('Plaza');this.viewModelInstance=this.file.viewModelByName('PlazaVM').defaultInstance();
      this.artboard.bindViewModelInstance(this.viewModelInstance);
      this.sm=new runtime.StateMachineInstance(this.artboard.stateMachineByName('Plaza'),this.artboard);this.sm.bindViewModelInstance(this.viewModelInstance);
      this.ready=true;this.params.onLoad();
    }
    resizeDrawingSurfaceToCanvas(dpr){canvas.width=nativeCanvas.width=Math.floor(size.width*dpr);canvas.height=nativeCanvas.height=Math.floor(size.height*dpr);this.artboard.width=size.width;this.artboard.height=size.height;}
    draw(){const start=performance.now();this.sm.advanceAndApply(1/60);this.artboard.advance(1/60);const advanced=performance.now();renderer.clear();renderer.save();renderer.scale(size.dpr,size.dpr);this.artboard.draw(renderer);renderer.restore();renderer.flush();runtime.resolveAnimationFrame();if(measureNative)nativeSamples.push({advance:advanced-start,render:performance.now()-advanced});}
    stopRendering(){}startRendering(){}
  }
  w.rive={RuntimeLoader:{setWasmUrl(){},setWasmFallbackUrl(){}},Rive:NativeHost,Layout:class{constructor(args){Object.assign(this,args)}},Fit:{Layout:'layout'}};
  w.eval(fs.readFileSync('rive/web/mobile.js','utf8'));
  async function loaded(){for(let i=0;i<100&&!w.game.ready;i++)await new Promise(r=>setTimeout(r,20));assert.ok(w.game.ready);}
  await loaded();
  function tick(count=1,draw=false){for(let i=0;i<count;i++){time+=1000/60;const pending=raf;raf=[];for(const f of pending)f(time);if(draw)instance.draw();}if(!draw)instance.draw();}
  function pointer(target,type,x,y,id=1){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:id,pointerType:'touch',button:0});target.dispatchEvent(e);}
  function capture(name){instance.draw();const file='shots/software-'+name+'.png';fs.writeFileSync(file,nativeCanvas.toBuffer('image/png'));captures.push({file,width:size.width,height:size.height,dpr:size.dpr});}
  tick(3);
  assert.equal(w.game.slots.length,16);assert.equal(w.game.crowdCount+1,13);
  const before={x:w.game.player.x,y:w.game.player.y};
  let [x,y]=w.game.toScreen(before.x+80,before.y+15);
  pointer(canvas,'pointerdown',x,y);pointer(canvas,'pointerup',x,y);tick(60);
  assert.ok(w.game.player.x>before.x+70);assert.equal(w.game.player.path.length,0);checks.push('tap arrives');
  pointer(canvas,'pointerdown',90,680);pointer(canvas,'pointermove',130,660);tick(10);
  assert.equal(w.game.vmi.number('stickOn').value,1);assert.equal(w.game.vmi.number('joystickX').value,90);
  capture('phone-390-joystick');
  const owner=w.game.joystick.id;
  pointer(canvas,'pointerdown',200,600,2);assert.equal(w.game.joystick.id,owner);
  pointer(w.document.getElementById('quack'),'pointerdown',280,808,3);tick(3);assert.equal(w.game.player.action,2);assert.equal(w.game.joystick.id,owner);checks.push('second finger quack preserves joystick');
  capture('phone-390-quack');
  pointer(canvas,'pointerup',130,660);tick(1);assert.equal(w.game.vmi.number('stickOn').value,0);
  const stopped=[w.game.player.x,w.game.player.y];tick(20);assert.deepEqual([w.game.player.x,w.game.player.y],stopped);checks.push('lift stops');
  pointer(canvas,'pointerdown',90,680);pointer(canvas,'pointermove',120,680);pointer(canvas,'pointercancel',120,680);tick(1);assert.equal(w.game.joystick.id,null);checks.push('cancel stops');
  pointer(w.document.getElementById('dance'),'pointerdown',345,808,4);tick(2);assert.equal(w.game.player.action,3);capture('phone-390-dance');
  pointer(w.document.getElementById('dance'),'pointerdown',345,808,4);tick(2);assert.equal(w.game.player.action,0);checks.push('dance toggle');
  w.game.player.x=800;w.game.player.y=820;
  const path=w.game.pathTo(800,380);assert.ok(path.length>1,'path detours around fountain');
  for(const point of path)assert.ok(w.game.walkable(...point));checks.push('fountain route');
  [x,y]=w.game.toScreen(800,380);pointer(canvas,'pointerdown',x,y);pointer(canvas,'pointerup',x,y);tick(480);
  assert.ok(Math.hypot(w.game.player.x-800,w.game.player.y-380)<3);checks.push('fountain route arrives');
  w.game.player.x=800;w.game.player.y=820;
  for(const [width,height,dpr] of [[375,812,3],[390,844,3],[412,915,2.625],[768,1024,2],[1024,768,2],[844,390,3]]){
    size={width,height,dpr};w.dispatchEvent(new w.Event('resize'));tick(3);assert.equal(canvas.width,Math.floor(width*dpr));assert.equal(canvas.height,Math.floor(height*dpr));
    const [sx,sy]=w.game.toScreen(w.game.player.x,w.game.player.y),[wx,wy]=w.game.toArtboard(sx,sy);assert.ok(Math.abs(wx-w.game.player.x)<.001&&Math.abs(wy-w.game.player.y)<.001);
    capture('phone-'+width);checks.push(`native ${width}x${height} DPR ${dpr}`);
  }
  size={width:390,height:844,dpr:3};safe.bottom=34;w.dispatchEvent(new w.Event('resize'));tick(3);
  assert.equal(w.game.vmi.number('controlY').value,774);capture('phone-390-safearea');checks.push('safe-area control coordinates');
  const softwareCosts=[];
  function measureCosts(label){nativeSamples=[];measureNative=true;tick(120,true);measureNative=false;const stat=key=>{const sorted=nativeSamples.map(x=>x[key]).sort((a,b)=>a-b);return{mean:sorted.reduce((a,b)=>a+b)/sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]}};softwareCosts.push({label,frames:nativeSamples.length,advanceMs:stat('advance'),renderMs:stat('render')});}
  measureCosts('13 Duckies, Canvas2D software raster, 390x844 DPR3');
  w.game.setQuality('low');await loaded();tick(3);assert.equal(w.game.slots.length,6);assert.equal(w.game.crowdCount+1,6);capture('phone-390-lite');checks.push('native six-placement fallback');
  measureCosts('6 Duckies, Canvas2D software raster, 390x844 DPR3');
  w.game.setQuality('high');await loaded();tick(3);assert.equal(w.game.slots.length,16);checks.push('quality switch back');
  fs.writeFileSync('qa/software-results.json',JSON.stringify({mode:'Native Rive Canvas2D WASM raster + jsdom host simulation. Not Chrome, no trusted touches, no fps claim.',checks,captures,softwareCosts},null,2));
  console.log(JSON.stringify({checks,captures},null,2));
  instance.sm.delete();instance.artboard.delete();instance.viewModelInstance.delete();instance.file.delete();renderer.delete();dom.window.close();
})();
