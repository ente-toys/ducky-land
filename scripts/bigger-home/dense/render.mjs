// Read-only assembly of Home's production SVG layers. No game files are written.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const out=path.resolve(root,'../concepts/themes/world-map/bigger');
const stage=process.env.HOME_STAGE??'after';
const require=createRequire(root+'/package.json');
const sharp=require('sharp');
const {createServer}=await import(require.resolve('vite'));
const vite=await createServer({root,configFile:false,cacheDir:'/private/tmp/ducky-home-dense-render',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
import {mkdirSync} from 'node:fs';
mkdirSync(out+'/home-dense-crops',{recursive:true});mkdirSync(out+'/home-dense-work',{recursive:true});
const crop=process.env.HOME_CROP?.split(',').map(Number);
const W=crop?1800:1600,H=crop?1500:1200,k=crop?.[2]??(process.env.HOME_PRESERVE?.18:.135),offset=crop?{x:W/2-crop[0]*k,y:H/2-crop[1]*k}:process.env.HOME_PRESERVE?{x:278,y:204}:{x:800-2877.777777777778*k,y:600-2088.888888888889*k};
try {
 const load=p=>vite.ssrLoadModule(p);
 const P=await load('/src/pixi/placements.js');
 const {geometry}=await load('/rive/web/island-geometry.mjs');
 const world=P.trimWorld(JSON.parse(readFileSync(root+'/rive/web/world.json')));
 const art=JSON.parse(readFileSync(root+'/src/pixi/art-manifest.json'));
 const before=JSON.parse(readFileSync(root+'/scripts/bigger-home/dense/before.json'));
 const baseProps=P.createPlacements(world,geometry({...world,obstacles:[]}).walkable);
 const props=stage==='before'?[...baseProps.filter(p=>!String(p.id).startsWith('bigger-')),...before.props]:baseProps;
 const local=P.walkWorld(world,props);
 const oldLand=geometry({...world,obstacles:[]}).walkable,grownLand={...world,coast:local.coast};
 const flats=[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},
 {src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},
 ...P.homeDecals(props)];
 const decks=[...P.HOME_DECKS,...P.JETTIES,{src:'/pixi-art/library-steps.svg',x:2780,y:1370,width:280,height:260}];
 const {sleepHalfWidths}=await load('/src/pixi/sleep-spots.js');
 const beds=P.sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths());
 const poses=JSON.parse(readFileSync(root+'/src/pixi/sleep-poses.json'));
 for(const b of beds){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
  for(const l of p.layers){const src=root+'/public'+l.src,m=await sharp(src).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;
   props.push({src,x:b.x,y:b.y,width,height,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height},flip:b.flip});}}
 const layers=[],cache=new Map();
 const source=s=>s.startsWith('/pixi-art/')?root+'/public'+s:s.startsWith('/assets/')?root+s:path.isAbsolute(s)?s:root+'/'+s;
 async function add(p,kind){
  const scale=kind==='prop'?(p.scale??1):1;let w=Math.max(1,Math.round(p.width*scale*k)),h=Math.max(1,Math.round(p.height*scale*k));
  if(kind==='ground'){w=Math.round(offset.x+(p.x+p.width)*k)-Math.round(offset.x+p.x*k);h=Math.round(offset.y+(p.y+p.height)*k)-Math.round(offset.y+p.y*k);}
  const anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
  const x=Math.round(offset.x+p.x*k-anchor.x*w),y=Math.round(offset.y+p.y*k-anchor.y*h);
  if(x>=W||y>=H||x+w<=0||y+h<=0)return;
  const key=[source(p.src),w,h,p.flip].join(':');
  let buf=cache.get(key);if(!buf){let im=sharp(source(p.src)).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();buf=await im.png().toBuffer();cache.set(key,buf);}
  const left=Math.max(0,x),top=Math.max(0,y),cw=Math.min(w-Math.max(0,-x),W-left),ch=Math.min(h-Math.max(0,-y),H-top);
  const input=cw===w&&ch===h?buf:await sharp(buf).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).png().toBuffer();
  layers.push({input,left,top});
 }
 const ground=stage==='before'?[{src:out+'/home-dense-work/baseline-ground-full.svg',...before.origin,width:before.width,height:before.height},...P.HOME_TILES.slice(before.tiles.length)]:P.HOME_TILES;
 for(const p of ground)await add(p,'ground');
 for(const p of flats)await add(p,'flat');
 for(const p of decks)await add(p,'deck');
 for(const p of [...props].sort((a,b)=>a.y-b.y))await add(p,'prop');
 const transparent=await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
 if(!crop&&stage==='after')await sharp(transparent).toFile(out+'/home-dense-work/home-built-layers.png');
 await sharp({create:{width:W,height:H,channels:4,background:'#6EC9DE'}}).composite([{input:transparent}]).png().toFile(crop?out+'/home-dense-crops/'+process.env.HOME_CROP_NAME+'.png':out+(process.env.HOME_PRESERVE?'/home-dense-work/preservation-frame.png':stage==='before'?'/home-dense-before.png':'/home-dense.png'));
 if(!crop&&stage==='after')writeFileSync(out+'/home-dense-work/home-built-render.json',JSON.stringify({source:root,world:'rive/web/world.json',walkWorld:'rive/web/walk-world.json',placement:'src/pixi/placements.js',layers:'public/pixi-art and production asset references',width:W,height:H,worldScale:k,offset,projection:1,counts:{ground:P.HOME_TILES.length,flats:flats.length,decks:decks.length,standingAndSleeperLayers:props.length,sleepers:beds.length},note:'Static real-art assembly. No live players, animated water, or procedural harbour overlay. Original SVG art and production placement preserved.'},null,2));
 console.log('Home rendered from production SVG layers, '+layers.length+' layers, '+beds.length+' sleepers.');
} finally {await vite.close();}
