import fs from 'node:fs';
import {Path2D,PathOp,even,ring,curve,stroke,union,simplifyLine} from '../pagepond/geometry.mjs';
import {sites} from './design.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
// Capsule unions avoid self-intersecting outlines when a routed lane doubles
// back at a main-loop junction. Only the shared outer edge receives an outline.
export function lane(points,width){const p=simplifyLine(points,8);return union(p.slice(1).map((b,i)=>stroke(`M${p[i].join(' ')}L${b.join(' ')}`,width)));}
export function composeFloor(ground,links){
 const roads=structuredClone(ground.roads);
 for(const r of roads){for(const site of Object.values(sites))for(const replacement of site.bypass){const a=r.points.findIndex(p=>JSON.stringify(p)===JSON.stringify(replacement[0])),b=r.points.findIndex(p=>JSON.stringify(p)===JSON.stringify(replacement.at(-1)));if(a>=0&&b>a)r.points.splice(a,b-a+1,...replacement);}if(r.id==='west-north-heart')r.points=r.points.slice(1);if(r.id==='east-north-heart')r.points[0]=[8500,1280];}
 let floor=union(roads.map(r=>stroke(curve(r.points),r.width)));
 for(const [h,s]of Object.entries(sites))for(const p of read('scripts/pagepond-hamlets/layouts/'+h+'.json').paths){const sh=p.d?new Path2D(p.d).transform({a:s.k,b:0,c:0,d:s.k,e:s.at[0],f:s.at[1]}):new Path2D(ring(p.polygon.map(q=>q.map((v,i)=>s.at[i]+v*s.k))));floor=floor.op(sh,PathOp.Union);}
 for(const l of links.filter(l=>l.kind!=='main-bypass'))floor=floor.op(lane(l.points,l.width),PathOp.Union);
 return floor;
}
