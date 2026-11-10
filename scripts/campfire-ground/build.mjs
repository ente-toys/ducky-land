// Ground art only. Never writes manifests, placements, navigation or sleepers.
// source.svg recovers the existing expansion drawing and its original centre
// as ordinary paths. The former <image> sources were embedded SVGs, not PNGs.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {Path2D} from '@napi-rs/canvas';
import {transform,mul,I} from '../globe-svg/compile.mjs';
import {composeGround} from './material.mjs';
import {contours,simplifyRing} from '../pagepond/geometry.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),rootDir=fileURLToPath(new URL('../../',import.meta.url));
const A=rootDir+'public/pixi-art/themes/community/',parser=new DOMParser(),serializer=new XMLSerializer();
export const source=fs.readFileSync(dir+'source.svg','utf8');
// Boolean fillets can contain thousands of tiny cubic segments. Flatten with
// <=3-unit chords, then simplify by 0.08 world units, well below one device
// pixel. This keeps static SVG decode cost close to the original ground.
export const compactFloor=d=>contours(d,3).map(r=>{
 const points=simplifyRing(r,.08);
 return points.length>2?'M'+points.map(p=>p.map(n=>+n.toFixed(3)).join(' ')).join('L')+'Z':'';
}).join('');
const elements=n=>Array.from(n.childNodes??[]).filter(n=>n.nodeType===1);
// Homeland's flat lawn, retaining every existing patch, tuft and pebble position.
const palette={'#a7c653':'#93b72f','#99ba48':'#a8ca48'};
const ink=new Set(['#819f3e','#7b9542','#798f42','#687b3f','#71894b','#498f9a','#7b826a','#6f8b3e']);
// Rectangular polygon clipping retains holes and winding. Cuts sit 200 units
// outside the visible tile, so cap/join changes cannot become tile-edge marks.
function cropPolygons(d,box){
 return (d.match(/M[^M]+/gi)??[]).map(part=>{
  const v=(part.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number);let points=[];
  for(let i=0;i<v.length;i+=2)points.push(v.slice(i,i+2));
  for(const [axis,edge,sign]of [[0,box[0],1],[0,box[2],-1],[1,box[1],1],[1,box[3],-1]]){
   const input=points;points=[];if(!input.length)break;
   let a=input.at(-1),insideA=(a[axis]-edge)*sign>=0;
   for(const b of input){const insideB=(b[axis]-edge)*sign>=0;
    if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);points.push(a.map((n,k)=>n+(b[k]-n)*t));}
    if(insideB)points.push(b);a=b;insideA=insideB;
   }
  }
  return points.length>2?'M'+points.map(p=>p.map(n=>+n.toFixed(3)).join(' ')).join('L')+'Z':'';
 }).join('');
}
export function tileSvg(tile,{style=true,cull=true,sourceSvg=source}={}){
 const root=parser.parseFromString(sourceSvg,'image/svg+xml').documentElement;
 root.setAttribute('width',String(tile.width));root.setAttribute('height',String(tile.height));root.setAttribute('viewBox',`${tile.x} ${tile.y} ${tile.width} ${tile.height}`);
 // Padding keeps newly clipped stroke endpoints safely outside the viewport,
 // including wide coastal strokes. All tile cuts use identical world geometry.
 const margin=200;
 const box=[tile.x-margin,tile.y-margin,tile.x+tile.width+margin,tile.y+tile.height+margin];
 function walk(n,m=I){
  const tag=n.localName,ctm=mul(m,transform(n.getAttribute('transform')));
  if(style)for(const k of ['fill','stroke']){const value=n.getAttribute(k).toLowerCase();if(palette[value])n.setAttribute(k,palette[value]);if(k==='stroke'&&ink.has(value))n.setAttribute(k,'#39472d');}
  // Patterns retain their local coordinates and phase across every tile.
  if(tag==='pattern'||tag==='symbol')return;
  let p=null;
  if(tag==='path')p=new Path2D(n.getAttribute('d'));
  if(tag==='ellipse'){p=new Path2D();p.ellipse(+n.getAttribute('cx'),+n.getAttribute('cy'),+n.getAttribute('rx'),+n.getAttribute('ry'),0,0,Math.PI*2);}
  if(tag==='rect'){p=new Path2D();p.rect(+n.getAttribute('x'),+n.getAttribute('y'),+n.getAttribute('width'),+n.getAttribute('height'));}
  if(tag==='use'){p=new Path2D();p.rect(+n.getAttribute('x'),+n.getAttribute('y'),+n.getAttribute('width'),+n.getAttribute('height'));}
  if(p&&cull){const world=new Path2D(p).transform({a:ctm[0],b:ctm[1],c:ctm[2],d:ctm[3],e:ctm[4],f:ctm[5]}),b=world.computeTightBounds();
   if(b[0]>box[2]||b[2]<box[0]||b[1]>box[3]||b[3]<box[1]){n.parentNode.removeChild(n);return;}
   // Only filled, huge polygon geometry is cropped. Small marks and all curves
   // retain the original path text and drawing semantics.
   if(tag==='path'&&n.getAttribute('d').length>5000&&!/[CQAHVSTcqahvst]/.test(n.getAttribute('d'))&&ctm.slice(0,4).every((v,i)=>v===I[i])){
    n.setAttribute('d',cropPolygons(n.getAttribute('d'),[box[0]-ctm[4],box[1]-ctm[5],box[2]-ctm[4],box[3]-ctm[5]]));
   }
   if(tag==='path'&&n.getAttribute('data-ground')==='paths'){
    // Clip each flattened winding ring directly. Skia can retain the entire
    // complex floor when its boolean intersection fails.
    n.setAttribute('d',cropPolygons(compactFloor(p.toSVGString()),box));
   }
  }
  for(const child of elements(n))walk(child,ctm);
  if(tag==='g'&&!elements(n).length)n.parentNode.removeChild(n);
 }
 walk(root);
 // Drop unreferenced definitions after tile culling, without external references.
 let changed=true;while(changed){changed=false;const xml=serializer.serializeToString(root);for(const n of Array.from(root.getElementsByTagName('*')))if(n.hasAttribute('id')&&!xml.includes(`url(#${n.getAttribute('id')})`)&&!xml.includes(`href="#${n.getAttribute('id')}"`)){n.parentNode.removeChild(n);changed=true;}}
 const svg=serializer.serializeToString(root).replace(/>\s+</g,'><');
 if(/<(?:image|linearGradient|radialGradient|filter)\b|data:/i.test(svg))throw Error('Non-vector output');
 return svg;
}
export async function build(){
 const art=JSON.parse(fs.readFileSync(A+'art.json')),sizes=[],composed=await composeGround(source);
 for(const tile of art.ground.tiles){if(!tile.src.startsWith('expansion/ground-'))throw Error('Unexpected tile '+tile.src);const svg=tileSvg(tile,{sourceSvg:composed.svg});fs.writeFileSync(A+tile.src,svg);sizes.push(Buffer.byteLength(svg));}
 // Only route widths are updated. Props, stage, water, walk data and manifest
 // are owned by other packages and must remain byte-for-byte untouched.
 const file=rootDir+'rive/web/themes/community/world.json',world=JSON.parse(fs.readFileSync(file));world.pathWidths=composed.report.widths;fs.writeFileSync(file,JSON.stringify(world,null,2)+'\n');
 fs.writeFileSync(dir+'ground-plan.json',JSON.stringify(composed.report,null,2)+'\n');
 console.log(JSON.stringify({tiles:sizes.length,totalBytes:sizes.reduce((a,b)=>a+b),minBytes:Math.min(...sizes),maxBytes:Math.max(...sizes),...composed.report.counts}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
