import {readFileSync,writeFileSync} from 'node:fs';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const A='public/pixi-art/themes/pink/', D='assets/world/themes/pink/', R='../concepts/themes/work/pink/';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,o)=>writeFileSync(p,JSON.stringify(o,null,1)+'\n');
const art=read(R+'close-base-art.json'),world=read(R+'close-base-world.json'),walk=read(R+'close-base-walk.json');
const ink='#39472D',cream='#FFF0C7',rose='#F5A3C7',joint='#AF9069',round=n=>Math.round(n*100)/100;
const pt=(x,y)=>`${round(x)} ${round(y)}`;
const path=(ps,fill,stroke=joint,sw=.9)=>`<path d="M${ps.map(([x,y])=>pt(x,y)).join(' L')} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
function heart(x,y,s,fill=rose){return `<path d="M${pt(x,y+s*.38)} C${pt(x-s*.1,y+s*.2)} ${pt(x-s*.58,y-s*.05)} ${pt(x-s*.46,y-s*.29)} C${pt(x-s*.36,y-s*.52)} ${pt(x-s*.1,y-s*.48)} ${pt(x,y-s*.26)} C${pt(x+s*.1,y-s*.48)} ${pt(x+s*.36,y-s*.52)} ${pt(x+s*.46,y-s*.29)} C${pt(x+s*.58,y-s*.05)} ${pt(x+s*.1,y+s*.2)} ${pt(x,y+s*.38)}Z" fill="${fill}" stroke="${joint}" stroke-width="1.5"/>`;}
function bow(x,y,s){return `<g transform="translate(${x} ${y})"><path d="M0 0 Q${-s} ${-s*.65} ${-s} 0 Q${-s} ${s*.55} 0 0 Q${s} ${-s*.65} ${s} 0 Q${s} ${s*.55} 0 0" fill="${rose}" stroke="${joint}" stroke-width="1.5"/><ellipse rx="${s*.17}" ry="${s*.14}" fill="${cream}" stroke="${joint}" stroke-width="1.2"/></g>`;}
const floors=[];
function floor(id,x,y,w,h,body){
 const file=`detail/pink-close-${id}.svg`;
 writeFileSync(A+file,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><title>Rosybutton Bay, ${id}, hand set rose and cream paving</title><g stroke-linecap="round" stroke-linejoin="round">${body.join('\n')}</g></svg>`);
 floors.push({id:`pink-close-${id}`,src:file,x,y,width:w,height:h,topLeft:true});
}
const rings=[{id:'plaza',x:4000,y:2833.66,rx:755,ry:540},{id:'cafe',x:2197.7,y:3337.36,rx:574,ry:349},{id:'festival',x:3150,y:3730,rx:407,ry:242},{id:'court',x:4000,y:3004,rx:558,ry:426.78}];
let tiles=0;
for(const ring of rings){
 const {id,x,y,rx,ry}=ring,body=[],pos=(q,a)=>[x+rx*q*Math.cos(a),y+ry*q*Math.sin(a)];
 const ellipse=(q,c,sw)=>`<ellipse cx="${x}" cy="${y}" rx="${rx*q}" ry="${ry*q}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
 body.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#FCEBD6"/>`);
 const bands=[0,.24,.43,.62,.80,.91,.98];
 for(let j=0;j<bands.length-1;j++){
  const q0=bands[j],q1=bands[j+1],n=Math.max(12,Math.round(rx*q1*2*Math.PI/100)),phase=j%2*.5;
  for(let i=0;i<n;i++){
   const a0=(i+phase)*2*Math.PI/n,a1=(i+1+phase)*2*Math.PI/n;
   const ps=[];for(let k=0;k<=6;k++)ps.push(pos(q1,a0+(a1-a0)*k/6));for(let k=6;k>=0;k--)ps.push(pos(q0,a0+(a1-a0)*k/6));
   const palette=j===4?['#F2AFC3','#FBE0CD','#F5C3D0','#FFF0C7']:['#FFF0C7','#F9E3BA','#FCEBD6','#F5D5AC','#FFE8CA'];
   body.push(path(ps,palette[(i*7+j*3)%palette.length]));tiles++;
  }
 }
 body.push(ellipse(.985,ink,2.2),ellipse(.91,ink,1.5),ellipse(.8,cream,3));
 for(let i=0;i<20;i++){const a=(i+.5)*Math.PI/10,[hx,hy]=pos(.855,a);body.push(i%2?bow(round(hx),round(hy),14):heart(hx,hy,30));}
 if(id==='festival'){body.push(`<ellipse cx="${x}" cy="${y}" rx="78" ry="48" fill="${cream}" stroke="${joint}" stroke-width="2"/>`,heart(x,y+4,75));}
 floor(id,x-rx-4,y-ry-4,rx*2+8,ry*2+8,body);
}
for(const [id,x,y,w,h] of [['market',4820,3730,780,180],['harbor',1560,1660,660,170],['road',5800,2730,660,170]]){
 const body=[`<defs><clipPath id="row"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${h/2}"/></clipPath></defs><g clip-path="url(#row)">`];
 for(let j=0;j<4;j++)for(let i=-1;i<13;i++){
  const tx=x-w/2+i*72+(j%2)*36,ty=y-h/2+j*h/4;
  body.push(`<rect x="${tx}" y="${ty}" width="72" height="${h/4}" fill="${['#FCEBD6','#FFF0C7','#F4D6B1','#FAE1BC'][(i+j+8)%4]}" stroke="${joint}" stroke-width=".9"/>`);tiles++;
 }
 body.push('</g>',`<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${h/2}" fill="none" stroke="${ink}" stroke-width="1.8"/>`);
 for(const dx of [-w*.29,0,w*.29])body.push(heart(x+dx,y,25));
 floor(id,x-w/2-3,y-h/2-3,w+6,h+6,body);
}
art.flats.unshift(...floors.filter(f=>f.id!=='pink-close-court'));
art.flats.push(floors.find(f=>f.id==='pink-close-court'));
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
const pathDist=(x,y)=>Math.min(...world.paths.map((p,i)=>Math.min(...p.slice(1).map((b,j)=>seg(x,y,p[j],b)))-world.pathWidths[i]/2));
const map=makeMap('pink',{world,walk,harbor:read(D+'harbor.json'),sleepers:[]});
const beds=resolveSleepSpots(map.baseWalk,art.props,geometry(map.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const safe=(x,y,r,h=0)=>inShape(x,y,{poly:world.coast},0)&&pathDist(x,y)>r+24&&!world.water.some(o=>inShape(x,y,o,r+28))&&!world.obstacles.some(o=>inShape(x,y,o,r+18))&&beds.every(b=>Math.hypot(x-b.x,(y-b.y)*1.3)>r+b.r+55&&!(y>b.y-20&&y-h<b.y+20&&Math.abs(x-b.x)<r+b.r+15));
let pots=0,lamps=0,decals=0;
function rimProp(kind,x,y,zone){
 const isLamp=kind==='lamp',r=isLamp?15:28,h=isLamp?200:110;
 if(!safe(x,y,r,h)||art.props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.4)<p.width*(p.scale??1)*.32+r+18)||art.props.some(p=>p.id?.startsWith('pink-close-')&&Math.hypot(x-p.x,(y-p.y)*1.2)<155))return;
 const p=isLamp?{src:'detail/lamp-heart.svg',width:250,height:696,scale:.29,anchor:{x:.5,y:.98}}:{src:'/pixi-art/detail/street--planter-flowers.svg',width:82,height:122,scale:1,anchor:{x:.5,y:1}};
 art.props.push({...p,id:`pink-close-${kind}-${isLamp?lamps++:pots++}`,name:isLamp?'Heart rim lamp':'Flower planter',x:round(x),y:round(y),zone,shadow:false});
 const o={x:round(x),y:round(y-5),rx:r,ry:isLamp?10:18,craft:'pink-close-rim'};world.obstacles.push(o);walk.obstacles.push(structuredClone(o));return true;
}
for(const ring of [...rings.filter(r=>r.id!=='court'),{id:'picnic',x:2580,y:1030,rx:590,ry:248},{id:'meadow',x:5420,y:1000,rx:550,ry:258}]){
 for(const [kind,target] of [['pot',45],['pot',135],['pot',225],['pot',315],['lamp',90],['lamp',270]]){
  let placed=false;
  for(const shift of [0,-8,8,-16,16,-24,24,-32,32]){
   const a=(target+shift)*Math.PI/180;
   for(const offset of [55,20,-12]){
    const x=ring.x+(ring.rx+offset)*Math.cos(a),y=ring.y+(ring.ry+offset*.75)*Math.sin(a);
    if(rimProp(kind,x,y,ring.id)){placed=true;break;}
   }
   if(placed)break;
  }
 }
 for(let i=0;i<42;i++){
  const a=(i+.31)*2*Math.PI/42,x=ring.x+(ring.rx+40+(i%3)*16)*Math.cos(a),y=ring.y+(ring.ry+35+(i%3)*12)*Math.sin(a);
  if(!safe(x,y,9)||art.flats.some(f=>Math.hypot(x-f.x,y-f.y)<23))continue;
  const kind=i%3===0?'pebble-2':i%3===1?'grass-tuft-2':'flower-dot-3';
  art.flats.push({id:`pink-close-edge-${decals++}`,src:`/pixi-art/decals/${kind}.svg`,x:round(x),y:round(y),width:kind==='pebble-2'?34:38,height:kind==='pebble-2'?17:25});
 }
}
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
const finalMap=makeMap('pink',{world,walk,harbor:read(D+'harbor.json'),sleepers:[]});
const resolved=resolveSleepSpots(finalMap.baseWalk,art.props,geometry(finalMap.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
if(resolved.length!==40||resolved.bad.length)throw Error('Sleeper regression: '+JSON.stringify(resolved.bad));
save(R+'pink-close-stats.json',{floors:floors.length,tiles,pots,lamps,edgeDecals:decals,props:art.props.length,flats:art.flats.length,sleepers:resolved.length});
console.log({floors:floors.length,tiles,pots,lamps,edgeDecals:decals,sleepers:resolved.length});
