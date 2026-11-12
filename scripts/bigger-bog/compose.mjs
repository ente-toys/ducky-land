import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import sharp from 'sharp';
import {plan,original,base,out,fitted} from './design.mjs';
import {terrainSVG,waters,bridgeArt,bridgeSVG} from './terrain.mjs';
if(!existsSync(out+'/bog-communities.png'))throw Error('Draw and review the community plan before building.');
const art=structuredClone(original.art),world=structuredClone(original.world),walk=structuredClone(original.walk);
const tiles=[];
writeFileSync(`${base}/terrain-master.svg`,terrainSVG(plan.origin.x,plan.origin.y,plan.width,plan.height));
// Ground SVGs remain exact source art. New transparent terrain sits underneath.
// Trim empty margins from each <=1200 world-unit tile; no giant GPU textures.
for(let y=plan.origin.y;y<plan.origin.y+plan.height;y+=1200)for(let x=plan.origin.x;x<plan.origin.x+plan.width;x+=1200){
 const w=Math.min(1200,plan.origin.x+plan.width-x),h=Math.min(1200,plan.origin.y+plan.height-y),pw=Math.round(w*.5),ph=Math.round(h*.5);
 const buf=await sharp(Buffer.from(terrainSVG(x,y,w,h))).resize(pw,ph).png().toBuffer(),stats=await sharp(buf).stats();if(stats.channels[3].max===0)continue;
 const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=pw,y0=ph,x1=0,y1=0;
 for(let py=0;py<ph;py++)for(let px=0;px<pw;px++)if(data[(py*pw+px)*4+3]){x0=Math.min(x0,px);y0=Math.min(y0,py);x1=Math.max(x1,px);y1=Math.max(y1,py);}
 const src=`communities/ground-${(y-plan.origin.y)/1200}-${(x-plan.origin.x)/1200}.png`;
 await sharp(buf).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toFile('public/pixi-art/themes/bog/'+src);
 // PNG native pixels are the intended texture size. Resolution 1 prevents an upsample at load.
 tiles.push({src,x:x+x0*2,y:y+y0*2,width:(x1-x0+1)*2,height:(y1-y0+1)*2,resolution:1,community:true,nativePixels:[x1-x0+1,y1-y0+1]});
}
// Original 2000-unit SVGs rasterize at .7, exactly 1400 px. Keep them byte-for-byte.
tiles.push(...original.art.ground.tiles);
art.width=plan.width;art.height=plan.height;art.origin=plan.origin;art.ground.tiles=tiles;art.props.push(...plan.props);art.decks.push(...bridgeArt);
// Physical harbour deck reaches open sea at Reedwhistle; the previous harbour had no static art.
const harbor={jetty:{foot:[9370,6500],tip:[10070,6500],width:140},spawn:original.harbor.spawn,boats:[{x:9820,y:6740,turn:Math.PI/2},{x:10020,y:6260,turn:Math.PI/2},{x:10120,y:6800,turn:Math.PI/2},{x:-2270,y:3000,turn:-Math.PI/2},{x:7200,y:-2020,turn:Math.PI},{x:7400,y:8040,turn:0}]};
harbor.jetty.foot=fitted(harbor.jetty.foot);harbor.jetty.tip=fitted(harbor.jetty.tip);for(const b of harbor.boats)[b.x,b.y]=fitted([b.x,b.y]);
writeFileSync(`${base}/reedwhistle-pier.svg`,bridgeSVG(630,140));
art.decks.push({id:'reedwhistle-sea-pier',src:'communities/reedwhistle-pier.svg',x:harbor.jetty.foot[0],y:harbor.jetty.foot[1]-70,width:630,height:140,resolution:1,community:true});
const extraWater=[...waters,{id:'kettle-pond',x:fitted([1700,250])[0],y:fitted([1700,250])[1],rx:210,ry:130,community:true},{id:'reed-pond',x:fitted([6200,5480])[0],y:fitted([6200,5480])[1],rx:220,ry:140,community:true}];
for(const w of [world,walk]){
 Object.assign(w,{width:plan.width,height:plan.height,origin:plan.origin,coast:plan.coast});
 w.water.push(...extraWater);w.bridges.push(...plan.bridges);w.obstacles.push(...plan.obstacles);
 w.paths.push(...plan.roads.map(r=>r.pts));w.props.push(...plan.props);
 w.communities=plan.communities.map(c=>({id:c.id,name:c.name,residents:c.who,point:c.point,homes:plan.props.filter(p=>p.neighbourhood===c.id&&p.name.includes(' home ')).map(p=>p.id),workplace:plan.props.find(p=>p.neighbourhood===c.id&&p.name.endsWith('workplace')).id}));
 w.commons=plan.commons.map(c=>({id:c.id,name:c.name,point:c.point,props:plan.props.filter(p=>p.common===c.id).map(p=>p.id)}));
 for(const c of plan.communities)w.zones[c.id]={name:c.name,x:c.point[0],y:c.point[1],spawn:c.point};
}
// Garden fence rails and mailbox posts are solid, with an open central gate.
for(const p of plan.props.filter(p=>p.src==='communities/garden.svg'))for(const [dx,dy,rx,ry]of [[-172,-51,77,10],[172,-51,77,10],[-207,-100,13,12]])for(const w of[world,walk])w.obstacles.push({x:p.x+dx,y:p.y+dy,rx,ry,prop:p.id,community:true});
// Training equipment is walk-through between its small physical contact points.
for(const [x,y,rx,ry]of [[712,30,14,12],[1170,30,14,12],[847,0,38,24],[1030,0,38,24]])for(const w of[world,walk])w.obstacles.push({x:fitted([x,y])[0],y:fitted([x,y])[1],rx,ry,prop:'community-training-equipment',community:true});
for(const [file,data]of [['public/pixi-art/themes/bog/art.json',art],['assets/world/themes/bog/world.json',world],['assets/world/themes/bog/walk-world.json',walk],['assets/world/themes/bog/harbor.json',harbor]])writeFileSync(file,JSON.stringify(data));
const area=p=>Math.abs(p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
const originalBytes=original.art.ground.tiles.reduce((s,t)=>s+Math.ceil(t.width*t.resolution)*Math.ceil(t.height*t.resolution)*4,0);
let newBytes=0;for(const t of tiles){if(t.nativePixels)newBytes+=t.nativePixels[0]*t.nativePixels[1]*4;else newBytes+=Math.ceil(t.width*t.resolution)*Math.ceil(t.height*t.resolution)*4;}
writeFileSync('scripts/bigger-bog/build-metrics.json',JSON.stringify({landAreaBefore:area(original.world.coast),landAreaAfter:area(plan.coast),landRatio:area(plan.coast)/area(original.world.coast),groundTextureMiBBefore:originalBytes/2**20,groundTextureMiBAfter:newBytes/2**20,groundTiles:tiles.length,maxTileUnits:Math.max(...tiles.flatMap(t=>[t.width,t.height])),maxTilePixels:Math.max(...tiles.flatMap(t=>t.nativePixels??[t.width*t.resolution,t.height*t.resolution])),originalPropsPreserved:original.art.props.every(p=>JSON.stringify(art.props.find(n=>n.id===p.id))===JSON.stringify(p)),originalSleepSpotsPreserved:JSON.stringify(world.sleepSpots)===JSON.stringify(original.world.sleepSpots)},null,2));
console.log(readFileSync('scripts/bigger-bog/build-metrics.json','utf8'));
