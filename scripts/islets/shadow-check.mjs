// Render the production islet layers without a browser. No game art is generated.
// node scripts/islets/shadow-check.mjs before|after [output directory]
// Use the same explicit output directory for both runs to generate comparisons.
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {Canvas,createCanvas,loadImage} from '@napi-rs/canvas';
import {Container,DOMAdapter,Matrix} from 'pixi.js';
import {CanvasRenderer} from '../../node_modules/pixi.js/lib/rendering/renderers/canvas/CanvasRenderer.mjs';
import {createIsletView} from '../../src/pixi/islet-view.js';
import {ISLET_ART,ISLET_SCALE} from '../../src/pixi/islets.js';
import {placeIslet} from '../../src/pixi/islet-placement.js';
const [phase = 'after', outputDirectory] = process.argv.slice(2);
const out = outputDirectory === undefined
  ? fs.mkdtempSync(path.join(tmpdir(), 'ducky-islet-shadows-'))
  : path.resolve(outputDirectory);
fs.mkdirSync(out, {recursive: true});
const dom=new JSDOM('<body></body>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},HTMLCanvasElement:Canvas});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const canvas=(w=1,h=1)=>{const c=createCanvas(w,h);c.style={};c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;};
DOMAdapter.set({createCanvas:canvas,createImage:()=>null,getCanvasRenderingContext2D:()=>createCanvas(1,1).getContext('2d').constructor,getWebGLRenderingContext:()=>null,getNavigator:()=>navigator,getBaseUrl:()=>dom.window.location.href,getFontFaceSet:()=>document.fonts,fetch:(...a)=>fetch(...a),parseXML:s=>new DOMParser().parseFromString(s,'image/svg+xml')});
const contains=document.body.contains.bind(document.body);document.body.contains=n=>n instanceof dom.window.Node?contains(n):true;
globalThis.fetch=async url=>({ok:true,text:async()=>fs.readFileSync(path.resolve('public',String(url).replace(/^\//,'')),'utf8')});
const output=canvas(2048,2048),renderer=new CanvasRenderer();
await renderer.init({canvas:output,width:2048,height:2048,resolution:1,background:0x6ec9de,antialias:true,manageImports:false,eventFeatures:{move:false,globalMove:false,click:false,wheel:false}});
const scene=new Container(),objects=new Container({sortableChildren:true});scene.addChild(objects);
const view=await createIsletView({renderer},scene,objects),report=[];
try{
 for(const art of ISLET_ART){
  const v=view.views.find(v=>v.i.art===art),i=v.i,k=i.width/1024,p=placeIslet(i.home,i,[0,0]),zoom=2/k;
  view.update(i.home,{...p,zoom},2048,2048,false);
  for(const other of view.views)if(other!==v){other.root.visible=false;for(const p of other.props)p.sprite.visible=false;}
  scene.setFromMatrix(new Matrix(zoom,0,0,zoom,1024-p.x*zoom,1024-p.y*zoom));
  renderer.render({container:scene,clear:true});
  const file=`${art}-${phase}.png`;fs.writeFileSync(path.join(out,file),output.toBuffer('image/png'));
  report.push({art,file,width:i.width,scale:ISLET_SCALE,props:v.props.length,shadows:v.props.filter(p=>p.shadow).length});
 }
}finally{view.destroy();renderer.destroy();dom.window.close();}
fs.writeFileSync(path.join(out,`${phase}.json`),JSON.stringify(report,null,2)+'\n');
const sheet=createCanvas(1536,4*550),g=sheet.getContext('2d');g.fillStyle='#fff9df';g.fillRect(0,0,sheet.width,sheet.height);g.font='18px sans-serif';
for(const [n,row]of report.entries()){const x=n%3*512,y=Math.floor(n/3)*550;g.drawImage(await loadImage(path.join(out,row.file)),x,y,512,512);g.fillStyle='#39472d';g.fillText(`${row.art} (${phase})`,x+12,y+537);}
fs.writeFileSync(path.join(out,`${phase}-sheet.png`),sheet.toBuffer('image/png'));
if(phase==='after')for(const row of report){const before=path.join(out,`${row.art}-before.png`);if(!fs.existsSync(before))continue;const c=createCanvas(2048,1060),g=c.getContext('2d');g.fillStyle='#fff9df';g.fillRect(0,0,2048,1060);g.drawImage(await loadImage(before),0,0,1024,1024);g.drawImage(await loadImage(path.join(out,row.file)),1024,0,1024,1024);g.fillStyle='#39472d';g.font='22px sans-serif';g.fillText(`${row.art}: BEFORE`,20,1050);g.fillText('AFTER',1044,1050);fs.writeFileSync(path.join(out,`${row.art}-compare.png`),c.toBuffer('image/png'));}
console.log(JSON.stringify({phase,out,islets:report.length,scale:ISLET_SCALE}));
