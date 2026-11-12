import {createServer} from 'vite';
import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
const out='../concepts/themes/work/pink/';
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const load=p=>vite.ssrLoadModule(p),P=await load('/src/pixi/placements.js'),{geometry}=await load('/assets/world/island-geometry.mjs');
 const w=P.trimWorld((await load('/assets/world/world.json')).default),a=(await load('/src/pixi/art-manifest.json')).default;
 const props=P.createPlacements(w,geometry({...w,obstacles:[]}).walkable);
 const decals=P.decalsFor(w,props,geometry({...w,obstacles:[]}).walkable);
 const art={...a,width:5800,height:4400,props,flats:[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},{src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},...decals],decks:[...P.JETTIES,{src:'/pixi-art/library-steps.svg',x:2780,y:1370,width:280,height:260}]};
 const local=P.walkWorld(w,props),{sleepHalfWidths}=await load('/src/pixi/sleep-spots.js');
 const beds=P.sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths());
 const poses=JSON.parse(readFileSync('src/pixi/sleep-poses.json'));
 for(const b of beds){const pose=poses.poses[b.pose],u=pose.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=pose.box;
 for(const layer of pose.layers){const src='public'+layer.src,m=await sharp(src).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u,cx=(x0+x1)/2*u;props.push({src,x:b.x,y:b.y,width,height,scale:1,anchor:{x:b.flip?1-cx/width:cx/width,y:y1*u/height},flip:b.flip});}}
 const source=s=>s.startsWith('/pixi')?'public'+s:s.startsWith('/assets')?s.slice(1):s;
 async function render(view,k,name){
 const [ox,oy,cw,ch]=view,W=Math.round(cw*k),H=Math.round(ch*k),comps=[];
 async function add(src,x,y,w,h,flip){let L=Math.round((x-ox)*k),T=Math.round((y-oy)*k),ww=Math.max(1,Math.round(w*k)),hh=Math.max(1,Math.round(h*k));if(L>=W||T>=H||L+ww<=0||T+hh<=0)return;let im=sharp(source(src)).resize(ww,hh,{fit:'fill'});if(flip)im=im.flop();let buf=await im.png().toBuffer();const left=Math.max(0,-L),top=Math.max(0,-T),width=Math.min(ww-left,W-Math.max(0,L)),height=Math.min(hh-top,H-Math.max(0,T));if(left||top||width!==ww||height!==hh)buf=await sharp(buf).extract({left,top,width,height}).png().toBuffer();comps.push({input:buf,left:Math.max(0,L),top:Math.max(0,T)});}
 for(const t of art.ground.tiles)await add(t.src,t.x,t.y,t.width,t.height);
 for(const f of art.flats)await add(f.src,f.x-(f.topLeft?0:f.width/2),f.y-(f.topLeft?0:f.height),f.width,f.height,f.flip);
 for(const d of art.decks)await add(d.src,d.x,d.y,d.width,d.height);
 for(const p of props.sort((a,b)=>a.y-b.y)){const w=p.width*(p.scale??1),h=p.height*(p.scale??1);await add(p.src,p.x-p.anchor.x*w,p.y-p.anchor.y*h,w,h,p.flip);}
 await sharp({create:{width:W,height:H,channels:4,background:'#6EC9DE'}}).composite(comps).png().toFile(out+name+'.png');
 }
 await render([0,0,5800,4400],.25,'home-overview');
 await render([1420,1270,2800,2100],.55,'home-plaza');
 await render([2420,2330,1100,800],1,'home-bench');
 await render([1670,2180,1100,800],1,'home-junction');
 await render([1600,1300,1100,800],1,'home-trees');
 for(const [name,x,y] of [['plaza',2820,2370],['bench',2870,2670],['junction',2250,2780],['trees',2000,2200]])await render([x-1200/1.4,y-900/1.4,1200/.7,900/.7],.7,'home-game-'+name);
 console.log('Home SVG reference render complete');
}finally{await vite.close()}
