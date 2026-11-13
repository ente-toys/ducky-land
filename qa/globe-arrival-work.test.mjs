import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container,ImageSource,Texture,RenderTexture,GlProgram,DOMAdapter} from 'pixi.js';
import {Canvas,Image,createCanvas} from '@napi-rs/canvas';
import {JSDOM} from 'jsdom';
import {createWorldView} from '../src/rendering/pixi/world-view.js';
import {createIsletView} from '../src/rendering/pixi/islet-view.js';
import {createArchipelago} from '../src/rendering/pixi/archipelago.js';
import {createRasterWorkQueue,createRasterCache} from '../src/rendering/pixi/art/raster-work.js';
import {queuedSVGParser} from '../src/rendering/pixi/art/queued-svg.js';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {gpuWorkRenderer,traceGPUFrames} from './helpers/gpu-work.mjs';
const flush=()=>new Promise(setImmediate);

test('renderer hooks count real GL draw/transfer entry points per frame and restore without GPU reads',()=>{
 let draws=0;const renderer={gl:{drawElements(){draws++;},texImage2D(){},generateMipmap(){},blitFramebuffer(){}},render(){this.gl.drawElements();}};
 const render=renderer.render,draw=renderer.gl.drawElements,trace=traceGPUFrames(renderer);
 trace.beginFrame(1);renderer.render();renderer.gl.texImage2D();renderer.gl.generateMipmap();
 trace.beginFrame(2);renderer.render();renderer.gl.blitFramebuffer();
 assert.deepEqual(trace.frames.get(1),{renders:1,drawCalls:1,textureTransfers:1,mipmaps:1});
 assert.deepEqual(trace.frames.get(2),{renders:1,drawCalls:1,resolves:1});assert.equal(draws,2);
 trace.restore();assert.equal(renderer.render,render);assert.equal(renderer.gl.drawElements,draw);
});

async function globeFixture(t){
 const names=['window','document','DOMParser','HTMLCanvasElement','fetch'],prior=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 const adapter=DOMAdapter.get(),compile=GlProgram.from,dom=new JSDOM('<body/>'),create=dom.window.document.createElement.bind(dom.window.document);
 dom.window.document.createElement=(tag,...a)=>tag==='canvas'?createCanvas(64,64):create(tag,...a);
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,HTMLCanvasElement:Canvas,
  fetch:async url=>({ok:true,text:async()=>readFileSync('public'+url,'utf8')})});
 DOMAdapter.set({...adapter,fetch:globalThis.fetch,createImage:()=>new Image(),createCanvas:(w=64,h=64)=>createCanvas(w,h)});GlProgram.from=o=>({...o,destroy(){}});
 const probe=gpuWorkRenderer(),callbacks=[],work=createRasterWorkQueue({schedule:cb=>callbacks.push(cb),now:()=>probe.frame*16});
 const stage=new Container(),scene=stage.addChild(new Container()),objects=scene.addChild(new Container({sortableChildren:true}));
 const app={stage,renderer:probe.renderer};app.renderer.generateTexture=()=>RenderTexture.create({width:64,height:64});
 const islets=await createIsletView(app,scene,objects,work),view=createWorldView(app,scene,islets,Texture.EMPTY,work),m=mapOf('home');
 const cache=createRasterCache({budgetBytes:32*1048576});
 const arch=createArchipelago(app,scene,scene,m,work),held=new Map();let requests=0,loaded=false;
 const loading=arch.loadPreviews(async src=>{requests++;const texture=await queuedSVGParser.load(src,{data:{workQueue:work,sourceCache:cache,resolution:1,autoGenerateMipmaps:true}});held.set(src,texture);return texture;},src=>{held.get(src)?.destroy(true);held.delete(src);}).then(()=>{loaded=true;});
 for(let i=0;i<3000&&!loaded;i++){probe.nextFrame();callbacks.splice(0).forEach(cb=>cb());await flush();if(!callbacks.length&&!loaded)await new Promise(resolve=>setTimeout(resolve,2));}assert(loaded,'initial preview raster/queue finishes '+JSON.stringify({cache:cache.stats(),work:work.stats(),requests}));await loading;
 const cam={x:m.cx,y:m.cy,zoom:.7};
 const step=async(t,zoom,input=false)=>{probe.nextFrame();work.update(zoom,probe.frame*16,input);callbacks.splice(0).forEach(cb=>cb());cam.zoom=zoom;arch.update(zoom,cam,1512,827);view.update(t,1512,827,probe.frame*.016,cam,arch,m,.03,true,null,true);probe.renderer.render({container:stage});await flush();};
 t.after(()=>{view.destroy();islets.destroy();arch.destroy();work.destroy();cache.destroy();stage.destroy({children:true});probe.destroy();DOMAdapter.set(adapter);GlProgram.from=compile;Object.assign(globalThis,prior);dom.window.close();});
 return {probe,work,cache,view,arch,stage,step,get requests(){return requests;}};
}
function summary(events){
 const counts={};for(const e of events)counts[e.kind]=(counts[e.kind]??0)+1;
 const groups=new Map();for(const e of events){const g=groups.get(e.frame)??[];g.push(e);groups.set(e.frame,g);}
 return {...counts,maxLargeAllocationsOrUploads:Math.max(0,...[...groups.values()].map(g=>g.filter(e=>['allocation','upload'].includes(e.kind)&&e.level===0&&e.pixels>=512*512).length)),resolvePixels:events.filter(e=>e.kind==='resolve').reduce((n,e)=>n+e.pixels,0)};
}

test('globe arrival: GL upload, mipmap, resolve and render work during the first four seconds versus steady state',async t=>{
 const f=await globeFixture(t);
 await f.step(0,.7);for(let i=0;i<200;i++)await f.step(0,.7); // previews retire in walking
 // Approach the globe at a normal wheel pace. Preparation starts before .1.
 const begin=f.probe.frame;
 for(let i=0;i<75;i++)await f.step(i<35?0:(i-35)/40,.18*Math.pow(.03/.18,i/74),true);
 const arrival=f.probe.frame;
 for(let i=0;i<250;i++)await f.step(1,.03);
 const steady=f.probe.frame;
 for(let i=0;i<250;i++)await f.step(1,.03);
 const events=f.probe.events;
 t.diagnostic(JSON.stringify({approach:summary(events.filter(e=>e.frame>begin&&e.frame<=arrival)),arrival4s:summary(events.filter(e=>e.frame>arrival&&e.frame<=steady)),steady4s:summary(events.filter(e=>e.frame>steady)),atlasRenders:events.filter(e=>e.kind==='render'&&/globe atlas/.test(e.target)).map(e=>[e.frame,e.target])}));
 if(!process.env.GLOBE_BASELINE){
  assert.equal(summary(events.filter(e=>e.frame>begin)).maxLargeAllocationsOrUploads,1,'one large allocation/upload per frame across both atlases');
  assert(events.filter(e=>e.kind==='render'&&e.target==='World globe atlas').every(e=>e.frame<=arrival),'world atlas completes on approach');
  assert.equal(events.filter(e=>e.kind==='render'&&/globe atlas/.test(e.target)&&e.frame>arrival).length,0,'no globe atlas renders after arrival');
  assert.equal(events.filter(e=>e.kind==='mipmap'&&/globe atlas/.test(e.label)).length,2,'one final mip chain per atlas, no empty chain on allocation');
  assert(events.filter(e=>e.kind==='resolve').every(e=>e.pixels<=512*512),'MSAA resolves only a cell');
  assert.equal(events.filter(e=>e.kind==='render'&&e.target!=='screen'&&e.frame>steady).length,0,'idle globe never renders to a texture');
  assert.equal(events.filter(e=>['allocation','upload','mipmap'].includes(e.kind)&&e.frame>steady).length,0,'steady globe makes no texture changes');
  assert.equal(f.cache.stats().misses,9,'the nine SVGs rasterize only once across walking and reopening');
  assert.equal(f.cache.stats().bytes,29081600,'authored preview canvases fit the reserved 32 MiB');
 }
});

test('a direct globe arrival still serializes large resources and a reversal cancels freed targets',async t=>{
 const f=await globeFixture(t);
 for(let i=0;i<200;i++)await f.step(0,.7);
 const begin=f.probe.frame;
 await f.step(1,.03,true);
 for(let i=0;i<10;i++)await f.step(1,.03,true);
 // Reverse while both atlas queues are active, let walking retire everything,
 // then re-open. Old callbacks must not allocate or publish a freed source.
 for(let i=0;i<220;i++)await f.step(0,.7);
 const reopened=f.probe.frame;
 for(let i=0;i<100;i++)await f.step(1,.03,true);
 const events=f.probe.events.filter(e=>e.frame>begin);
 assert.equal(summary(events).maxLargeAllocationsOrUploads,1);
 const worlds=f.probe.events.filter(e=>e.kind==='allocation'&&e.level===0&&e.label==='World globe atlas');
 assert(worlds.some(e=>e.frame>reopened),'reopening prepares a fresh globe target');
 assert.equal(f.cache.stats().misses,9,'reversal retains CPU pixels without retaining GPU targets');
});

test('compact world UV rectangles retain source detail and separate every atlas cell',async()=>{
 const {globeAtlasLayout}=await import('../src/rendering/pixi/globe-atlas-layout.js');
 const {artOf}=await import('../src/world/island-maps.js');
 const sizes=new Map();
 for(const island of WORLD_ISLANDS){
  const xml=readFileSync(`public/pixi-art/globe/${artOf(island.id)}.svg`,'utf8');
  sizes.set(island.id,{width:+xml.match(/\bwidth="([\d.]+)"/)[1],height:+xml.match(/\bheight="([\d.]+)"/)[1]});
 }
 const layout=globeAtlasLayout({globeSizeOf:id=>sizes.get(id)});
 assert.equal(layout.width,3072);assert.equal(layout.height,2539);
 for(const [k,c]of layout.cells.entries()){
  const source=sizes.get(WORLD_ISLANDS[k].id);
  assert.equal(c.width,1022,'the original island width is retained');
  assert(c.height>=source.height*1022/source.width,'height retains the source detail available at 1022px width');
  const [u,v,du,dv]=layout.uvs.slice(k*4,k*4+4);
  for(const [a,b]of [[u,(c.x+1)/layout.width],[v,(c.y+1)/layout.height],[du,c.width/layout.width],[dv,c.height/layout.height]])assert(Math.abs(a-b)<1e-7);
  for(const [j,d]of layout.cells.entries())if(j!==k)assert(c.x+1024<=d.x||d.x+1024<=c.x||c.y+c.height+2<=d.y||d.y+d.height+2<=c.y,'guttered cells never overlap');
 }
});
