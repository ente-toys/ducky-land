// Offline art.json render and collision evidence for the sunpink pass.
import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {geometry} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const poses=read('src/pixi/sleep-poses.json');
for(const theme of ['sunflower']) {
 const A=`public/pixi-art/themes/${theme}/`,D=`rive/web/themes/${theme}/`;
 const OUT='../concepts/themes/work/sunflower/legacy-review/';mkdirSync(OUT,{recursive:true});
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
 const base=makeMap(theme,{world,walk,harbor,sleepers:[]});
 const beds=resolveSleepSpots(base.baseWalk,art.props,geometry(base.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
 const map=makeMap(theme,{world,walk,harbor,sleepers:beds}),geo=geometry(map.walk);
 const source=s=>s.startsWith('/')?'public'+s:A+s;
 const props=art.props.map(p=>({...p,src:source(p.src)}));
 for(const b of beds){
  const pose=poses.poses[b.pose],u=pose.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=pose.box;
  for(const layer of pose.layers){
   const src='public'+layer.src,m=await sharp(src).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;
   const cx=(x0+x1)/2*u;
   props.push({src,x:b.x,y:b.y,width,height,scale:1,anchor:{x:b.flip?1-cx/width:cx/width,y:y1*u/height},flip:b.flip});
  }
 }
 // The actual game Ducky parts, at 130 world units tall, mark the verified spawn.
 const parts=['shadow-0','tail-0','foot-0','foot-1','toe-0','toe-1','body-0','eye-0','eye-1','beak-0'];
 const duckLayers=[];
 for(const part of parts){
  const f=`public/pixi-duck/view-10-${part}.svg`,s=readFileSync(f,'utf8'),[x,y]=s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  duckLayers.push({input:await sharp(f).png().toBuffer(),left:Math.round(x)+100,top:Math.round(y)+100});
 }
 const duck=await sharp({create:{width:900,height:900,channels:4,background:'#00000000'}}).composite(duckLayers).png().toBuffer();
 const trimmed=await sharp(duck).trim().png().toBuffer(),dm=await sharp(trimmed).metadata();
 props.push({src:trimmed,x:map.spawn.x,y:map.spawn.y,width:130*dm.width/dm.height,height:130,anchor:{x:.5,y:1},scale:1});
 props.sort((a,b)=>a.y-b.y);
 async function render(view,k,out,overlay=false) {
  const [ox,oy,cw,ch]=view,W=Math.round(cw*k),H=Math.round(ch*k),comps=[];
  async function add(src,x,y,w,h,flip=false){
   let L=Math.round((x-ox)*k),T=Math.round((y-oy)*k),ww=Math.max(1,Math.round(w*k)),hh=Math.max(1,Math.round(h*k));
   if(L>=W||T>=H||L+ww<=0||T+hh<=0)return;
   let im=sharp(src).resize(ww,hh,{fit:'fill'});if(flip)im=im.flop();let buf=await im.png().toBuffer();
   const left=Math.max(0,-L),top=Math.max(0,-T),width=Math.min(ww-left,W-Math.max(0,L)),height=Math.min(hh-top,H-Math.max(0,T));
   if(left||top||width!==ww||height!==hh)buf=await sharp(buf).extract({left,top,width,height}).png().toBuffer();
   comps.push({input:buf,left:Math.max(0,L),top:Math.max(0,T)});
  }
  for(const t of art.ground.tiles)await add(source(t.src),t.x,t.y,t.width,t.height);
  for(const f of art.flats)await add(source(f.src),f.x-(f.topLeft?0:f.width/2),f.y-(f.topLeft?0:f.height),f.width,f.height,f.flip);
  for(const d of art.decks)await add(source(d.src),d.x,d.y,d.width,d.height);
  for(const p of props){const w=p.width*(p.scale??1),h=p.height*(p.scale??1);await add(p.src,p.x-p.anchor.x*w,p.y-p.anchor.y*h,w,h,p.flip);}
  if(overlay){
   const shapes=world.centrePlacement.blocked.map(o=>o.poly?`<path d="M${o.poly.join(' L')} Z"/>`:`<ellipse cx="${o.x}" cy="${o.y}" rx="${o.rx}" ry="${o.ry}"/>`).join('');
   const stairs=world.centrePlacement.stairs.map(s=>`<path d="M${s.top} L${s.bottom}"/>`).join('');
   comps.push({input:Buffer.from(`<svg width="${W}" height="${H}" viewBox="${ox} ${oy} ${cw} ${ch}"><g fill="#ff0033" fill-opacity=".2" stroke="#ff0033" stroke-width="3">${shapes}</g><g fill="none" stroke="#00bbff" stroke-width="8">${stairs}</g></svg>`),left:0,top:0});
  }
  await sharp({create:{width:W,height:H,channels:4,background:art.sea}}).composite(comps).png().toFile(out);
 }
 await render([0,0,art.width,art.height],1160/art.width,OUT+'preview.png');
 const [cx,cy]=world.centrePlacement.origin;
 await render([cx-1400,cy-1100,2800,2100],.55,OUT+'sunpink-centre-review.png');
 await render([cx-1400,cy-1100,2800,2100],.55,OUT+'sunpink-centre-walk.png',true);
 if(theme==='pink')for(const [i,a]of world.arches.entries()){
  await render([(a.a[0]+a.b[0])/2-650,(a.a[1]+a.b[1])/2-650,1300,1300],.65,OUT+`sunpink-bridge-${i+1}.png`);
 }
 // Flood fill with the actual padded obstacles and all 40 sleeper footprints installed.
 const G=20,W=Math.ceil(world.width/G),H=Math.ceil(world.height/G),ok=new Uint8Array(W*H),seen=new Uint8Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)ok[y*W+x]=geo.walkable(x*G,y*G);
 const cell=(x,y)=>Math.round(y/G)*W+Math.round(x/G),start=cell(map.spawn.x,map.spawn.y),q=[start];seen[start]=1;
 for(let i=0;i<q.length;i++){const at=q[i],x=at%W,y=Math.floor(at/W);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const xx=x+dx,yy=y+dy,j=yy*W+xx;if(xx>=0&&xx<W&&yy>=0&&yy<H&&ok[j]&&!seen[j]){seen[j]=1;q.push(j);}
 }}
 const reached=(x,y)=>[-20,0,20].some(dy=>[-20,0,20].some(dx=>seen[cell(x+dx,y+dy)]));
 const errors=[];
 for(const [name,z]of Object.entries(world.zones))if(!geo.walkable(...z.spawn)||!reached(...z.spawn))errors.push(`zone ${name}: ${z.spawn}`);
 for(const s of world.centrePlacement.stairs)for(let i=0;i<=20;i++){
  const t=i/20,x=s.top[0]*(1-t)+s.bottom[0]*t,y=s.top[1]*(1-t)+s.bottom[1]*t;
  if(!geo.walkable(x,y)||!reached(x,y))errors.push(`stair ${s.name}: t=${t}`);
 }
 for(const [i,a] of world.arches.entries()){
  if(!world.walkways.some(w=>JSON.stringify(w.a)===JSON.stringify(a.a)&&JSON.stringify(w.b)===JSON.stringify(a.b)))errors.push(`arch ${i} lacks walkway`);
  for(let i=0;i<=20;i++){const t=i/20,x=a.a[0]*(1-t)+a.b[0]*t,y=a.a[1]*(1-t)+a.b[1]*t;if(!geo.walkable(x,y)||!reached(x,y))errors.push(`arch unreachable ${x},${y}`);}
 }
 const area=Math.abs(world.coast.reduce((sum,p,i)=>{const n=world.coast[(i+1)%world.coast.length];return sum+p[0]*n[1]-n[0]*p[1];},0))/2;
 const report={theme,landArea:area,homeRatio:area/11090000,sleepers:beds.length,sleeperDrops:beds.bad,
  reachablePercent:100*q.length/ok.reduce((a,b)=>a+b,0),spawn:map.spawn,stairs:world.centrePlacement.stairs.length,arches:world.arches.length,errors};
 writeFileSync(D+'sunpink-validation.json',JSON.stringify(report,null,2)+'\n');
 console.log(report);if(errors.length||beds.length!==40)process.exitCode=1;
}
