import anchors from './home-seat-anchors.json' with {type:'json'};
import {homePropContract} from './home-layer.js';
export function createHomeSeats(props,nav) {
 return props.filter(p=>homePropContract(p)?.class==='seat').map(p=>{
  const s=anchors[p.id];if(!s)throw Error(`Missing authored Home seat ${p.id}`);
  const w=p.width*p.scale,h=p.height*p.scale,u=p.flip?1-s.u:s.u;
  const x=p.x+(u-p.anchor.x)*w,y=p.y+(s.v-p.anchor.y)*h;
  const displayY=p.y+(s.displayV-p.anchor.y)*h,turn=p.flip?-s.turn:s.turn;
  const approach={x,y,turn};
  return {...p,homeSeat:nav.walkable(x,y)?{approach,x,y,lift:y-displayY,z:y,turn,bench:p.id}:null};
 });
}
