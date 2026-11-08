// Build the saved, authored drawing into Pink's production manifests only.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
const S='scripts/bigger-pink/',A='public/pixi-art/themes/pink/',D='rive/web/themes/pink/';
const read=p=>JSON.parse(readFileSync(p)),write=(p,d)=>writeFileSync(p,JSON.stringify(d,null,1)+'\n');
const original=read(S+'original-art.json'),world=read(S+'original-world.json'),walk=read(S+'original-walk.json'),layout=read(S+'layout.json');
const art=structuredClone(original),body=readFileSync(S+'ground-body.svg','utf8');
// Keep the old ground in its own compositing layer. Otherwise SVG painters
// round translucent path edges against the new grass underneath them.
const split=body.indexOf('<ns0:g'),outer=body.slice(0,split),inner=body.slice(split);
if(split<0)throw Error('Original ground group missing');
const svg=(content,x,y,w,h,tw=w,th=h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="${x} ${y} ${w} ${h}">${content}</svg>`;
writeFileSync(A+'expansion/outer-ground.svg',svg(outer,-2600,-1900,13200,9800));
writeFileSync(A+'expansion/original-ground.svg',svg(inner,0,0,8000,5800));
const bounds={width:layout.width,height:layout.height,origin:layout.origin,coast:layout.coast};
Object.assign(world,bounds);Object.assign(walk,bounds);Object.assign(art,{width:layout.width,height:layout.height,origin:layout.origin});
world.obstacles.push(...layout.obstacles);walk.obstacles.push(...layout.obstacles);
world.props.push(...layout.props);art.props.push(...layout.props);
// Each old zone and its spawn remains identical. New courts get open arrival points.
for(const p of layout.places)world.zones['bigger-'+p.id]={x:p.x,y:p.y,spawn:p.arrival,name:p.name};
world.paths.push(...layout.paths);world.pathWidths.push(...layout.pathWidths);
for(const target of [world,walk]) {target.water.push(...(layout.water??[]));target.bridges.push(...(layout.bridges??[]));}
art.decks.push(...(layout.decks??[]));
// Crop the same source into GPU-safe tiles. The original 0..8000 x 0..5800
// region retains one texture pixel per world unit. Outer lawns use half density.
const xs=[-2600,-1300,0,1333,2666,4000,5333,6666,8000,9300,10600],ys=[-1900,-950,0,1450,2900,4350,5800,6850,7900];
art.ground={tiles:[]};mkdirSync(A+'expansion/tiles',{recursive:true});
for(let r=0;r<ys.length-1;r++)for(let c=0;c<xs.length-1;c++){
 const x=xs[c]-2,y=ys[r]-2,width=xs[c+1]-x+2,height=ys[r+1]-y+2;
 const k=.5;
 const src=`expansion/tiles/r${r}-c${c}.svg`;
 writeFileSync(A+src,svg(outer,x,y,width,height,Math.ceil(width*k),Math.ceil(height*k)));
 art.ground.tiles.push({src,x,y,width,height,resolution:1});
}
for(let r=2;r<6;r++)for(let c=2;c<8;c++){
 const x=xs[c]-2,y=ys[r]-2,width=xs[c+1]-x+2,height=ys[r+1]-y+2,src=`expansion/tiles/original-r${r}-c${c}.svg`;
 writeFileSync(A+src,svg(inner,x,y,width,height));
 art.ground.tiles.push({src,x,y,width,height,resolution:1});
}
// East-facing timber marina, its foot and tip visible in the same coordinates
// as the interactive jetty. Old ornamental piers/bridges remain untouched.
const foot=[9560,2850],tip=[10240,2850],width=120;
let deck='<path d="M9530 2800L10260 2800V2920H9530Z" fill="#bb8654" stroke="#805c56" stroke-width="5"/>';
for(let x=9540;x<=10250;x+=30)deck+=`<path d="M${x} 2804V2916" stroke="#805c56" stroke-width="2"/><path d="M${x+5} 2809V2910" stroke="#fcebd6" stroke-width="2" opacity=".6"/>`;
for(const x of [9580,9790,10010,10220])for(const y of [2800,2920])deck+=`<path d="M${x-7} ${y-30}v45h14v-45" fill="#98683f" stroke="#805c56" stroke-width="3"/><ellipse cx="${x}" cy="${y-30}" rx="10" ry="6" fill="#fcebd6" stroke="#805c56" stroke-width="3"/>`;
writeFileSync(A+'expansion/marina-jetty.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="180" viewBox="9520 2760 760 180">${deck}</svg>`);
art.decks.push({src:'expansion/marina-jetty.svg',x:9520,y:2760,width:760,height:180});
const harbor={jetty:{foot,tip,width},boats:[{x:10000,y:2700,turn:Math.PI/2},{x:10200,y:2700,turn:Math.PI/2},{x:10200,y:3040,turn:Math.PI/2}],spawn:read(S+'original-harbor.json').spawn};
// Named beach berths sampled against actual geometry, never decorative scatter.
const map=makeMap('pink',{world,walk,harbor}),nav=map.nav();
const wet=(x,y)=>!map.landAt(x,y)&&Array.from({length:16},(_,i)=>i*Math.PI/8).every(a=>!map.landAt(x+Math.cos(a)*55,y+Math.sin(a)*55));
for(const index of [15,27,50,72,90]){
 const p=layout.coast[index],q=layout.coast[(index+1)%layout.coast.length],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);
 let berth=null;
 for(const sign of [-1,1])for(const distance of [105,130,155,180]){
  const x=Math.round(p[0]+dy/len*distance*sign),y=Math.round(p[1]-dx/len*distance*sign);
  if(wet(x,y)&&nav.nearest(x,y,250)){berth={x,y,turn:Math.atan2(dx,-dy)};break;}
 }
 if(!berth)throw Error('No safe beach berth at coast '+index);harbor.boats.push(berth);
}
for(const p of layout.props)if(!inPoly(p.x,p.y,layout.coast))throw Error('Offshore prop '+p.id+' '+p.x+','+p.y);
write(A+'art.json',art);write(D+'world.json',world);write(D+'walk-world.json',walk);write(D+'harbor.json',harbor);
const before=original.ground.tiles.reduce((s,t)=>s+t.width*t.height*4,0)/1048576;
const after=art.ground.tiles.reduce((s,t)=>{const text=readFileSync(A+t.src,'utf8'),m=text.match(/width="([\d.]+)" height="([\d.]+)"/);return s+Number(m[1])*Number(m[2])*4;},0)/1048576;
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2);
write(S+'build-metrics.json',{groundRGBA_MiB:{before,after,withMipmapsAfter:after*4/3},tiles:art.ground.tiles.length,originalProps:original.props.length,newProps:layout.props.length,originalFlats:original.flats.length,landAreaRatio:area(layout.coast)/area(read(S+'original-world.json').coast),boats:harbor.boats});
console.log('Pink built:',layout.places.length,'places,',layout.props.length,'new props;',before.toFixed(1),'->',after.toFixed(1),'MiB ground');
