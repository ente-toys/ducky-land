// Run from the repo root. Rebuild only this lane, preserving current greenery and communities.
import fs from 'node:fs';
import {honeywoodBridge} from './bridges.mjs';
import {rebuildWaterArt} from './water-art.mjs';
import {port} from './water-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',S='scripts/bigger-cathedral/water-source/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),source=read(S+'world.json'),geo=read('scripts/bigger-cathedral/water-geometry.json');
const path=p=>'M'+p.map(q=>q.join(' ')).join('L')+'Z';
const waterShapes=polys=>polys.map((poly,i)=>{const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);return {id:'bellovo-water-'+i,poly,x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,rx:(Math.max(...xs)-Math.min(...xs))/2,ry:(Math.max(...ys)-Math.min(...ys))/2};});
const water=waterShapes(geo.polys);
// Art is generated from the continuous dry/sea contour, including both mouths.
rebuildWaterArt(art);
art.decks=art.decks.filter(d=>!/^deck-(jetty|arch|pond)/.test(d.src)&&!d.src.startsWith('communities/river-bridge-')&&!d.src.startsWith('bridges/'));
const arches=[],walkways=[],rects=[];
for(const b of geo.bridges){
 const br=honeywoodBridge(b);fs.writeFileSync(A+br.deck.src,br.svg);
 art.decks.push(br.deck);
 arches.push({...b,r:24});walkways.push({...b,boatPassUnder:true});
 const len=Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1]),n=Math.ceil(len/20);
 for(let i=0;i<=n;i++){const t=i/n;rects.push({id:'bellovo-'+b.id,x:b.a[0]+(b.b[0]-b.a[0])*t,y:b.a[1]+(b.b[1]-b.a[1])*t,w:b.w,h:b.w});}
}
// Reuse the rope-wrapped quay for the stem and detailed fishing dock for the T head.
fs.copyFileSync('public/pixi-art/themes/sunflower/hamlets/seedwake/timber-fishing-dock.svg',A+'bridges/port-head.svg');
art.decks.push({id:'bellovo-port-stem',src:'bridges/port-dock.svg',x:4479,y:7070,width:242,height:600},{id:'bellovo-port-head',src:'bridges/port-head.svg',x:4380,y:7460,width:440,height:260});
const portWalk={id:'bellovo-port',a:port.foot,b:port.tip,w:port.width};
for(let y=7100;y<=7590;y+=20)rects.push({id:'bellovo-port',x:4600,y,w:140,h:140});
rects.push({id:'bellovo-port-head',x:4600,y:7560,w:400,h:140});
for(const m of [world,walk]){m.water=water;m.bridges=rects;m.walkways=[...walkways,portWalk];}
walk.water=waterShapes(geo.collisionPolys);
world.arches=arches;world.boatWater=geo.polys;
world.riverMouths=[{x:1030,y:-800,rx:420,ry:420},{x:6200,y:6700,rx:400,ry:500}];
// No movement of the original residents: makeMap resolves the approved 40 from their original data.
world.sleepSpots=source.sleepSpots;
const harbor={...read(S+'harbor.json'),jetty:{...port,boats:undefined,art:true},boats:port.boats,water:{x:4780,y:7570}};
art.props=art.props.filter(p=>!p.id?.startsWith('bellovo-port-'));
art.props.push({id:'bellovo-port-crate',name:'Dock supplies',src:'reuse/supply-crates.svg',x:4480,y:7560,width:75,height:70,anchor:{x:.5,y:1}},{id:'bellovo-port-lantern',name:'Dock lantern',src:'reuse/street--lamp-lantern.svg',x:4740,y:7550,width:32,height:100,anchor:{x:.5,y:1}});
world.props=art.props;save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'harbor.json',harbor);
console.log(JSON.stringify({bridges:geo.bridges.length,mouths:2,portBoats:harbor.boats.length,waterPolygons:water.length}));
