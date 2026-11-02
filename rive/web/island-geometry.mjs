// Same island geometry used for the world host and socket authority.
export function geometry(world){
 function inPoly(x,y){let inside=false;const p=world.coast;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;}return inside;}
 const ellipse=(x,y,o,pad=0)=>((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;
 function walkable(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const board=world.walkways?world.walkways.some(b=>{const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],t=Math.max(0,Math.min(1,((x-b.a[0])*dx+(y-b.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-b.a[0]-dx*t,y-b.a[1]-dy*t)<b.w/2-10;}):Math.abs(x-world.boardwalk.x)<world.boardwalk.w/2-12&&Math.abs(y-world.boardwalk.y)<world.boardwalk.h/2+25;
  const isle=world.islets.some(a=>((x-a[0])/(a[2]-20))**2+((y-a[1])/(a[3]-20))**2<1);
  if(!inPoly(x,y)&&!board&&!isle)return false;
  const bridge=world.bridges.some(b=>Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);
  return (bridge||!world.water.some(o=>ellipse(x,y,o,20)))&&!world.obstacles.some(o=>ellipse(x,y,o,16));
 }
 return {walkable,inPoly,ellipse};
}
