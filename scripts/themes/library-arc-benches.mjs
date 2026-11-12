import {writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {inShape} from '../../assets/world/island-geometry.mjs';
export function libraryArcBenches({artDir,props,obstacles,plaza,market}) {
 const records=[];
 for(const [name,z,angles,radius] of [
  ['globe',plaza,[-143,-35,38,140],980],
  ['bookstore',market,[48,76,105,134],900],
 ]) for(const target of angles){
  let deg=target;
  const clear=a=>{
   const x=z.x+Math.cos(a*Math.PI/180)*radius,y=z.y+Math.sin(a*Math.PI/180)*radius*z.ry/z.rx;
   return !props.some(p=>{
    if(p.src.includes('centre/')&&!/stall/.test(p.src))return false;
    if(p.y<y-25)return false;
    const w=p.width*(p.scale??1),h=p.height*(p.scale??1),left=p.x-w*p.anchor.x,top=p.y-h*p.anchor.y;
    return left<x+145&&left+w>x-145&&top<y+70&&top+h>y-90;
   })&&!obstacles.some(o=>inShape(x,y,o,45));
  };
  const candidate=[0,-3,3,-6,6,-9,9,-12,12,-15,15,-18,18,-21,21,-24,24,-27,27,-30,30].map(d=>target+d).find(clear);
  if(candidate===undefined)throw Error('No clear bench arc for '+name+' '+target);
  deg=candidate;
  const k=z.ry/z.rx, b={deg,span:12}, sIn=radius-20,sOut=radius+20,back=radius+24;
  const ground=(a,s)=>[z.x+Math.cos(a*Math.PI/180)*s,z.y+Math.sin(a*Math.PI/180)*s*k];
  const arc=(s)=>Array.from({length:25},(_,i)=>ground(deg-6+i*.5,s));
  const points=[...arc(sIn-4),...arc(back+4)], xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x=Math.floor(Math.min(...xs))-5,y=Math.floor(Math.min(...ys))-53,w=Math.ceil(Math.max(...xs))-x+5,h=Math.ceil(Math.max(...ys))-y+6;
  const [ax,ay]=ground(deg,radius),id=`arc-${name}-${deg}`,src=id+'.svg';
  const svg=drawArcBench(b,{ground,sIn,sOut,back,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:1.3});
  writeFileSync(artDir+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><title>Pagepond ${name} curved reading bench</title>${svg.join('')}</svg>`);
  props.push({id,name:'Curved reading bench',src,x:ax,y:ay,width:w,height:h,scale:1,anchor:{x:(ax-x)/w,y:(ay-y)/h},shadow:false,wind:false,zone:name==='globe'?'plaza':'bookstore'});
  const poly=[...arc(sIn-4),...arc(back+4).reverse()].map(p=>p.map(v=>Math.round(v*10)/10));
  obstacles.push({poly,name:id});records.push({id,deg,span:b.span,centre:[z.x,z.y],radius,ratio:k,footprint:poly});
 }
 writeFileSync(artDir+'arc-benches.json',JSON.stringify(records,null,2));
 return records;
}
