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
const WORK=fileURLToPath(new URL('../../../concepts/themes/work/canal/',import.meta.url));
const round=process.argv[2]||'final',OUT=WORK+round;mkdirSync(OUT,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),A='public/pixi-art/themes/canal/',D='assets/world/themes/canal/';
let art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');

const harbor=read(D+'harbor.json'),base=makeMap('canal',{world,walk,harbor,sleepers:[]}).baseWalk;
const beds=resolveSleepSpots(base,art.props,geometry(base).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const source=p=>p.startsWith('/pixi-')?'public'+p:p.startsWith('/')?p.slice(1).split('?')[0]:A+p;
const poses=read('src/pixi/sleep-poses.json');
async function sleepers(list){const out=[];for(const b of list){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
 for(const l of p.layers){const src='public'+l.src,m=await sharp(src).metadata(),w=m.width/poses.F*u,h=m.height/poses.F*u;out.push({src,x:b.x,y:b.y,width:w,height:h,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/w:(x0+x1)/2*u/w,y:y1*u/h},flip:b.flip});}}
 return out;}
const theme={...art,props:art.props.map(p=>({...p,src:source(p.src)})),flats:art.flats.map(p=>({...p,src:source(p.src)})),decks:art.decks.map(p=>({...p,src:source(p.src)})),ground:{tiles:art.ground.tiles.map(p=>({...p,src:source(p.src)}))}};
theme.props.push(...await sleepers(beds));
theme.floating=(art.floating??[]).map(p=>({...p,src:source(p.src)}));
const hp=read(A+'build-metrics.json').previewHarbor;theme.decks.push({...hp,src:source(hp.src)});
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
  let L=Math.round((x-ox)*k),T=Math.round((y-oy)*k*K),ww=Math.max(1,Math.round((x+w-ox)*k)-L),hh=Math.max(1,Math.round((y+h/(upright?K:1)-oy)*k*K)-T);
  if(L>=W||T>=H||L+ww<=0||T+hh<=0)return;
  const key=`${src}:${ww}:${hh}:${flip}`;
  let buf=cache.get(key);if(!buf){let s=sharp(src).resize(ww,hh,{fit:'fill'});if(flip)s=s.flop();buf=await s.png().toBuffer();if(cache.size>1200)cache.clear();cache.set(key,buf);}
  const left=Math.max(0,-L),top=Math.max(0,-T),width=Math.min(ww-left,W-Math.max(0,L)),height=Math.min(hh-top,H-Math.max(0,T));
  if(left||top||width!==ww||height!==hh)buf=await sharp(buf).extract({left,top,width,height}).png().toBuffer();
  comps.push({input:buf,left:Math.max(0,L),top:Math.max(0,T)});
 }
 for(const p of a.ground.tiles)await add(p.src,p.x,p.y,p.width,p.height);
 for(const p of a.floating??[])await add(p.src,p.x-p.width/2,p.y-p.height/2,p.width,p.height);
 for(const p of a.flats)await add(p.src,p.x-(p.topLeft?0:p.width/2),p.y-(p.topLeft?0:p.height),p.width,p.height,false,p.flip);
 for(const p of a.decks)await add(p.src,p.x,p.y,p.width,p.height);
 for(const p of a.props.slice().sort((a,b)=>a.y-b.y)){const w=p.width*(p.scale??1),h=p.height*(p.scale??1),anchor=p.anchor??{x:.5,y:1};await add(p.src,p.x-anchor.x*w,p.y-anchor.y*h/K,w,h,true,p.flip);}
 await sharp({create:{width:W,height:H,channels:4,background:a.sea||'#6EC9DE'}}).composite(comps).png().toFile(out);
}
const views={canal:[['island',[4000,3000,.25]],['plaza',[4000,3320,.65]],['bench',[4330,3000,1]],['junction',[1370,3020,1]],['trees',[3300,1250,1]],['lawn',[1450,3300,1]],['stalls',[2140,1890,1]],['north-lawn',[4900,1140,1]],['east-lawn',[6500,3800,1]],['east-stalls',[6310,2370,1]],['south-stalls',[2725,4855,1]]],home:[['island',[2900,2200,.25]],['plaza',[2820,2370,.65]],['bench',[2520,2110,1]],['junction',[2500,1900,1]],['trees',[2100,1900,1]]]};
for(const [name,a]of [['home',home],['canal',theme]])for(const [v,cam]of views[name]){await render(a,cam,`${OUT}/${name}-${v}.png`,v==='island'?2500:1200,v==='island'?1800:850);console.log(name,v);}
await sharp({create:{width:5000,height:1800,channels:3,background:'#6EC9DE'}}).composite([{input:`${OUT}/home-island.png`,left:0,top:0},{input:`${OUT}/canal-island.png`,left:2500,top:0}]).png().toFile(`${OUT}/canal-vs-home.png`);
const panels=[];for(const [i,n]of ['plaza','bench','junction','trees'].entries())for(const [j,t]of ['home','canal'].entries())panels.push({input:`${OUT}/${t}-${n}.png`,left:j*1200,top:i*850});
await sharp({create:{width:2400,height:3400,channels:3,background:'#6EC9DE'}}).composite(panels).png().toFile(`${OUT}/canal-closeups-vs-home.png`);
writeFileSync(`${OUT}/render.json`,JSON.stringify({renderer:'Production SVG assets and placements composited with Sharp; static, browser sandbox blocked',sleepers:beds.length,dropped:beds.bad,overviewZoom:.25,groundProjection:1,comparison:'Home left, Canal right'},null,2));
