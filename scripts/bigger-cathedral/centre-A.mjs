// Boss-picked Olive Fountain Piazza. Authored world positions, upright SVG only.
import fs from 'node:fs';
import {oliveSVGBody} from './round2-olive.mjs';
import {segmentedArcades} from './centre-arcade.mjs';
import {rebuildPaths} from './paths.mjs';
import {applyGrass} from './round2-grass.mjs';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const ink='#39472d',stone='#ebcb87',cream='#fff0c7',shade='#c59b59',green='#70813b';
const P=(d,fill='none',stroke=ink,w=4.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const E=(x,y,rx,ry,fill,stroke=ink,w=4.5)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const shadow=(x,y,rx,ry)=>`<ellipse data-contact-shadow="base" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}" opacity=".16"/>`;
function svg(src,w,h,b){fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linejoin="round" stroke-linecap="round">${b}</svg>\n`);}
const art=read(A+'art.json');
// Retire both central mosaics and the freestanding wishing well, keep village mosaics.
art.flats=art.flats.filter(p=>!['detail/piazza-mosaic.svg','detail/rose-inlay.svg','centre-A/paving.svg'].includes(p.src));
art.props=art.props.filter(p=>p.id!=='centre-wishing-well'&&!p.id.startsWith('centre-A-'));
fs.mkdirSync(A+'centre-A',{recursive:true});
let floor=E(1160,850,1160,850,'#f7dc88','none')+E(1160,850,1124,823,'none','#e4c567',4);
// Three quiet courses and a few short joints, no high-contrast radial medallion.
for(const [rx,ry]of [[930,680],[700,510]])floor+=E(1160,850,rx,ry,'none','#d8b96f',2.5);
for(let i=0;i<20;i++){const a=i*Math.PI/10;floor+=P(`M${1160+934*Math.cos(a)} ${850+683*Math.sin(a)}L${1160+1122*Math.cos(a)} ${850+821*Math.sin(a)}`,'none','#d8b96f',2.5);}
svg('centre-A/paving.svg',2320,1700,floor);
art.flats.unshift({id:'centre-A-paving',name:'Quiet round stone piazza',src:'centre-A/paving.svg',x:2940,y:1640,width:2320,height:1700,topLeft:true});
const solids=[];
function prop(id,name,src,x,y,width,height,extra={}){let p={id:'centre-A-'+id,name,src:'centre-A/'+src,x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false,flip:false,...extra};art.props.push(p);return p;}
// Big round stone basin. The raised island is part of this one grounded structure.
let b=shadow(480,589,451,23)+P('M28 300Q480 640 932 300V367C932 693 28 693 28 367Z',shade)+E(480,300,452,284,cream)+E(480,300,415,250,'#67bcc3');
b+=P('M28 300C28 677 932 677 932 300','none',ink)+P('M29 348C100 660 860 660 931 348','none','#ad874b',3);
for(const x of [100,240,390,570,720,860]){const y=367+Math.sqrt(Math.max(0,1-((x-480)/452)**2))*250;b+=P(`M${x} ${y-23}v35`,'none','#ad874b',3);}
b+=P('M300 280Q480 392 660 280V333Q480 454 300 333Z',stone)+E(480,280,180,102,cream)+E(480,280,162,85,'#a7b65b');
for(const [x,y,c]of [[355,286,'#f4c84c'],[388,320,'#fff0c7'],[570,311,'#d9753d'],[602,271,'#f4c84c']]){b+=P(`M${x} ${y+18}v-20`,'none',green,4);for(let j=0;j<5;j++)b+=E(x+Math.cos(j*1.257)*10,y+Math.sin(j*1.257)*8,7,6,c,ink,2);b+=E(x,y,4,4,shade,ink,2);}
svg('centre-A/fountain.svg',960,650,b);
const water={centre:{x:480,y:300},pool:{x:480,y:300,rx:395,ry:234},minPoolY:405,minDropY:245,spray:null,cleanArtwork:false,sprayRate:18,spills:[{start:118,x:160,bottom:345,w:10,jet:{y:345,cx:135,cy:120}},{start:842,x:800,bottom:345,w:10,jet:{y:345,cx:825,cy:120}},{start:460,x:500,bottom:514,w:12,jet:{y:514,cx:480,cy:310}}]};
prop('fountain','Olive island stone fountain','fountain.svg',4100,2720,960,650,{anchor:{x:.5,y:300/650},sortY:2730,fountainWater:water,contact:false});
solids.push({id:'centre-A-fountain',x:4100,y:2720,rx:452,ry:284});
// Enlarge the original olive by authoring its coordinates at the actual placed size.
let olive=oliveSVGBody().replace(/<ellipse[^>]*data-contact-shadow="olive"\/>/,'');
olive=olive.replace(/d="([^"]+)"/g,(_,d)=>'d="'+d.replace(/-?\d*\.?\d+/g,n=>+(Number(n)*1.7).toFixed(2))+'"').replace(/\b(cx|rx)="([^"]+)"/g,(_,k,n)=>`${k}="${+(Number(n)*1.7).toFixed(2)}"`).replace(/\b(cy|ry)="([^"]+)"/g,(_,k,n)=>`${k}="${+(Number(n)*1.7).toFixed(2)}"`);
svg('centre-A/olive.svg',714,765,shadow(357,748,78,12)+olive);
Object.assign(art.props.find(p=>p.id==='cloister-olive-well'),{src:'centre-A/olive.svg',x:4100,y:2700,width:714,height:765,trunk:[357,748],anchor:{x:.5,y:748/765},sortY:2740,shadow:false,contact:false,rasterPool:undefined});
// Upright cafe sets, broad umbrella canopy, two chairs and a small round table.
for(const [i,tone]of ['#d9753d',green].entries()){
 let s=shadow(150,270,128,17);
 for(const x of [46,254])s+=P(`M${x-21} 258v-74q21 -28 42 0v74M${x-24} 230h48v15h-48Z`,'#d3a459')+P(`M${x-18} 245v29M${x+18} 245v29`,'none',ink,5);
 s+=P('M150 131V246','none',ink,7)+P('M133 266h34M150 215v51','none',green,8)+E(150,216,74,30,cream);
 s+=P('M9 106Q36 47 150 19Q264 47 291 106Q259 130 220 107Q184 131 150 109Q114 131 80 107Q42 131 9 106Z',cream);
 s+=P('M9 106Q39 50 150 19Q95 66 80 107Q42 131 9 106Z',tone)+P('M150 19Q202 68 220 107Q184 131 150 109Z',tone)+E(150,17,5,7,shade);
 s+=E(163,202,12,6,cream,ink,2)+P('M151 193h24v11q-12 13 -24 0Z',cream,ink,2);
 svg(`centre-A/cafe-${i}.svg`,300,290,s);
}
for(const [i,x,y,c]of [[0,3450,2510,1],[1,3450,3150,0],[2,4950,2570,0],[3,4850,3170,1]]){prop('cafe-'+i,'Cafe table and umbrella',`cafe-${c}.svg`,x,y,300,290);solids.push({id:'centre-A-cafe-'+i,x,y:y-28,rx:125,ry:55});}
let stall=shadow(165,307,143,12)+P('M29 113H301V288H29Z',stone)+P('M37 124H293V232H37Z','#526e44')+P('M20 230H310V249H20Z',cream)+P('M29 249H301V295H29Z','#d3a459');
for(const x of [82,137,192,247])stall+=P(`M${x} 250V293`,'none',shade,3);
stall+=P('M19 113L53 51H276L313 113Z','#d9753d');
for(const x of [54,130,206])stall+=P(`M${x} 52H${x+38}L${x+45} 113H${x-9}Z`,cream);
stall+=P('M19 113H313V137Q291 153 268 137Q242 153 219 137Q192 153 168 137Q143 153 119 137Q93 153 69 137Q43 153 19 137Z',cream);
for(const x of [72,120,220])stall+=E(x,217,17,7,cream,ink,2)+P(`M${x-14} 197h28v18q-14 15 -28 0Z`,cream,ink,2);
svg('centre-A/cafe-stall.svg',330,330,stall);prop('stall','Piazza cafe stall','cafe-stall.svg',3070,2440,330,330);solids.push({id:'centre-A-stall',x:3070,y:2415,rx:139,ry:49});
let pot=shadow(62,153,48,9)+P('M17 95H107L98 137Q62 166 26 137Z','#ce8741')+E(62,95,47,16,stone);
for(const [x,y]of [[35,64],[65,48],[88,65],[52,80]]){pot+=P(`M62 102L${x} ${y}`,'none',green,5);for(let j=0;j<5;j++)pot+=E(x+Math.cos(j*1.257)*10,y+Math.sin(j*1.257)*10,8,7,j%2?'#f4c84c':'#d9753d',ink,2.5);pot+=E(x,y,4,4,shade,ink,2);}
svg('centre-A/planter.svg',124,168,pot);
for(const [i,x,y]of [[0,3500,2290],[1,4720,2290],[2,3530,3050],[3,4650,3070],[4,3750,3290],[5,4540,3280]]){prop('planter-'+i,'Flower pot','planter.svg',x,y,124,168);solids.push({id:'centre-A-planter-'+i,x,y:y-24,rx:41,ry:23});}
let lamp=shadow(43,295,31,8)+P('M21 282H65L61 295H25Z',green)+P('M37 282V83H49V282Z',green)+P('M21 56L43 33L65 56L61 92H25Z',green)+P('M28 59H58L54 82H32Z','#f4d270')+E(43,30,5,7,green);
svg('centre-A/lamp.svg',86,308,lamp);
for(const [i,x,y]of [[0,3240,2380],[1,4960,2380],[2,3250,3020],[3,5030,2910]]){prop('lamp-'+i,'Piazza lamp post','lamp.svg',x,y,86,308);solids.push({id:'centre-A-lamp-'+i,x,y:y-15,rx:20,ry:13});}
let lights=P('M8 14Q230 153 452 14','none',ink,4);
for(let i=0;i<9;i++){const x=20+i*52,y=14+69.5*(1-((x-230)/222)**2);lights+=P(`M${x} ${y}v12`,'none',ink,3)+E(x,y+18,7,9,'#f4d270',ink,2.5);}
svg('centre-A/lights.svg',460,115,lights);
prop('lights-left','Cafe string lights','lights.svg',3470,2220,460,115,{contact:false,sortY:3350});prop('lights-right','Cafe string lights','lights.svg',4730,2220,460,115,{contact:false,sortY:3350});
// Keep Home's authored directional bench artwork. Never rotate sprites.
const benchPositions=[[3520,2800],[4680,2800],[3820,3160],[4380,3160]],oldBench=[];
for(const [i,[x,y]]of benchPositions.entries()){let p=art.props.find(p=>p.id==='cloister-bench-'+(i+1));oldBench.push([p.id,x-p.x,y-p.y]);const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;p.bench.target=[4100,2720];p.bench.seat.x+=dx;p.bench.seat.y+=dy;}
// Bring a few existing Home autumn trees inward as a composed lawn frame.
const trees=[['b2-clump-13-1',5180,3370],['life-inner-north-east-shade-tree-0',5430,1800],['life-inner-north-east-shade-tree-1',5350,2490]];
const moved=[];for(const [id,x,y]of trees){const p=art.props.find(p=>p.id===id);moved.push([id,x-p.x,y-p.y]);p.x=x;p.y=y;const shadow=art.flats.find(f=>f.id==='life-'+id+'-shadow');if(shadow){shadow.x=x-shadow.width/2;shadow.y=y-16;}}
for(const file of ['world.json','walk-world.json']){const w=read(D+file);w.obstacles=w.obstacles.filter(o=>!['centre-olive-trunk','centre-well-solid'].includes(o.id)&&!o.id?.startsWith('centre-A-'));for(const [id,dx,dy]of [...oldBench,...moved]){const o=w.obstacles.find(o=>o.id===id);if(o){o.x+=dx;o.y+=dy;}}w.obstacles.push(...solids);if(file==='world.json')w.props=art.props;save(D+file,w);}
art.raster.enabled=false;save(A+'art.json',art);
segmentedArcades();
rebuildPaths();
for(const src of new Set(art.ground.tiles.map(t=>t.src).filter(s=>s.endsWith('.svg')))){const file=A+src;fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/#93b72f/gi,'#a2b542').replace(/#9bbd3b/gi,'#aabc50'));}
await applyGrass();
const metrics=read('scripts/bigger-cathedral/centre-art-metrics.json');
Object.assign(metrics,{piazza:{x:4100,y:2490,rx:1160,ry:850},keptWell:null,olive:art.props.find(p=>p.id==='cloister-olive-well'),fountain:art.props.find(p=>p.id==='centre-A-fountain'),footprints:read(D+'world.json').obstacles.filter(o=>o.id?.startsWith('centre-')).length});
save('scripts/bigger-cathedral/centre-art-metrics.json',metrics);
console.log('Olive Fountain Piazza installed');
