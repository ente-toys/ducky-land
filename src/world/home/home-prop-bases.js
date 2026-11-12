import moves from './home-prop-moves.json' with {type:'json'};
import bases from './home-prop-bases.json' with {type:'json'};
function homePropBase(p) {
 const spec=bases[p.src];if(!spec)return null;
 const w=p.width*p.scale,h=p.height*p.scale;
 return {poly:spec.poly.map(([u,v])=>[p.x+((p.flip?1-u:u)-p.anchor.x)*w,p.y+(v-p.anchor.y)*h])};
}
export function fitHomeProp(p) {
 const move=moves[p.id];if(move)p={...p,x:p.x+move.dx,y:p.y+move.dy,...(p.z===undefined?{}:{z:p.z+move.dy}),...(p.footprint?{footprint:p.footprint.poly?{poly:p.footprint.poly.map(([x,y])=>[x+move.dx,y+move.dy])}:{...p.footprint,x:p.footprint.x+move.dx,y:p.footprint.y+move.dy}}:{})};
 let footprint=homePropBase(p);if(!footprint)return p;
 if(/bush|shrub/i.test(p.asset??p.name)&&p.footprint&&!p.footprint.poly){
  const f=p.footprint,pts=[...footprint.poly,...Array.from({length:32},(_,i)=>[f.x+Math.cos(i*Math.PI/16)*f.rx,f.y+Math.sin(i*Math.PI/16)*f.ry])];
  pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=ps=>{const out=[];for(const p of ps){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  footprint={poly:[...half(pts).slice(0,-1),...half([...pts].reverse()).slice(0,-1)]};
 }
 footprint={...p.footprint,...footprint};
 const front=Math.max(...footprint.poly.map(pt=>pt[1]));
 return {...p,footprint,sortFootY:front,z:front};
}
