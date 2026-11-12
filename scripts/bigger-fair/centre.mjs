import fs from 'node:fs';
import {applyFairBridges} from './bridges.mjs';
import {inPoly,geometry} from '../../assets/world/island-geometry.mjs';
import {FIT,SLEEP_TREES,SLEEP_POINTS,TREE_CLUMPS} from './centre-data.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/world/home/sleep-spots.js';
import {BENCH_COURTS,placeBench,fitContact} from './furniture.mjs';
const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),old=read('scripts/bigger-fair/original-art.json'),ow=read('scripts/bigger-fair/original-world.json'),layout=read('scripts/bigger-fair/centre-source/layout.json');
const {cx,cy,sx,sy}=FIT,P=([x,y])=>[cx+(x-768)*sx,cy+(y-520)*sy],poly=p=>'M'+p.map(q=>q.join(' ')).join('L')+'Z',inner=ow.coast;
const inside=p=>inPoly(p.x,p.y,inner),mine=p=>/^ac2-|^ring-fence-/.test(p.id??p.name??'');
const gone=old.props.filter(p=>inside(p)&&p.id!=='fair-0');
const goneIds=new Set(gone.map(p=>p.id));
art.props=art.props.filter(p=>!mine(p)&&!goneIds.has(p.id)&&p.id!=='fair-0');
art.flats=art.flats.filter(p=>!inside(p));art.floating=(art.floating??[]).filter(p=>!inside(p));
for(const w of [world,walk]){
 w.obstacles=w.obstacles.filter(o=>!mine(o)&&!inside(o)&&!o.poly?.some(([x,y])=>inside({x,y})));
 w.water=w.water.filter(o=>o.id!=='ac2-lagoon'&&(o.poly||!inside(o)));
 const outer=layout.polygons.lagoon.map(P),islet=layout.polygons.islet.map(P);
 w.water.push(...outer.map((p,i)=>({id:'ac2-lagoon',poly:[p,outer[(i+1)%outer.length],islet[(i+1)%islet.length],islet[i]]})));
 w.islets=[];
}
art.decks=art.decks.filter(d=>d.id!=='ac2-lagoon-bridge');
const inline=file=>fs.readFileSync(A+'ac2/'+file,'utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const flat=o=>/castle-islet-ground|lagoon-lily|plaza-ground/.test(o.file);
function place(o,id='ac2-'+o.id,at=P([o.x,o.y]),scale=sx){
 if(BENCH_COURTS[o.id]){const p=placeBench(o,at,scale);art.props.push(p);return p;}
 const a=(o.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),corners=[[-o.width/2,-o.height],[o.width/2,-o.height],[-o.width/2,0],[o.width/2,0]].map(([x,y])=>[x*c-y*s,x*s+y*c]);
 const x0=Math.min(...corners.map(p=>p[0])),y0=Math.min(...corners.map(p=>p[1])),w=Math.max(...corners.map(p=>p[0]))-x0,h=Math.max(...corners.map(p=>p[1]))-y0;
 const src='ac2/placed-'+id+'.svg';fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"><g transform="rotate(${o.rotation??0}) translate(${-o.width/2} ${-o.height}) scale(${o.width/layout.assets[o.file].width} ${o.height/layout.assets[o.file].height})">${inline(o.file)}</g></svg>`);
 const p=fitContact({id,name:o.file.replace('.svg','').replaceAll('-',' '),src,x:at[0],y:at[1],width:w,height:h,scale,anchor:{x:-x0/w,y:-y0/h},wind:false,shadow:!(/fence|banner/.test(o.file))});art.props.push(p);return p;
}
for(const o of layout.objects.filter(o=>!flat(o)&&!/castle-kept|canal-bridge|islet-bridge|bunting-fence/.test(o.file+' '+o.id))){
 const p=place(o);if(BENCH_COURTS[o.id]){
 for(const w of [world,walk])w.obstacles.push(p.footprint);
 }else if(/ride|carousel|ferris|fountain|balloon-kiosk|bench|flower-box|lamp|banner/.test(o.file)){
 const rx=/ride|carousel|ferris/.test(o.file)?o.width*sx*.32:/balloon-kiosk/.test(o.file)?124:/fountain/.test(o.file)?o.width*sx*.26:/bench|flower/.test(o.file)?o.width*sx*.35:13;
 for(const w of [world,walk])w.obstacles.push({name:p.id,x:p.x,y:p.y-20,rx,ry:/ride|carousel|ferris/.test(o.file)?100:/balloon-kiosk/.test(o.file)?40:/fountain/.test(o.file)?65:20});}
}
const castle={...old.props.find(p=>p.id==='fair-0'),x:P([768,0])[0],y:P([0,284])[1],scale:.94};art.props.push(castle);
for(const w of [world,walk])w.obstacles.push({name:'ac2-castle',x:castle.x,y:castle.y-80,rx:470,ry:140});
const bridge={id:'ac2-lagoon-bridge',a:[3570,1441],b:[3570,1757.4],w:112,boatPassUnder:true};
for(const w of [world,walk]){w.walkways=w.walkways.filter(x=>x.id!==bridge.id);w.walkways.push(bridge);w.bridges=w.bridges.filter(b=>b.id!==bridge.id);w.bridges.push({id:bridge.id,x:cx,y:(bridge.a[1]+bridge.b[1])/2,w:bridge.w,h:bridge.b[1]-bridge.a[1]+80});}
world.arches=world.arches.filter(x=>x.id!==bridge.id);world.arches.push({...bridge,r:80});
const nod=ow.sleepSpots.nod.flatMap(([id,,flip],i)=>{
 if(i===1)return [];
 const p={...old.props.find(p=>p.id===id),x:SLEEP_TREES[i][0],y:SLEEP_TREES[i][1]};
 art.props.push(p);return[[id,0,flip]];
});
for(const [i,clump] of TREE_CLUMPS.entries())for(const [j,t] of clump.entries()){
 if(t.nod!==undefined)continue;
 art.props.push({...old.props.find(p=>p.id===ow.sleepSpots.nod[t.model][0]),id:`ac2-tree-clump-${i}-${j}`,x:t.at[0],y:t.at[1]});
}
for(const p of art.props.filter(p=>/^ac2-tree-clump-/.test(p.id)||nod.some(([id])=>id===p.id)))
 for(const w of [world,walk])w.obstacles.push({name:'ac2-'+p.id,x:p.x,y:p.y-9,rx:31,ry:22});
world.sleepSpots={...structuredClone(SLEEP_POINTS),nod};
world.sleepSpots.leaf.push([...SLEEP_TREES[1],ow.sleepSpots.nod[1][2]]);
world.sleepAvoid=[];
world.zones.plaza={...world.zones.plaza,x:cx,y:P([768,791])[1],spawn:P([768,925])};
const h=read(D+'harbor.json');h.spawn=world.zones.plaza.spawn;save(D+'harbor.json',h);
const placements=read(D+'placements.json').filter(p=>!goneIds.has(p.id)&&!mine(p)&&p.id!=='fair-0');placements.push(...art.props.filter(p=>mine(p)||p.id==='fair-0'||SLEEP_TREES.some(q=>p.x===q[0]&&p.y===q[1])));save(D+'placements.json',placements);
const metadata=read('scripts/bigger-fair/centre-source/outer-props.json');world.props=[...metadata,...art.props.filter(p=>mine(p)||p.id==='fair-0'||ow.sleepSpots.nod.some(s=>s[0]===p.id)).map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,zone:'plaza'}))];
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
const nav=geometry(walk),beds=resolveSleepSpots(world,art.props,(x,y)=>nav.walkable(x,y),sleepHalfWidths(),{spots:world.sleepSpots,warn:false});console.log('Fair AC-2:',art.props.length,'props; sleepers',beds.length,JSON.stringify(beds.bad));

applyFairBridges();
const {rebuildFairSurface}=await import('./paths.mjs');
rebuildFairSurface();
