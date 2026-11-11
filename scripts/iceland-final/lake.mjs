import path from 'node:path';
import {LAKE_ASSETS} from './lake-assets.mjs';
const round=n=>Math.round(n*100)/100;
// Periodic cubic outline, authored as an asymmetric chain of shallow coves.
// Rendering and skating use this same curve, sampled to less than .2 world px.
const knots=[[12,330],[75,250],[200,190],[355,155],[400,100],[480,30],[640,8],[740,65],[720,100],[880,130],[900,170],[1050,205],[1090,290],[1030,320],[1080,420],[1020,490],[960,550],[820,615],[650,630],[550,670],[400,650],[340,590],[180,570],[100,520],[15,480],[40,410]];
export function lakeOutline(){
 let d=`M${knots[0].join(' ')}`,poly=[];
 for(let i=0;i<knots.length;i++){
  const a=knots[(i+knots.length-1)%knots.length],b=knots[i],c=knots[(i+1)%knots.length],e=knots[(i+2)%knots.length];
  const u=[b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6],v=[c[0]-(e[0]-b[0])/6,c[1]-(e[1]-b[1])/6];
  d+=`C${u.map(round).join(' ')} ${v.map(round).join(' ')} ${c.join(' ')}`;
  for(let j=0;j<24;j++){const t=j/24,s=1-t;poly.push([round(s*s*s*b[0]+3*s*s*t*u[0]+3*s*t*t*v[0]+t*t*t*c[0]),round(s*s*s*b[1]+3*s*s*t*u[1]+3*s*t*t*v[1]+t*t*t*c[1])]);}
 }
 return {d:d+'Z',poly};
}
export function composeLake(root,art,w,report){
 const files=new Map(),base='public/pixi-art/themes/snow',dir='final/rink';
 for(const [name,a]of LAKE_ASSETS)files.set(path.join(base,dir,name+'.svg'),a.svg);
 const x=6434.25,y=4776.19,width=1100,height=680,{d,poly}=lakeOutline();
 const retired=p=>p.id==='rink'||p.id==='decorated-pine'||p.scene==='rink-scene'||p.lakePart||/^rink-fence/.test(p.id);
 const retiredIds=new Set([...art.props,...art.flats].filter(retired).map(p=>p.id));
 art.props=art.props.filter(p=>!retired(p));art.flats=art.flats.filter(p=>!retired(p));
 w.obstacles=w.obstacles.filter(o=>!retiredIds.has(o.prop));
 // Existing lane nodes retain their exact joins, now named shore approaches.
 const rename=s=>typeof s==='string'?s.replace('-gate','-shore'):s;
 const shores=w.iceland2.shores??w.iceland2.gates;
 w.iceland2.shores=Object.fromEntries(Object.entries(shores).map(([k,v])=>[rename(k),v]));delete w.iceland2.gates;
 w.iceland2.nodes=Object.fromEntries(Object.entries(w.iceland2.nodes).map(([k,v])=>[rename(k),v]));
 for(const route of w.iceland2.routes){route.ends=route.ends.map(rename);route.id=rename(route.id);}
 const shape={type:'natural-lake',x,y,width,height,poly:poly.map(([px,py])=>[round(x+px),round(y+py)]),heart:[x+550,y+355],exclusions:[]};
 w.iceland2.rink=shape;
 const shell=`<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="740" viewBox="-30 -30 1160 740"><title>Natural frozen lake with continuous snowy shore</title><path id="shore-snow" d="${d}" fill="#a6deec" stroke="#eef3f9" stroke-width="48" stroke-linejoin="round"/><path id="shore-shadow" d="${d}" fill="#a6deec" stroke="#d4dfec" stroke-width="6" stroke-linejoin="round"/><path id="lake-ice" d="${d}" fill="#a6deec"/><path id="light-ice-swirls" d="M165 359C283 273 391 293 472 242M638 511C766 506 884 414 959 363M531 135Q584 108 646 128" fill="none" stroke="#bce6f0" stroke-width="4" stroke-linecap="round"/><g transform="translate(160 175)">${LAKE_ASSETS.get('ice-decal').svg}</g></svg>\n`;
 files.set(path.join(base,dir,'lake.svg'),shell);
 art.flats.push({id:'rink',src:dir+'/lake.svg',x:x-30,y:y-30,width:1160,height:740,topLeft:true,preload:true,resolution:3.5,finalKind:'scene-base',finalRole:'lake-ice',scene:'rink-scene',lakePart:true,shadow:false});
 const add=(role,id,px,py,pw,obstacle=true)=>{
  const a=LAKE_ASSETS.get(role),ph=round(pw*a.height/a.width);
  const p={id:'lake-'+id,name:role,src:dir+'/'+role+'.svg',x:px,y:py,width:pw,height:ph,finalKind:'lake',finalRole:role,scene:'rink-scene',lakePart:true,resolution:4,shadow:false,wind:false,contact:obstacle};art.props.push(p);return p;
 };
 const solid=(p,rx,ry,dx=0,dy=-12)=>w.obstacles.push({prop:p.id,x:p.x+dx,y:p.y+dy,rx,ry});
 const hut=add('warming-hut','warming-hut',6555,4950,320);solid(hut,124,32,0,-29);
 const table=add('mug-table','mug-table',6475,5000,160);solid(table,65,18);
 const pile=add('woodpile','woodpile',6800,4920,130);solid(pile,50,20);
 const sled=add('sled','sled',6890,4930,65);solid(sled,22,13);
 const jetty=add('jetty','jetty',6585,5150,210,false),jx=jetty.x-jetty.width/2,jy=jetty.y-jetty.height,k=jetty.width/240;
 for(const [px,py]of [[28,65],[215,65],[78,109]])w.obstacles.push({prop:jetty.id,x:round(jx+px*k),y:round(jy+(py+25)*k),rx:8,ry:8});
 shape.exclusions.push([[30,55],[174,25],[222,61],[221,72],[79,106],[30,69]].map(([px,py])=>[round(jx+px*k),round(jy+py*k)]));
 for(const [i,px,py,pw]of [[1,6435,5345,132],[2,6640,5445,105],[3,7500,5160,115],[1,7380,4940,110],[2,7115,4730,95],[3,7420,5490,85]]){const p=add('rock-'+i,`rock-${px}`,px,py,pw);solid(p,pw*.4,Math.min(23,pw*.16));}
 for(const [i,px,py,pw]of [[1,6430,5330,85],[2,7490,5140,90],[1,7315,4955,74]])add('reeds-'+i,`reeds-${px}`,px,py,pw,false);
 const bench=add('bench-skates','bench-skates',7360,5535,265);solid(bench,105,24,0,-38);
 const lamp=add('lantern-post','lantern-post',7550,5440,120);solid(lamp,12,12,29,-10);
 // Reuse the approved three pine drawings at their existing Home scale.
 for(const [i,px,py,pw,role]of [[0,6240,4955,210,'pine-large'],[1,6630,4760,195,'pine-medium'],[2,7130,4750,210,'pine-large'],[3,7355,4820,195,'pine-medium'],[4,7530,4930,210,'pine-large']]){
  const source=art.props.find(p=>p.finalRole===role),p={id:'lake-bank-pine-'+i,name:'snowy bank pine',src:source.src,x:px,y:py,width:pw,height:round(pw*source.height/source.width),finalKind:'lake',finalRole:role,scene:'rink-scene',lakePart:true,resolution:4,shadow:false,wind:false};art.props.push(p);solid(p,14,12);
 }
 const scene=report.scenes.find(s=>s.id==='rink-scene');Object.assign(scene,{x:6978.94,y:5113.62,base:'rink',props:art.props.filter(p=>p.scene==='rink-scene').map(p=>p.id),shore:'continuous walkable snow',heart:shape.heart});
 w.zones.rink.spawn=[...shape.heart];
 report.lake={shape:'irregular-rounded',fence:false,shore:'continuous-soft-snow',heart:shape.heart,pieces:[...LAKE_ASSETS.keys()]};
 return files;
}
