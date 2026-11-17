import {usesHouseBase} from '../../world/prop-outlines/islands.js';
import {shapeIndex} from '../../../assets/world/island-geometry.mjs';
import {propBodyPadding} from '../../world/home/prop-outline-rules.js';
import {HOME_DUCK_BODY} from '../../world/home/duck-body.js';
const indexes=new WeakMap();
// Feet cannot enter a solid outline. At its open sides, draw the standing
// duck in front of furniture instead of reserving an invisible full-body box.
// Houses keep base-line depth so their roofs cover Duckies walking behind.
// Trees keep their original canopy mask and depth. Island packs and Home
// both carry the original footprints, so this also works for remote Duckies.
export function furnitureDepth(props,x,y,depth=y){
 // An island's props arrive with its art; until then there is nothing to sort against.
 if(!Array.isArray(props)||!props.length)return depth;
 let near=indexes.get(props);
 if(!near){
  const shapes=[];
  for(const p of props){
   if(!p.src||!p.footprint||propBodyPadding(p).width!==48||usesHouseBase(p.footprint,true))continue;
   // Some footprints are ellipses or part lists without a poly: only use real [x,y] points, skip the rest.
   const rings=[p.footprint.poly,...(p.footprint.parts??[]).map(r=>Array.isArray(r)?r:r?.poly)].filter(Array.isArray),points=rings.flat().filter(q=>Array.isArray(q)&&Number.isFinite(q[0])&&Number.isFinite(q[1]));
   if(!points.length&&!p.footprint.propBase)continue;
   if(p.footprint.propBase){const w=p.width*(p.scale??1),h=p.height*(p.scale??1),a=p.anchor??{x:.5,y:1};
    points.push([p.x-a.x*w,p.y-a.y*h],[p.x+(1-a.x)*w,p.y+(1-a.y)*h]);}
   const xs=points.map(q=>q[0]),ys=points.map(q=>q[1]);
   shapes.push({x0:Math.min(...xs)-HOME_DUCK_BODY.width/2,x1:Math.max(...xs)+HOME_DUCK_BODY.width/2,
    y0:Math.min(...ys),y1:Math.max(...ys)+HOME_DUCK_BODY.height,z:p.sortY??p.z??p.y,
    poly:[[Math.min(...xs)-HOME_DUCK_BODY.width/2,Math.min(...ys)],[Math.max(...xs)+HOME_DUCK_BODY.width/2,Math.min(...ys)],
     [Math.max(...xs)+HOME_DUCK_BODY.width/2,Math.max(...ys)+HOME_DUCK_BODY.height],[Math.min(...xs)-HOME_DUCK_BODY.width/2,Math.max(...ys)+HOME_DUCK_BODY.height]]});
  }
  near=shapeIndex(shapes,0);indexes.set(props,near);
 }
 for(const s of near(x,y))if(x>=s.x0&&x<=s.x1&&y>=s.y0&&y<=s.y1)depth=Math.max(depth,s.z+.001);
 return depth;
}
export const usesFurnitureDepth=id=>['home','sunset','pink','isle-251','library','isle-250','community'].includes(id);
