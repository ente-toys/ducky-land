// Read-only assembly of Home's production SVG layers. No game files are written.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const out=process.env.HOME_REVIEW_OUT || '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/sleepers';
mkdirSync(out+'/close',{recursive:true});
const require=createRequire(root+'/package.json');
const sharp=require('sharp');
const {createServer}=await import(require.resolve('vite'));
const vite=await createServer({root,configFile:false,cacheDir:'/private/tmp/ducky-home-pilot-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
const views=[
 ['whole',[-2622.222222222222,-2036.111111111111,11000,8250],.30],
 ['01-plaza-fountain',[2050,1740,1650,1350],.85],
 ['02-pond-west-lawn',[700,2080,2100,1550],.75],
 ['03-duck-lighthouse-beach',[4110,1850,1900,1650],.8],
 ['04-harbour-reedwhistle',[3000,4200,2500,1900],.7],
 ['05-river-bridges-south-lawn',[1600,3030,2350,2050],.7],
 ['06-butterbill',[-1930,-440,2350,1800],.75],
 ['07-lanternleaf',[1740,-1260,2350,1800],.75],
 ['08-clovercrust',[3860,-1050,2350,1800],.75],
 ['09-petalpatch',[-2120,2820,2350,1800],.75],
 ['10-east-coast-empty-lawns',[5650,1640,2200,2150],.7],
 ['11-northwest-groves',[-1550,-1250,2600,1700],.8],
 ['12-north-ridge',[1250,-1650,3900,1550],.7],
 ['13-east-upland',[5600,-850,2400,2450],.7],
 ['14-west-commons',[-2150,650,2500,2600],.7],
 ['15-southwest-groves',[-1700,4150,2700,1700],.8],
 ['16-south-coast',[1300,4320,2500,1600],.8],
 ['17-southeast-groves',[5100,3650,2500,1800],.8],
];
try {
 const load=p=>vite.ssrLoadModule(p);
 const P=await load('/src/pixi/placements.js');
 const {geometry}=await load('/rive/web/island-geometry.mjs');
 const world=P.trimWorld(JSON.parse(readFileSync(root+'/rive/web/world.json')));
 const art=JSON.parse(readFileSync(root+'/src/pixi/art-manifest.json'));
 const props=P.createPlacements(world,geometry({...world,obstacles:[]}).walkable);
 const local=P.walkWorld(world,props);
 const oldLand=geometry({...world,obstacles:[]}).walkable,grownLand={...world,coast:local.coast};
 const flats=[{src:'/pixi-art/lake-race.svg',x:3400,y:1050,width:1500,height:950,topLeft:true},
 {src:'/pixi-art/decals/plaza-paving.svg',x:2330,y:1980,width:980,height:780,topLeft:true},
 ...P.homeDecals(props),...P.HOME_GROUND_DECALS];
 const decks=[...P.JETTIES,{src:'/pixi-art/library-steps.svg',x:2780,y:1370,width:280,height:260},...P.HOME_DECKS];
 const grounded=props.slice();
 const {sleepHalfWidths}=await load('/src/pixi/sleep-spots.js');
 const beds=P.sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths());
 const sleeperShadows=[];
 for(const [i,b] of beds.slice(40).entries())views.push([`sleeper-${String(i+41).padStart(2,'0')}-${b.pose}`,[b.x-230,b.y-250,460,370],1]);
 const poses=JSON.parse(readFileSync(root+'/src/pixi/sleep-poses.json'));
 for(const b of beds){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
  for(const l of p.layers){const src=root+'/public'+l.src,m=await sharp(src).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;
   if(l.id!=='zz')sleeperShadows.push({src,x:b.x,y:b.y+3*.81*(.88*.24*3)/3,width,height:height*.3,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height},flip:b.flip,shadow:true});
   props.push({src,x:b.x,y:b.y,width,height,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height},flip:b.flip});}}
 writeFileSync(out+'/placements.json',JSON.stringify({props:grounded,flats,decks,sleepers:beds,tiles:P.HOME_TILES,floating:art.floating},null,2));
 writeFileSync(out+'/views.json',JSON.stringify(views.map(([name,view,scale])=>({file:name==='whole'?'whole.png':'close/'+name+'.png',view,scale,standingDuckPixels:130*scale})),null,2));
 for(const [name,view,k] of views){
 const [ox,oy,cw,ch]=view,W=Math.round(cw*k),H=Math.round(ch*k),offset={x:-ox*k,y:-oy*k};
 const layers=[],cache=new Map();
 const source=s=>s.startsWith('/pixi-art/')?root+'/public'+s:s.startsWith('/assets/')?root+s:path.isAbsolute(s)?s:root+'/'+s;
 async function add(p,kind){
  const scale=kind==='prop'?(p.scale??1):1;let w=Math.max(1,Math.round(p.width*scale*k)),h=Math.max(1,Math.round(p.height*scale*k));
  if(kind==='ground'){w=Math.round(offset.x+(p.x+p.width+(p.bleed??0))*k)-Math.round(offset.x+p.x*k);h=Math.round(offset.y+(p.y+p.height+(p.bleed??0))*k)-Math.round(offset.y+p.y*k);}
  const anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
  const x=Math.round(offset.x+p.x*k-anchor.x*w),y=Math.round(offset.y+p.y*k-anchor.y*h);
  if(x>=W||y>=H||x+w<=0||y+h<=0)return;
  const key=[source(p.src),w,h,p.flip,p.shadow].join(':');
  let buf=cache.get(key);if(!buf){let im=sharp(source(p.src)).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();if(p.tint&&kind==='prop'){const c=p.tint;im=im.linear([(c>>16&255)/255,(c>>8&255)/255,(c&255)/255,1],[0,0,0,0]);}if(p.shadow)im=im.ensureAlpha().linear([0,0,0,.07],[0,0,0,0]);buf=await im.png().toBuffer();cache.set(key,buf);}
  const left=Math.max(0,x),top=Math.max(0,y),cw=Math.min(w-Math.max(0,-x),W-left),ch=Math.min(h-Math.max(0,-y),H-top);
  const input=cw===w&&ch===h?buf:await sharp(buf).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).png().toBuffer();
  layers.push({input,left,top});
 }
 for(const p of P.HOME_TILES)await add(p,'ground');
 for(const p of flats)await add(p,'flat');
 for(const p of art.floating??[])await add({...p,scale:1},'prop');
 for(const p of decks)await add(p,'deck');
 // Match engine.js contactShadow, including explicit footprint overrides and ground tint.
 const patterns=[[/bench-wood-(left|right)/,.1,2.4],[/fountain/,.25,.82],[/^tree-/,.3,.3],[/^(bush|flower)-/,.4,.32],[/lamp|pole/,.4,.34],[/lighthouse/,.3,.32],[/umbrella/,.32,.4],[/library/,.44,.26],[/boat/,.36,.3]];
 for(const p of grounded){const n=p.asset||p.name||'';if(/bunting|banner|flag|bridge|blanket|lily|shell|reeds/i.test(n)||p.noShadow)continue;
 const [,share,depth]=patterns.find(([re])=>re.test(n))??[null,.38,.3];
 const r=Math.max(8,Math.min(300,p.width*(p.scale??1)*share)),[rx,ry]=p.shadowSize??[r,r*depth];
 const nudge=Math.min(1,rx/80)*.15*130/Math.hypot(2,1),cx=p.x+(p.shadowOffset?.[0]??nudge*2),cy=p.y+(p.shadowOffset?.[1]??nudge);
 const ground=/boat/i.test(n)?'water':P.groundAt(p.x,p.y,world),[color,alpha]=({sand:['#E4C567',.18],grass:['#2B7A37',.15],water:['#39472D',.12]})[ground];
 const x=Math.round(offset.x+(cx-rx)*k),y=Math.round(offset.y+(cy-ry)*k),w=Math.max(1,Math.round(rx*2*k)),h=Math.max(1,Math.round(ry*2*k));
 if(x<0||y<0||x+w>W||y+h>H)continue;
 layers.push({input:Buffer.from(`<svg width="${w}" height="${h}"><ellipse cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" fill="${color}" opacity="${alpha}"/></svg>`),left:x,top:y});
 }
 for(const p of sleeperShadows)await add(p,'prop');
 for(const p of [...props].filter(p=>/bridge/i.test(p.asset||p.name||'')).sort((a,b)=>(a.z??a.y)-(b.z??b.y)))await add(p,'prop');
 for(const p of [...props].filter(p=>!/bridge/i.test(p.asset||p.name||'')).sort((a,b)=>(a.z??a.y)-(b.z??b.y)))await add(p,'prop');
 const file=out+(name==='whole'?'/whole.png':'/close/'+name+'.png');
 await sharp({create:{width:W,height:H,channels:4,background:'#6EC9DE'}}).composite(layers).png().toFile(file);
 console.log(name+': '+W+'x'+H+', '+layers.length+' layers, '+beds.length+' sleepers');
 }
 writeFileSync(out+'/render-provenance.json',JSON.stringify({root,adaptedFrom:'scripts/bigger-home-2/render.mjs',views:views.length,ground:P.HOME_TILES.length,flats:flats.length,decks:decks.length,props:grounded.length,sleepers:beds.length,note:'Production SVG assembly, engine-equivalent prop and sleeper contact shadows, tints, z-order, floating objects and HOME_GROUND_DECALS. No live players, animated water, procedural harbour overlay, ocean texture or UI. No game files written.'},null,2));
} finally {await vite.close();}
