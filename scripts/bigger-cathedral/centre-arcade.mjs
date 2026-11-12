// Bellovo's arms stop after three readable bays, at solid square end pavilions.
// Three authored facade treatments: front, three-quarter left, three-quarter right.
// Points are authored in the SVG itself. There are no sprite rotations or skews.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {LEFT,RIGHT} from './centre-art-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/';
const ink='#39472d',stone='#EBCB87',light='#FFF0C7',shade='#C59B59',roof='#D9753D',terra='#BA542F';
const n=v=>Math.round(v*100)/100;
const pt=q=>q.map(n).join(' ');
const path=(d,fill='none',stroke=ink,w=4.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const polygon=(points,fill,stroke=ink,w=4.5)=>path('M'+points.map(pt).join('L')+'Z',fill,stroke,w);
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function pier(q,out){
 const [x,y]=q,w=26,c=w+7,base=w+8,d=out*22;
 // The base, shaft and capital each have a top, a warm face and a shaded return.
 let s=`<g data-arcade-pier="shared">`;
 s+=polygon([[x-w,y-166],[x+w,y-166],[x+w,y-18],[x-w,y-18]],stone);
 s+=polygon([[x+out*w,y-166],[x+out*w+d,y-179],[x+out*w+d,y-31],[x+out*w,y-18]],shade);
 s+=path(`M${x-w+8} ${y-157}V${y-29}`,'none',light,4);
 s+=polygon([[x-c,y-178],[x+c,y-178],[x+c+d,y-191],[x-c+d,y-191]],light);
 s+=polygon([[x-c,y-178],[x+c,y-178],[x+c,y-161],[x-c,y-161]],stone);
 s+=polygon([[x+out*c,y-178],[x+out*c+d,y-191],[x+out*c+d,y-174],[x+out*c,y-161]],shade);
 s+=polygon([[x-base,y-18],[x+base,y-18],[x+base+d,y-31],[x-base+d,y-31]],light);
 s+=polygon([[x-base,y-18],[x+base,y-18],[x+base,y+1],[x-base,y+1]],stone);
 s+=polygon([[x+out*base,y-18],[x+out*base+d,y-31],[x+out*base+d,y-12],[x+out*base,y+1]],shade);
 return s+'</g>';
}
function facade(a,b,depth,variant){
 const out=depth[0]<0?-1:1;
 const q=(t,h=0,d=0)=>{const c=lerp(a,b,t);return [c[0]+depth[0]*d,c[1]-h+depth[1]*d];};
 // A filled spandrel, round intrados, and an exposed soffit. The opening has no fill.
 // Insets are measured along the bay, so even the oblique bays have solid jambs.
 const inset=.13,opening=Array.from({length:25},(_,i)=>{
  const u=i/24,t=inset+u*(1-2*inset);return q(t,154+90*Math.sqrt(Math.max(0,1-(2*u-1)**2)));
 });
 const soffit=opening.map(([x,y])=>[x+depth[0]*.20,y+depth[1]*.20]);
 let s=`<g data-bay-variant="${variant}" data-open-round-arch="true">`;
 s+=polygon([...opening,...soffit.toReversed()],shade);
 s+=polygon([q(0,311),q(1,311),q(1,154),...opening.toReversed(),q(0,154)],stone);
 // Radiating joints live in the stone mass, rather than substituting thin arcs for it.
 for(const u of [.12,.3,.5,.7,.88]){
  const t=inset+u*(1-2*inset),rise=90*Math.sqrt(1-(2*u-1)**2),p=q(t,154+rise);
  s+=path(`M${pt(p)}L${pt(q(t+(u-.5)*.035,184+rise))}`,'none','#A68850',2.4);
 }
 s+=path('M'+opening.map(pt).join('L'),'none',ink,4.5);
 s+=`</g>`;
 // Continuous straight entablature with an explicit shadowed eave thickness.
 s+=`<g data-solid-entablature="true">`;
 s+=polygon([q(-.035,315),q(1.035,315),q(1.035,291),q(-.035,291)],light);
 s+=polygon([q(-.035,291),q(1.035,291),q(1.035,280),q(-.035,280)],shade);
 s+='</g>';
 // Each bay has its own Home-house gable. The repeated roof peaks separate
 // the modules immediately, instead of reconstructing another bent ribbon.
 const rf=q(-.055,319),ef=q(1.055,319),rb=q(-.055,319,1),eb=q(1.055,319,1);
 const peak=variant==='front-facing'?.5:variant==='three-quarter-left'?.43:.57;
 const ra=q(peak,374),re=q(peak,374,1);
 s+=`<g data-straight-tiled-roof="true">`;
 // A stone gable seats directly on the entablature, with the tiled roof above.
 s+=polygon([rf,ra,ef],stone);
 s+=polygon([rf,rb,re,ra],roof);
 s+=polygon([ra,re,eb,ef],terra);
 for(const t of [.22,.46,.70,.88]){
  const onLeft=lerp(rf,ra,t),onLeftBack=lerp(rb,re,t);
  const onRight=lerp(ef,ra,t),onRightBack=lerp(eb,re,t);
  s+=path(`M${pt(onLeft)}L${pt(onLeftBack)}M${pt(onRight)}L${pt(onRightBack)}`,'none','#8C492D',2.4);
 }
 // Projecting stone rake and deep eaves belong to this roof alone.
 s+=path(`M${pt(rf)}L${pt(ra)}L${pt(ef)}`,'none',ink,15);
 s+=path(`M${pt(rf)}L${pt(ra)}L${pt(ef)}`,'none',light,9);
 s+=polygon([ef,eb,[eb[0],eb[1]+16],[ef[0],ef[1]+16]],light);
 s+=polygon([rf,rb,[rb[0],rb[1]+16],[rf[0],rf[1]+16]],shade);
 s+=path(`M${pt(ra)}L${pt(re)}`,'none',terra,7);
 s+='</g>';
 // Each station is drawn once, by the bay that starts there. The final
 // station belongs to the pavilion, so no doubled shafts or capitals remain.
 s+=pier(a,out);
 return s;
}
function endPavilion([x,y],out){
 const q=(u,v)=>[x+u,y+v],d=out*82;
 const front=[q(-72,5),q(72,5)],back=front.map(([u,v])=>[u+d,v-56]);
 let s=`<path data-contact-shadow="end-pavilion" d="M${x-84} ${y+9}H${x+84}L${x+84+d} ${y-47}H${x-84+d}Z" fill="${ink}" opacity=".16"/>`;
 s+='<g data-end-pavilion="square" data-grounded-block="true">';
 s+=polygon([q(-62,-314),q(62,-314),q(62,-18),q(-62,-18)],stone);
 s+=polygon([q(out*62,-314),q(out*62+d,-370),q(out*62+d,-74),q(out*62,-18)],shade);
 // Recessed stone panel and sparse bed joints give the broad face scale.
 s+=polygon([q(-43,-276),q(43,-276),q(43,-55),q(-43,-55)],light);
 s+=polygon([q(-31,-264),q(31,-264),q(31,-66),q(-31,-66)],stone);
 for(const v of [-222,-139])s+=path(`M${pt(q(-28,v))}H${x+28}`,'none','#B58D51',2.5);
 s+=polygon([q(-72,-18),q(72,-18),q(72+d,-74),q(-72+d,-74)],light);
 s+=polygon([q(-72,-18),q(72,-18),...front.toReversed()],stone);
 s+=polygon([q(out*72,-18),q(out*72+d,-74),q(out*72+d,-51),q(out*72,5)],shade);
 s+=polygon([q(-78,-332),q(78,-332),q(78+d,-388),q(-78+d,-388)],light);
 s+=polygon([q(-78,-332),q(78,-332),q(78,-310),q(-78,-310)],light);
 s+=polygon([q(out*78,-332),q(out*78+d,-388),q(out*78+d,-366),q(out*78,-310)],shade);
 s+='</g><g data-hipped-terracotta-roof="true">';
 const a=q(-86,-335),b=q(86,-335),c=q(86+d,-391),e=q(-86+d,-391),peak=q(d/2,-446);
 s+=polygon([a,b,c,e],terra);
 s+=polygon([a,b,peak],roof);
 s+=polygon(out>0?[b,c,peak]:[a,e,peak],terra);
 s+=polygon([e,c,peak],'#CA6838');
 for(const t of [.25,.5,.75])s+=path(`M${pt(lerp(a,peak,t))}L${pt(lerp(b,peak,t))}`,'none','#8C492D',2.4);
 for(const t of [.23,.47,.71])s+=path(`M${pt(lerp(a,b,t))}L${pt(peak)}`,'none','#AC512F',2.4);
 s+=path(`M${pt(a)}L${pt(peak)}L${pt(b)}M${pt(peak)}L${pt(out>0?c:e)}`,'none',ink,4.5);
 return {body:s+'</g>',foot:[front[0],front[1],back[1],back[0]]};
}
const front=(a,b,d)=>facade(a,b,d,'front-facing');
const left=(a,b,d)=>facade(a,b,d,'three-quarter-left');
const right=(a,b,d)=>facade(a,b,d,'three-quarter-right');
export function segmentedArcades(){
 const art=JSON.parse(fs.readFileSync(A+'art.json')),metrics=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/centre-art-metrics.json'));
 art.props=art.props.filter(p=>!/^centre-colonnade-(?:left|right)-[4-6]$|^centre-end-pavilion-/.test(p.id));
 const portals=[],solids=[],walkways={};
 for(const [side,points]of [['left',LEFT],['right',RIGHT]]){
  const out=side==='left'?-1:1,depth=[out*104,-70];
  walkways[side]=points.slice(1,3).map(([x,y])=>[x+out*82,y-48]);
  for(let i=0;i<3;i++){
   const a=points[i],b=points[i+1],angle=Math.atan2(b[1]-a[1],Math.abs(b[0]-a[0]))*180/Math.PI;
   const draw=angle<30?front:out<0?left:right;
   let body=`<path data-contact-shadow="arcade-bay" d="M${a[0]-40+out*8} ${a[1]+5}a40 11 0 1 0 80 0a40 11 0 1 0 -80 0M${b[0]-40+out*8} ${b[1]+5}a40 11 0 1 0 80 0a40 11 0 1 0 -80 0" fill="${ink}" opacity=".16"/>`;
   // The first bay's roof seats inside the existing cathedral/tower socket.
   if(i===0)body+=`<g data-roof-abutment="${side}">`+(side==='left'?polygon([[3490,1492],[3535,1480],[3600,1540],[3580,1570]],roof):polygon([[4600,1518],[4636,1492],[4710,1492],[4720,1540],[4620,1570]],roof))+'</g>';
   body+=draw(a,b,depth);
   const x0=Math.floor(Math.min(a[0],b[0],a[0]+depth[0],b[0]+depth[0]))-65;
   const y0=Math.floor(Math.min(a[1],b[1]))-450;
   const w=Math.ceil(Math.max(a[0],b[0],a[0]+depth[0],b[0]+depth[0]))-x0+65;
   const h=Math.ceil(Math.max(a[1],b[1]))-y0+28;
   body=localise(body,x0,y0);
   const id=`centre-colonnade-${side}-${i+1}`;
   let p=art.props.find(p=>p.id===id);
   if(!p){p={id,rasterMargin:16,wind:false};art.props.push(p);}
   Object.assign(p,{name:'Segmented stone arcade bay',src:`centre/arcade-${side}-${i+1}.svg`,x:x0+w/2,y:Math.max(a[1],b[1])+4,width:w,height:h,anchor:{x:.5,y:(Math.max(a[1],b[1])+4-y0)/h},sortY:Math.max(a[1],b[1])+4,scale:1,shadow:false,contact:false,flip:false});
   p.arcadeVariant=angle<30?'front-facing':out<0?'three-quarter-left':'three-quarter-right';
   fs.writeFileSync(A+p.src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>Bellovo straight ${p.arcadeVariant} stone arcade bay</title>${body}</svg>\n`);
   solids.push({id:`centre-pier-${side}-${i}`,x:a[0]+out*11,y:a[1]-15,rx:42,ry:20});
   const mid=lerp(a,b,.5);portals.push({side,bay:i+1,front:mid,rear:[mid[0]+depth[0],mid[1]+depth[1]]});
  }
  const q=points[3],pavilion=endPavilion(q,out),x0=q[0]-180,y0=q[1]-460,w=360,h=490;
  const p={id:`centre-end-pavilion-${side}`,name:'Square stone arcade end pavilion',src:`centre/end-pavilion-${side}.svg`,x:q[0],y:q[1]+9,width:w,height:h,scale:1,anchor:{x:.5,y:469/h},sortY:q[1]+9,rasterMargin:16,shadow:false,contact:false,wind:false,flip:false};
  art.props.push(p);
  fs.writeFileSync(A+p.src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>Bellovo ${side} square end pavilion, stone front and return with hipped terracotta roof</title>${localise(pavilion.body,x0,y0)}</svg>\n`);
  solids.push({id:`centre-end-pavilion-${side}`,poly:pavilion.foot});
 }
 for(const file of ['world.json','walk-world.json']){
  const world=JSON.parse(fs.readFileSync(D+file));world.obstacles=world.obstacles.filter(o=>!/^centre-(pier-|end-pavilion-)/.test(o.id??''));world.obstacles.push(...solids);
  if(file==='world.json')world.props=art.props;
  fs.writeFileSync(D+file,JSON.stringify(world,null,2)+'\n');
 }
 art.raster.enabled=false;
 fs.writeFileSync(A+'art.json',JSON.stringify(art,null,2)+'\n');
 Object.assign(metrics,{colonnadeBays:6,endPavilions:2,footprints:solids.length+4,portals,coveredWalkways:walkways,arcade:'segmented',variants:['front-facing','three-quarter-left','three-quarter-right']});
 fs.writeFileSync('scripts/bigger-cathedral/centre-art-metrics.json',JSON.stringify(metrics,null,2)+'\n');
}
function localise(svg,x0,y0){return svg.replace(/d="([^"]+)"/g,(_,d)=>'d="'+d.replace(/([MLHVCAQZmlhvcaqz])([^MLHVCAQZmlhvcaqz]*)/g,(_,cmd,args)=>{const v=args.trim().split(/[ ,]+/).filter(Boolean).map(Number);if(['M','L','C','Q'].includes(cmd))for(let j=0;j<v.length;j++)v[j]-=j%2?y0:x0;else if(cmd==='H')v.forEach((_,j)=>v[j]-=x0);else if(cmd==='V')v.forEach((_,j)=>v[j]-=y0);return cmd+v.map(n).join(' ');})+'"');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)segmentedArcades();
