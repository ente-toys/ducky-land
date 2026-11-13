import {tileResolution} from '../../src/rendering/pixi/art/ground-stream.js';
export function rasterPeak(tiles,{width,height,zoom,dpr=2,tilt=1}){
 const rectangles=tiles.map(t=>{
  const margin=t.viewMargin??192,hw=width/(2*zoom)+margin,hh=height/(2*zoom*tilt)+margin,r=tileResolution(t,zoom,dpr);
  return [t.x-hw,t.x+t.width+hw,t.y-hh,t.y+t.height+hh,Math.ceil(t.width*r)*Math.ceil(t.height*r)*4];
 });
 const ys=[...new Set(rectangles.flatMap(r=>[r[2],r[3]]))].sort((a,b)=>a-b),indices=new Map(ys.map((y,i)=>[y,i]));
 const n=ys.length-1,max=new Float64Array(n*4+8),lazy=new Float64Array(n*4+8),at=new Int32Array(n*4+8);
 if(n<1)return {bytes:0,camera:null};
 const init=(v,l,r)=>{at[v]=l;if(l<r){const m=(l+r)>>1;init(v*2,l,m);init(v*2+1,m+1,r);}};init(1,0,n-1);
 const add=(v,l,r,a,b,w)=>{
  if(a<=l&&r<=b){max[v]+=w;lazy[v]+=w;return;}
  const m=(l+r)>>1;if(a<=m)add(v*2,l,m,a,b,w);if(b>m)add(v*2+1,m+1,r,a,b,w);
  const child=max[v*2]>=max[v*2+1]?v*2:v*2+1;max[v]=lazy[v]+max[child];at[v]=at[child];
 };
 const events=rectangles.flatMap(([x0,x1,y0,y1,w])=>[[x0,indices.get(y0),indices.get(y1)-1,w],[x1,indices.get(y0),indices.get(y1)-1,-w]]).sort((a,b)=>a[0]-b[0]);
 let peak=0,camera=null;
 for(let i=0;i<events.length;){
  const x=events[i][0];do{const [,a,b,w]=events[i++];add(1,0,n-1,a,b,w);}while(i<events.length&&events[i][0]===x);
  if(max[1]>peak){peak=max[1];camera={x:i<events.length?(x+events[i][0])/2:x,y:(ys[at[1]]+ys[at[1]+1])/2,zoom};}
 }
 return {bytes:peak,camera};
}
