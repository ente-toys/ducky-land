import fs from 'node:fs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/neon/bigger/';
const d=ps=>'M'+ps.map(p=>p.map(v=>+v.toFixed(2)).join(',')).join('L')+'Z';
function smooth(ps){const out=[];for(let i=0;i<ps.length-1;i++){const a=ps[Math.max(0,i-1)],b=ps[i],c=ps[i+1],e=ps[Math.min(ps.length-1,i+2)];for(let j=0;j<12;j++){const t=j/12;out.push([0,1].map(k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-e[k])*t*t+(-a[k]+3*b[k]-3*c[k]+e[k])*t*t*t)));}}return [...out,ps.at(-1)];}
function ribbon(points,width){const ps=smooth(points),edges=[[],[]];for(let i=0;i<ps.length;i++){const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;const w=width/2*(1+.14*Math.sin(i*.19));for(let s=0;s<2;s++)edges[s].push([ps[i][0]+dy/l*w*(s?1:-1),ps[i][1]-dx/l*w*(s?1:-1)]);}return [...edges[0],...edges[1].toReversed()];}
function shape(poly,id){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return {id,x:(x0+x1)/2,y:(y0+y1)/2,rx:(x1-x0)/2,ry:(y1-y0)/2,poly};}
export function reviewFixes(old,p){
 const coast=old.world.coast;
 const oldDry=(x,y)=>inPoly(x,y,coast)||old.world.islets.some(([a,b,rx,ry])=>((x-a)/rx)**2+((y-b)/ry)**2<1);
 const outer=coast.map(([x,y],i)=>{const a=coast[(i-1+coast.length)%coast.length],b=coast[(i+1)%coast.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;let reach=235;for(let t=8;t<=235;t+=4)if(oldDry(x+dy/l*t,y-dx/l*t)){reach=t-8;break;}return [x+dy/l*reach,y-dx/l*reach];});
 const water=[];
 for(let start=0;start<coast.length;start+=71){const ix=Array.from({length:Math.min(71,coast.length-start)+1},(_,j)=>(start+j)%coast.length);water.push(shape([...ix.map(i=>coast[i]),...ix.toReversed().map(i=>outer[i])],`old-shore-canal-${start/71}`));}
 const streams=[{id:'clockwater',points:[[6015,565],[6400,450],[6700,150],[6750,-300],[6500,-750],[6350,-1170],[6200,-1780]],width:175},{id:'moonwake-brook',points:[[5100,4460],[5600,4600],[6100,5310],[6650,5500],[7060,5680],[7200,6200]],width:185}];
 for(const s of streams)water.push(shape(ribbon(s.points,s.width),s.id));
 let ground='';
 const bankPaths=[d(outer),d(coast),...water.filter(o=>!o.id.startsWith('old-shore')).map(o=>d(o.poly))];
 for(const path of bankPaths)ground+=`<path d="${path}" fill="none" stroke="#56754a" stroke-width="22"/><path d="${path}" fill="none" stroke="#e1d393" stroke-width="8"/>`;
 for(const o of water)ground+=`<path d="${d(o.poly)}" fill="#69bfd0"/>`;
 for(const [x,y,rx]of [[540,1880,45],[560,2770,38],[1320,3740,36],[2050,3870,48],[3900,4525,60],[5580,4430,40],[7165,2780,40],[7030,1600,30],[5620,500,45],[6700,-390,35],[6600,5400,36]])ground+=`<path d="M${x-rx} ${y}q${rx} 10 ${rx*2} 0m-${rx*1.5} 24h${rx}" fill="none" stroke="#c7f0df" stroke-width="5"/>`;
 for(const [x,y]of [[392,1800],[370,2590],[1050,3660],[2320,4160],[4600,4610],[5580,4530],[7380,3030],[7340,1800],[6220,370],[6870,-400],[6470,-980],[5730,4760],[6820,5540]])ground+=`<g transform="translate(${x} ${y})"><ellipse cx="12" cy="10" rx="39" ry="14" fill="#759a3e"/><path d="M0 9Q-22 -37 -6 -65M10 8Q15 -42 28 -57M16 8Q40 -15 49 -20M2 8Q-34 -17 -40 -26" fill="none" stroke="#587a45" stroke-width="5"/><path d="M-7 -61v-16M28 -53v-15" stroke="#a08d55" stroke-width="9"/><ellipse cx="57" cy="15" rx="17" ry="10" fill="#b8b79a" stroke="#7a8167" stroke-width="3"/></g>`;
 const bridges=[];const decks=[];
 for(const [id,x,y]of [['clockwater-promenade',6700,150],['clockwater-coast',6350,-1170],['moonwake-promenade',6100,5310],['moonwake-coast',7060,5680]]){
  const w=510,h=310;
  fs.writeFileSync(A+id+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><path d="M12 135Q255 57 498 135V254Q255 176 12 254Z" fill="#c69c61" stroke="#685d63" stroke-width="6"/>${Array.from({length:17},(_,i)=>{const x=17+i*29;return `<path d="M${x} ${135-70*Math.sin(x/510*Math.PI)}v117" stroke="#ead099" stroke-width="4"/>`;}).join('')}<path d="M12 97Q255 15 498 97M12 222Q255 140 498 222" fill="none" stroke="#786668" stroke-width="15"/><path d="M12 91Q255 9 498 91M12 216Q255 134 498 216" fill="none" stroke="#efd09a" stroke-width="9"/>${[20,102,184,266,348,430,490].map(x=>`<path d="M${x} ${94-70*Math.sin(x/510*Math.PI)}v47M${x} ${219-70*Math.sin(x/510*Math.PI)}v47" stroke="#87715d" stroke-width="9"/>`).join('')}</svg>`);
  decks.push({src:`bigger/${id}.svg`,x:x-w/2,y:y-h/2,width:w,height:h});bridges.push({id,x,y,w:490,h:120});
 }
 for(const [id,x,y]of [['heart-north',3844,746],['heart-south',3899,4460]]){
  const width=229.2,height=381,left=x-97.6,top=y-height/2;
  const body=fs.readFileSync('public/pixi-art/themes/neon/islet-bridge-1.svg','utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  const black=[`<path d="${d(coast)}" fill="black"/>`,...old.world.islets.map(([a,b,rx,ry])=>`<ellipse cx="${a}" cy="${b}" rx="${rx}" ry="${ry}" fill="black"/>`)].join('');
  fs.writeFileSync(A+id+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="dry-protection" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><g transform="translate(${-left} ${-top})">${black}</g></mask></defs><g mask="url(#dry-protection)"><g transform="translate(-1648.8 -3585.5)">${body}</g></g></svg>`);
  decks.push({src:`bigger/${id}.svg`,x:left,y:top,width,height});bridges.push({id,x,y,w:115,h:390});
 }
 for(const [i,q]of old.world.walkways.slice(0,5).entries()){const x=(q.a[0]+q.b[0])/2,y=(q.a[1]+q.b[1])/2;bridges.push({id:`restored-coastal-${i}`,x,y,w:Math.abs(q.b[0]-q.a[0])+q.w,h:Math.abs(q.b[1]-q.a[1])+q.w});}
 const commons=[{id:'dye-garden',x:700,y:-510,rx:620,ry:290},{id:'clock-orchard',x:7480,y:-230,rx:460,ry:330},{id:'tea-garden',x:7830,y:4300,rx:440,ry:310},{id:'picnic-grove',x:730,y:4720,rx:610,ry:320},{id:'fishing-green',x:4720,y:4740,rx:450,ry:210}];
 let commonsGround='';
 for(const c of commons){const {x,y,rx,ry}=c;commonsGround+=`<path d="M${x-rx} ${y}Q${x-rx*.7} ${y-ry*1.35} ${x+rx*.2} ${y-ry}Q${x+rx*1.3} ${y-ry*.6} ${x+rx} ${y+ry*.35}Q${x+rx*.5} ${y+ry*1.2} ${x-rx*.6} ${y+ry}Q${x-rx*1.2} ${y+ry*.65} ${x-rx} ${y}Z" fill="#a6bd4b" stroke="#7e9f39" stroke-width="8"/>`;}
 for(const [x,y,color]of [[350,-620,'#eea5bd'],[700,-710,'#d2b4da'],[1050,-620,'#f5d36e'],[7590,4130,'#70a258'],[7950,4150,'#6c9b50'],[7700,4490,'#82ad55'],[8080,4440,'#779f4c']]){commonsGround+=`<g transform="translate(${x} ${y})"><path d="M-105 -36Q0 -63 105 -36L115 40Q0 69 -115 40Z" fill="#bb9d6c" stroke="#817351" stroke-width="7"/>${[-60,0,60].map(dx=>`<path d="M${dx-20} 15l12 -31 15 11 16 -28 16 34 -15 19Z" fill="${color}" stroke="#71924c" stroke-width="3"/>`).join('')}</g>`;}
 for(const [src,x,y,s=1]of [['reuse/tree-1.svg',210,-350],['reuse/tree-4.svg',1250,-380],['reuse/street--bench-park.svg',730,-350,.9],['bigger/noodle-rack.svg',1050,-220,.8],['reuse/tree-2.svg',7310,-380],['reuse/tree-4.svg',7650,-400],['reuse/tree-1.svg',7800,-20],['reuse/tree-5.svg',7240,30],['reuse/neon-crate.svg',7470,90],['reuse/street--bench-wood.svg',7650,170,.8],['reuse/tree-3.svg',8220,4210],['reuse/tree-5.svg',7520,4460],['bigger/book-rack.svg',7840,4650,.8],['reuse/street--bench-wood.svg',8060,4640,.8],['reuse/tree-4.svg',250,4650],['reuse/tree-1.svg',550,4520],['reuse/tree-3.svg',1050,4730],['reuse/tree-5.svg',1210,4880],['reuse/street--picnic-table.svg',610,4800],['reuse/street--umbrella-cafe.svg',610,4760],['reuse/street--picnic-table.svg',1000,4970,.9],['reuse/tree-2.svg',4370,4950],['reuse/tree-4.svg',5070,4810],['reuse/street--bench-wood.svg',4600,4760],['reuse/neon-barrel.svg',4910,4770,.8]])p(src,x,y,s);
 return {water,ground,commonsGround,bridges,decks,streams,commons};
}
