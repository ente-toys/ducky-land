// Real Pixi islet sprites, boat views, duck rig and sailing FX, windowless.
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {createCanvas,loadImage,Canvas} from '@napi-rs/canvas';
import sharp from 'sharp';
import {svgPathProperties} from '/private/tmp/boat48-browser/node_modules/svg-path-properties/dist/main.mjs';
import {Assets,Container,Sprite,Texture,CanvasSource,DOMAdapter,Matrix,Graphics} from 'pixi.js';
import {CanvasRenderer} from '../../node_modules/pixi.js/lib/rendering/renderers/canvas/CanvasRenderer.mjs';
import {ISLETS} from '../../src/pixi/islets.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../../src/pixi/world-map.js';
import {angle,expMap,transport} from '../../src/pixi/sphere.js';
import {localPoint} from '../../src/pixi/sphere-coordinates.js';
import {cameraMatrix} from '../../src/pixi/sphere-camera.js';
import {canSail,sailStep,sailRoute} from '../../src/pixi/islands.js';
import {createIsletView} from '../../src/pixi/islet-view.js';
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
const {createDuck}=await import('../../src/pixi/duck.js'),{createSailingFX}=await import('../../src/pixi/sailing-fx.js');
const renderer=new CanvasRenderer(),W=1440,H=1000,output=canvas(W,H);
await renderer.init({canvas:output,width:W,height:H,resolution:1,background:0x6ec9de,antialias:true,manageImports:false,eventFeatures:{move:false,globalMove:false,click:false,wheel:false}});
const scene=new Container(),water=new Container(),objects=new Container({sortableChildren:true});scene.addChild(water);
const isletView=await createIsletView({renderer},scene,objects);scene.addChild(objects);
const duck=await createDuck({outfit:{},seed:0}),fx=await createSailingFX({water,objects}),root=new Container(),sprite=new Sprite();root.addChild(sprite);objects.addChild(root,duck.root);const entry={root,sprite};
const out='../concepts/themes/world-map/islets',proof=[];
for(const [n,i]of [ISLETS[0],ISLETS.find(i=>i.art==='07-pink-blossom')].entries()){
 const island=WORLD_ISLANDS.reduce((a,b)=>angle(i.center,a.center)<angle(i.center,b.center)?a:b),id=island.id,p=localPoint(id,i.center),frame=transport(i,i.collisionCenter);
 const start=localPoint(id,expMap(frame,-900,650,WORLD_GEO.Rw)),end=localPoint(id,expMap(frame,900,650,WORLD_GEO.Rw)),route=sailRoute(id,start,end);
 if(!route)throw Error('Sailing path missing');
 const actor={id:'rider',islandId:id,...start,mode:'sailing',boatId:'review',sailTarget:route[0],sailRoute:route.slice(1)};
 for(let k=0;k<80;k++)sailStep(actor,1/60,{x:0,y:0});
 if(!canSail(actor.x,actor.y,id))throw Error('Boat proof crosses islet');
 const camera={x:p.x,y:p.y+200,zoom:.66};scene.setFromMatrix(Object.assign(new Matrix(),cameraMatrix(camera,W,H,1)));isletView.update(id,camera,W,H,false);
 fx.forget('review');const boat={id:'review',x:actor.x,y:actor.y,turn:actor.turn,occupant:'rider',travel:380};fx.boat(entry,boat,true);root.zIndex=actor.y+2;
 const look=fx.duck({...actor,travel:380},true);duck.root.position.set(look.x,look.y);duck.root.scale.set(look.scale);duck.root.rotation=look.rotation;duck.root.zIndex=look.z;
 for(let k=0;k<60;k++)duck.update(.1,{turn:look.turn,time:0,reducedMotion:false,action:0,speed:0,sailing:true});fx.front(entry);renderer.render(scene);
 const d=output.getContext('2d').getImageData(0,0,W,H).data;let ink=0;for(let k=0;k<d.length;k+=4)if(d[k]<100&&d[k+1]<100&&d[k+2]<100)ink++;
 const file=`ingame-close-${n+1}.png`;writeFileSync(`${out}/${file}`,output.toBuffer('image/png'));
 // Assert that the flat layer is excluded before the globe's scene capture.
 isletView.update(id,camera,W,H,true);if(isletView.layer.visible)throw Error('Double draw at globe transition');
 renderer.render(scene);const without=output.getContext('2d').getImageData(0,0,W,H).data;let changed=0;for(let k=0;k<d.length;k+=4)if(Math.abs(d[k]-without[k])+Math.abs(d[k+1]-without[k+1])+Math.abs(d[k+2]-without[k+2])>8)changed++;
 if(changed<20000)throw Error(`Missing Pixi islet sprite: ${changed} islet pixels`);
 proof.push({file,islet:i.id,islandId:id,boat:{x:actor.x,y:actor.y,turn:actor.turn},camera,inkPixels:ink,isletPixels:changed,renderer:'Production Pixi sprites + createDuck + createSailingFX in CanvasRenderer',canSail:true,globeCaptureExcludesFlatLayer:true});
 console.log(proof.at(-1));
}
writeFileSync(`${out}/ingame-close-proof.json`,JSON.stringify(proof,null,2)+'\n');
fx.dispose();isletView.destroy();renderer.destroy();
