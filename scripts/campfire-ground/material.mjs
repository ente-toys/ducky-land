import fs from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {Path2D,PathOp,ring,curve,stroke} from '../pagepond/geometry.mjs';
const A='public/pixi-art/themes/community/';
const read=p=>JSON.parse(fs.readFileSync(p));
const els=n=>Array.from(n.childNodes??[]).filter(n=>n.nodeType===1);
const ellipse=(x,y,rx,ry)=>{const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);return p;};
const op=(a,b,kind)=>a.op(b.asWinding(),kind).asWinding();
const union=ps=>ps.reduce((a,b)=>op(a,b,PathOp.Union),new Path2D());
export function routeWidths(world,placement){
 const n=world.paths.length-placement.links.length;
 const original=read('scripts/bigger-community/baseline/world.json');
 return world.paths.map((_,i)=>i<n?(original.pathWidths[i]>=180?128:104):placement.links[i-n].kind==='main'?128:104);
}
function closedCurve(points){
 const q=points.slice(0,-1);let d=`M${q[0].join(' ')}`;
 for(let i=0;i<q.length;i++){const a=q[(i+q.length-1)%q.length],b=q[i],c=q[(i+1)%q.length],e=q[(i+2)%q.length];d+=`C${b[0]+(c[0]-a[0])/6} ${b[1]+(c[1]-a[1])/6} ${c[0]-(e[0]-b[0])/6} ${c[1]-(e[1]-b[1])/6} ${c.join(' ')}`;}
 return d+'Z';
}
export async function composeGround(source){
 const art=read(A+'art.json'),world=read('assets/world/themes/community/world.json'),placement=read('scripts/campfire-hamlets/placement.json');
 const widths=routeWidths(world,placement),parser=new DOMParser(),serializer=new XMLSerializer(),doc=parser.parseFromString(source,'image/svg+xml'),root=doc.documentElement;
 const node=(tag,attrs={})=>{const n=doc.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const paint=(parent,d,attrs)=>{const n=node('path',{d,...attrs});parent.appendChild(n);return n;};
 const groups=els(root),outer=groups[6],centre=groups.at(-1);
 const oldPaths=els(centre).filter(n=>n.getAttribute('data-name')==='Footpaths');
 const lines=els(oldPaths[0]).map(n=>n.getAttribute('d'));
 const routes=[...lines.map((d,i)=>stroke(d,widths[i])),...placement.links.map((l,i)=>stroke(l.kind==='main'?closedCurve(l.points):curve(l.points),widths[lines.length+i]))];
 const wet=union(world.water.map(w=>w.poly?new Path2D(ring(w.poly)):ellipse(w.x,w.y,w.rx,w.ry)));
 const coast=new Path2D(ring(world.coast)),dry=op(new Path2D(coast),wet,PathOp.Difference);
 const contacts=union(placement.shapes.filter(s=>s.solid).map(s=>{const p=new Path2D(ring(s.poly));return op(new Path2D(p),stroke(p,40),PathOp.Union);}));
 let floor=union([...routes,...placement.courts.map(c=>new Path2D(c.d))]);
 const expanded=op(new Path2D(floor),stroke(floor,44),PathOp.Union);
 floor=op(new Path2D(expanded),stroke(expanded,44),PathOp.Difference);
 floor=op(op(floor,contacts,PathOp.Difference),dry,PathOp.Intersect).simplify().asWinding();
 for(const n of els(outer).slice(35,39))outer.removeChild(n);
 for(const n of oldPaths)n.parentNode.removeChild(n);
 for(const n of els(centre))if(['Soft path sand grain','Community path-edge craft'].includes(n.getAttribute('data-name')))centre.removeChild(n);
 groups[5].setAttribute('stroke','none');
 for(const n of Array.from(centre.getElementsByTagName('g'))){
  if(['Sandy coast','Islet sand','West cove','Beach','Pond bank','Lake water'].includes(n.getAttribute('data-name'))){
   for(const c of els(n))if(c.getAttribute('stroke').toLowerCase()==='#39472d')c.setAttribute('stroke','none');
   if(n.getAttribute('data-name')==='Lake water')for(const c of els(n))if(c.getAttribute('fill').toLowerCase()==='#39472d')n.removeChild(c);
  }
 }
 for(const n of els(groups[8]).slice(0,3))n.parentNode.removeChild(n);
 for(const n of Array.from(root.getElementsByTagName('ellipse')))if([108,130].includes(+n.getAttribute('rx'))&&[54,72].includes(+n.getAttribute('ry')))n.parentNode.removeChild(n);
 for(const n of els(root))if(n.nodeName==='path'&&/q14 -6 28 0/.test(n.getAttribute('d')))root.removeChild(n);
 for(const n of [root,...Array.from(root.getElementsByTagName('*'))])for(const k of ['fill','stroke']){
  const v=n.getAttribute(k).toLowerCase();if(v==='#a7c653')n.setAttribute(k,'#93b72f');if(v==='#99ba48')n.setAttribute(k,'#a8ca48');
 }
 const defs=node('defs');root.appendChild(defs);
 const clip=(id,shape)=>{const c=node('clipPath',{id});paint(c,shape.toSVGString(),{'clip-rule':'evenodd'});defs.appendChild(c);};
 clip('campfire-island',coast);clip('campfire-water',wet);
 const waterGroup=node('g',{'data-ground':'water','clip-path':'url(#campfire-island)'});root.appendChild(waterGroup);
 const waterD=wet.toSVGString();
 paint(waterGroup,waterD,{fill:art.sea,stroke:'#fde48c','stroke-width':32,'stroke-linejoin':'round','fill-rule':'evenodd'});
 paint(waterGroup,waterD,{fill:art.sea,'fill-rule':'evenodd'});
 const foam=node('g',{'clip-path':'url(#campfire-water)'});waterGroup.appendChild(foam);
 paint(foam,waterD,{fill:'none',stroke:'#fff0c7','stroke-width':32,opacity:'.14','stroke-linejoin':'round'});
 paint(foam,waterD,{fill:'none',stroke:'#fff0c7','stroke-width':7,opacity:'.55','stroke-linejoin':'round'});
 paint(root,floor.toSVGString(),{'data-ground':'paths',fill:'#fde48c','fill-rule':'evenodd'});
 const shadows=parser.parseFromString(fs.readFileSync('scripts/campfire-hamlets/contact-shadows.svg','utf8'),'image/svg+xml').documentElement;
 for(const n of els(shadows))root.appendChild(doc.importNode(n,true));
 return {svg:serializer.serializeToString(root),report:{sea:art.sea,pathColor:'#fde48c',widths,paths:floor.toSVGString(),water:waterD,features:[],counts:{tuft:0,flower:0,patch:0}}};
}
