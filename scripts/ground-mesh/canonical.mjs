import {Path2D} from '@napi-rs/canvas';
import {triangulate} from './tessellate.mjs';
// A boundary representation gives translated/scaled copies one dictionary
// entry even when Earcut picked different internal diagonals in world space.
export function canonicalMesh(positions,indices,cache){
 const points=[],lookup=new Map(),remap=[];for(let i=0;i<positions.length;i+=2){const key=positions[i]+','+positions[i+1];if(!lookup.has(key)){lookup.set(key,points.length);points.push([positions[i],positions[i+1]]);}remap.push(lookup.get(key));}
 const edges=new Map();for(let i=0;i<indices.length;i+=3){const t=[remap[indices[i]],remap[indices[i+1]],remap[indices[i+2]]];if(new Set(t).size<3)continue;for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],reverse=b+','+a;if(edges.has(reverse))edges.delete(reverse);else if(edges.has(a+','+b))return {positions,indices};else edges.set(a+','+b,[a,b]);}}
 const next=new Map();for(const [a,b]of edges.values()){if(next.has(a))return {positions,indices};next.set(a,b);}
 const loops=[];while(next.size){const start=next.keys().next().value,ring=[];let at=start;do{if(!next.has(at))return {positions,indices};ring.push(points[at]);const to=next.get(at);next.delete(at);at=to;}while(at!==start);if(ring.length<3)continue;let first=0;for(let j=1;j<ring.length;j++)if(ring[j][0]<ring[first][0]||ring[j][0]===ring[first][0]&&ring[j][1]<ring[first][1])first=j;const ordered=ring.slice(first).concat(ring.slice(0,first));loops.push('M'+ordered.map(p=>p.join(' ')).join('L')+'Z');}
 const key=loops.sort().join('');if(!cache.has(key))cache.set(key,triangulate(new Path2D(key)));return cache.get(key);
}
