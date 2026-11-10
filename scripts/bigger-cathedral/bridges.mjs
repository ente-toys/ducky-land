// Fit the approved Honeywood source at its longitudinal stations. Each post and
// cross-board is a rigid source shape, never an affine/skewed copy of the bridge.
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const A='public/pixi-art/themes/cathedral/';
export const HOME='/pixi-art/home-expansion-c/bridges/';
export const PALETTE={'#e4c567':'#F7DC88','#c88941':'#CB7139','#885931':'#8F5033'};
const fmt=n=>+n.toFixed(5);
export function commands(d){
 const tokens=d.match(/[MLQZ]|[-+]?(?:\d*\.\d+|\d+)/g),out=[];let i=0;
 while(i<tokens.length){const op=tokens[i++],count={M:2,L:2,Q:4,Z:0}[op];if(count===undefined)throw Error('Unsupported Home command '+op);out.push([op,tokens.slice(i,i+count).map(Number)]);i+=count;}
 return out;
}
export function honeywoodBridge(b){
 const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1];
 const dir=Math.abs(dy)<Math.abs(dx)*.35?'ew':Math.abs(dx)<Math.abs(dy)*.35?'ns':dx*dy<0?'ne':'nw';
 const ns=dir==='ns',diag=dir==='ne'||dir==='nw';
 const [a,z]=ns?(b.a[1]<b.b[1]?[b.a,b.b]:[b.b,b.a]):diag?(b.a[1]>b.b[1]?[b.a,b.b]:[b.b,b.a]):(b.a[0]<b.b[0]?[b.a,b.b]:[b.b,b.a]);
 const [near,far]=ns?[[120,50],[120,310]]:dir==='ne'?[[91.5,292],[388.5,108]]:dir==='nw'?[[388.5,292],[91.5,108]]:[[30,169.2],[450,169.2]];
 const delta=z.map((n,k)=>n-a[k]-far[k]+near[k]),offset=a.map((n,k)=>n-near[k]);
 const homeSource=HOME+`bridge-${dir}.svg`,source=fs.readFileSync('public'+homeSource,'utf8');
 const doc=new JSDOM(source,{contentType:'image/svg+xml'}).window.document,root=doc.documentElement,paths=[...root.querySelectorAll('path')],points=[];
 paths[0].remove();paths[1].remove(); // Only the source bank sills obstructing the path throats.
 for(const [idx,e]of paths.entries()){
  if(idx<2)continue;
  e.setAttribute('data-home-path',idx);
  const subs=e.getAttribute('d').match(/M[^M]+/g);
  e.setAttribute('d',subs.map((d,subIndex)=>{
   const cmds=commands(d),coords=cmds.flatMap(([,vs])=>vs.flatMap((v,i)=>i%2?[]:[[v,vs[i+1]]])),xs=coords.map(p=>p[0]);
   const post=diag?[2,13].includes(idx):ns?[8,9].includes(idx):[2,11].includes(idx);
   return cmds.map(([op,vs],j)=>{
    const fresh=[];
    for(let pair=0;pair<vs.length/2;pair++){
     const x=vs[pair*2],y=vs[pair*2+1];let t;
     if(diag){
      if(post)t=subIndex/5;
      else if([3,4,6,9,10,14,15].includes(idx))t=op==='M'?0:op==='L'?1:pair===0?.5:j===1?1:0;
      else if(idx===5)t=op==='M'||j===5?0:op==='L'?1:pair===0?.5:j===1?1:0;
      else if(idx===7)t=(subIndex+1)/15;
      else if(idx===8)t=(subIndex+.5)/6;
      else if([11,12].includes(idx))t=0;
      else t=subIndex/5;
     }else if(!ns){
      const center=(Math.min(...xs)+Math.max(...xs))/2;
      t=((post?center:x)-30)/420;
     }else{
      if(post)t=subIndex/5;
      else if(idx===2)t=[0,1,1,0,0][j];
      else if([3,10,11].includes(idx))t=op==='M'?0:op==='L'?1:pair===0?.5:j===1?1:0;
      else if(idx===4)t=(66-Math.min(...xs))/6;
      else if(idx===5){const yy=coords[0][1];t=(-164+Math.sqrt(164**2+384*(yy-50)))/192;}
      else if([6,7].includes(idx))t=1;
      else t=x<120?(66-x)/6:(x-174)/6;
     }
     const p=[x+delta[0]*t,y+delta[1]*t];fresh.push(...p.map(fmt));points.push(p);
    }
    return op+fresh.join(' ');
   }).join(' ');
  }).join(' '));
 }
 for(const e of root.querySelectorAll('*'))for(const attr of ['fill','stroke']){const c=e.getAttribute(attr)?.toLowerCase();if(PALETTE[c])e.setAttribute(attr,PALETTE[c]);}
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),box=[Math.min(...xs)-3,Math.min(...ys)-3,Math.max(...xs)-Math.min(...xs)+6,Math.max(...ys)-Math.min(...ys)+6].map(fmt);
 root.setAttribute('data-home-source',homeSource);root.setAttribute('width',box[2]);root.setAttribute('height',box[3]);root.setAttribute('viewBox',box.join(' '));
 const src=`bridges/home-${b.id}.svg`;
 return {svg:root.outerHTML.split('\n').map(line=>line.trimEnd()).join('\n')+'\n',deck:{id:'bellovo-'+b.id,src,x:fmt(box[0]+offset[0]),y:fmt(box[1]+offset[1]),width:box[2],height:box[3],homeBridge:dir,homeSource,a:b.a,b:b.b,overBoats:true,resolution:2},offset,near,far,delta};
}
export function rebuildBridges(art,geo){
 for(const b of geo.bridges){const fitted=honeywoodBridge(b);fs.writeFileSync(A+fitted.deck.src,fitted.svg);const deck=art.decks.find(d=>d.id===fitted.deck.id);if(!deck)throw Error('Missing crossing '+b.id);Object.assign(deck,fitted.deck);}
 // This custom silhouette is retired; every active crossing reads the Home family.
 if(fs.existsSync(A+'bridges/ns-arch.svg'))fs.unlinkSync(A+'bridges/ns-arch.svg');
}
export function rebuildBridgePhysics(world,walk,geo){
 for(const map of [world,walk])map.arches=geo.bridges.map(b=>({...b,r:24}));
}
if(process.argv[1]?.endsWith('/bridges.mjs')){
 const art=JSON.parse(fs.readFileSync(A+'art.json')),geo=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/water-geometry.json'));
 rebuildBridges(art,geo);fs.writeFileSync(A+'art.json',JSON.stringify(art,null,2)+'\n');
 const D='rive/web/themes/cathedral/',world=JSON.parse(fs.readFileSync(D+'world.json')),walk=JSON.parse(fs.readFileSync(D+'walk-world.json'));
 rebuildBridgePhysics(world,walk,geo);
 for(const [name,map]of [['world',world],['walk-world',walk]])fs.writeFileSync(D+name+'.json',JSON.stringify(map,null,2)+'\n');
 console.log('13 Honeywood spans, rigid upright posts, fixed path anchors, Home 24-unit crown.');
}
