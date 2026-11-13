import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeMap} from '../../src/world/island-maps.js';
import {groundArtwork, streamArtwork} from './ground.mjs';
import {composeLake} from './lake.mjs';
import {composeQuality3, composedCoverage, quality3Problems} from './quality3.mjs';
import {isCanopy,isSoftPatch,canopyProblems,fenceProblems,softPatchProblems,snowmanProblems} from './fix-all.mjs';
import {geometry, inPoly, inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots, sleepHalfWidths, sleepShapeProblems} from '../../src/world/home/sleep-spots.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ART = 'public/pixi-art/themes/snow';
export const WORLD = 'assets/world/themes/snow';
export const WORKERS = ['b1','b2','b3','p1','p2','p3'];
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const clone = v => structuredClone(v);
const round = n => Math.round(n * 100) / 100;
const norm = s => String(s).replace(/\.svg$/i,'').replace(/^(street|ground|scene)-/,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
export const area = poly => Math.abs(poly.reduce((s,p,i) => {const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
export function bounds(p) {const a=p.topLeft?{x:0,y:0}:(p.anchor??{x:.5,y:1});return {x0:p.x-p.width*a.x,y0:p.y-p.height*a.y,x1:p.x+p.width*(1-a.x),y1:p.y+p.height*(1-a.y)};}
export const overlaps = (a,b,pad=0) => a.x0<b.x1+pad && a.x1>b.x0-pad && a.y0<b.y1+pad && a.y1>b.y0-pad;
const segDist = (x,y,a,b) => {const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
export function pathClearance(w,x,y) {let d=Infinity;for(const r of w.iceland2.routes)for(let i=1;i<r.samples.length;i++)d=Math.min(d,segDist(x,y,r.samples[i-1],r.samples[i])-r.width/2);return d;}
export function propPathClearance(w,p) {
 const b=bounds(p),point=(x,y)=>Math.hypot(Math.max(b.x0-x,0,x-b.x1),Math.max(b.y0-y,0,y-b.y1));
 let clearance=Infinity;
 for(const r of w.iceland2.routes)for(let i=1;i<r.samples.length;i++){
  const a=r.samples[i-1],c=r.samples[i],dx=c[0]-a[0],dy=c[1]-a[1];let lo=0,hi=1;
  for(const [v,d,min,max] of [[a[0],dx,b.x0,b.x1],[a[1],dy,b.y0,b.y1]]){
   if(!d){if(v<min||v>max){lo=1;hi=0;break;}}
   else {const t0=(min-v)/d,t1=(max-v)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
  }
  const d=lo<=hi?0:Math.min(point(...a),point(...c),...[[b.x0,b.y0],[b.x1,b.y0],[b.x0,b.y1],[b.x1,b.y1]].map(q=>segDist(...q,a,c)));
  clearance=Math.min(clearance,d-r.width/2-12);
 }
 return clearance;
}
export function landViews(w,{width=1440,height=900,stride=240}={}) {
 const xs=w.coast.map(p=>p[0]),ys=w.coast.map(p=>p[1]),views=[];
 for(let y=Math.floor((Math.min(...ys)-height/2)/stride)*stride;y<=Math.max(...ys)-height/2;y+=stride)for(let x=Math.floor((Math.min(...xs)-width/2)/stride)*stride;x<=Math.max(...xs)-width/2;x+=stride){
  let land=0;for(let j=0;j<5;j++)for(let i=0;i<7;i++)if(inPoly(x+(i+.5)*width/7,y+(j+.5)*height/5,w.coast))land++;
  if(land>=18||inPoly(x+width/2,y+height/2,w.coast))views.push({x0:x,y0:y,x1:x+width,y1:y+height,land:land/35});
 }
 return views;
}
export const viewDetails=(view,clusters)=>clusters.filter(c=>c.role!=='shade-cluster'&&overlaps(bounds(c),view)).length;
export const viewCoverage = (view,art,report=art.icelandFinal) => composedCoverage(view,art,report);
function coastDistance(w,x,y) {let d=Infinity;for(let i=0;i<w.coast.length;i++)d=Math.min(d,segDist(x,y,w.coast[i],w.coast[(i+1)%w.coast.length]));return d;}
const halton = (i,b) => {let n=0,f=1;while(i){f/=b;n+=f*(i%b);i=Math.floor(i/b);}return n;};
const PLACEHOLDERS = {
 bakery:[360,374,'bakery'], workshop:[360,279,'sled-workshop'], lodge:[360,428,'lodge'], gallery:[400,394,'ice-duck-gallery'], 'cocoa-hut':[360,360,'cocoa-hut'],
 'cottage-1':[400,463,'bakery-store'],'cottage-2':[400,487,'lodge-west'],'cottage-3':[400,456,'workshop-store'],'cottage-4':[400,455,'fishing-west'],
 bench:[210,136.5,'home-bench'],lamp:[90,171,'snow-lantern'],mailbox:[65,90,'snow-lantern'],woodpile:[150,99,'firewood-stack'],fence:[180,84,'snow-fence'],signpost:[90,130,'snow-lantern'],
 'pine-small':[185,330,'tree-1'],'pine-medium':[230,410,'tree-2'],'pine-large':[255,460,'tree-3'],
 'shrub-small':[100,66,'bush-1'],'shrub-medium':[145,95,'bush-2'],'shrub-large':[165,110,'bush-3'],
 'sled-hill':[820,440,'sled-hill'],sled:[130,70,'sled-hill-start'],'snowman-1':[115,145,'snowman-0'],'snowman-2':[115,145,'snowman-1'],'snowman-3':[115,145,'snowman-2'],
 'cocoa-cart':[190,126,'cocoa-cart'],'ice-duck':[150,195,'ice-duck-sculpture'],'skate-rack':[180,170,'sled-rack'],'umbrella-table':[200,270,'cocoa-cart'],'snowball-pile':[110,80,'snow-pile'],'scarf-basket':[100,80,'snow-crates'],
 tuft:[44,26,'snow-pile'],pebbles:[34,18,'snow-pile'],footprints:[56,24,'snow-pile'],drift:[100,40,'snow-pile'],'berry-shrub':[90,60,'bush-1'],'snowbank-edge':[140,30,'snow-pile'],
 smoke:[85,125,null],
 'mini-snowman':[118,142,'final/props/mini-snowman'],flowerpot:[58,76,'final/props/flowerpot'],'bird-feeder':[112,174,'final/props/bird-feeder'],'lantern-stump':[110,118,'final/props/lantern-stump'],
 'frozen-puddle':[210,110,'final/props/frozen-puddle'],'sled-scarf':[184,132,'final/props/sled-scarf'],'woodpile-axe':[166,153,'final/props/woodpile-axe'],
};
const ALIASES = {
 workshop:['sled-workshop'],gallery:['ice-duck-gallery'],bench:['snow-bench','street-bench'],lamp:['street-lamp','snow-lantern','lantern'],woodpile:['street-woodpile','firewood-stack','firewood'],fence:['street-fence','fence-segment'],
 'sled-hill':['sled-hill-base','hill-base','scene-sledhill','sledhill'],sled:['parked-sled','sled-small'],
 'snowman-1':['snowman-a','snowman-big','snowman-large','snowman'],'snowman-2':['snowman-b','snowman-medium','snowman-small'],'snowman-3':['snowman-c','snowman-small'],
 'cocoa-cart':['rink-cocoa-cart','hot-cocoa-cart'], 'ice-duck':['ice-duck-sculpture','ice-sculpture','rink-sculpture'],
 tuft:['snow-tuft','grass-tuft','winter-tuft','tufts'],pebbles:['pebble','pebble-cluster','snow-pebbles'],footprints:['footprint-pair','footprint','duck-footprints'],drift:['snow-drift','snowdrift','snow-mound'],
 'berry-shrub':['berry-bush','berries','winter-berry-shrub'],'snowbank-edge':['snowbank','path-edge','snow-bank-edge','snow-edge'],smoke:['chimney-smoke','oven-smoke'],
};

export function loadCatalog(root=ROOT,{dryRun=false,manifestDir=path.join(root,ART,'final')}={}) {
 const assets=new Map(),missing=[],manifests=[];
 const findManifest = name => [manifestDir,path.join(manifestDir,'buildings'),path.join(manifestDir,'props')].map(d=>path.join(d,name+'.json')).find(existsSync);
 for(const worker of WORKERS){
  const file=findManifest(worker);if(!file){missing.push(worker);continue;}
  manifests.push(path.relative(root,file));const data=json(file);
  const raw=Array.isArray(data)?data:(data.assets??data.pieces??data.buildings??data.props??data);
  const entries=Array.isArray(raw)?raw.map(a=>[a.id??a.name??path.basename(a.file??a.src??''),a]):Object.entries(raw);
  for(const [key,a] of entries){if(!a || typeof a!=='object' || !(a.file??a.src??a.path))continue;
   const width=+(a.width??a.size?.width),height=+(a.height??a.size?.height);
   if(!(width>0&&height>0))throw Error(`${file}: ${key} needs positive width and height`);
   const src=a.file??a.src??a.path;
   const candidates=[path.resolve(path.dirname(file),src),path.resolve(root,ART,src),path.resolve(root,src.replace(/^\//,'')),path.resolve(root,'public',src.replace(/^\//,''))];
   const disk=candidates.find(existsSync);if(!disk)throw Error(`${file}: missing SVG ${src}`);
   if(!/\.svg$/i.test(disk))throw Error(`${file}: non-SVG asset ${src}`);
   const item={...a,width,height,src:path.relative(path.join(root,ART),disk).split(path.sep).join('/'),manifest:path.relative(root,file),key:norm(key)};
   assets.set(norm(key),item);assets.set(norm(path.basename(src)),item);
  }
 }
 if(missing.length&&!dryRun)throw Error(`Missing manifests: ${missing.join(', ')}. Use --dry-run until all six workers finish.`);
 const placeholders=new Set();
 function get(role,variant=0){
  if(/^(tuft|pebbles|footprints|drift|berry-shrub|snowbank-edge)$/.test(role)){
   const names=[role,...(ALIASES[role]??[])].map(norm);
   const variations=[...new Set([...assets.values()])].filter(a=>names.some(n=>a.key===n||a.key.startsWith(n+'-')));
   if(variations.length)return variations[variant%variations.length];
  }
  let a=[role,...(ALIASES[role]??[])].map(norm).map(k=>assets.get(k)).find(Boolean);
  if(!a)a=[...assets.entries()].find(([k])=>[role,...(ALIASES[role]??[])].some(s=>k===norm(s)||k.startsWith(norm(s)+'-')))?.[1];
  if(a)return a;
  if(!dryRun)throw Error(`No piece for ${role}; available: ${[...new Set([...assets.values()].map(a=>a.key))].join(', ')}`);
  const p=PLACEHOLDERS[role];if(!p)throw Error(`No placeholder role ${role}`);placeholders.add(role);
  return {key:role,width:p[0],height:p[1],src:p[2]?.startsWith('final/')?p[2]+'.svg':p[2]?`v2/${p[2]}.svg`:'/pixi-art/home-hamlets/reedwhistle/chimney-smoke.svg',placeholder:true};
 }
 return {get,assets,missing,manifests,placeholders};
}

export function piece(catalog,role,id,x,y,extra={}) {
 const a=catalog.get(role,Number(id.match(/(\d+)$/)?.[1]??0));
 const fitWidth=(!/^(bakery|workshop|lodge|gallery|cocoa-hut|cottage-|tuft|pebbles|footprints|drift|berry-shrub|snowbank-edge)/.test(role))?PLACEHOLDERS[role]?.[0]:null;
 const k=(a.worldWidth??a.displayWidth??a.placement?.width??fitWidth??a.width)/a.width;
 return {id,name:id,src:a.src,x:round(x),y:round(y),width:round(a.width*k),height:round(a.height*k),resolution:2,shadow:false,wind:false,
  finalRole:role,assetKey:a.key,sourceSize:[a.width,a.height],assetScale:k,...(a.placeholder?{placeholder:true}:{}),...extra};
}
function localPoint(p,a,point){const b=bounds(p);return [b.x0+point.x*p.width/a.width,b.y0+point.y*p.height/a.height];}
export function footprint(p,a,{building=false,tree=false}={}) {
 const k=p.width/a.width,b=bounds(p),fp=a.footprint??a.collision;
 if(fp?.poly)return {prop:p.id,poly:fp.poly.map(q=>[round(b.x0+q[0]*k),round(b.y0+q[1]*k)])};
 if(fp?.rx>0&&fp?.ry>0)return {prop:p.id,x:round(b.x0+(fp.x??fp.cx??a.width/2)*k),y:round(b.y0+(fp.y??fp.cy??a.height-20)*k),rx:round(fp.rx*k),ry:round(fp.ry*k)};
 const fw=(a.groundFootprintWidth??a.footprintWidth??a.width*(building?.85:tree?.16:.78))*k;
 return {prop:p.id,x:p.x,y:round(building?p.door[1]-40:p.y-Math.min(18,p.height*.1)),rx:round(fw/2),ry:building?20:tree?14:round(Math.max(8,Math.min(30,p.height*.16)))};
}
export async function homeDensity(){
 const {homeLayers}=await import('../globe-perf/snapshot.mjs');
 const {mapOf}=await import('../../src/world/island-maps.js');
 const h=homeLayers(),world=mapOf('home').world,count=h.flats.filter(p=>/\/decals\//.test(p.src)).length;
 return {count,area:area(world.coast),perMillion:count/area(world.coast)*1e6};
}

export async function integrate({root=ROOT,dryRun=true,catalog=loadCatalog(root,{dryRun}),inputArt=json(path.join(root,ART,'art.json')),inputWorld=json(path.join(root,WORLD,'world.json')),density=null}={}) {
 const art=clone(inputArt),w=clone(inputWorld),report=clone(art.icelandFinal);
 if(!report?.sourceLayout)throw Error('Iceland final approved composition is required');
 const files=composeLake(root,art,w,report);
 const ground=groundArtwork(root,art,w,report.ground.clusters,files);
 report.lake.junctions=ground.landings;
 for(const [file,svg] of composeQuality3(root,art,w,report,catalog))files.set(file,svg);
 for(const [file,svg] of ground.files)files.set(file,svg);
 streamArtwork(root,art,files);
 report.pathEdges=ground.paths;report.manifests=catalog.manifests;report.missingManifests=catalog.missing;report.placeholderRoles=[...catalog.placeholders];
 art.icelandFinal=report;w.icelandFinal={version:5,counts:report.counts};w.props=clone(art.props);
 return {art,world:w,report,catalog,files};
}

export function validate(result,{root=ROOT,requireAssets=true}={}) {
 const {art,world:w,report,files=new Map()}=result,errors=[],buildings=art.props.filter(p=>p.finalKind==='building');
 const check=(ok,msg)=>{if(!ok)errors.push(msg);};
 const ids=new Set();for(const p of [...art.props,...art.flats]){
  check(!ids.has(p.id),`duplicate ${p.id}`);ids.add(p.id);
  check([p.x,p.y,p.width,p.height].every(Number.isFinite)&&p.width>0&&p.height>0,`invalid dimensions ${p.id}`);
  check(p.finalRole!=='tuft'&&p.finalRole!=='snowbank-edge'&&p.finalKind!=='path-edge',`retired ground item ${p.id}`);
  if(p.finalKind&&!['building','smoke','scene-base'].includes(p.finalKind)){
   check(!buildings.some(b=>overlaps(bounds(p),bounds(b))&&!(p.wallDressing&&p.building===b.id&&bounds(p).y0>=bounds(b).y1-145)),`roof overlap ${p.id}`);
   if(!p.wallDressing&&!p.continuousTrail)check(pathClearance(w,p.x,p.y)>=0,`path overlap ${p.id}`);
   if(['yard','scene','nook'].includes(p.finalKind)&&!p.wallDressing)check(propPathClearance(w,p)>=0,`path sprite overlap ${p.id}`);
  }
 }
 check(buildings.length===w.iceland2.doors.length,'missing building');
 const base=makeMap('snow',{world:w,walk:w,harbor:json(path.join(root,WORLD,'harbor.json')),sleepers:[]}).baseWalk;
 const beds=resolveSleepSpots(base,art.props,geometry(base).walkable,sleepHalfWidths(),{spots:w.sleepSpots,avoid:w.sleepAvoid,warn:false});
 check(beds.length===60&&!beds.bad.length,`sleepers ${beds.length}: ${JSON.stringify(beds.bad)}`);
 for(const issue of quality3Problems(art,w,report))check(false,issue);
 for(const p of art.props.filter(isCanopy))for(const issue of canopyProblems(p,art,w))check(false,issue);
 for(const issue of fenceProblems(art))check(false,issue);
 for(const issue of snowmanProblems(art,report))check(false,issue);
 for(const p of [...art.flats,...art.props].filter(isSoftPatch)){
  const file=path.join(ART,p.src),svg=files.get(file)??readFileSync(path.join(root,file),'utf8');
  for(const issue of softPatchProblems(svg,p.id))check(false,issue);
 }
 for(const v of landViews(w,{stride:120}))for(const [kind,present] of Object.entries(viewCoverage(v,art,report)))check(present,`blank land view ${v.x0},${v.y0}: missing ${kind}`);
 for(const b of buildings){const yard=art.props.filter(p=>p.building===b.id),d=report.yardDressing?.find(y=>y.building===b.id);
  check([-1,1].every(side=>yard.some(p=>p.finalRole==='flowerpot'&&p.flank===side)),`bare door ${b.id}`);
  check(art.flats.filter(p=>p.building===b.id&&p.finalRole==='wall-drift').length>=2,`bare walls ${b.id}`);
  check(yard.filter(p=>p.finalRole==='lamp').length===1&&yard.some(p=>['bench','woodpile'].includes(p.finalRole)),`bare yard ${b.id}`);
  check(yard.filter(p=>p.finalRole==='mailbox').length===(b.finalRole.startsWith('cottage-')?1:0),`mailbox count ${b.id}`);
  check(d?.route.distance<1,`disconnected yard ${b.id}`);
  const light=yard.find(p=>p.id===d?.pathLamp);
  check(light?.pathLamp&&pathClearance(w,light.x,light.y)<=160&&propPathClearance(w,light)>=8,`unlit approach ${b.id}`);
 }
 const hill=art.flats.find(p=>p.id==='sled-hill'),hillSource=readFileSync(path.join(root,ART,hill.src),'utf8');
 const mound=hillSource.match(/<path id="mound-snow"[^>]*>/)?.[0];
 check(hill.width<=720&&hill.height<=400&&mound?.includes('stroke="none"')&&!/[HLhl]/.test(mound.match(/\bd="([^"]+)"/)?.[1]??'H'),'hill has a straight bottom edge');
 const walk=geometry(w).walkable;
 for(const r of w.iceland2.routes){for(const [x,y] of r.samples)check(walk(x,y),`blocked path ${r.id} ${round(x)},${round(y)}`);
  check(report.pathEdges.some(e=>e.route===r.id&&e.sides.length===2&&e.d),`missing continuous lip ${r.id}`);
 }
 for(const c of report.ground.clusters)check(c.motifCount>=2,`isolated ground item ${c.id}`);
 check(report.counts.trees>=report.sourceLayout.treeCount*1.9&&report.counts.trees<=report.sourceLayout.treeCount*2.1,'tree count must double');
 const propIds=new Set(art.props.map(p=>p.id));for(const o of w.obstacles)check(propIds.has(o.prop),`orphan obstacle ${o.prop}`);
 for(const g of report.groves){const trees=art.props.filter(p=>g.trees.includes(p.id));for(const p of trees)check(trees.some(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<400),`isolated tree ${p.id}`);}
 if(requireAssets){const sources=new Set();const collect=v=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if((k==='src'||k==='vector')&&typeof x==='string')sources.add(x);else if(typeof x==='object')collect(x);}};collect({props:art.props,flats:art.flats,ground:art.ground,decks:art.decks,floating:art.floating});
  for(const src of sources){const file=src.startsWith('/')?path.join(root,'public',src):path.resolve(root,ART,src);check(/\.svg$/i.test(src),`non-SVG ${src}`);check(existsSync(file)||files.has(path.relative(root,file)),`missing asset ${src}`);}
 }
 return errors;
}

async function main(){
 const args=process.argv.slice(2),write=args.includes('--write'),dryRun=!write;
 if(write&&args.includes('--dry-run'))throw Error('Choose --write or --dry-run');
 if(args.some((a,i)=>!['--write','--dry-run','--out'].includes(a)&&args[i-1]!=='--out'))throw Error('Unknown argument');
 const result=await integrate({dryRun}),errors=validate(result);
 if(errors.length)throw Error(errors.slice(0,30).join('\n')+`\n${errors.length} integration problems`);
 const outIndex=args.indexOf('--out');
 if(outIndex>=0&&(!args[outIndex+1]||args[outIndex+1].startsWith('--')))throw Error('--out requires a directory');
 const out=outIndex<0?null:path.resolve(args[outIndex+1]);
 if(out){if(out===ROOT||['public','assets','src','scripts','qa'].some(d=>out===path.join(ROOT,d)||out.startsWith(path.join(ROOT,d)+path.sep)))throw Error('--out must be outside production/source directories');mkdirSync(out,{recursive:true});writeFileSync(path.join(out,'art.json'),JSON.stringify(result.art,null,1)+'\n');writeFileSync(path.join(out,'world.json'),JSON.stringify(result.world,null,1)+'\n');writeFileSync(path.join(out,'report.json'),JSON.stringify(result.report,null,2)+'\n');}
 if(write){
  for(const [file,text] of result.files){const disk=path.join(ROOT,file);mkdirSync(path.dirname(disk),{recursive:true});writeFileSync(disk,text);}
  writeFileSync(path.join(ROOT,ART,'art.json'),JSON.stringify(result.art,null,1)+'\n');
  for(const name of ['world.json','walk-world.json'])writeFileSync(path.join(ROOT,WORLD,name),JSON.stringify(result.world,null,1)+'\n');
  const indexFile=path.join(ROOT,'assets/world/themes/index.js'),index=readFileSync(indexFile,'utf8');
  const harbor=json(path.join(ROOT,WORLD,'harbor.json')),base=makeMap('snow',{world:result.world,walk:result.world,harbor,sleepers:[]}).baseWalk;
  const beds=resolveSleepSpots(base,result.art.props,geometry(base).walkable,sleepHalfWidths(),{spots:result.world.sleepSpots,avoid:result.world.sleepAvoid,warn:false})
   .map(({x,y,pose,r,flip,tree})=>({x:Math.round(x),y:Math.round(y),pose,r:Math.round(r*10)/10,flip,...(tree?{tree}:{})}));
  writeFileSync(indexFile,index.replace(/^  snow: .*$/m,`  snow: {world: snowWorld, walk: snowWalk, harbor: snowHarbor, art: '/pixi-art/themes/snow/art.json', sea: ${JSON.stringify(result.art.sea)}, sleepers: ${JSON.stringify(beds)}},`));
 }
 console.log(JSON.stringify({mode:write?'write':'dry-run',...result.report.counts,ground:result.report.ground.count,missingManifests:result.report.missingManifests,placeholderRoles:result.report.placeholderRoles,out},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
