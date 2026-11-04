// Same island geometry used for the world host and socket authority.
// boss 4 Nov: a water or obstacle entry may carry `poly` (a traced outline) in place of its oval. Only the client's local world
// sets it; world.json has none, so the socket server walks exactly as before.
export function inPoly(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;}return inside;}
function edgeDist(x,y,p){let d=Infinity;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[j],b=p[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t));}return d;}
export const inShape=(x,y,o,pad=0)=>o.poly?(pad<0?inPoly(x,y,o.poly)&&edgeDist(x,y,o.poly)>-pad:inPoly(x,y,o.poly)||pad>0&&edgeDist(x,y,o.poly)<pad):((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;
export function geometry(world){
 const ellipse=(x,y,o,pad=0)=>((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;
 function walkable(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const board=world.walkways?world.walkways.some(b=>{const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],t=Math.max(0,Math.min(1,((x-b.a[0])*dx+(y-b.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-b.a[0]-dx*t,y-b.a[1]-dy*t)<b.w/2-10;}):Math.abs(x-world.boardwalk.x)<world.boardwalk.w/2-12&&Math.abs(y-world.boardwalk.y)<world.boardwalk.h/2+25;
  const isle=world.islets.some(a=>((x-a[0])/(a[2]-20))**2+((y-a[1])/(a[3]-20))**2<1);
  if(!inPoly(x,y,world.coast)&&!board&&!isle)return false;
  const bridge=world.bridges.some(b=>Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);
  return (bridge||!world.water.some(o=>inShape(x,y,o,20)))&&!world.obstacles.some(o=>inShape(x,y,o,16));
 }
 return {walkable,inPoly:(x,y,p=world.coast)=>inPoly(x,y,p),ellipse};
}
