import {readFileSync} from 'node:fs';
import {createCanvas,Path2D} from '@napi-rs/canvas';
import {inShape} from '../assets/world/island-geometry.mjs';

const base=new URL('../public/pixi-art/themes/sunflower/bloom/',import.meta.url);
const centre=JSON.parse(readFileSync(new URL('centre-placements.json',base)));
const svg=readFileSync(new URL('plaza-bloom-ground.svg',base),'utf8');
const tile=centre.groundTiles.find(t=>t.src==='plaza-bloom-ground.svg');
const {x:cx,y:cy,rx,ry}=centre.plaza,sy=ry/rx;
const ctx=createCanvas(1,1).getContext('2d');
// Read the actual paving outline, including all ten rotated petals, rather than
// assuming a small plaza ellipse that misses the petal tips and sides.
const petal=new Path2D(svg.match(/id="petal" d="([^"]+)"/)[1]);
const angles=[...svg.matchAll(/<g transform="rotate\(([-\d.]+)\)"><use href="#petal"/g)].map(m=>Number(m[1])*Math.PI/180);
const discRadius=Number(svg.match(/<circle r="([\d.]+)" fill="#fff0b4"/)[1]);
const world=(u,v)=>[cx+u,cy+v*sy];
export function bloomFloor(x,y) {
  const u=x-cx,v=(y-cy)/sy;
  return Math.hypot(u,v)<discRadius || angles.some(a=>ctx.isPointInPath(petal,u*Math.cos(a)+v*Math.sin(a),-u*Math.sin(a)+v*Math.cos(a)));
}
export const bloomBlockers=centre.walkBlockers;
const statue=bloomBlockers.find(b=>b.name==='clock planter');
const nearBase=point=>{
  const dx=point[0]-statue.x,dy=point[1]-statue.y;
  const k=1/Math.sqrt((dx/(statue.rx+22))**2+(dy/(statue.ry+22))**2);
  return [statue.x+dx*k,statue.y+dy*k];
};
// Check all ten drawn approaches, exceeding the requested eight. Three end at
// benches; begin 100 units inward on their clear lane, keeping benches solid.
export const bloomApproaches=[...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+) L([-\d.]+) ([-\d.]+)" fill="none" stroke="#f5dfa1"/g)].map((m,i)=>{
  const a=Math.atan2(Number(m[4]),Number(m[3]));
  const petalAngle=angles.reduce((best,b)=>Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))<Math.abs(Math.atan2(Math.sin(best-a),Math.cos(best-a)))?b:best,angles[0]);
  const disc=world(350*Math.cos(petalAngle),350*Math.sin(petalAngle));
  const length=Math.hypot(Number(m[3]),Number(m[4]));
  return {id:'bloom-approach-'+i,points:[world((length-100)*Math.cos(a),(length-100)*Math.sin(a)),world(820*Math.cos(petalAngle),820*Math.sin(petalAngle)),disc,nearBase(disc)]};
});

export function auditBloom(nav) {
  let samples=0;const blocked=[];
  for(let y=tile.y;y<tile.y+tile.height;y+=12)for(let x=tile.x;x<tile.x+tile.width;x+=12){
    if(!bloomFloor(x,y)||bloomBlockers.some(b=>inShape(x,y,b,16)))continue;
    samples++;
    if(!nav.walkable(x,y))blocked.push([x,y]);
  }
  const routes=bloomApproaches.map(({id,points})=>{
    let reached=nav.walkable(...points[0]),clear=reached,steps=0;
    for(let i=1;i<points.length;i++){
      const path=nav.route(...points[i-1],...points[i]);let prev=points[i-1];
      reached&&=JSON.stringify(path.at(-1))===JSON.stringify(points[i]);
      for(const q of path){clear&&=nav.clearLine(prev,q);prev=q;steps++;}
    }
    return {id,reached,clear,steps};
  });
  return {samples,blocked,routes,failed:routes.filter(r=>!r.reached||!r.clear)};
}
