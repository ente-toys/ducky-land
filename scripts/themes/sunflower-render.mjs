// Raster evidence fallback when macOS sandbox refuses Chromium launch.
// Uses production home placements + SVG assets, default top-down projection and upright props.
// Animation, foam and GPU rendering still need the separate browser capture.
import sharp from 'sharp';
import {createServer} from 'vite';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const WORK=fileURLToPath(new URL('../../../concepts/themes/work/sunflower/',import.meta.url));
const round=process.argv[2]||'final',OUT=WORK+round;mkdirSync(OUT,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),A='public/pixi-art/themes/sunflower/',D='assets/world/themes/sunflower/';
let art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
if(round==='before'){art=read(WORK+'baseline/art.json');world=read(WORK+'baseline/world.json');walk=read(WORK+'baseline/walk-world.json');}
const harbor=read(D+'harbor.json'),base=makeMap('sunflower',{world,walk,harbor,sleepers:[]}).baseWalk;
const beds=resolveSleepSpots(base,art.props,geometry(base).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const source=p=>p.startsWith('/pixi-')?'public'+p:p.startsWith('/')?p.slice(1).split('?')[0]:A+p;
const poses=read('src/pixi/sleep-poses.json');
async function sleepers(list){const out=[];for(const b of list){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
 for(const l of p.layers){const src='public'+l.src,m=await sharp(src).metadata(),w=m.width/poses.F*u,h=m.height/poses.F*u;out.push({src,x:b.x,y:b.y,width:w,height:h,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/w:(x0+x1)/2*u/w,y:y1*u/h},flip:b.flip});}}
 return out;}
const theme={...art,props:art.props.map(p=>({...p,src:source(p.src)})),flats:art.flats.map(p=>({...p,src:source(p.src)})),decks:art.decks.map(p=>({...p,src:source(p.src)})),ground:{tiles:art.ground.tiles.map(p=>({...p,src:source(p.src)}))}};
theme.props.push(...await sleepers(beds));
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
let home;
try{
 const P=await vite.ssrLoadModule('/src/pixi/placements.js'),W=P.trimWorld((await vite.ssrLoadModule('/assets/world/world.json')).default);
 const props=P.createPlacements(W,geometry({...W,obstacles:[]}).walkable),local=P.walkWorld(W,props),B=P.sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths());
 const a=read('src/pixi/art-manifest.json');
 home={sea:'#6EC9DE',ground:a.ground,decks:P.JETTIES,props,flats:[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},{src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},...P.decalsFor(W,props,geometry({...W,obstacles:[]}).walkable)]};
 for(const list of [home.ground.tiles,home.decks,home.props,home.flats])for(const p of list)p.src=source(p.src);
 home.props.push(...await sleepers(B));
}finally{await vite.close();}
const cache=new Map();
async function render(a,camera,out,W=1200,H=850){
 const [cx,cy,k]=camera,K=1,ox=cx-W/k/2,oy=cy-H/k/K/2,comps=[];
 async function add(src,x,y,w,h,upright=false,flip=false){
  let L=Math.round((x-ox)*k),T=Math.round((y-oy)*k*K),ww=Math.max(1,Math.round(w*k)),hh=Math.max(1,Math.round(h*k*(upright?1:K)));
  if(L>=W||T>=H||L+ww<=0||T+hh<=0)return;
  const key=`${src}:${ww}:${hh}:${flip}`;
  let buf=cache.get(key);if(!buf){let s=sharp(src).resize(ww,hh,{fit:'fill'});if(flip)s=s.flop();buf=await s.png().toBuffer();if(cache.size>1200)cache.clear();cache.set(key,buf);}
  const left=Math.max(0,-L),top=Math.max(0,-T),width=Math.min(ww-left,W-Math.max(0,L)),height=Math.min(hh-top,H-Math.max(0,T));
  if(left||top||width!==ww||height!==hh)buf=await sharp(buf).extract({left,top,width,height}).png().toBuffer();
  comps.push({input:buf,left:Math.max(0,L),top:Math.max(0,T)});
 }
 for(const p of a.ground.tiles)await add(p.src,p.x,p.y,p.width,p.height);
 for(const p of a.flats)await add(p.src,p.x-(p.topLeft?0:p.width/2),p.y-(p.topLeft?0:p.height),p.width,p.height,false,p.flip);
 for(const p of a.decks)await add(p.src,p.x,p.y,p.width,p.height);
 for(const p of a.props.slice().sort((a,b)=>a.y-b.y)){const w=p.width*(p.scale??1),h=p.height*(p.scale??1),anchor=p.anchor??{x:.5,y:1};await add(p.src,p.x-anchor.x*w,p.y-anchor.y*h/K,w,h,true,p.flip);}
 await sharp({create:{width:W,height:H,channels:4,background:a.sea||'#6EC9DE'}}).composite(comps).png().toFile(out);
}
const views={sunflower:[['island',[4000,2800,.25]],['plaza',[3880,2608,1]],['plaza-wide',[3880,2608,.65]],['bench',[3210,2160,1]],['junction',[2680,2390,1]],['trees',[2230,3700,1]],['lawn',[5700,2070,1]],['stalls',[4325,1765,1]]],home:[['island',[2900,2200,.25]],['plaza',[2820,2370,1]],['plaza-wide',[2820,2370,.65]],['bench',[2520,2110,1]],['junction',[2500,1900,1]],['trees',[2100,1900,1]]]};
for(const [name,a]of [['home',home],['sunflower',theme]])for(const [v,cam]of views[name]){await render(a,cam,`${OUT}/${name}-${v}.png`,v==='island'?2500:1200,v==='island'?1800:850);console.log(name,v);}
await sharp({create:{width:5000,height:1800,channels:3,background:'#6EC9DE'}}).composite([{input:`${OUT}/home-island.png`,left:0,top:0},{input:`${OUT}/sunflower-island.png`,left:2500,top:0}]).png().toFile(`${OUT}/sunflower-vs-home.png`);
const panels=[];for(const [i,n]of ['plaza','bench','junction','trees'].entries())for(const [j,t]of ['home','sunflower'].entries()){panels.push({input:`${OUT}/${t}-${n}.png`,left:j*1200,top:i*890+40});panels.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="40"><rect width="1200" height="40" fill="#FFF3D2"/><text x="20" y="27" font-family="sans-serif" font-size="21" fill="#39472D">${t.toUpperCase()} / ${n} / 1 px per world unit / static SVG render</text></svg>`),left:j*1200,top:i*890});}
await sharp({create:{width:2400,height:3560,channels:3,background:'#6EC9DE'}}).composite(panels).png().toFile(`${OUT}/sunflower-closeups-vs-home.png`);
writeFileSync(`${OUT}/render.json`,JSON.stringify({renderer:'sharp SVG, production placements, static pose; browser sandbox blocked',sleepers:beds.length,dropped:beds.bad,overviewZoom:.25,detailZoom:1,plazaWideZoom:.65,groundProjection:1,comparison:'Home left, Sunflower right'},null,2));
