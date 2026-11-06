// Direct SVG inspection when the execution sandbox blocks Vite/Chromium.
import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
import {animateCentre} from './animate.mjs';
import assert from 'node:assert/strict';
import {geometry} from '../../../../../rive/web/island-geometry.mjs';
const root=process.cwd();
function inside(x,y,s){if(s.ellipse){const e=s.ellipse;return ((x-e.x)/e.rx)**2+((y-e.y)/e.ry)**2<1;}let yes=false;for(let i=0,j=s.poly.length-1;i<s.poly.length;j=i++){const [a,b]=s.poly[i],[c,d]=s.poly[j];if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;}
for(const theme of ['waterfall']){
 const folder=`${root}/public/pixi-art/themes/${theme}/centre/`,d=JSON.parse(readFileSync(folder+'centre.json'));
 const geo=geometry({coast:[[-2000,-2000],[2000,-2000],[2000,1700],[-2000,1700]],water:d.water.map(s=>s.ellipse??s),obstacles:d.blocked.map(s=>s.ellipse??s),islets:[],walkways:[],bridges:[]});
 assert.equal(new Set(d.pieces.map(p=>p.id)).size,d.pieces.length);
 assert(d.walkable.some(s=>inside(...d.spawn,s))&&!d.blocked.some(s=>inside(...d.spawn,s)),'spawn must be clear');
 const records=d.pieces.map((p,i)=>{assert(p.width>0&&p.height>0);assert(['decal','back','sorted','front','anim'].includes(p.layer));if(['sorted','front','anim'].includes(p.layer))assert(Number.isFinite(p.sortY));
 const sprite={x:p.x,y:p.y,alpha:1,scale:{x:1,y:1,set(x,y){this.x=x;this.y=y;}}};return {piece:p,sprite,z:p.layer==='decal'?-100000+i:p.layer==='back'?-50000+i:p.sortY+i*.0001};});
 const animated=records.filter(r=>r.piece.animate);
 for(const t of [0,.3,.75,1,8,100,10000]){animateCentre(records,t);for(const {sprite:s}of records){assert(Number.isFinite(s.x+s.y+s.scale.x+s.scale.y+s.alpha));assert(s.alpha>=0&&s.alpha<=1);}}
 for(const record of animated){const p=record.piece;animateCentre([record],.37);const a=JSON.stringify(record.sprite);animateCentre([record],.37+p.animate.period);const s=record.sprite;const prev=JSON.parse(a);assert(Math.abs(s.y-prev.y)<1e-7&&Math.abs(s.alpha-prev.alpha)<1e-7,'loop must be seamless');}
 animateCentre(records,1,true);for(const {piece:p,sprite:s}of animated){assert.equal(s.x,p.x);assert.equal(s.y,p.y);assert.equal(s.alpha,1);}
 let seed=39;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),pts=[];
 for(let tries=0;pts.length<100&&tries<100000;tries++){const x=(rnd()*2-1)*1060,y=(rnd()*2-1)*790;if(!d.walkable.some(s=>inside(x,y,s))||!geo.walkable(x,y)||pts.some(p=>Math.hypot(x-p[0],(y-p[1])/.766)<95))continue;pts.push([x,y]);}
 assert.equal(pts.length,100);
 const bounds=[Math.min(...d.pieces.map(p=>p.x))-80,Math.min(...d.pieces.map(p=>p.y))-100,Math.max(...d.pieces.map(p=>p.x+p.width))+80,Math.max(...d.pieces.map(p=>p.y+p.height))+80];
 const S=Math.min(1520/(bounds[2]-bounds[0]),1380/(bounds[3]-bounds[1])),ox=800-(bounds[0]+bounds[2])/2*S,oy=780-(bounds[1]+bounds[3])/2*S;
 const db=await sharp(root+'/public/pixi-art/themes/waterfall/centre/ducky-scale.svg').metadata(),dh=130,dw=db.width/db.height*dh;
 const ducks=pts.map(([x,y])=>({duck:true,x:x-dw/2,y:y-dh,w:dw,h:dh,z:y}));
 for(const [frame,t]of [[0,.5],[1,1.15]]){
  if(theme==='goldmine'&&frame)continue;
  animateCentre(records,t);const comps=[];
  for(const r of [...records,...ducks].sort((a,b)=>a.z-b.z)){
   let x,y,w,h,opacity=1,src;
   if(r.duck){({x,y,w,h}=r);src=root+'/public/pixi-art/themes/waterfall/centre/ducky-scale.svg';}
   else{const p=r.piece,s=r.sprite;x=s.x;y=s.y;w=p.width*s.scale.x;h=p.height*s.scale.y;opacity=s.alpha;src=folder+p.file;}
   let buffer=await sharp(src).resize(Math.max(1,Math.round(w*S)),Math.max(1,Math.round(h*S)),{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   if(opacity!==1)for(let i=3;i<buffer.data.length;i+=4)buffer.data[i]=Math.round(buffer.data[i]*opacity);
   comps.push({input:buffer.data,raw:buffer.info,left:Math.round(ox+x*S),top:Math.round(oy+y*S)});
  }
  comps.push({input:Buffer.from(`<svg width="1600" height="80"><rect x="20" y="16" width="740" height="45" rx="6" fill="#fff0c7"/><text x="36" y="46" font-family="sans-serif" font-size="20" fill="#39452f">${d.name} · 100 Duckies · assembled SVG${frame?' · water frame 2':''}</text></svg>`),left:0,top:0});
  await sharp({create:{width:1600,height:1500,channels:4,background:'#89C332'}}).composite(comps).png().toFile(root+'/../concepts/themes/work/waterfall/centre/'+(frame?'water-frame-2.png':`${theme}-centre-built.png`));
 }
 console.log(theme,JSON.stringify({pieces:d.pieces.length,animated:animated.length,ducks:pts.length,checks:'manifest, spawn, sortY, animation finite/ranges/loops/reduced motion PASS'}));
}
