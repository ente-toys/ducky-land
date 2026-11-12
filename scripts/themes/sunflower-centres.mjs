import {readFileSync, writeFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry, inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots, sleepHalfWidths} from '../../src/pixi/sleep-spots.js';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const save = (p, d) => writeFileSync(p, JSON.stringify(d, null, 1) + '\n');
const round = v => Math.round(v * 10000) / 10000;
const distance = (x, y, a, b) => {
  const dx=b[0]-a[0], dy=b[1]-a[1], t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
};

const requested=process.argv.slice(2);
if(requested.some(t=>!['sunflower','pink'].includes(t)))throw Error('Only sunflower and pink are supported');
for (const theme of requested.length ? requested : ['sunflower', 'pink']) {
  const D=`assets/world/themes/${theme}/`, A=`public/pixi-art/themes/${theme}/`;
  const world=read(D+'world.json'), walk=read(D+'walk-world.json'), harbor=read(D+'harbor.json'), art=read(A+'art.json'), centre=read(A+'centre/centre.json');
  const plaza=world.zones.plaza;
  const scale=theme==='sunflower' ? .65 : .6;
  const origin=theme==='sunflower' ? [plaza.x,plaza.y] : [plaza.x,plaza.y+170];
  const point=([x,y])=>[round(origin[0]+x*scale),round(origin[1]+y*scale)];
  const shape=o=>o.ellipse ? shape(o.ellipse) : o.poly ? {poly:o.poly.map(point)} :
    {x:round(origin[0]+o.x*scale),y:round(origin[1]+o.y*scale),rx:round(o.rx*scale),ry:round(o.ry*scale)};

  const old=theme==='sunflower' ? {x:3880,y:2628.5,rx:300,ry:150} : {x:4000,y:2775,rx:244,ry:99};
  for(const data of [world,walk]) data.obstacles=data.obstacles.filter(o=>o.centre!=='locked' && !Object.entries(old).every(([k,v])=>o[k]===v));
  art.props=art.props.filter(p=>!p.id.startsWith('centre-') && !['sunflower-sundial-0','ribbon-sculpture'].includes(p.id));
  art.flats=art.flats.filter(p=>!p.id?.startsWith('centre-'));
  art.decks=art.decks.filter(p=>!p.id?.startsWith('centre-'));

  const moves=theme==='pink' ? {
    'heart-hedge-9':[3450,2450], 'heart-hedge-10':[4550,2450],
    'lamp-heart-24':[3530,2290], 'lamp-heart-25':[4470,2290],
    'bow-bench-5':[3550,3340], 'bow-bench-6':[4450,3340],
  } : {'lamp-24':[3440,3240], 'lamp-25':[4320,3240]};
  for(const [id,[x,y]] of Object.entries(moves)) {
    const p=art.props.find(p=>p.id===id); if(!p || (p.x===x && p.y===y)) continue;
    for(const data of [world,walk]) for(const o of data.obstacles) {
      if(o.x===p.x && Math.abs(o.y-p.y)<25) {o.x=x;o.y=round(o.y+y-p.y);}
    }
    p.x=x;p.y=y;
  }

  for(const p of centre.pieces) {
    const entry={id:`centre-${p.id}`,src:`centre/${p.file}`,width:round(p.width*scale),height:round(p.height*scale)};
    if(p.layer==='decal' || p.layer==='back') {
      const [x,y]=point([p.x,p.y]);
      (p.layer==='decal' ? art.flats : art.decks).push({...entry,x,y,topLeft:true});
    } else {
      const parent=centre.pieces.find(q=>q.id===p.parent);
      const sortY=p.sortY ?? parent?.sortY ?? p.at[1];
      const [x,y]=point([p.x+p.width/2,sortY]);
      art.props.push({...entry,name:`Centre ${p.id}`,x,y:round(y+(p.layer==='anim' ? .01 : 0)),
        anchor:{x:.5,y:(sortY-p.y+(p.layer==='anim' ? .01/scale : 0))/p.height},
        scale:1,flip:false,shadow:false,sortY:y,centrePiece:p.id});
    }
  }
  const blocked=centre.blocked.map(o=>({...shape(o.ellipse??o),name:o.name,centre:'locked'}));
  for(const data of [world,walk]) data.obstacles.push(...structuredClone(blocked));
  const stairs=centre.stairs.map(s=>({...s,top:point(s.top),bottom:point(s.bottom),
    ...(s.width?{width:round(s.width*scale)}:{widthTop:round(s.widthTop*scale),widthBottom:round(s.widthBottom*scale)})}));
  world.centrePlacement={source:`/pixi-art/themes/${theme}/centre/centre.json`,origin,scale,stairs,
    walkable:centre.walkable.map(shape),blocked};
  plaza.spawn=point(centre.spawn);harbor.spawn=[...plaza.spawn];
  world.sleepAvoid=(world.sleepAvoid??[]).filter(a=>a.name!=='locked centre');
  world.sleepAvoid.push(theme==='sunflower' ? {name:'locked centre',x:origin[0],y:origin[1],rx:850,ry:680} :
    {name:'locked centre',x:origin[0],y:origin[1]-170,rx:720,ry:860});

  for(const a of world.arches)for(const data of [world,walk]){
    const w=data.walkways.find(w=>Math.hypot(w.a[0]-a.a[0],w.a[1]-a.a[1])<1 && Math.hypot(w.b[0]-a.b[0],w.b[1]-a.b[1])<1);
    if(!w)throw Error(`${theme}: arch missing its walkable deck`);
    w.a=[...a.a];w.b=[...a.b];w.w=a.w;
  }

  const map=makeMap(theme,{world,walk,harbor,sleepers:[]}), geo=geometry(map.baseWalk), sizes=sleepHalfWidths();
  let spots=structuredClone(world.sleepSpots);
  const resolve=()=>resolveSleepSpots(map.baseWalk,art.props,geo.walkable,sizes,{spots,avoid:world.sleepAvoid,warn:false});
  const valid=resolve();
  for(const pose of Object.keys(spots)) spots[pose]=spots[pose].filter(s=>valid.some(b=>b.pose===pose && (pose==='nod'?b.tree===s[0]:b.x===s[0]&&b.y===s[1])));
  const want={nod:8,hammock:4,rock:5,leaf:6,book:5,chair:2,wing:6,box:4};
  const onPath=(x,y,r)=>world.paths.some((path,i)=>path.slice(1).some((b,j)=>distance(x,y,path[j],b)<(world.pathWidths?.[i]??158)/2+r*.6+20));
  const open=(x,y,r)=>!onPath(x,y,r) && !world.sleepAvoid.some(a=>inShape(x,y,a,r*.35));
  for(const p of art.props.filter(p=>/tree/i.test(p.name))) {
    if(spots.nod.length>=want.nod) break;
    if(spots.nod.some(s=>s[0]===p.id)||!open(p.x,p.y+14,42))continue;
    if(world.walkways.some(w=>distance(p.x,p.y,w.a,w.b)<w.w/2+200))continue;
    spots.nod.push([p.id,0,spots.nod.length%2===1]);
    if(resolve().bad.length)spots.nod.pop();
  }
  const matches={hammock:/tree/i,rock:/bush|rock/i,leaf:/flower|bush/i,book:/bench|stall|cart|mailbox|cafe/i,
    chair:/lounger|umbrella|parasol|beach/i,wing:/bush|flower|bench/i,box:/house|cart|stall|barn|kiosk/i};
  let seed=931;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  for(const pose of Object.keys(want).filter(p=>p!=='nod')) {
    const anchors=art.props.filter(p=>!p.id.startsWith('centre-')&&matches[pose].test(p.name));
    for(let attempt=0; spots[pose].length<want[pose] && attempt<40000; attempt++) {
      const p=anchors[attempt%anchors.length], angle=rnd()*Math.PI*2, r=p.width*(p.scale??1)/2+sizes[pose]+35+rnd()*200;
      const x=Math.round(p.x+Math.cos(angle)*r), y=Math.round(p.y+Math.sin(angle)*r*.7);
      if(!open(x,y,sizes[pose]))continue;
      spots[pose].push([x,y,Math.cos(angle)<0]);
      if(resolve().bad.length)spots[pose].pop();
    }
    console.log(`${theme}: ${pose} ${spots[pose].length}/${want[pose]}`);
    if(spots[pose].length!==want[pose])throw Error(`${theme}: ${pose} only ${spots[pose].length}/${want[pose]}`);
  }
  const beds=resolve();
  if(beds.length!==40||beds.bad.length)throw Error(`${theme}: invalid beds ${JSON.stringify(beds.bad)}`);
  if(!geo.walkable(...plaza.spawn))throw Error(`${theme}: blocked plaza spawn`);
  world.sleepSpots=spots;
  world.props=art.props;
  save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'harbor.json',harbor);
  console.log(`${theme}: ${centre.pieces.length} locked pieces, ${blocked.length} footprints, ${stairs.length} stairs, ${beds.length} valid sleepers; spawn ${plaza.spawn}`);
}
