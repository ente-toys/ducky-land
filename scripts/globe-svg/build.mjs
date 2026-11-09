#!/usr/bin/env node
// node scripts/globe-svg/build.mjs [home|theme|island-id]
// Compose the current island's own SVG contours and authored placements, without
// loading the game or baking pixels. Safe to rerun after another island rebuild.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
import {mapOf,mapFor} from '../../src/pixi/island-maps.js';
import {homeLayers} from '../globe-perf/snapshot.mjs';
import {num,inline,serialize,parse} from './vector.mjs';
import {compile,markup,rectClip,crop} from './compile.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
process.chdir(ROOT);
const OUT='public/pixi-art/globe';fs.mkdirSync(OUT,{recursive:true});
const selected=process.argv[2],ids=[...new Set(WORLD_ISLANDS.map(i=>mapOf(i.id).id))];
const id=selected&&(ids.includes(selected)?selected:WORLD_ISLANDS.some(i=>i.id===selected)?mapOf(selected).id:null);
if(selected&&!id)throw Error(`Unknown island ${selected}. Choose ${ids.join(', ')}`);
const manifest=fs.existsSync(`${OUT}/manifest.json`)?JSON.parse(fs.readFileSync(`${OUT}/manifest.json`)):{};
const files=new Map();
function read(file){if(!files.has(file))files.set(file,fs.readFileSync(file,'utf8'));return files.get(file);}
const source=(src,base)=>src.startsWith('/pixi-art/')?'public'+src:src.startsWith('/assets/')?'.'+src:path.join(base,src);

// Bog's old generator only kept PNG crops. Evaluate its authored terrain with
// filesystem writes disabled to recover the vector, without rebuilding the map.
async function bogTerrain(){
 const result=await build({entryPoints:['scripts/bigger-bog/densify.mjs'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'read-only-sources',setup(b){b.onLoad({filter:/densify\.mjs$/},a=>({contents:read(a.path).split('\n').slice(0,read(a.path).split('\n').findIndex(l=>l.startsWith('writeFileSync(`${base}/terrain-master.svg`'))+1).join('\n').replace("import sharp from 'sharp';",'')+'\nexport {svg,plan};',loader:'js'}));b.onResolve({filter:/^node:fs$/},a=>a.namespace==='readonly'?{path:'node:fs',external:true}:({path:'fs',namespace:'readonly'}));b.onLoad({filter:/.*/,namespace:'readonly'},()=>({contents:"import fs from 'node:fs'; export const readFileSync=(p,...args)=>fs.readFileSync(p==='scripts/bigger-bog/original-harbor.json'?'rive/web/themes/bog/harbor.json':p.endsWith('/before-walk.json')?'scripts/bigger-bog/evidence/dense/before-world.json':p.endsWith('/before-plan.json')?'scripts/bigger-bog/plan.json':p,...args); export const writeFileSync=()=>{}, mkdirSync=()=>{};",loader:'js'}));}}]});
 const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 return module.svg(module.plan.origin.x,module.plan.origin.y,module.plan.width,module.plan.height);
}
let bog;
for(const theme of selected?[id]:ids){
 const map=mapFor(theme),K=1024/Math.max(map.width,map.height),W=Math.round(map.width*K),H=Math.round(map.height*K),base=`public/pixi-art/themes/${theme}`;
 const art=map.home?homeLayers():JSON.parse(read(base+'/art.json'));
 let tiles=map.home?art.tiles:art.ground.tiles;
 // These generators embedded cropped original SVGs in every tile. Recover
 // one vector master and its unchanged dry-land clip instead of duplicating
 // the entire original drawing dozens of times.
 if(theme==='community'||theme==='goldmine'){
  const root=inline(read(source(tiles[0].src,base)));
  let old=Array.from(root.getElementsByTagName('g')).find(n=>n.getAttribute('data-name')==='Unchanged original tile sources'||n.getAttribute('clip-path')==='url(#originalIsland)');
  if(old){while(old.firstChild)old.removeChild(old.firstChild);old.appendChild(parse(read(`${base}/${theme==='goldmine'?'community/original-ground.svg':'ground.svg'}`)));}
  root.setAttribute('viewBox',`${map.origin.x} ${map.origin.y} ${map.width} ${map.height}`);
  files.set('@'+theme,serialize(root));tiles=[{src:'@'+theme,x:map.origin.x,y:map.origin.y,width:map.width,height:map.height}];
 }
 // Restore exact vectors where legacy ground tiles embedded raster crops.
 if(theme==='library'&&tiles.some(t=>t.src.startsWith('bigger/ground-')&&/<image/.test(read(source(t.src,base))))){
  // Original bridge orientations are present in the current world, while an
  // old untracked fixed-crossings.json is absent in clean checkouts.
  const libraryBundle=await build({entryPoints:['scripts/bigger-library/ground.mjs'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'current-crossings',setup(b){b.onLoad({filter:/waterways\.mjs$/},a=>({contents:read(a.path).replace("read('scripts/bigger-library/fixed-crossings.json')",JSON.stringify(JSON.parse(read('scripts/bigger-library/plan.json')).crossings)),loader:'js'}));}}]});
  const {extensionBody}=await import('data:text/javascript;base64,'+Buffer.from(libraryBundle.outputFiles[0].text).toString('base64'));
  const {original,pathRing}=await import('../bigger-library/model.mjs');
  const old=original.world.coastRings.map(pathRing).join(' '),o=map.origin;
  files.set('@library',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o.x} ${o.y} ${map.width} ${map.height}"><defs><mask id="newonly" maskUnits="userSpaceOnUse" x="${o.x}" y="${o.y}" width="${map.width}" height="${map.height}"><rect x="${o.x}" y="${o.y}" width="${map.width}" height="${map.height}" fill="white"/><path d="${old}" fill="black"/></mask></defs><g mask="url(#newonly)">${extensionBody}</g></svg>`);
  tiles=[{src:'@library',x:o.x,y:o.y,width:map.width,height:map.height},...tiles.filter(t=>!t.src.startsWith('bigger/ground-'))];
 }
 if(theme==='bog'&&tiles.some(t=>t.src.endsWith('.png'))){
  bog??=await bogTerrain();files.set('@bog',bog);
  tiles=[{src:'@bog',x:map.origin.x,y:map.origin.y,width:map.width,height:map.height},...tiles.filter(t=>!t.src.endsWith('.png'))];
 }
 if(theme==='cathedral'&&tiles.some(t=>t.src.endsWith('.png'))){
  const original=JSON.parse(read('scripts/bigger-cathedral/baseline/art.json')),world=JSON.parse(read('scripts/bigger-cathedral/baseline/world.json'));
  const d='M'+world.coast.map(p=>p.join(' ')).join('L')+'Z',mask=d+world.islets.map(([x,y,rx,ry])=>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`).join('');
  const svg=read('scripts/bigger-cathedral/baseline/ground.svg');
  files.set('@cathedral',svg.replace(/(<svg[^>]*>)/,`$1<defs><clipPath id="preserved"><path d="${mask}"/></clipPath></defs><g clip-path="url(#preserved)">`).replace('</svg>','</g></svg>'));
  tiles=[...tiles.filter(t=>!t.src.endsWith('.png')),{...original.ground.tiles[0],src:'@cathedral',x:0,y:0,width:8000,height:6000}];
 }
 const defs=[],paint=[],groups=new Map(),tileOrder=[],symbolCache=new Map();let serial=0;
 function position(p,kind){const s=kind==='prop'?(p.scale??1):1,w=p.width*s,h=p.height*s,a=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};return {w,h,x:p.x-a.x*w,y:p.y-a.y*h};}
 function document(p){const file=p.src.startsWith('@')?p.src:source(p.src,base),root=inline(read(file));for(const tag of ['title','desc','metadata'])for(const n of Array.from(root.getElementsByTagName(tag)))n.parentNode.removeChild(n);return root;}
 // Preserve the source viewport as well as its body. Original crop SVGs can
 // share geometry while their clipping depends on the authored viewport.
 for(const p of tiles){
  const root=document(p),v=(root.getAttribute('viewBox')||`0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`).split(/[ ,]+/).map(Number),s=position(p,'ground');
  const sx=s.w/v[2],sy=s.h/v[3],tx=s.x-v[0]*sx,ty=s.y-v[1]*sy;
  root.removeAttribute('viewBox');root.removeAttribute('width');root.removeAttribute('height');
  const key=createHash('sha256').update(serialize(root)+v.map(num).join(',')+'|'+[sx,sy,tx,ty].map(num).join(',')).digest('hex');
  let group=groups.get(key);if(!group){group={root,sx,sy,tx,ty,rects:[]};groups.set(key,group);}
  const rect=[(s.x-map.origin.x)*K,(s.y-map.origin.y)*K,s.w*K,s.h*K];
  tileOrder.push({group,rect});
 }
 const terrain=[],terrainCache=new Map(),runs=[];
 for(const {group:g,rect}of tileOrder){
  const matrix=[g.sx*K,0,0,g.sy*K,(g.tx-map.origin.x)*K,(g.ty-map.origin.y)*K];
  // The original tile viewport remains the exact paint boundary. Geometry is
  // clipped during generation, so runtime SVGs need no masks or large surfaces.
  // Resolve shared source geometry once, then crop each original viewport
  // separately. Combining viewports before resolving source clips changes
  // their paint, notably Canal's original ring geometry.
  const key=createHash('sha256').update(serialize(g.root)+matrix.map(v=>+v.toFixed(6)).join(',')).digest('hex');
  if(g.root.getElementsByTagName('svg').length){
   // Literal nested SVGs inherit the parent's clipping viewport. Resolve them
   // in that exact viewport, rather than treating the parent as an atlas.
   const localKey=key+'|'+rect.join(','),local=terrainCache.get(localKey)??{records:compile(g.root,{matrix,clip:rectClip([rect])})};
   terrainCache.set(localKey,local);runs.push({key:localKey,records:local.records,rects:null});continue;
  }
  let entry=terrainCache.get(key);if(!entry){entry={records:compile(g.root,{matrix})};terrainCache.set(key,entry);}
  let run=runs.at(-1);if(!run||run.key!==key){run={key,records:entry.records,rects:[]};runs.push(run);}run.rects.push(rect);
 }
 // Only adjacent copies can combine viewports. A later overlay tile must
 // retain its authored painter order even when an earlier tile shares its SVG.
 for(const {records,rects}of runs)terrain.push(...(rects?crop(records,rects):records));
 
 const sizes=new Map();
 for(const [kind,entries]of [['flat',art.flats??[]],['deck',art.decks??[]],['prop',art.props],['flat',art.floating??[]]])for(const p of entries){const size=position(p,kind),key=source(p.src,base),old=sizes.get(key);if(!old||size.w*size.h*K*K>old.w*old.h)sizes.set(key,{w:size.w*K,h:size.h*K});}
 function add(p,kind){
  const s=position(p,kind);if(s.x>map.origin.x+map.width||s.y>map.origin.y+map.height||s.x+s.w<map.origin.x||s.y+s.h<map.origin.y||Math.max(s.w,s.h)*K<.5)return;
  const file=source(p.src,base);let name=symbolCache.get(file);
  if(!name){
   name='s'+serial++;const root=document(p),v=(root.getAttribute('viewBox')||`0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`).split(/[ ,]+/).map(Number),size=sizes.get(file)??{w:s.w*K,h:s.h*K},matrix=[size.w/v[2],0,0,size.h/v[3],-v[0]*size.w/v[2],-v[1]*size.h/v[3]];
   const records=compile(root,{matrix,clip:rectClip([[0,0,size.w,size.h]])});
   defs.push({name,size,records});symbolCache.set(file,name);
  }
  const x=(s.x-map.origin.x)*K,y=(s.y-map.origin.y)*K,w=s.w*K,h=s.h*K;
  paint.push(`<use href="#${name}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${p.flip?` transform="translate(${num(2*x+w)} 0) scale(-1 1)"`:''}/>`);
 }

 for(const p of art.floating??[])add({...p,x:p.x-p.width/2,y:p.y-p.height/2,topLeft:true},'flat');
 for(const p of art.flats??[])add(p,'flat');
 for(const p of art.decks??[])add(p,'deck');
 const bridgeStart=paint.length,bridgeDetails=art.props.filter(p=>p.deck||/bridge|jetty|boardwalk/i.test(p.src+' '+p.name));
 for(const p of [...bridgeDetails].sort((a,b)=>a.y-b.y))add(p,'prop');
 // Fallbacks include the complete ground composition: paths, plazas, garden
 // decals, water and bridges. Standing scenery is added only to the globe.
 const groundDefsCount=defs.length,groundPaint=[...paint];
 // The globe still draws each bridge detail once in the prop's true Y order.
 paint.splice(bridgeStart);
 for(const p of [...art.props].sort((a,b)=>a.y-b.y))add(p,'prop');
 let globe,ground,quality;
 for(let level=0;level<10;level++){
  quality={tolerance:+(.3+level*.1).toFixed(2),minArea:+(.18+level*.18).toFixed(2),paletteDistance:Math.min(65,38+level*5),quantum:level<5?.5:1};
  const terrainText=markup(terrain,quality),symbols=defs.map(({name,size,records})=>`<symbol id="${name}" viewBox="0 0 ${num(size.w)} ${num(size.h)}" preserveAspectRatio="none">${markup(records,quality)}</symbol>`);
  const wrap=(groundOnly)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${symbols.slice(0,groundOnly?groundDefsCount:symbols.length).join('')}</defs>${terrainText}${(groundOnly?groundPaint:paint).join('')}</svg>\n`;
  ground=dropSeaBox(wrap(true),W,H);globe=dropSeaBox(wrap(false),W,H);   // boss 9 Nov ('why blue box'): no full-canvas sea shape
  if(Buffer.byteLength(globe)<600000&&Buffer.byteLength(ground)<600000)break;
 }
 if(Buffer.byteLength(globe)>=600000||Buffer.byteLength(ground)>=600000)throw Error(`${theme} cannot fit the 600 KB vector budget`);
 for(const [suffix,svg]of [['-ground',ground],['',globe]]){
  if(/<image\b|data:|<(?:linearGradient|radialGradient|filter)\b/i.test(svg))throw Error(`Non-vector content in ${theme}${suffix}`);
  fs.writeFileSync(`${OUT}/${theme}${suffix}.svg`,svg);
 }
 manifest[theme]={src:`/pixi-art/globe/${theme}.svg`,sha256:createHash('sha256').update(globe).digest('hex'),width:W,height:H,bytes:Buffer.byteLength(globe),groundBytes:Buffer.byteLength(ground),quality,worldPaths:map.world.paths?.length??0,walkways:map.world.walkways?.length??0,flats:art.flats?.length??0,decks:art.decks?.length??0,bridgeDetails:bridgeDetails.length};
 console.log(`${theme}: globe ${manifest[theme].bytes} B, ground ${manifest[theme].groundBytes} B (${W}x${H})`);
}

function dropSeaBox(svg,W,H){
 const [head,body]=svg.split('</defs>');
 return head+'</defs>'+body.replace(/<path fill="(#[0-9a-f]{6})"[^>]* d="([^"]+)"\/>/gi,(all,fill,d)=>{
  if(!/^#(?:6ec9de|6fc9de|7fd3d6|86cbcd|97dce5|a6e3de)$/i.test(fill))return all;
  const n=d.match(/-?\d+\.?\d*/g)?.map(Number)??[],xs=n.filter((_,i)=>i%2===0),ys=n.filter((_,i)=>i%2===1);
  return xs.length&&Math.min(...xs)<=W*.05&&Math.max(...xs)>=W*.95&&Math.min(...ys)<=H*.05&&Math.max(...ys)>=H*.95?'':all;
 });
}
fs.writeFileSync(`${OUT}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
