// Rebuild only the approved inner garden and bridge art. Outer data is read from the pre-centre snapshot.
import fs from 'node:fs';
import {rebuildPaths} from './paths.mjs';
import {rebuildBridges,rebuildBridgePhysics} from './bridges.mjs';
import {JSDOM} from 'jsdom';
import {inPoly} from '../../rive/web/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {point,FEATURES,CLUMPS,REST,NOD_COMPANIONS} from './centre-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/',S='scripts/bigger-cathedral/centre-source/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const art=read(S+'art.json'),world=read(S+'world.json'),walk=read(S+'walk-world.json'),geo=read('scripts/bigger-cathedral/water-geometry.json');
const inside=p=>inPoly(p.x,p.y,geo.ring);
const keep=p=>['cathedral-hall','campanile','cathedral-2','cathedral-3','cloister-olive-well'].includes(p.id)||/^cloister-(cloister-back|roof-roses|bench-[1-4]$)/.test(p.id);
const nodIds=new Set(world.sleepSpots.nod.map(s=>s[0]));
art.props=art.props.filter(p=>!inside(p)||keep(p)||nodIds.has(p.id));
// Keep the exact round piazza floors; remove the old beach towels and all inner toy dressing.
art.flats=art.flats.filter(p=>!inside(p)||/piazza-mosaic|rose-inlay/.test(p.src));
const removed=new Set(read(S+'art.json').props.filter(p=>inside(p)&&!keep(p)&&!nodIds.has(p.id)).map(p=>p.id));
// Preserve architecture footprints; retire inner furniture and side-wall solids.
const protectedSolids=world.obstacles.slice(0,14);
for(const m of [world,walk])m.obstacles=m.obstacles.filter(o=>!inside(o)&&!o.poly?.some(([x,y])=>inside({x,y}))).concat(protectedSolids);
// Reuse the exact Home family. Longitudinal station fitting preserves upright
// posts, source cross-planks, and both existing path anchors without transforms.
rebuildBridges(art,geo);
rebuildBridgePhysics(world,walk,geo);
// Snapshot the green tiles once, then append a garden repaint beneath the unchanged water tiles.
const poly=pts=>'M'+pts.map(p=>p.join(' ')).join('L')+'Z';
const inner=geo.ring.map(([x,y])=>[4100+(x-4100)*.975,2800+(y-2800)*.975]);
let body=`<defs><clipPath id="b2-inner"><path d="${poly(inner)}"/></clipPath></defs><g clip-path="url(#b2-inner)"><path d="${poly(inner)}" fill="#93b72f"/>`;
body+=CLUMPS.map(c=>{const trees=c.filter(p=>typeof p[2]==='number'),[x,y]=point(trees[0]);return `<ellipse cx="${x}" cy="${y-12}" rx="180" ry="65" fill="#9bbd3b"/>`;}).join('');
body+=[[620,180],[700,200],[1260,460],[250,450],[420,510],[575,1140],[1400,465],[1600,575],[1630,1000],[1390,1220],[300,1190],[400,1150],[220,970],[1350,1030]].map(([x,y])=>{const [a,b]=point([x,y]);return `<path d="M${a-10} ${b}q-8 -18 2 -15q5 3 8 15q1 -26 10 -22q7 6 -3 22q15 -15 19 -7q0 8 -19 7" fill="#5d9135"/>`;}).join('');
body+='</g>';
// The sole paths painter supplies all garden lanes and court base surfaces.
for(const t of art.ground.tiles.filter(t=>!t.src.startsWith('bridges/water-')&&t.x<7300&&t.x+t.width>600&&t.y<5500&&t.y+t.height>400)){
 const svg=fs.readFileSync(A+t.src,'utf8').replace(/<!--b2-garden-->[\s\S]*?(?=<\/svg>\s*$)/,'');
 fs.writeFileSync(A+t.src,svg.replace(/<\/svg>\s*$/,'<!--b2-garden-->'+body+'</svg>'));
}
const dimensions={1:[260,360],2:[180,360],3:[300,380],4:[200,280],5:[150,380],b1:[130,100],b2:[168,110],b3:[116,104],b4:[140,100]};
function plant(id,x,y,type){const [width,height]=dimensions[type],b=String(type).startsWith('b');return {id,name:b?'Home garden bush':'Home garden tree',src:`/pixi-art/plants/${b?'bush-'+String(type).slice(1):'tree-'+type}.svg`,x,y,width,height,scale:1,anchor:{x:.5,y:1},wind:false};}
// Sleeper trunk IDs and their roots are retained exactly, replacing only the olive art.
for(const id of nodIds){const p=art.props.find(p=>p.id===id);Object.assign(p,plant(id,id==='olive-14'?6400:p.x,id==='olive-14'?3870:p.y,1));}
for(const [i,clump]of CLUMPS.entries())for(const [j,[px,py,type]]of clump.entries()){
 const [x,y]=point([px,py]);art.props.push(plant(`b2-clump-${i}-${j}`,x,y,type));
}
for(const [id,file,x,y,width,height]of [
 ['bench-nw','bench-1.svg',3870,4000,163,94],['bench-ne','bench-2.svg',4330,4000,163,94],
 ['bench-sw','bench-3.svg',3870,4570,163,94],['bench-se','bench-4.svg',4330,4570,163,94],
 ['lamp-w','lamp-1.svg',3770,4410,46.48,191.73],['lamp-e','lamp-2.svg',4430,4410,46.48,191.73],
 ])art.props.push({id:'b2-'+id,name:'Fountain plaza '+id,src:'centre/'+file,x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false});
const source='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-check/svg/centre/';
const missing=[];
for(const [id,file,px,py,pw,ph,flip]of FEATURES){
 if(!fs.existsSync(source+file)&&!fs.existsSync(A+'centre/'+file)){missing.push(file);continue;}
 const redraw=S+'redraw/'+file;
 if(fs.existsSync(redraw))fs.copyFileSync(redraw,A+'centre/'+file);
 else if(!fs.existsSync(A+'centre/'+file)&&fs.existsSync(source+file))fs.copyFileSync(source+file,A+'centre/'+file);
 let placedFile=file;
 if(id.startsWith('parterre-s')){placedFile='hedge-parterre-south.svg';fs.copyFileSync(S+'redraw/'+placedFile,A+'centre/'+placedFile);}
 const target=A+'centre/'+placedFile;let vector=fs.readFileSync(target,'utf8');vector=vector.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="'+pw/.3+'"').replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="'+ph/.3+'"');fs.writeFileSync(target,vector);
 const [x,y]=point([px,py]);art.props.push({id:'b2-'+id,name:'Garden '+id,src:'centre/'+placedFile,x,y,width:pw/.3,height:ph/.3,scale:1,anchor:{x:.5,y:1},flip:!!flip,shadow:false,wind:false});
}
for(const [i,clump]of NOD_COMPANIONS.entries())for(const [j,[x,y,type]]of clump.entries())art.props.push(plant(`b2-nod-${i}-${j}`,x,y,type));
for(const [pose,entries]of Object.entries(REST))for(const [i,[x,y]]of Object.entries(entries))world.sleepSpots[pose][i]=[x,y,world.sleepSpots[pose][i][2]];
// Add shallow trunks and hedge footprints alongside the fountain/gazebo bases, keeping the paths through the garden clear.
for(const p of art.props.filter(p=>/^b2-(fountain|gazebo)$/.test(p.id)))for(const m of [world,walk])m.obstacles.push({id:p.id,x:p.x,y:p.y-35,rx:p.width*.28,ry:50});
for(const p of art.props.filter(p=>/^b2-(bench|lamp)-/.test(p.id)))for(const m of [world,walk])m.obstacles.push({id:p.id,x:p.x,y:p.y-12,rx:p.id.includes('bench')?p.width*.42:10,ry:12});
// Route geometry is authored only in paths-data.mjs.
world.sleepAvoid=world.sleepAvoid.filter(p=>!inside(p));walk.sleepAvoid=world.sleepAvoid;
for(const p of art.props.filter(p=>/^b2-(clump|nod)/.test(p.id)&&p.name==='Home garden tree'))for(const m of [world,walk])m.obstacles.push({id:p.id,x:p.x,y:p.y-10,rx:18,ry:12});
for(const p of art.props.filter(p=>/^b2-parterre/.test(p.id)))for(const m of [world,walk])m.obstacles.push({id:p.id,x:p.x,y:p.y-p.height*.45,rx:p.width*.43,ry:p.height*.35});
world.props=art.props;
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
const map=makeMap('cathedral',{world,walk,harbor:read(D+'harbor.json')});
save('scripts/bigger-cathedral/centre-metrics.json',{bridges:13,removedProps:removed.size,features:FEATURES.length-missing.length,missing,clumps:CLUMPS.length,sleepers:map.sleepers.length});
console.log(read('scripts/bigger-cathedral/centre-metrics.json'));

rebuildPaths();
