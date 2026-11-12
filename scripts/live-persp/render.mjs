import sharp from 'sharp';
import fs from 'node:fs';
import {createServer} from 'vite';
const out='../concepts/themes/work/live-persp/';
const read=p=>JSON.parse(fs.readFileSync(p));
const k=.7,W=1200,H=1050;
async function render(art,source,center) {
  const ox=center[0]-W/k/2,oy=center[1]-H/k/2,comps=[];
  async function add(p,kind) {
    let w=p.width*(p.scale??1),h=p.height*(p.scale??1),x=p.x,y=p.y;
    if(kind==='prop'){x-=(p.anchor?.x??.5)*w;y-=(p.anchor?.y??1)*h;}
    else if(kind==='flat'&&!p.topLeft){x-=w/2;y-=h;}
    const L=Math.round((x-ox)*k),T=Math.round((y-oy)*k),ww=Math.max(1,Math.round(w*k)),hh=Math.max(1,Math.round(h*k));
    if(L>=W||T>=H||L+ww<=0||T+hh<=0)return;
    let im=sharp(source(p.src)).resize(ww,hh,{fit:'fill'});
    if(p.flip)im=im.flop();
    let buf=await im.png().toBuffer();
    const left=Math.max(0,-L),top=Math.max(0,-T),width=Math.min(ww-left,W-Math.max(0,L)),height=Math.min(hh-top,H-Math.max(0,T));
    if(left||top||width!==ww||height!==hh)buf=await sharp(buf).extract({left,top,width,height}).png().toBuffer();
    comps.push({input:buf,left:Math.max(0,L),top:Math.max(0,T)});
  }
  for(const p of art.ground.tiles)await add(p);
  for(const p of art.flats)await add(p,'flat');
  for(const p of art.decks)await add(p);
  for(const p of [...art.props].sort((a,b)=>a.y-b.y))await add(p,'prop');
  return sharp({create:{width:W,height:H,channels:4,background:art.sea??'#6EC9DE'}}).composite(comps).png().toBuffer();
}
const vite=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-live-persp-ssr-cache',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
let home;
try {
  const load=p=>vite.ssrLoadModule(p),P=await load('/src/pixi/placements.js'),{geometry}=await load('/assets/world/island-geometry.mjs');
  const w=P.trimWorld((await load('/assets/world/world.json')).default),manifest=(await load('/src/pixi/art-manifest.json')).default;
  const geo=geometry({...w,obstacles:[]}),props=P.createPlacements(w,geo.walkable),flats=P.decalsFor(w,props,geo.walkable);
  home=await render({...manifest,props,flats:[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},{src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},...flats],decks:[...P.JETTIES,{src:'/pixi-art/library-steps.svg',x:2780,y:1370,width:280,height:260}]},s=>s.startsWith('/pixi')?'public'+s:s.startsWith('/assets')?s.slice(1):s,[2900,1450]);
} finally {await vite.close();}
const title=t=>Buffer.from(`<svg width="1200" height="70"><rect width="1200" height="70" fill="#FFF0C7"/><text x="24" y="30" font-family="sans-serif" font-size="23" fill="#39452F">${t}</text><text x="24" y="55" font-family="sans-serif" font-size="16" fill="#39452F">Static SVG placements, game zoom 0.7, default tilt 1, no panel resizing</text></svg>`);
for(const [theme,center] of [['pink',[4000,2500]],['waterfall',[3900,3620]],['fair',[3570,2737.5]]]) {
  const base=`public/pixi-art/themes/${theme}/`,source=s=>s.startsWith('/')?'public'+s:base+s;
  const oldSource=s=>s.startsWith('centre/')?out+'before/'+base+s:source(s);
  const before=await render(read(out+'before/'+base+'art.json'),oldSource,center);
  const after=await render(read(base+'art.json'),source,center);
  const comps=[];
  for(const [i,[label,buf]] of [[`${theme}: live baseline`,before],[`${theme}: centre perspective restored`,after],['Home museum steps reference',home]].entries()) {
    comps.push({input:title(label),left:i*W,top:0},{input:buf,left:i*W,top:70});
  }
  await sharp({create:{width:W*3,height:H+70,channels:4,background:'#FFF0C7'}}).composite(comps).png().toFile(out+theme+'.png');
  await sharp(before).toFile(out+theme+'-before.png');
  await sharp(after).toFile(out+theme+'-after.png');
  console.log('Saved',theme+'.png');
}
