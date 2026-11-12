import {inPoly, shapeIndex} from '../../../assets/world/island-geometry.mjs';

const pointSegment2 = (p, a, b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
};
function segmentDistance2(a,b,c,d) {
  const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;
  if(den){const wx=c[0]-a[0],wy=c[1]-a[1],s=(wx*vy-wy*vx)/den,t=(wx*uy-wy*ux)/den;if(s>=0&&s<=1&&t>=0&&t<=1)return 0;}
  return Math.min(pointSegment2(a,c,d),pointSegment2(b,c,d),pointSegment2(c,a,b),pointSegment2(d,a,b));
}
export function solidLineTest(obstacles,pad=16) {
  const CELL=256,near=shapeIndex(obstacles,pad,CELL);
  return (a,b) => {
    const seen=new Set(),dx=b[0]-a[0],dy=b[1]-a[1];
    let x=Math.floor(a[0]/CELL),y=Math.floor(a[1]/CELL);
    const ex=Math.floor(b[0]/CELL),ey=Math.floor(b[1]/CELL),sx=Math.sign(dx),sy=Math.sign(dy);
    const stepX=dx?CELL/Math.abs(dx):Infinity,stepY=dy?CELL/Math.abs(dy):Infinity;
    let nextX=dx?((x+(sx>0?1:0))*CELL-a[0])/dx:Infinity,nextY=dy?((y+(sy>0?1:0))*CELL-a[1])/dy:Infinity;
    for(;;){
      for(const o of near((x+.5)*CELL,(y+.5)*CELL)){
        if(seen.has(o))continue;seen.add(o);
        let start=a,end=b;
        if(o.frontY!==undefined){
          if(a[1]>=o.frontY&&b[1]>=o.frontY)continue;
          if((a[1]<o.frontY)!==(b[1]<o.frontY)){const t=(o.frontY-a[1])/(b[1]-a[1]),cross=[a[0]+dx*t,o.frontY];if(a[1]>=o.frontY)start=cross;else end=cross;}
        }
        if(o.poly){
          if(inPoly(...start,o.poly)||inPoly(...end,o.poly))return false;
          for(let i=0;i<o.poly.length;i++)if(segmentDistance2(start,end,o.poly[i],o.poly[(i+1)%o.poly.length])<pad**2)return false;
        }else{
          const ax=(a[0]-o.x)/(o.rx+pad),ay=(a[1]-o.y)/(o.ry+pad),ux=dx/(o.rx+pad),uy=dy/(o.ry+pad);
          const t=Math.max(0,Math.min(1,-(ax*ux+ay*uy)/(ux*ux+uy*uy||1)));
          if((ax+t*ux)**2+(ay+t*uy)**2<1)return false;
        }
      }
      if(x===ex&&y===ey)return true;
      if(nextX<nextY){x+=sx;nextX+=stepX;}else if(nextY<nextX){y+=sy;nextY+=stepY;}else{x+=sx;y+=sy;nextX+=stepX;nextY+=stepY;}
    }
  };
}
export function waterLineTest(water,bridges) {
 const clear=solidLineTest(water,20);
 return (a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],spans=[];
  for(const bridge of bridges){
   let lo=0,hi=1;
   if(bridge.poly){
    const poly=bridge.poly,area=poly.reduce((s,p,i)=>s+p[0]*poly[(i+1)%poly.length][1]-p[1]*poly[(i+1)%poly.length][0],0),sign=Math.sign(area);
    for(let i=0;i<poly.length;i++){
     const p=poly[i],q=poly[(i+1)%poly.length],ex=q[0]-p[0],ey=q[1]-p[1];
     const v=sign*(ex*(a[1]-p[1])-ey*(a[0]-p[0]))-8*Math.hypot(ex,ey),d=sign*(ex*dy-ey*dx);
     if(!d){if(v<=0){hi=-1;break;}continue;}
     const t=-v/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    }
    if(hi>lo)spans.push([lo,hi]);continue;
   }
   for(const [v,d,c,r]of [[a[0],dx,bridge.x,bridge.w/2-8],[a[1],dy,bridge.y,bridge.h/2-12]]){
    if(!d){if(v<=c-r||v>=c+r){hi=-1;break;}continue;}
    const t0=(c-r-v)/d,t1=(c+r-v)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
   }
   if(hi>lo)spans.push([lo,hi]);
  }
  spans.sort((a,b)=>a[0]-b[0]);let t=0;
  const at=t=>[a[0]+dx*t,a[1]+dy*t];
  for(const [lo,hi]of spans){if(lo>t&&!clear(at(t),at(lo)))return false;t=Math.max(t,hi);}
  return t>=1||clear(at(t),b);
 };
}
