import {writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {inShape} from '../../assets/world/island-geometry.mjs';

const n=v=>Math.round(v*10)/10;
const path=p=>'M'+p.map(([x,y])=>`${n(x)} ${n(y)}`).join(' L')+' Z';
export function libraryPathInlays(paths){
 const out=['<clipPath id="path-joint-inlays">'];
 for(const p of paths){
  const left=[],right=[];
  p.line.forEach(([x,y],i)=>{
   const a=p.line[Math.max(0,i-1)],b=p.line[Math.min(p.line.length-1,i+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,r=(p.w-14)/2;
   const dx=-(b[1]-a[1])/len*r,dy=(b[0]-a[0])/len*r;
   left.push([x+dx,y+dy]);right.push([x-dx,y-dy]);
  });
  out.push(`<path d="${path([...left,...right.reverse()])}"/>`);
  for(const [x,y]of [p.line[0],p.line.at(-1)])out.push(`<circle cx="${x}" cy="${y}" r="${(p.w-14)/2}"/>`);
 }
 out.push('</clipPath><g clip-path="url(#path-joint-inlays)">');
 for(const index of [2,3]){
  const [x,y]=paths[index].line.at(-1),k=.78;
  for(const radius of [50,108]){
   for(let i=0;i<12;i++){
    const a=(i+(radius===140?.5:0))*Math.PI/6,b=a+Math.PI/6;
    const inner=Math.max(0,radius-58),outer=radius;
    const point=(a,r)=>[x+Math.cos(a)*r,y+Math.sin(a)*r*k];
    const points=[point(a,inner),...Array.from({length:5},(_,j)=>point(a+(b-a)*j/4,outer)),point(b,inner),...Array.from({length:4},(_,j)=>point(b-(b-a)*(j+1)/4,inner))];
    out.push(`<path d="${path(points)}" fill="${i%3===0?'#FFF0C7':'#FDE48C'}" stroke="#D7BC73" stroke-width="2"/>`);
   }
  }
 }
 out.push('</g>');return out.join('');
}
export function libraryCourtPaving(z,border){
 const out=[],pave='#FDE48C',line='#D1B46E';
 const scaled=(sx,sy=sx)=>border.map(([x,y])=>[z.x+(x-z.x)*sx,z.y+(y-z.y)*sy]);
 out.push(`<clipPath id="reading-court"><path d="${path(border)}"/></clipPath><g clip-path="url(#reading-court)">`);
 out.push(`<path d="${path(border)}" fill="${pave}"/>`);
 for(let row=-6;row<7;row++)for(let col=-9;col<10;col++){
  const x=z.x+col*112+(row%2?56:0),y=z.y+row*76;
  const q=[[x,y],[x+112,y],[x+112,y+76],[x,y+76]];
  out.push(`<path d="${path(q)}" fill="${(col+row)%4===0?'#FFF0C7':(col-row)%5===0?'#F5DC94':pave}" stroke="${line}" stroke-width="2.2"/>`);
 }
 out.push(`<path d="${path(scaled(.965,.94))}" fill="none" stroke="#F9EDBC" stroke-width="44"/>`);
 for(const [sx,sy]of [[.99,.985],[.94,.89],[.87,.76]])out.push(`<path d="${path(scaled(sx,sy))}" fill="none" stroke="#BDA266" stroke-width="2.6"/>`);
 for(const side of [-1,1])for(let i=-6;i<=6;i++){
  const x=z.x+i*112,y=z.y+side*z.ry*.675;
  if(Math.abs(i)===6)continue;
  out.push(`<path d="M${x-16} ${y-16}h32v32h-32Z" fill="${i%3===0?'#C68F65':'#E4C567'}" stroke="#BDA266" stroke-width="2"/><path d="M${x-8} ${y-10}v20m16-20v20" stroke="#F9EDBC" stroke-width="2"/>`);
 }
 for(const [scale,width,colour]of [[.76,20,'#C49B75'],[.76,12,'#E5BB91'],[.66,3,'#BDA266']])
  out.push(`<path d="${path(scaled(scale,scale))}" fill="none" stroke="${colour}" stroke-width="${width}"/>`);
 for(const side of [-1,1])for(const dx of [-.53,0,.53]){
  const x=z.x+dx*z.rx,y=z.y+side*z.ry*.56;
  out.push(`<path d="M${x-48} ${y-12}h96l-14 12 14 12h-96l14-12Z" fill="#B2AE83" stroke="#9D9162" stroke-width="2.6"/><path d="M${x-29} ${y}h58" stroke="#FFF0C7" stroke-width="3"/>`);
 }
 for(const side of [-1,1])for(const dx of [-.68,-.43,.43,.68]){
  const x=z.x+dx*z.rx,y=z.y+side*z.ry*.38;
  out.push(`<path d="M${x-13} ${y-23}h26v46l-13-10-13 10Z" fill="${dx<0?'#D8C58E':'#D3B798'}" stroke="#BCA064" stroke-width="2"/><path d="M${x-5} ${y-15}h10" stroke="#F9EDBC" stroke-width="3"/>`);
 }
 const cx=z.x,cy=z.y;
 out.push(`<ellipse cx="${cx}" cy="${cy}" rx="255" ry="164" fill="#E4C567" stroke="#BDA266" stroke-width="3"/><ellipse cx="${cx}" cy="${cy}" rx="239" ry="153" fill="#FFF0C7" stroke="#BDA266" stroke-width="2.2"/>`);
 for(let a=0;a<Math.PI*2;a+=Math.PI/12){
  out.push(`<path d="M${cx+Math.cos(a)*240} ${cy+Math.sin(a)*154}L${cx+Math.cos(a)*255} ${cy+Math.sin(a)*164}" stroke="#BDA266" stroke-width="2"/>`);
 }
 out.push(`<path d="M${cx} ${cy-62}q-66-45-162-12v133q84-28 162 15q78-43 162-15v-133q-96-33-162 12Z" fill="#F9EDBC" stroke="#AE925A" stroke-width="4"/><path d="M${cx} ${cy-62}v137" fill="none" stroke="#AE925A" stroke-width="3"/>`);
 for(const side of [-1,1])for(let row=0;row<4;row++)out.push(`<path d="M${cx+side*26} ${cy-35+row*25}q${side*50} -18 ${side*106} -12" fill="none" stroke="#C5A668" stroke-width="3"/>`);
 out.push('</g>');
 return out.join('\n');
}

export function libraryCloseupFurniture({artDir,props,obstacles,ACT,STALL_ROWS,plaza,market,put,fits,bedNear,pathNear,land,PATHS,flats,ASSET}){
 const benches=[];
 const clear=(x,y,w=135,h=65)=>land(x,y,110)&&!pathNear(x,y,w*.3)&&!bedNear(x,y,w*.7)
  &&!STALL_ROWS.some(z=>inShape(x,y,z,w+45))
  &&!obstacles.some(o=>inShape(x,y,o,45))
  &&!props.some(p=>{
   const pw=p.width*(p.scale??1),ph=p.height*(p.scale??1),left=p.x-pw*p.anchor.x,top=p.y-ph*p.anchor.y;
   return left<x+w&&left+pw>x-w&&top<y+30&&top+ph>y-h;
  });
 for(const [zi,z]of ACT.entries()){
  const radius=z.rx*(zi===2?.91:1.08),ratio=z.ry/z.rx*(zi===2?.82:1);
  const targets=zi===2?[-120,-60,32,148]:[-135,-45,45,135];
  for(const target of targets){
   const deg=[0,-5,5,-10,10,-15,15].map(d=>target+d).find(a=>{
    const r=a*Math.PI/180,x=z.x+Math.cos(r)*radius,y=z.y+Math.sin(r)*radius*ratio;
    return clear(x,y,115,70)&&!benches.some(b=>Math.hypot(x-b.at[0],y-b.at[1])<240);
   });
   if(deg===undefined)continue;
   const ground=(a,r)=>[z.x+Math.cos(a*Math.PI/180)*r,z.y+Math.sin(a*Math.PI/180)*r*ratio];
   const span=Math.min(24,175/radius*180/Math.PI),sIn=radius-20,sOut=radius+20,back=radius+24;
   const arc=r=>Array.from({length:25},(_,i)=>ground(deg-span/2+span*i/24,r));
   const poly=[...arc(sIn-4),...arc(back+4).reverse()].map(p=>p.map(n));
   const all=poly,x=Math.floor(Math.min(...all.map(p=>p[0])))-6,y=Math.floor(Math.min(...all.map(p=>p[1])))-54;
   const w=Math.ceil(Math.max(...all.map(p=>p[0])))-x+6,h=Math.ceil(Math.max(...all.map(p=>p[1])))-y+7;
   const id=`close-arc-${zi}-${target}`,src=id+'.svg',[ax,ay]=ground(deg,radius);
   const svg=drawArcBench({deg,span},{ground,sIn,sOut,back,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:1.3});
   writeFileSync(artDir+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${svg.join('')}</svg>`);
   props.push({id,name:'Curved reading court bench',src,x:ax,y:ay,width:w,height:h,scale:1,anchor:{x:(ax-x)/w,y:(ay-y)/h},shadow:false,wind:false,zone:z.id});
   obstacles.push({poly,name:id});benches.push({id,at:[ax,ay],deg,span,centre:[z.x,z.y],radius,ratio,footprint:poly});
  }
 }
 let lamps=0,planters=0;
 for(const z of [plaza,market,...ACT])for(let i=0;i<16;i++){
  const a=(i+.5)/16*Math.PI*2;
  const rx=z.rx+(z===ACT[2]?25:85),ry=z.ry+(z===ACT[2]?-30:75);
  const x=z.x+Math.cos(a)*rx,y=z.y+Math.sin(a)*ry;
  if(!clear(x,y,72,160))continue;
  const name=i%3===0?'pencil-lamp':'inkwell-planter';
  put(name,[x,y],'closeup-rim',{world:true,mult:name==='pencil-lamp'?.82:1.1});
  if(name==='pencil-lamp')lamps++;else planters++;
 }
 for(const z of [ACT[2],market])for(const side of [-1,1])for(const dx of [-.28,.28]){
  const y=z.y+side*z.ry*(z===market?1.04:.84),x=z.x+dx*z.rx;
  for(const offset of [0,-45,45,-90,90,-135,135]){
   if(!clear(x+offset,y,65,125))continue;
   const name=side<0?'pencil-lamp':'inkwell-planter';
   put(name,[x+offset,y],'closeup-rim',{world:true,mult:name==='pencil-lamp'?.82:1.1});
   if(name==='pencil-lamp')lamps++;else planters++;
   break;
  }
 }
 let details=0;
 for(const [li,p]of PATHS.entries())for(let i=2;i<p.line.length-2;i+=3){
  const [x,y]=p.line[i],a=p.line[i-1],b=p.line[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(const side of [-1,1]){
   const xx=x-(b[1]-a[1])/len*(p.w/2+18+(i%4)*7)*side,yy=y+(b[0]-a[0])/len*(p.w/2+18+(i%4)*7)*side;
   if(!land(xx,yy,120)||pathNear(xx,yy,4)||bedNear(xx,yy,35)||[plaza,market,...ACT,...STALL_ROWS].some(z=>inShape(xx,yy,z,20)))continue;
   const key=(i+li)%3===0?'pebble-1':`grass-tuft-${1+(i+li)%3}`,asset=ASSET[key];
   flats.push({src:asset.src,x:xx,y:yy,width:asset.w*1.45,height:asset.h*1.45,flip:side<0});details++;
  }
 }
 let rimDetails=0;
 for(const z of ACT)for(let i=0;i<72;i++){
  if(i%3===0)continue;
  const a=i/72*Math.PI*2;
  let x,y;
  if(z.kind==='paved'){
   const side=i<36?-1:1,t=(i%36)/35;
   x=z.x+(t*1.6-.8)*z.rx;y=z.y+side*(z.ry*.83+12+(i%4)*7);
  }else{x=z.x+Math.cos(a)*(z.rx+34);y=z.y+Math.sin(a)*(z.ry+28);}
  x+=Math.sin(i*17.31+z.x)*21;y+=Math.sin(i*9.73+z.y)*24;
  if(!land(x,y,120)||pathNear(x,y,20)||bedNear(x,y,25)||STALL_ROWS.some(s=>inShape(x,y,s,20)))continue;
  const key=i%5===0?'pebble-1':i%5===1?'flower-dot-1':`grass-tuft-${1+(i*7)%3}`,asset=ASSET[key],size=1.1+(Math.sin(i*5.1)+1)*.2;
  flats.push({src:asset.src,x,y,width:asset.w*size,height:asset.h*size,flip:i%2===0});rimDetails++;
 }
 writeFileSync(artDir+'library-closeup-benches.json',JSON.stringify(benches,null,2));
 const metrics={benches:benches.length,lamps,planters,pathEdgeDetails:details,rimDetails};
 writeFileSync(artDir+'library-closeup-metrics.json',JSON.stringify(metrics,null,2));
 return metrics;
}
