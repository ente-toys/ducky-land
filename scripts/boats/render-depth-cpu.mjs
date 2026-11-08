// Actual Pixi scene, duck rig and sailing FX, using Pixi's software CanvasRenderer.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {createCanvas,loadImage,Canvas} from '@napi-rs/canvas';
import sharp from 'sharp';
import {svgPathProperties} from '/private/tmp/boat48-browser/node_modules/svg-path-properties/dist/main.mjs';
import {Assets,Container,Sprite,Texture,CanvasSource,DOMAdapter} from 'pixi.js';
import {CanvasRenderer} from '../../node_modules/pixi.js/lib/rendering/renderers/canvas/CanvasRenderer.mjs';
const dom=new JSDOM('<body></body>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.SVGElement.prototype.getTotalLength=function(){return new svgPathProperties(this.getAttribute('d')).getTotalLength();};
dom.window.SVGElement.prototype.getPointAtLength=function(n){return new svgPathProperties(this.getAttribute('d')).getPointAtLength(n);};
function canvas(w=1,h=1){const c=createCanvas(w,h);c.style={};c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;}
DOMAdapter.set({createCanvas:canvas,createImage:()=>null,getCanvasRenderingContext2D:()=>createCanvas(1,1).getContext('2d').constructor,getWebGLRenderingContext:()=>null,getNavigator:()=>navigator,getBaseUrl:()=>dom.window.location.href,getFontFaceSet:()=>document.fonts,fetch:(...a)=>fetch(...a),parseXML:s=>new DOMParser().parseFromString(s,'text/xml')});
globalThis.HTMLCanvasElement=Canvas;
const contains=document.body.contains.bind(document.body);document.body.contains=n=>n instanceof dom.window.Node?contains(n):true;
globalThis.fetch=async url=>{const data=readFileSync(path.resolve('public',String(url).replace(/^\//,'')));return {ok:true,text:async()=>data.toString(),json:async()=>JSON.parse(data)};};
const cache=new Map();Assets.get=url=>cache.get(url);Assets.load=async req=>{const url=typeof req==='string'?req:req.src;if(cache.has(url))return cache.get(url);const resolution=req.data?.resolution??1;
 const data=readFileSync(path.resolve('public',url.replace(/^\//,''))),png=await sharp(data,{density:72*resolution}).png().toBuffer(),im=await loadImage(png),c=canvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const t=new Texture({source:new CanvasSource({resource:c,resolution})});cache.set(url,t);return t;};
const {createDuck}=await import('../../src/pixi/duck.js');const {loadBoatViews}=await import('../../src/pixi/boat-views.js');const {createSailingFX}=await import('../../src/pixi/sailing-fx.js');
const renderer=new CanvasRenderer();const output=canvas(480,440);await renderer.init({canvas:output,width:480,height:440,resolution:1,background:0xc4e2f5,antialias:true,manageImports:false,eventFeatures:{move:false,globalMove:false,click:false,wheel:false}});
const stage=new Container(),water=new Container(),objects=new Container({sortableChildren:true});stage.addChild(water,objects);
const bank=await loadBoatViews(),duck=await createDuck({outfit:{},seed:0});objects.addChild(duck.root);const fx=await createSailingFX({water,objects});const root=new Container(),sprite=new Sprite();root.addChild(sprite);objects.addChild(root);const entry={root,sprite};
const out=`../concepts/boat-turntable/spin48-work/${process.env.BOAT_PROOF??'depth'}`;mkdirSync(out,{recursive:true});const proof=[];
for(let n=0;n<48;n++){
 const v=bank.views[n];fx.forget('review');const boat={id:'review',x:240,y:355,turn:v.angle,occupant:'rider',travel:0};fx.boat(entry,boat,true);root.zIndex=357;
 const look=fx.duck({id:'rider',x:240,y:355,mode:'sailing',boatId:'review',turn:v.angle,travel:0},true);
 duck.root.position.set(look.x,look.y);duck.root.scale.set(look.scale);duck.root.rotation=look.rotation;duck.root.zIndex=look.z;
 for(let k=0;k<60;k++)duck.update(.1,{turn:look.turn,time:0,reducedMotion:false,action:0,speed:0,sailing:true});
 fx.front(entry);renderer.render(stage);writeFileSync(`${out}/frame-${String(n).padStart(2,'0')}.png`,output.toBuffer('image/png'));
 // Isolate the actual rig to verify the white fringe is gone in every direction.
 root.visible=false;entry.front.visible=false;renderer.render(stage);
 const pixels=output.getContext('2d').getImageData(0,0,480,440).data;let tuftHighlightPixels=0,whiteEdgePixels=0;
 for(let i=0;i<pixels.length;i+=4)if(pixels[i]>248&&pixels[i+1]>248&&pixels[i+2]>248&&pixels[i+3]>200){if(Math.floor(i/4/480)<look.y-85)tuftHighlightPixels++;else whiteEdgePixels++;}
 if(whiteEdgePixels)throw Error(`White body fringe in view ${n}: ${whiteEdgePixels} pixels`);
 if([0,33,36,38,40,42].includes(n))writeFileSync(`${out}/duck-only-${n}.png`,output.toBuffer('image/png'));
 root.visible=true;entry.front.visible=true;
 proof.push({frame:n,seat:v.seat,pin:[look.x,look.y],pivot:[root.pivot.x,root.pivot.y],z:[root.zIndex,duck.root.zIndex,entry.front.zIndex],mask:look.mask,tuftHighlightPixels,whiteEdgePixels});
}
if(process.env.BOAT_PROOF==='mast') {
 // Render a real continuous turn, including the 80 ms view/foreground fades.
 const originalNow=performance.now;let now=10000;performance.now=()=>now;
 try {
  fx.forget('review');
  const motion=[];
  for(let i=0;i<312;i++) {
   now+=1000/30;const angle=(90-Math.min(i,288)*360/288)*Math.PI/180;
   fx.boat(entry,{id:'review',x:240,y:355,turn:angle,occupant:'rider',travel:0},i===0);
   const look=fx.duck({id:'rider',x:240,y:355,mode:'sailing',boatId:'review',turn:angle,travel:0},false);
   duck.root.position.set(look.x,look.y);duck.root.rotation=look.rotation;
   duck.update(1/30,{turn:look.turn,time:i/30,reducedMotion:false,action:0,speed:0,sailing:true});
   fx.front(entry);renderer.render(stage);
   writeFileSync(`${out}/turn-${String(i).padStart(3,'0')}.png`,output.toBuffer('image/png'));
   motion.push({frame:i,view:bank.views.find(v=>v.texture===sprite.texture)?.key,alpha:sprite.alpha,rigNow:entry.front.rigNow.visible,rigWas:entry.front.rigWas.visible});
  }
  writeFileSync(`${out}/motion.json`,JSON.stringify(motion,null,2)+'\n');
 }finally{performance.now=originalNow;}
}
writeFileSync(`${out}/runtime.json`,JSON.stringify({renderer:'Pixi CanvasRenderer with @napi-rs/canvas, actual createDuck/createSailingFX',proof,errors:[]},null,2)+'\n');console.log('Rendered all 48 pinned real Pixi views');renderer.destroy();
