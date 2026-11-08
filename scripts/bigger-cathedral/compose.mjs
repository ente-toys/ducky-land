import fs from 'node:fs';
import sharp from 'sharp';
import {A,OUT,plan,coast,svg,el,path,dpath,roadShape,ink,cream,sand,grass,house,garden,workshop,furniture,smooth} from './design.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const baseline='scripts/bigger-cathedral/baseline/',D='rive/web/themes/cathedral/';
let art=read(baseline+'art.json'),world=read(baseline+'world.json'),walk=read(baseline+'walk-world.json');
const oldWorld=structuredClone(world),oldWalk=structuredClone(walk),oldArt=structuredClone(art);
// This pier was originally drawn by the engine from harbor.json, rather than the art manifest.
// Keep its exact old artwork when the active arrival harbour moves to the southern village.
art.decks.push({src:'deck-jetty-0.svg',x:2860,y:250,width:280,height:1020});
const {origin:o,width:W,height:H}=plan;
const oldMask=path(oldWorld.coast,'white')+oldWorld.islets.map(([x,y,rx,ry])=>el(x,y,rx,ry,'white')).join('');
const oldBody=fs.readFileSync(baseline+'ground.svg','utf8').replace(/^.*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
// The original dry island is drawn unchanged, above the extension. Its old sea foam is outside this mask.
const defs=`<defs><clipPath id="extension-land">${path(coast,'white')}</clipPath><mask id="extension" maskUnits="userSpaceOnUse" x="${o.x}" y="${o.y}" width="${W}" height="${H}"><rect x="${o.x}" y="${o.y}" width="${W}" height="${H}" fill="white"/>${oldMask.replaceAll('white','black')}</mask><clipPath id="original">${oldMask}</clipPath><pattern id="meadow" width="211" height="167" patternUnits="userSpaceOnUse"><path d="M16 35l3 -9l5 10m73 31l-4 -7m58 68l4 -9l5 8m-110 23l4 -3" fill="none" stroke="#769937" stroke-width="2" opacity=".36"/><ellipse cx="139" cy="37" rx="18" ry="4" fill="#B2C855" opacity=".25"/><ellipse cx="59" cy="114" rx="13" ry="3" fill="#C2D276" opacity=".25"/></pattern></defs>`;
let ground=path(coast,'none','#B9EAF0',150)+path(coast,'none','#E2F5E5',90)+path(coast,sand,ink,5);
// The shore's grass bank follows a slightly inset coastline, leaving a generous sandy walk.
const inset=coast.map(([x,y])=>[4100+(x-4100)*.958,2750+(y-2750)*.955]);
ground+=path(inset,grass,'#9AA854',10)+path(inset,'url(#meadow)');
const roads=plan.roads.map(r=>({...r,...roadShape(r)}));
const insideOtherRoad=(x,y,id)=>roads.some(r=>r.id!==id&&inPoly(x,y,r.poly))||plan.communities.some(c=>((x-c.x)/390)**2+((y-c.y)/250)**2<1);
const squares=plan.communities.map(c=>el(c.x,c.y,380,240,sand));
let banks='',fills='',texture='',verge='';
for(const r of roads){banks+=`<g transform="translate(0 9)" opacity=".20">${path(r.poly,'#746C39','#746C39',18)}</g>`+path(r.poly,'#687D35','#53672D',13);fills+=path(r.poly,sand);let p=r.p;
 // Worn ruts follow the road, with broken lighter sand inside the broad irregular banks.
 texture+=`<path d="${dpath(p,false)}" fill="none" stroke="#C7AA62" stroke-width="10" stroke-dasharray="83 33 38 120 49 61" opacity=".48" stroke-linecap="round"/>`;
 for(let j=5;j<p.length-5;j+=11){let q=p[j],a=p[j-1],b=p[j+1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,n=[-dy/l,dx/l];texture+=el(q[0]+n[0]*r.width*.17,q[1]+n[1]*r.width*.17,23,5,'#FFEAB0');}
 // Irregular overhanging grass lips, small stones and flecks are part of the road drawing.
 for(const [side,edge]of [[1,r.left],[-1,r.right]])for(let j=2;j<edge.length-2;j++){let [x,y]=edge[j],a=p[j-1],b=p[j+1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,ox=-dy/l*side,oy=dx/l*side;
   if(insideOtherRoad(x,y,r.id))continue;
   // A scallop straddles the bank, overlapping the road only on its inner side.
   const tuft=j%3===0?'l5 10l2 -7l6 8l9 -5l3 9':'q9 13 24 5';
   // Local Y points out into the raised grass. The low scallop casts shade onto sand.
   verge+=`<g transform="matrix(${dx/l} ${dy/l} ${ox} ${oy} ${x} ${y})"><path d="M-28 3Q-23 -14 -6 -11Q10 -14 28 0Q18 7 0 9Q-18 10 -28 3" fill="#766D3C" opacity=".22"/><path d="M-29 5Q-25 -5 -13 -5Q-6 -10 0 -4${tuft}Q31 1 30 10Q18 19 -2 16Q-21 20 -29 5Z" fill="${j%4===0?'#A0B83D':grass}" stroke="#5F7930" stroke-width="1.8"/><path d="M-17 6q8 -7 15 -4m10 6l4 -7l4 6" stroke="#658536" stroke-width="1.8" fill="none"/></g>`;
   if(j%5===0)texture+=el(x-ox*21,y-oy*21,7,4,'#BDA56C','#968952',1.5)+el(x-ox*31+8,y-oy*31+4,4,3,'#DED0A1','#968952',1);
 }
}
for(const c of plan.communities){banks+=el(c.x,c.y+8,315,212,'#71823A');fills+=el(c.x,c.y,305,205,sand);texture+=el(c.x,c.y,255,148,'none','#DEC382',3);}
ground+=`<g mask="url(#extension)"><g clip-path="url(#extension-land)">${banks}${fills}${texture}${verge}</g></g>`;
// Small authored stone and flower arrangements at junctions, rather than props scattered across lawns.
const dressing=[[5200,340],[450,1790],[7440,3320],[4050,5400],[100,920],[6990,650],[2250,5520],[7450,4610]];
for(const [x,y]of dressing)ground+=`<g mask="url(#extension)">${el(x-150,y+100,42,15,'#A0AB51')}${el(x-150,y+100,11,7,'#C5C391',ink,2)}${el(x-125,y+112,8,5,'#D7D29C',ink,2)}</g>`;
const newBody=defs+`<g mask="url(#extension)">${ground}</g>`;
fs.writeFileSync(A+'communities/ground-extension.svg',svg(W,H,newBody,`${o.x} ${o.y} ${W} ${H}`));
// Extension tiles use half resolution. Original tiles retain full resolution and their exact SVG paths.
art.width=W;art.height=H;art.origin=o;art.ground.tiles=[];
let newPixels=0,oldPixels=0;
for(let y=o.y,row=0;y<o.y+H;y+=1400,row++)for(let x=o.x,col=0;x<o.x+W;x+=1400,col++){
 let w=Math.min(1400,o.x+W-x),h=Math.min(1400,o.y+H-y);
 // Do not allocate textures for sea-only tiles.
 const near=coast.some(([a,b])=>a>=x-180&&a<=x+w+180&&b>=y-180&&b<=y+h+180)||inPoly(x+w/2,y+h/2,coast);
 if(!near)continue;
 const src=`communities/ground-${row}-${col}.svg`;
 fs.writeFileSync(A+src,svg(w,h,newBody,`${x} ${y} ${w} ${h}`));
 art.ground.tiles.push({src,x,y,width:w,height:h,resolution:.5});newPixels+=w*h*.25;
}
// Rasterise each ORIGINAL tile at its original native texture size, then split its pixels.
// This avoids re-rasterising the old vector at different viewport widths, which changes AA.
for(const tile of oldArt.ground.tiles){
 const raster=await sharp(A+tile.src).png().toBuffer();
 const mask=await sharp(Buffer.from(svg(tile.width,tile.height,oldMask,`${tile.x} ${tile.y} ${tile.width} ${tile.height}`))).png().toBuffer();
 const protectedRaster=await sharp(raster).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 for(let half=0;half<2;half++){
  const w=tile.width/2,h=tile.height,x=tile.x+half*w,y=tile.y,src=`communities/preserved-${x}-${y}.png`;
  const buf=await sharp(protectedRaster).extract({left:half*w,top:0,width:w,height:h}).png().toBuffer();
  if((await sharp(buf).stats()).channels[3].max===0)continue;
  fs.writeFileSync(A+src,buf);art.ground.tiles.push({src,x,y,width:w,height:h,resolution:1});oldPixels+=w*h;
 }
}
let obstacles=[];
const add=(id,src,x,y,width,height,foot=null)=>{let p={id,name:id,src:'communities/'+src,x,y,width,height,scale:1,anchor:{x:.5,y:1}};art.props.push(p);if(foot)obstacles.push({x,y:y-foot.ry,rx:foot.rx,ry:foot.ry});return p;};
const themeProp=(id,src,x,y,w,h,foot=null)=>{let p={id,name:id,src,x,y,width:w,height:h,scale:1,anchor:{x:.5,y:1}};art.props.push(p);if(foot)obstacles.push({x,y:y-foot.ry,rx:foot.rx,ry:foot.ry});};
const flat=(src,x,y,w,h)=>art.flats.push({src,x,y,width:w,height:h,topLeft:true});
for(const c of plan.communities){
 for(let v=0;v<5;v++){fs.writeFileSync(A+`communities/home-${c.kind}-${v}.svg`,house(c.kind,v));fs.writeFileSync(A+`communities/garden-${c.kind}-${v}.svg`,garden(c.kind,v));}
 fs.writeFileSync(A+`communities/garden-${c.kind}.svg`,garden(c.kind));
 fs.writeFileSync(A+`communities/work-${c.kind}.svg`,workshop(c.kind));
 fs.writeFileSync(A+`communities/craft-${c.kind}.svg`,furniture(c.kind));
 for(const [i,[x,y]]of c.homes.entries()){
  flat(`communities/garden-${c.kind}-${i}.svg`,x-225,y-50,450,263);
  add(`${c.id}-home-${i}`,`home-${c.kind}-${i}.svg`,x,y,[380,455,335,465,350][i],[350,405,285,385,335][i],{rx:137,ry:47});
  // Low side walls, washing lines and mailboxes are drawn individually in each house's garden.
  obstacles.push({x:x-175,y:y+155,rx:23,ry:8},{x:x+185,y:y+155,rx:18,ry:8});
  themeProp(`${c.id}-porch-${i}`,'detail/terracotta-pot.svg',x+185,y+30,58,85,{rx:20,ry:11});
  themeProp(`${c.id}-garden-${i}`,'reuse/flower-2.svg',x-195,y+65,67,62);
  themeProp(`${c.id}-garden-bush-${i}`,'reuse/bush-2.svg',x+205,y+120,95,74,{rx:26,ry:14});
 }
 const [wx,wy]=c.work.flat();
 add(c.id+'-workplace',`work-${c.kind}.svg`,wx,wy,490,449,{rx:170,ry:58});
 add(c.id+'-shared-craft',`craft-${c.kind}.svg`,c.x+(c.id==='bellpeep'?260:c.id==='crumbbell'?-200:-240),c.y+(c.id==='crumbbell'?320:c.id==='bellpeep'?350:-80),230,173,{rx:85,ry:27});
 themeProp(c.id+'-bench','detail/stone-bench.svg',c.x+(c.id==='olivello'?330:c.id==='bellpeep'?260:270),c.y+(c.id==='olivello'?0:c.id==='bellpeep'?220:-150),190,95,{rx:65,ry:18});
 themeProp(c.id+'-lantern','reuse/street--lamp-lantern.svg',c.x+330,c.y-55,55,170,{rx:12,ry:10});
 themeProp(c.id+'-planter','reuse/street--planter-flowers.svg',c.x-315,c.y+170,100,90,{rx:30,ry:15});
 themeProp(c.id+'-stock','reuse/supply-crates.svg',wx+(c.id==='olivello'?-300:290),wy+(c.id==='olivello'?160:15),130,123,{rx:48,ry:27});
 themeProp(c.id+'-stock-2','reuse/barrel-seeds.svg',wx-285,wy+40,85,111,{rx:30,ry:19});
 // Two shaded corners enclose each neighbourhood's working green without filling its walking room.
 for(const [i,[dx,dy]]of [[c.id==='bellpeep'?-800:-520,c.id==='bellpeep'?180:80],[c.id==='olivello'?-820:500,c.id==='olivello'?850:-310]].entries()){
  themeProp(c.id+'-shade-'+i,'detail/olive-tree.svg',c.x+dx,c.y+dy,325,350,{rx:40,ry:22});
  themeProp(c.id+'-shade-flowers-'+i,'reuse/flower-3.svg',c.x+dx-110,c.y+dy+35,90,80);
 }
 const board=svg(340,150,`<path d="M45 112v35m250 -35v35" stroke="${ink}" stroke-width="9"/><path d="M12 22Q170 0 328 22v85Q170 128 12 107Z" fill="#EEE0A2" stroke="${ink}" stroke-width="4"/><text x="170" y="68" font-size="27" font-family="Georgia" text-anchor="middle" fill="${ink}">${c.name}</text><path d="M112 88h116" stroke="#9C8C54" stroke-width="3"/>`);
 fs.writeFileSync(A+`communities/sign-${c.id}.svg`,board);
 add(c.id+'-sign',`sign-${c.id}.svg`,c.x+285,c.y+320,250,110,{rx:82,ry:9});
 world.zones['community-'+c.id]={x:c.x,y:c.y,rx:650,ry:530,spawn:[c.x+70,c.y+100],name:c.name,people:c.people};
}
// Olive orchard and press yard: fixed working rows beside the growers' homes.
for(const [i,[x,y]]of [[-730,2150],[-560,2050],[-360,2100],[-780,2380],[-600,2300],[-350,2390]].entries())themeProp('olive-working-tree-'+i,'detail/olive-tree.svg',x,y,270,290,{rx:38,ry:20});
// Artisan drying shelves, tile samples, a shared pergola and a harbour repair yard.
themeProp('tessera-pergola','detail/pergola.svg',8530,2920,390,305,{rx:140,ry:24});
themeProp('bell-keepers-olive','detail/olive-tree.svg',3200,100,310,335,{rx:40,ry:22});
themeProp('bell-keepers-olive-2','detail/olive-tree.svg',4600,450,300,324,{rx:40,ry:22});
add('olive-press-yard','craft-olive.svg',-580,2760,300,225,{rx:100,ry:35});
add('mosaic-worktable-2','craft-mosaic.svg',7740,2940,230,173,{rx:85,ry:27});
add('mosaic-worktable-3','craft-mosaic.svg',7870,2880,210,158,{rx:75,ry:25});
add('harbour-boat-repair','craft-harbour.svg',4900,6930,330,248,{rx:110,ry:35});
themeProp('harbour-supplies','reuse/supply-crates.svg',4890,6720,155,145,{rx:50,ry:30});
themeProp('harbour-cafe','reuse/street--umbrella-cafe.svg',4000,6350,230,240,{rx:45,ry:22});
for(const [i,[x,y]]of plan.groves.entries()){
 themeProp('commons-olive-'+i,i%3?'detail/olive-tree.svg':'reuse/tree-2.svg',x,y,i%3?340:280,i%3?365:390,{rx:43,ry:24});
 themeProp('commons-bush-'+i,'reuse/bush-2.svg',x+110,y+40,100,85,{rx:26,ry:13});
 themeProp('commons-flowers-'+i,'reuse/flower-1.svg',x-140,y+50,70,65);
}
fs.writeFileSync(A+'communities/wayfinding.svg',svg(130,180,`<path d="M64 42v132" stroke="#7F623B" stroke-width="9"/><g stroke="${ink}" stroke-width="2"><path d="M14 22h97l12 15l-12 15H14Z" fill="#CFAC63"/><path d="M10 62h97v30H10l-8 -15Z" fill="#93AA59"/><path d="M16 102h95l12 15l-12 15H16Z" fill="#DA9862"/></g><g fill="#39472D" font-family="Georgia" font-size="15" font-weight="bold" text-anchor="middle"><text x="65" y="43">PIAZZA</text><text x="58" y="83">GROVES</text><text x="64" y="123">HARBOUR</text></g>`));
for(const [i,[x,y]]of dressing.entries())themeProp('junction-sign-'+i,'communities/wayfinding.svg',x-220,y+90,95,145,{rx:16,ry:12});
Object.assign(world,{origin:o,width:W,height:H,coast,islets:[],props:art.props,communities:plan.communities.map(c=>({id:c.id,name:c.name,people:c.people,homes:c.homes.length,workplace:c.work.flat()})),paths:[...world.paths,...roads.map(r=>r.p)],pathWidths:[...world.pathWidths,...roads.map(r=>r.width)]});
// The two old garden islets have become inland gardens. Their art and bridges stay in place;
// removing their sea-ring metadata stops surf from running across the new grass.
Object.assign(walk,{origin:o,width:W,height:H,coast,islets:[],obstacles:[...walk.obstacles,...obstacles]});
world.obstacles=[...world.obstacles,...obstacles];
// Southern working harbour is the actual arrival point. Original decks remain untouched on the town roads.
const harbor={jetty:{foot:[4600,7100],tip:[4600,7800],width:140},boats:[{x:4420,y:7490,turn:0},{x:4780,y:7630,turn:0},{x:4420,y:7780,turn:0},
 {x:-1495,y:2300,turn:-Math.PI/2},{x:3600,y:-1795,turn:Math.PI},{x:7240,y:0,turn:Math.PI},
 {x:9800,y:2900,turn:Math.PI/2},{x:7080,y:5770,turn:Math.PI/2},{x:1030,y:5490,turn:-Math.PI/2},{x:660,y:-745,turn:Math.PI}],spawn:[4100,3070]};
// The engine draws the primary harbour's animated pier, so no duplicate artwork is added to art.decks.
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'harbor.json',harbor);
const area=p=>Math.abs(p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
// Discard only this generator's unused intermediate SVG retiles from the working passes.
for(const name of fs.readdirSync(A+'communities'))if(/^original-\d+-\d+\.svg$/.test(name))fs.unlinkSync(A+'communities/'+name);
save('scripts/bigger-cathedral/metrics.json',{oldLandArea:area(oldWorld.coast),newLandArea:area(coast),areaRatio:area(coast)/area(oldWorld.coast),originalProps:oldArt.props.length,newProps:art.props.length-oldArt.props.length,originalGroundMiB:8000*6000*4/2**20,newGroundMiB:(newPixels+oldPixels)*4/2**20,extensionGroundMiB:newPixels*4/2**20,originalRetiledMiB:oldPixels*4/2**20,tileCount:art.ground.tiles.length,maxTile:1500,newObstacles:obstacles.length});
console.log('Composed four communities,',art.props.length-oldArt.props.length,'authored props;',art.ground.tiles.length,'GPU-safe tiles.');
