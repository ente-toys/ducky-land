// The production Pixi scene and both production rigs, rendered by Pixi's
// CanvasRenderer. This works inside the macOS sandbox without launching Chrome.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {createCanvas,loadImage,Canvas,Image,Path2D,ImageData} from '@napi-rs/canvas';
import sharp from 'sharp';
import {JSDOM} from 'jsdom';
import {svgPathProperties} from '/private/tmp/boat48-browser/node_modules/svg-path-properties/dist/main.mjs';

const root=new URL('../../',import.meta.url),out=new URL('../concepts/boat-turntable/spin48-work/r2/',root);
mkdirSync(out,{recursive:true});
const dom=new JSDOM('<!doctype html><body></body>');
globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
globalThis.HTMLCanvasElement=Canvas;globalThis.Image=Image;globalThis.Path2D=Path2D;globalThis.ImageData=ImageData;
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const createElement=document.createElement.bind(document),contains=document.body.contains.bind(document.body);
document.createElement=(name,...args)=>name==='canvas'?createCanvas(1,1):createElement(name,...args);
document.body.contains=node=>node instanceof Canvas||contains(node);
dom.window.SVGElement.prototype.getTotalLength=function(){return new svgPathProperties(this.getAttribute('d')).getTotalLength();};
dom.window.SVGElement.prototype.getPointAtLength=function(length){return new svgPathProperties(this.getAttribute('d')).getPointAtLength(length);};
const {Assets,CanvasRenderer,Container,Sprite,Texture,ImageSource,DOMAdapter}=await import('pixi.js');
DOMAdapter.set({
 createCanvas:(width=1,height=1)=>{const canvas=createCanvas(width,height);canvas.style={};return canvas;},
 createImage:()=>new Image(),getCanvasRenderingContext2D:()=>createCanvas(1,1).getContext('2d').constructor,
 getWebGLRenderingContext:()=>undefined,getNavigator:()=>({userAgent:'Pixi node proof'}),
 getBaseUrl:()=>fileURLToPath(root),getFontFaceSet:()=>document.fonts,
 fetch:(url,options)=>fetch(url,options),parseXML:xml=>new DOMParser().parseFromString(xml,'text/xml'),
});
const hooks=registerHooks({load(url,context,next){if(url.endsWith('.json'))return {format:'module',source:`export default ${readFileSync(new URL(url),'utf8')}`,shortCircuit:true};return next(url,context);}});
const {createDuck}=await import('../../src/pixi/duck.js');
const {loadBoatViews}=await import('../../src/pixi/boat-views.js');
const {createSailingFX}=await import('../../src/pixi/sailing-fx.js');
hooks.deregister();
globalThis.fetch=async url=>{const bytes=readFileSync(new URL('public'+url,root));return {ok:true,json:async()=>JSON.parse(bytes),text:async()=>bytes.toString()};};
const loading=new Map();
Assets.load=async request=>{
 const url=typeof request==='string'?request:request.src;
 if(loading.has(url))return loading.get(url);
 const pending=(async()=>{
  const resolution=typeof request==='string'?1:request.data?.resolution||1;
  const data=await sharp(readFileSync(new URL('public'+url,root)),{density:72*resolution}).png().toBuffer();
  const image=await loadImage(data);
  const texture=new Texture({source:new ImageSource({resource:image,resolution,alphaMode:'no-premultiply-alpha'})});
  Assets.cache.set(url,texture);return texture;
 })();loading.set(url,pending);return pending;
};
const renderer=new CanvasRenderer();await renderer.init({width:480,height:440,resolution:1,background:0xc4e2f5,antialias:true,manageImports:false});
const stage=new Container(),water=new Container(),objects=new Container({sortableChildren:true});stage.addChild(water,objects);
const bank=await loadBoatViews(),duck=await createDuck({outfit:{},seed:0});objects.addChild(duck.root);
function hasBodyMorph(node){
 if(node.label?.startsWith('body-')&&node.children?.length>1&&node.children[0].visible===false)return true;
 return node.children?.some(hasBodyMorph)||false;
}
if(!hasBodyMorph(duck.root))throw new Error('Production Ducky body morph did not initialize');
let now=1000;performance.now=()=>now;
const fx=await createSailingFX({water,objects}),boatRoot=new Container(),sprite=new Sprite();boatRoot.addChild(sprite);objects.addChild(boatRoot);
const entry={root:boatRoot,sprite},boat={id:'r2',x:240,y:355,turn:bank.views[0].angle,occupant:'rider',travel:0};
function draw(dt=1/60){
 const pin=fx.boat(entry,boat,false);boatRoot.zIndex=357;
 const look=fx.duck({id:'rider',x:240,y:355,mode:'sailing',boatId:'r2',turn:boat.turn,travel:0},false);
 duck.root.position.set(look.x,look.y);duck.root.scale.set(look.scale);duck.root.rotation=look.rotation;duck.root.zIndex=look.z;
 duck.update(dt,{turn:look.turn,time:now/1000,reducedMotion:false,action:0,speed:0,sailing:true});
 fx.front(entry);fx.draw(false);renderer.render({container:stage});
 return {pin:[pin.x,pin.y],roll:boatRoot.rotation,bob:pin.y-305,target:boat.turn,
  views:[...entry.layers].filter(([,l])=>l.boat.visible).map(([key,l])=>({key,weight:l.boat.alpha,blend:l.front.blendMode})),
  rider:[look.x,look.y],z:[boatRoot.zIndex,duck.root.zIndex,entry.front.zIndex],filters:boatRoot.filters?.length||0,
  frontFilters:entry.front.filters?.length||0,renderer:'Pixi CanvasRenderer',bodyMorph:hasBodyMorph(duck.root)};
}
const save=name=>writeFileSync(new URL(name+'.png',out),renderer.canvas.toBuffer('image/png'));
function settle(n){fx.forget('r2');boat.turn=bank.views[n].angle;let proof;for(let k=0;k<60;k++){now+=1000/60;proof=draw();}return proof;}
const proofs=[];
for(let n=0;n<48;n++){proofs.push(settle(n));save(`frame-${String(n).padStart(2,'0')}`);}
writeFileSync(new URL('runtime.json',out),JSON.stringify(proofs,null,2));
settle(0);const motion=[];let rear31=false,rear38=false;
for(let n=0;n<480;n++){
 const slow=n<360,k=slow?n:n-360,dt=slow?1/30:1/60;
 boat.turn=Math.PI/2-k*Math.PI*2/(slow?360:120);now+=dt*1000;
 const p=draw(dt);motion.push(p);
 if(n%2===0)save(`motion-${String(n).padStart(3,'0')}`);
 if(!rear31&&p.views[0].key==='f31'){save('rear-mid-36');rear31=true;}
 if(!rear38&&p.views[0].key==='f38'){save('rear-mid-37');rear38=true;}
}
const settling=[];
for(let k=0;k<60;k++){boat.turn=Math.PI/2;now+=1000/60;settling.push(draw());save(`settle-${String(k).padStart(2,'0')}`);}
writeFileSync(new URL('settling.json',out),JSON.stringify(settling,null,2));
writeFileSync(new URL('motion.json',out),JSON.stringify(motion,null,2));
console.log(`Pixi CanvasRenderer captured ${proofs.length} views, ${motion.length} motion samples and 60 settling frames.`);
fx.dispose();renderer.destroy();
